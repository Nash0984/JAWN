import { db } from "../db";
import { apiKeys, apiUsageLogs, type ApiKey, type InsertApiKey } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * API Key Service - Manages third-party API access
 * 
 * Features:
 * - Generate API keys with scopes and rate limits
 * - Validate API key authentication
 * - Track usage and enforce rate limits
 * - Revoke/suspend keys
 */
class ApiKeyService {
  
  /**
   * Generate a new API key
   * @param organizationName - Name of the organization
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param scopes - Array of permission scopes
   * @param rateLimit - Requests per hour (default: 1000)
   * @param expiresAt - Optional expiration date
   * @param createdBy - User ID who created the key
   * @returns Object with readable key and API key record
   */
  async generateApiKey(
    organizationName: string,
    tenantId: string,
    scopes: string[],
    rateLimit: number = 1000,
    expiresAt?: Date,
    createdBy?: string
  ): Promise<{ readableKey: string; apiKey: ApiKey }> {
    // Generate a random 32-byte API key
    const readableKey = `md_${crypto.randomBytes(32).toString('hex')}`;
    
    // Hash the API key for secure storage (like passwords)
    const hashedKey = await bcrypt.hash(readableKey, 10);
    
    // Insert into database
    const [apiKey] = await db.insert(apiKeys).values({
      key: hashedKey,
      name: organizationName,
      tenantId,
      scopes,
      rateLimit,
      expiresAt,
      createdBy,
      status: 'active',
    }).returning();
    
    return {
      readableKey, // Return this to user ONCE (they must save it)
      apiKey,
    };
  }
  
  /**
   * Validate an API key and return key details
   * @param providedKey - The API key from request header
   * @returns API key record if valid, null otherwise
   */
  async validateApiKey(providedKey: string): Promise<ApiKey | null> {
    // Get all active API keys (we need to check hash against all)
    const allKeys = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.status, 'active'));
    
    // Find the key by comparing hashes
    for (const key of allKeys) {
      const isValid = await bcrypt.compare(providedKey, key.key);
      if (isValid) {
        // Check expiration
        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
          return null; // Key expired
        }
        return key;
      }
    }
    
    return null;
  }
  
  /**
   * Check if API key has required scope
   * @param apiKey - API key record
   * @param requiredScope - Required scope (e.g., 'eligibility:read')
   * @returns true if has scope, false otherwise
   */
  hasScope(apiKey: ApiKey, requiredScope: string): boolean {
    const scopes = apiKey.scopes as string[];
    
    // Check for exact match or wildcard
    return scopes.includes(requiredScope) || scopes.includes('*');
  }
  
  /**
   * Check rate limit for API key
   * @param apiKeyId - API key ID
   * @returns Object with rate limit status
   */
  async checkRateLimit(apiKeyId: string): Promise<{
    allowed: boolean;
    limit: number;
    current: number;
    resetAt: Date;
  }> {
    // Get API key details
    const [apiKey] = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId));
    
    if (!apiKey) {
      return { allowed: false, limit: 0, current: 0, resetAt: new Date() };
    }
    
    // Count requests in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(apiUsageLogs)
      .where(
        and(
          eq(apiUsageLogs.apiKeyId, apiKeyId),
          gte(apiUsageLogs.createdAt, oneHourAgo)
        )
      );
    
    const currentUsage = result?.count || 0;
    const resetAt = new Date(Date.now() + 60 * 60 * 1000);
    
    return {
      allowed: currentUsage < apiKey.rateLimit,
      limit: apiKey.rateLimit,
      current: currentUsage,
      resetAt,
    };
  }
  
  /**
   * Track API usage
   * @param apiKeyId - API key ID
   * @param endpoint - API endpoint called
   * @param method - HTTP method
   * @param statusCode - Response status code
   * @param responseTime - Response time in ms
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   * @param errorMessage - Error message if failed
   * @param metadata - Additional metadata
   */
  async trackUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime?: number,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    // Log usage
    await db.insert(apiUsageLogs).values({
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTime,
      ipAddress,
      userAgent,
      errorMessage,
      metadata,
    });
    
    // Update last used timestamp and request count
    await db.update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        requestCount: sql`${apiKeys.requestCount} + 1`,
      })
      .where(eq(apiKeys.id, apiKeyId));
  }
  
  /**
   * Revoke an API key
   * @param apiKeyId - API key ID
   * @param revokedBy - User ID who revoked the key
   */
  async revokeApiKey(apiKeyId: string, revokedBy?: string): Promise<void> {
    await db.update(apiKeys)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy,
      })
      .where(eq(apiKeys.id, apiKeyId));
  }
  
  /**
   * Suspend an API key (can be reactivated later)
   * @param apiKeyId - API key ID
   */
  async suspendApiKey(apiKeyId: string): Promise<void> {
    await db.update(apiKeys)
      .set({ status: 'suspended' })
      .where(eq(apiKeys.id, apiKeyId));
  }
  
  /**
   * Reactivate a suspended API key
   * @param apiKeyId - API key ID
   */
  async reactivateApiKey(apiKeyId: string): Promise<void> {
    await db.update(apiKeys)
      .set({ status: 'active' })
      .where(eq(apiKeys.id, apiKeyId));
  }
  
  /**
   * Get API keys for a tenant
   * @param tenantId - Tenant ID
   * @returns Array of API keys
   */
  async getApiKeysByTenant(tenantId: string): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId))
      .orderBy(desc(apiKeys.createdAt));
  }
  
  /**
   * Get usage statistics for an API key
   * @param apiKeyId - API key ID
   * @param days - Number of days to look back (default: 30)
   * @returns Usage statistics
   */
  async getUsageStats(apiKeyId: string, days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const stats = await db.select({
      totalRequests: sql<number>`count(*)::int`,
      successRequests: sql<number>`count(*) filter (where ${apiUsageLogs.statusCode} < 400)::int`,
      errorRequests: sql<number>`count(*) filter (where ${apiUsageLogs.statusCode} >= 400)::int`,
      avgResponseTime: sql<number>`avg(${apiUsageLogs.responseTime})::int`,
    })
    .from(apiUsageLogs)
    .where(
      and(
        eq(apiUsageLogs.apiKeyId, apiKeyId),
        gte(apiUsageLogs.createdAt, startDate)
      )
    );
    
    return stats[0] || {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgResponseTime: 0,
    };
  }
}

export const apiKeyService = new ApiKeyService();
