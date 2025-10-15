/**
 * Webhook Service
 * General webhook delivery system with signature verification and retry logic
 */

import { storage } from "../storage";
import crypto from "crypto";
import type { Webhook, InsertWebhookDeliveryLog } from "@shared/schema";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

interface DeliveryResult {
  success: boolean;
  httpStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  responseTime?: number;
  errorMessage?: string;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  attemptNumber: number = 1
): Promise<DeliveryResult> {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, webhook.secret);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": payload.event,
        "X-Webhook-Timestamp": payload.timestamp,
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text();
    
    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      success: response.ok,
      httpStatus: response.status,
      responseBody,
      responseHeaders,
      responseTime,
      errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${responseBody}`,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      success: false,
      responseTime,
      errorMessage: error.message || "Unknown error occurred",
    };
  }
}

/**
 * Calculate exponential backoff delay in milliseconds
 */
function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s, etc.)
  return Math.pow(2, attemptNumber - 1) * 1000;
}

/**
 * Trigger webhook delivery with retry logic
 */
export async function triggerWebhook(
  webhookId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  const webhook = await storage.getWebhook(webhookId);
  
  if (!webhook) {
    console.error(`Webhook ${webhookId} not found`);
    return;
  }

  // Check if webhook is active
  if (webhook.status !== "active") {
    console.log(`Webhook ${webhookId} is ${webhook.status}, skipping delivery`);
    return;
  }

  // Check if webhook is subscribed to this event
  if (!webhook.events.includes(eventType)) {
    console.log(`Webhook ${webhookId} not subscribed to event ${eventType}`);
    return;
  }

  const payload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: eventData,
  };

  // Attempt delivery with retries
  let lastResult: DeliveryResult | null = null;
  
  for (let attempt = 1; attempt <= webhook.maxRetries + 1; attempt++) {
    const result = await deliverWebhook(webhook, payload, attempt);
    lastResult = result;

    // Log delivery attempt
    const deliveryLog: InsertWebhookDeliveryLog = {
      webhookId: webhook.id,
      eventType,
      payload: payload.data,
      attemptNumber: attempt,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      responseHeaders: result.responseHeaders,
      deliveredAt: new Date(),
      responseTime: result.responseTime,
      status: result.success ? "success" : "failed",
      errorMessage: result.errorMessage,
    };

    await storage.createWebhookDeliveryLog(deliveryLog);

    // If successful, update webhook and break
    if (result.success) {
      await storage.updateWebhook(webhook.id, {
        lastTriggeredAt: new Date(),
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: "success",
        lastResponse: {
          status: result.httpStatus,
          body: result.responseBody,
          headers: result.responseHeaders,
        },
        retryCount: 0,
        failureCount: 0,
      });
      
      console.log(`✅ Webhook ${webhookId} delivered successfully for event ${eventType}`);
      return;
    }

    // If not the last attempt, wait before retrying
    if (attempt <= webhook.maxRetries) {
      const delay = getRetryDelay(attempt);
      console.log(`⏳ Webhook ${webhookId} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${webhook.maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  const newFailureCount = (webhook.failureCount || 0) + 1;
  const shouldPause = newFailureCount >= 5; // Pause after 5 consecutive failures

  await storage.updateWebhook(webhook.id, {
    lastTriggeredAt: new Date(),
    lastDeliveryAt: new Date(),
    lastDeliveryStatus: "failed",
    lastResponse: {
      status: lastResult?.httpStatus,
      error: lastResult?.errorMessage,
    },
    retryCount: webhook.maxRetries,
    failureCount: newFailureCount,
    status: shouldPause ? "paused" : webhook.status,
  });

  console.error(`❌ Webhook ${webhookId} failed after ${webhook.maxRetries + 1} attempts for event ${eventType}`);
  
  if (shouldPause) {
    console.warn(`⚠️  Webhook ${webhookId} paused after ${newFailureCount} consecutive failures`);
  }
}

/**
 * Trigger webhooks for a specific event type
 */
export async function triggerWebhooksForEvent(
  eventType: string,
  eventData: any,
  filters?: { tenantId?: string }
): Promise<void> {
  const webhooks = await storage.getWebhooks({
    status: "active",
    ...filters,
  });

  // Filter webhooks subscribed to this event
  const subscribedWebhooks = webhooks.filter(webhook => 
    webhook.events.includes(eventType)
  );

  console.log(`📤 Triggering ${subscribedWebhooks.length} webhooks for event ${eventType}`);

  // Trigger all webhooks in parallel
  await Promise.allSettled(
    subscribedWebhooks.map(webhook => 
      triggerWebhook(webhook.id, eventType, eventData)
    )
  );
}

/**
 * Test webhook delivery
 */
export async function testWebhook(webhookId: string): Promise<DeliveryResult> {
  const webhook = await storage.getWebhook(webhookId);
  
  if (!webhook) {
    throw new Error(`Webhook ${webhookId} not found`);
  }

  const testPayload: WebhookPayload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook delivery",
      webhookId: webhook.id,
    },
  };

  const result = await deliverWebhook(webhook, testPayload, 1);

  // Log the test delivery
  const deliveryLog: InsertWebhookDeliveryLog = {
    webhookId: webhook.id,
    eventType: "webhook.test",
    payload: testPayload.data,
    attemptNumber: 1,
    httpStatus: result.httpStatus,
    responseBody: result.responseBody,
    responseHeaders: result.responseHeaders,
    deliveredAt: new Date(),
    responseTime: result.responseTime,
    status: result.success ? "success" : "failed",
    errorMessage: result.errorMessage,
  };

  await storage.createWebhookDeliveryLog(deliveryLog);

  return result;
}

/**
 * Available event types
 */
export const WEBHOOK_EVENTS = {
  // SMS Events
  SMS_RECEIVED: "sms.received",
  SMS_SENT: "sms.sent",
  SMS_FAILED: "sms.failed",
  
  // Application Events
  APPLICATION_SUBMITTED: "application.submitted",
  APPLICATION_APPROVED: "application.approved",
  APPLICATION_DENIED: "application.denied",
  
  // Document Events
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_VERIFIED: "document.verified",
  DOCUMENT_REJECTED: "document.rejected",
  DOCUMENT_PROCESSED: "document.processed",
  
  // Eligibility Events
  ELIGIBILITY_CHECKED: "eligibility.checked",
  ELIGIBILITY_CHANGED: "eligibility.changed",
  
  // Case Events
  CASE_CREATED: "case.created",
  CASE_UPDATED: "case.updated",
  CASE_CLOSED: "case.closed",
  
  // Test Event
  WEBHOOK_TEST: "webhook.test",
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];
