/**
 * SMS Screening Link Service
 * Handles secure link generation, validation, and screening workflow management
 */

import { db } from "../db";
import { smsScreeningLinks, smsConversations } from "@shared/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { createHash } from "crypto";
import { nanoid } from "nanoid";

/**
 * Configuration constants
 */
const LINK_EXPIRY_HOURS = 24;
const MAX_LINKS_PER_DAY = 3;
const TOKEN_LENGTH = 12; // Short but secure
const BASE_URL = process.env.VITE_PUBLIC_URL || 'http://localhost:5000';

/**
 * Hash phone number for privacy
 */
export function hashPhoneNumber(phoneNumber: string): string {
  // Normalize phone number to E.164 format
  const normalized = phoneNumber.replace(/\D/g, '');
  const e164 = normalized.startsWith('1') ? `+${normalized}` : `+1${normalized}`;
  
  // Create SHA-256 hash
  return createHash('sha256')
    .update(e164 + (process.env.PHONE_HASH_SALT || 'default-salt'))
    .digest('hex');
}

/**
 * Generate secure screening link
 */
export async function generateScreeningLink(
  phoneNumber: string,
  tenantId: string,
  conversationId?: string,
  metadata?: any
): Promise<{
  success: boolean;
  token?: string;
  fullUrl?: string;
  shortUrl?: string;
  expiresAt?: Date;
  error?: string;
}> {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check rate limiting - max 3 links per phone per day
    const existingLinksToday = await db.query.smsScreeningLinks.findMany({
      where: and(
        eq(smsScreeningLinks.phoneHash, phoneHash),
        gte(smsScreeningLinks.createdAt, today)
      )
    });
    
    if (existingLinksToday.length >= MAX_LINKS_PER_DAY) {
      return {
        success: false,
        error: 'Daily link limit reached. Please try again tomorrow.'
      };
    }
    
    // Check for active unexpired link
    const activeLink = await db.query.smsScreeningLinks.findFirst({
      where: and(
        eq(smsScreeningLinks.phoneHash, phoneHash),
        eq(smsScreeningLinks.status, 'pending'),
        gte(smsScreeningLinks.expiresAt, new Date())
      ),
      orderBy: (links, { desc }) => [desc(links.createdAt)]
    });
    
    if (activeLink) {
      // Return existing active link
      return {
        success: true,
        token: activeLink.token,
        fullUrl: activeLink.fullUrl,
        shortUrl: activeLink.shortUrl || undefined,
        expiresAt: activeLink.expiresAt
      };
    }
    
    // Generate new link
    const token = nanoid(TOKEN_LENGTH);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + LINK_EXPIRY_HOURS);
    
    const fullUrl = `${BASE_URL}/screening/${token}`;
    const shortUrl = `${BASE_URL}/s/${token}`; // Short URL for SMS
    
    // Save to database
    const [newLink] = await db.insert(smsScreeningLinks).values({
      token,
      phoneHash,
      tenantId,
      conversationId,
      fullUrl,
      shortUrl,
      expiresAt,
      status: 'pending',
      maxUsage: 1, // One-time use by default
      captchaRequired: true,
      dailyLinkCount: existingLinksToday.length + 1,
      lastGeneratedDate: today,
      metadata
    }).returning();
    
    return {
      success: true,
      token: newLink.token,
      fullUrl: newLink.fullUrl,
      shortUrl: newLink.shortUrl || undefined,
      expiresAt: newLink.expiresAt
    };
  } catch (error) {
    console.error('❌ Error generating screening link:', error);
    return {
      success: false,
      error: 'Failed to generate screening link'
    };
  }
}

/**
 * Validate screening link token
 */
export async function validateScreeningLink(
  token: string,
  ipAddress?: string
): Promise<{
  valid: boolean;
  link?: any;
  error?: string;
}> {
  try {
    const link = await db.query.smsScreeningLinks.findFirst({
      where: eq(smsScreeningLinks.token, token)
    });
    
    if (!link) {
      return {
        valid: false,
        error: 'Invalid or expired link'
      };
    }
    
    // Check expiration
    if (link.expiresAt < new Date()) {
      await db.update(smsScreeningLinks)
        .set({ status: 'expired' })
        .where(eq(smsScreeningLinks.id, link.id));
      
      return {
        valid: false,
        error: 'This screening link has expired. Please text START to get a new link.'
      };
    }
    
    // Check usage count
    if (link.usageCount >= link.maxUsage) {
      return {
        valid: false,
        error: 'This link has already been used. Please text START for a new link.'
      };
    }
    
    // Check IP restriction if configured
    if (link.ipRestriction && ipAddress && !link.ipRestriction.includes(ipAddress)) {
      return {
        valid: false,
        error: 'Access denied from this location'
      };
    }
    
    // Update access tracking
    await db.update(smsScreeningLinks)
      .set({
        lastAccessedAt: new Date(),
        lastAccessIp: ipAddress,
        status: link.status === 'pending' ? 'accessed' : link.status
      })
      .where(eq(smsScreeningLinks.id, link.id));
    
    return {
      valid: true,
      link
    };
  } catch (error) {
    console.error('❌ Error validating screening link:', error);
    return {
      valid: false,
      error: 'Failed to validate link'
    };
  }
}

/**
 * Save screening progress
 */
export async function saveScreeningProgress(
  token: string,
  screeningData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const link = await db.query.smsScreeningLinks.findFirst({
      where: eq(smsScreeningLinks.token, token)
    });
    
    if (!link || link.status === 'expired') {
      return {
        success: false,
        error: 'Invalid or expired link'
      };
    }
    
    await db.update(smsScreeningLinks)
      .set({
        screeningData,
        updatedAt: new Date()
      })
      .where(eq(smsScreeningLinks.id, link.id));
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error saving screening progress:', error);
    return {
      success: false,
      error: 'Failed to save progress'
    };
  }
}

/**
 * Complete screening
 */
export async function completeScreening(
  token: string,
  completionData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const link = await db.query.smsScreeningLinks.findFirst({
      where: eq(smsScreeningLinks.token, token)
    });
    
    if (!link || link.status === 'expired') {
      return {
        success: false,
        error: 'Invalid or expired link'
      };
    }
    
    // Mark as used
    await db.update(smsScreeningLinks)
      .set({
        status: 'used',
        completedAt: new Date(),
        completionData,
        usageCount: link.usageCount + 1,
        updatedAt: new Date()
      })
      .where(eq(smsScreeningLinks.id, link.id));
    
    // Update conversation if linked
    if (link.conversationId) {
      await db.update(smsConversations)
        .set({
          state: 'completed',
          completedAt: new Date(),
          context: sql`jsonb_set(context, '{screeningCompleted}', 'true'::jsonb)`
        })
        .where(eq(smsConversations.id, link.conversationId));
    }
    
    // TODO: Trigger navigator notification
    // await notifyNavigator(completionData);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error completing screening:', error);
    return {
      success: false,
      error: 'Failed to complete screening'
    };
  }
}

/**
 * Get screening status by phone hash
 */
export async function getScreeningStatus(
  phoneNumber: string
): Promise<{
  hasActiveLink: boolean;
  hasCompletedScreening: boolean;
  lastScreeningDate?: Date;
  activeLink?: any;
}> {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    // Find most recent link
    const recentLink = await db.query.smsScreeningLinks.findFirst({
      where: eq(smsScreeningLinks.phoneHash, phoneHash),
      orderBy: (links, { desc }) => [desc(links.createdAt)]
    });
    
    if (!recentLink) {
      return {
        hasActiveLink: false,
        hasCompletedScreening: false
      };
    }
    
    const hasActiveLink = recentLink.status === 'pending' && 
                         recentLink.expiresAt > new Date();
    
    const hasCompletedScreening = recentLink.status === 'used' && 
                                  !!recentLink.completedAt;
    
    return {
      hasActiveLink,
      hasCompletedScreening,
      lastScreeningDate: recentLink.completedAt || recentLink.createdAt,
      activeLink: hasActiveLink ? recentLink : undefined
    };
  } catch (error) {
    console.error('❌ Error getting screening status:', error);
    return {
      hasActiveLink: false,
      hasCompletedScreening: false
    };
  }
}

/**
 * Clean up expired links (for scheduled job)
 */
export async function cleanupExpiredLinks(): Promise<number> {
  try {
    const result = await db.update(smsScreeningLinks)
      .set({ status: 'expired' })
      .where(and(
        eq(smsScreeningLinks.status, 'pending'),
        lte(smsScreeningLinks.expiresAt, new Date())
      ));
    
    console.log(`🧹 Cleaned up expired screening links`);
    return 0; // Return count if needed
  } catch (error) {
    console.error('❌ Error cleaning up expired links:', error);
    return 0;
  }
}

/**
 * Delete old screening data (90-day retention policy)
 */
export async function deleteOldScreeningData(): Promise<number> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // First, anonymize the data
    await db.update(smsScreeningLinks)
      .set({
        screeningData: null,
        completionData: null,
        metadata: null,
        lastAccessIp: null
      })
      .where(lte(smsScreeningLinks.createdAt, ninetyDaysAgo));
    
    console.log(`🧹 Deleted screening data older than 90 days`);
    return 0;
  } catch (error) {
    console.error('❌ Error deleting old screening data:', error);
    return 0;
  }
}

/**
 * Generate analytics for screening links
 */
export async function getScreeningLinkAnalytics(
  tenantId: string,
  days: number = 30
): Promise<{
  totalGenerated: number;
  totalCompleted: number;
  conversionRate: number;
  averageCompletionTime: number;
  byStatus: Record<string, number>;
}> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const links = await db.query.smsScreeningLinks.findMany({
      where: and(
        eq(smsScreeningLinks.tenantId, tenantId),
        gte(smsScreeningLinks.createdAt, since)
      )
    });
    
    const totalGenerated = links.length;
    const totalCompleted = links.filter(l => l.status === 'used').length;
    
    // Calculate average completion time
    const completionTimes = links
      .filter(l => l.completedAt && l.createdAt)
      .map(l => l.completedAt!.getTime() - l.createdAt.getTime());
    
    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;
    
    // Group by status
    const byStatus = links.reduce((acc, link) => {
      acc[link.status] = (acc[link.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalGenerated,
      totalCompleted,
      conversionRate: totalGenerated > 0 ? (totalCompleted / totalGenerated) * 100 : 0,
      averageCompletionTime: averageCompletionTime / 1000 / 60, // Convert to minutes
      byStatus
    };
  } catch (error) {
    console.error('❌ Error getting screening analytics:', error);
    return {
      totalGenerated: 0,
      totalCompleted: 0,
      conversionRate: 0,
      averageCompletionTime: 0,
      byStatus: {}
    };
  }
}