/**
 * SMS Service
 * Core service for sending/receiving SMS messages via Twilio
 * Handles conversation management and message routing
 */

import { db } from "../db";
import { smsConversations, smsMessages, smsTenantConfig } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getTwilioClient, isTwilioConfigured } from "./twilioConfig";
import { processConversationMessage } from "./smsConversationEngine";
import { smsTemplates, formatPhoneE164 } from "../templates/smsTemplates";

/**
 * Send SMS message via Twilio
 */
export async function sendSMS(
  to: string,
  body: string,
  tenantId: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const twilioClient = getTwilioClient();
  
  if (!twilioClient) {
    console.warn('⚠️  SMS send failed: Twilio not configured');
    return { success: false, error: 'Twilio not configured' };
  }
  
  try {
    // Get tenant's Twilio phone number
    const tenantConfig = await db.query.smsTenantConfig.findFirst({
      where: eq(smsTenantConfig.tenantId, tenantId)
    });
    
    if (!tenantConfig || !tenantConfig.isActive) {
      console.warn(`⚠️  SMS send failed: No active Twilio number for tenant ${tenantId}`);
      return { success: false, error: 'No Twilio number configured for tenant' };
    }
    
    // Format phone numbers
    const fromNumber = tenantConfig.twilioPhoneNumber;
    const toNumber = formatPhoneE164(to);
    
    // Send via Twilio
    const message = await twilioClient.messages.create({
      body,
      from: fromNumber,
      to: toNumber
    });
    
    console.log(`📤 SMS sent to ${toNumber}: ${message.sid}`);
    
    return {
      success: true,
      sid: message.sid
    };
  } catch (error: any) {
    console.error('❌ Error sending SMS:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Handle incoming SMS message from Twilio webhook
 */
export async function handleIncomingMessage(
  from: string,
  body: string,
  twilioPhoneNumber: string
): Promise<{ response: string; conversationId?: string }> {
  try {
    // Find tenant by Twilio phone number
    const tenantConfig = await db.query.smsTenantConfig.findFirst({
      where: and(
        eq(smsTenantConfig.twilioPhoneNumber, twilioPhoneNumber),
        eq(smsTenantConfig.isActive, true)
      )
    });
    
    if (!tenantConfig) {
      console.warn(`⚠️  No tenant found for Twilio number: ${twilioPhoneNumber}`);
      return { response: 'Service not available for this number.' };
    }
    
    const tenantId = tenantConfig.tenantId;
    const phoneNumber = formatPhoneE164(from);
    
    // Parse user intent from message
    const intent = parseUserIntent(body);
    
    // Get or create conversation
    const conversation = await getOrCreateConversation(phoneNumber, tenantId, intent);
    
    // Save incoming message
    await db.insert(smsMessages).values({
      conversationId: conversation.id,
      direction: 'inbound',
      messageBody: body,
      status: 'received'
    });
    
    // Process message through conversation engine
    const result = await processConversationMessage(
      {
        id: conversation.id,
        tenantId: conversation.tenantId,
        phoneNumber: conversation.phoneNumber,
        sessionType: conversation.sessionType,
        state: conversation.state,
        context: conversation.context as any || {}
      },
      body
    );
    
    // Update conversation state
    await db.update(smsConversations)
      .set({
        state: result.newState,
        context: result.newContext,
        lastMessageAt: new Date(),
        ...(result.newState === 'completed' ? { completedAt: new Date() } : {})
      })
      .where(eq(smsConversations.id, conversation.id));
    
    // Save outbound message
    const sendResult = await sendSMS(phoneNumber, result.response, tenantId);
    
    await db.insert(smsMessages).values({
      conversationId: conversation.id,
      direction: 'outbound',
      messageBody: result.response,
      twilioSid: sendResult.sid,
      status: sendResult.success ? 'sent' : 'failed'
    });
    
    return {
      response: result.response,
      conversationId: conversation.id
    };
  } catch (error) {
    console.error('❌ Error handling incoming SMS:', error);
    return { response: smsTemplates.error() };
  }
}

/**
 * Get existing conversation or create new one
 */
export async function getOrCreateConversation(
  phoneNumber: string,
  tenantId: string,
  sessionType?: string
): Promise<any> {
  const formattedPhone = formatPhoneE164(phoneNumber);
  
  // Look for active conversation (not completed/stopped)
  const existingConversation = await db.query.smsConversations.findFirst({
    where: and(
      eq(smsConversations.phoneNumber, formattedPhone),
      eq(smsConversations.tenantId, tenantId)
    ),
    orderBy: [desc(smsConversations.createdAt)]
  });
  
  // Return if conversation is active
  if (existingConversation && !['completed', 'stopped', 'abandoned'].includes(existingConversation.state)) {
    return existingConversation;
  }
  
  // Create new conversation
  const newConversation = await db.insert(smsConversations).values({
    phoneNumber: formattedPhone,
    tenantId,
    sessionType: sessionType || 'general_inquiry',
    state: 'started',
    context: {}
  }).returning();
  
  return newConversation[0];
}

/**
 * Parse user intent from message
 */
export function parseUserIntent(message: string): string {
  const upperMessage = message.toUpperCase().trim();
  
  // Keyword mapping
  const intentMap: Record<string, string> = {
    'SNAP': 'screener',
    'FOOD': 'screener',
    'BENEFITS': 'screener',
    'TAX': 'intake',
    'VITA': 'intake',
    'DOCUMENT': 'document_help',
    'DOCUMENTS': 'document_help',
    'HELP': 'general_inquiry',
    'INFO': 'general_inquiry',
    'QUESTION': 'general_inquiry'
  };
  
  // Check for exact keyword matches
  for (const [keyword, intent] of Object.entries(intentMap)) {
    if (upperMessage.includes(keyword)) {
      return intent;
    }
  }
  
  // Default to general inquiry
  return 'general_inquiry';
}

/**
 * Update message delivery status (from Twilio webhook)
 */
export async function updateMessageStatus(
  twilioSid: string,
  status: string
): Promise<void> {
  try {
    await db.update(smsMessages)
      .set({ status })
      .where(eq(smsMessages.twilioSid, twilioSid));
    
    console.log(`📊 Message ${twilioSid} status updated to: ${status}`);
  } catch (error) {
    console.error('❌ Error updating message status:', error);
  }
}

/**
 * Get conversation statistics for analytics
 */
export async function getConversationStats(tenantId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  try {
    const conversations = await db.query.smsConversations.findMany({
      where: and(
        eq(smsConversations.tenantId, tenantId)
      )
    });
    
    const total = conversations.length;
    const completed = conversations.filter(c => c.state === 'completed').length;
    const abandoned = conversations.filter(c => c.state === 'abandoned').length;
    const active = conversations.filter(c => !['completed', 'stopped', 'abandoned'].includes(c.state)).length;
    
    const byType = conversations.reduce((acc, c) => {
      acc[c.sessionType] = (acc[c.sessionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total,
      completed,
      abandoned,
      active,
      completionRate: total > 0 ? (completed / total * 100).toFixed(1) : '0',
      byType
    };
  } catch (error) {
    console.error('❌ Error getting conversation stats:', error);
    return {
      total: 0,
      completed: 0,
      abandoned: 0,
      active: 0,
      completionRate: '0',
      byType: {}
    };
  }
}

/**
 * Check if SMS is enabled for a tenant
 */
export async function isSmsEnabledForTenant(tenantId: string): Promise<boolean> {
  if (!isTwilioConfigured()) {
    return false;
  }
  
  try {
    const config = await db.query.smsTenantConfig.findFirst({
      where: and(
        eq(smsTenantConfig.tenantId, tenantId),
        eq(smsTenantConfig.isActive, true)
      )
    });
    
    return !!config;
  } catch (error) {
    return false;
  }
}
