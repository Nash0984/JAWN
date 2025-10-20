/**
 * Universal Phone System Adapter
 * Provides a vendor-agnostic interface for various phone systems
 * Supports Twilio, Asterisk, FreePBX, Cisco, and custom SIP implementations
 */

import { db } from "../db";
import { 
  phoneSystemConfigs, 
  phoneCallRecords, 
  agentCallStatus,
  callQueues,
  callQueueEntries,
  callRecordingConsents
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getWebSocketService } from "./websocket.service";

// ============================================================================
// Type Definitions
// ============================================================================

export interface CallInitiateOptions {
  from: string;
  to: string;
  agentId?: string;
  clientId?: string;
  systemConfigId?: string;
  recordCall?: boolean;
  metadata?: Record<string, any>;
}

export interface CallTransferOptions {
  callId: string;
  targetExtension: string;
  transferType: "blind" | "attended" | "conference";
  announcementText?: string;
}

export interface CallStatus {
  callId: string;
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed" | "busy" | "no-answer";
  duration?: number;
  talkTime?: number;
  holdTime?: number;
  position?: number; // Queue position
  estimatedWaitTime?: number;
}

export interface RecordingOptions {
  callId: string;
  consentGiven: boolean;
  consentType: "verbal" | "dtmf" | "written";
  stateCode?: string;
  encryptionEnabled?: boolean;
}

export interface PhoneSystemAdapter {
  initializeCall(options: CallInitiateOptions): Promise<string>;
  transferCall(options: CallTransferOptions): Promise<boolean>;
  holdCall(callId: string): Promise<boolean>;
  resumeCall(callId: string): Promise<boolean>;
  recordCall(options: RecordingOptions): Promise<boolean>;
  getCallStatus(callId: string): Promise<CallStatus | null>;
  endCall(callId: string): Promise<boolean>;
  muteCall(callId: string, muted: boolean): Promise<boolean>;
  sendDTMF(callId: string, digits: string): Promise<boolean>;
  getQueueStatus(queueId: string): Promise<any>;
  whisperToAgent(callId: string, message: string): Promise<boolean>;
}

// ============================================================================
// Base Phone System Adapter
// ============================================================================

export abstract class BasePhoneSystemAdapter implements PhoneSystemAdapter {
  protected config: any;
  protected tenantId: string;

  constructor(config: any, tenantId: string) {
    this.config = config;
    this.tenantId = tenantId;
  }

  abstract initializeCall(options: CallInitiateOptions): Promise<string>;
  abstract transferCall(options: CallTransferOptions): Promise<boolean>;
  abstract holdCall(callId: string): Promise<boolean>;
  abstract resumeCall(callId: string): Promise<boolean>;
  abstract recordCall(options: RecordingOptions): Promise<boolean>;
  abstract endCall(callId: string): Promise<boolean>;
  abstract muteCall(callId: string, muted: boolean): Promise<boolean>;
  abstract sendDTMF(callId: string, digits: string): Promise<boolean>;
  abstract whisperToAgent(callId: string, message: string): Promise<boolean>;

  /**
   * Get call status from database (common implementation)
   */
  async getCallStatus(callId: string): Promise<CallStatus | null> {
    try {
      const record = await db.query.phoneCallRecords.findFirst({
        where: and(
          eq(phoneCallRecords.callId, callId),
          eq(phoneCallRecords.tenantId, this.tenantId)
        )
      });

      if (!record) return null;

      // Check if call is in queue
      let queueInfo = null;
      if (record.status === "queued") {
        const queueEntry = await db.query.callQueueEntries.findFirst({
          where: eq(callQueueEntries.callRecordId, record.id)
        });
        if (queueEntry) {
          queueInfo = {
            position: queueEntry.position,
            estimatedWaitTime: queueEntry.estimatedWaitTime
          };
        }
      }

      return {
        callId: record.callId,
        status: record.status as CallStatus["status"],
        duration: record.duration || undefined,
        talkTime: record.talkTime || undefined,
        holdTime: record.holdTime || undefined,
        ...queueInfo
      };
    } catch (error) {
      console.error("Error getting call status:", error);
      return null;
    }
  }

  /**
   * Get queue status (common implementation)
   */
  async getQueueStatus(queueId: string): Promise<any> {
    try {
      const queue = await db.query.callQueues.findFirst({
        where: and(
          eq(callQueues.id, queueId),
          eq(callQueues.tenantId, this.tenantId)
        )
      });

      if (!queue) return null;

      // Get active entries in queue
      const entries = await db.query.callQueueEntries.findMany({
        where: and(
          eq(callQueueEntries.queueId, queueId),
          eq(callQueueEntries.status, "waiting")
        )
      });

      // Get available agents
      const agents = await db.query.agentCallStatus.findMany({
        where: eq(agentCallStatus.status, "available")
      });

      return {
        queueId: queue.id,
        queueName: queue.queueName,
        waitingCalls: entries.length,
        availableAgents: agents.length,
        averageWaitTime: entries.reduce((sum, e) => sum + (e.estimatedWaitTime || 0), 0) / Math.max(entries.length, 1),
        isActive: queue.isActive
      };
    } catch (error) {
      console.error("Error getting queue status:", error);
      return null;
    }
  }

  /**
   * Create call record in database
   */
  protected async createCallRecord(data: any): Promise<string> {
    const [record] = await db.insert(phoneCallRecords).values({
      ...data,
      tenantId: this.tenantId,
      systemConfigId: this.config.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Broadcast real-time update
    const ws = getWebSocketService();
    if (ws) {
      ws.broadcast({
        type: "call_started",
        data: {
          callId: record.callId,
          agentId: data.agentId,
          status: record.status
        }
      });
    }

    return record.id;
  }

  /**
   * Update call record status
   */
  protected async updateCallStatus(callId: string, status: string, additionalData?: any) {
    await db.update(phoneCallRecords)
      .set({
        status,
        ...additionalData,
        updatedAt: new Date()
      })
      .where(and(
        eq(phoneCallRecords.callId, callId),
        eq(phoneCallRecords.tenantId, this.tenantId)
      ));

    // Broadcast real-time update
    const ws = getWebSocketService();
    if (ws) {
      ws.broadcast({
        type: "call_status_changed",
        data: {
          callId,
          status,
          ...additionalData
        }
      });
    }
  }

  /**
   * Check and handle recording consent
   */
  protected async handleRecordingConsent(callId: string, options: RecordingOptions): Promise<boolean> {
    // Check if state requires two-party consent
    const requiresTwoParty = this.requiresTwoPartyConsent(options.stateCode);
    
    if (!options.consentGiven && requiresTwoParty) {
      console.warn(`Recording consent required for state ${options.stateCode} but not given`);
      return false;
    }

    // Find call record
    const callRecord = await db.query.phoneCallRecords.findFirst({
      where: and(
        eq(phoneCallRecords.callId, callId),
        eq(phoneCallRecords.tenantId, this.tenantId)
      )
    });

    if (!callRecord) return false;

    // Log consent
    await db.insert(callRecordingConsents).values({
      callRecordId: callRecord.id,
      consentType: options.consentType,
      consentGiven: options.consentGiven,
      stateCode: options.stateCode,
      requiresTwoPartyConsent: requiresTwoParty,
      consentTimestamp: new Date()
    });

    // Update call record
    await db.update(phoneCallRecords)
      .set({
        consentGiven: options.consentGiven,
        consentTimestamp: new Date()
      })
      .where(eq(phoneCallRecords.id, callRecord.id));

    return true;
  }

  /**
   * Check if state requires two-party consent for recording
   */
  private requiresTwoPartyConsent(stateCode?: string): boolean {
    if (!stateCode) return true; // Default to requiring consent

    const twoPartyStates = [
      "CA", "CT", "DE", "FL", "IL", "MD", "MA", "MI", 
      "MT", "NH", "NV", "OR", "PA", "VT", "WA"
    ];

    return twoPartyStates.includes(stateCode.toUpperCase());
  }
}

// ============================================================================
// Phone System Manager - Manages multiple adapters
// ============================================================================

export class PhoneSystemManager {
  private adapters: Map<string, PhoneSystemAdapter> = new Map();
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Initialize phone system adapters for tenant
   */
  async initialize(): Promise<void> {
    // Load all active phone system configs for tenant
    const configs = await db.query.phoneSystemConfigs.findMany({
      where: and(
        eq(phoneSystemConfigs.tenantId, this.tenantId),
        eq(phoneSystemConfigs.isActive, true)
      ),
      orderBy: [desc(phoneSystemConfigs.priority)]
    });

    for (const config of configs) {
      const adapter = await this.createAdapter(config);
      if (adapter) {
        this.adapters.set(config.id, adapter);
        console.log(`✅ Initialized ${config.systemType} adapter: ${config.systemName}`);
      }
    }
  }

  /**
   * Create adapter based on system type
   */
  private async createAdapter(config: any): Promise<PhoneSystemAdapter | null> {
    try {
      switch (config.systemType) {
        case "twilio":
          const { TwilioVoiceAdapter } = await import("./twilioVoiceAdapter");
          return new TwilioVoiceAdapter(config, this.tenantId);
        
        case "asterisk":
        case "freepbx":
          const { AsteriskAdapter } = await import("./asteriskAdapter");
          return new AsteriskAdapter(config, this.tenantId);
        
        case "cisco":
          const { CiscoAdapter } = await import("./ciscoAdapter");
          return new CiscoAdapter(config, this.tenantId);
        
        case "custom_sip":
          const { SIPAdapter } = await import("./sipAdapter");
          return new SIPAdapter(config, this.tenantId);
        
        default:
          console.warn(`Unknown phone system type: ${config.systemType}`);
          return null;
      }
    } catch (error) {
      console.error(`Failed to create adapter for ${config.systemType}:`, error);
      return null;
    }
  }

  /**
   * Get the default adapter
   */
  getDefaultAdapter(): PhoneSystemAdapter | null {
    // Try to get the default system
    for (const [id, adapter] of this.adapters) {
      return adapter; // Return first available adapter
    }
    return null;
  }

  /**
   * Get adapter by config ID
   */
  getAdapter(configId: string): PhoneSystemAdapter | null {
    return this.adapters.get(configId) || null;
  }

  /**
   * Auto-detect best adapter for a call
   */
  async selectBestAdapter(phoneNumber?: string): Promise<PhoneSystemAdapter | null> {
    // Logic to select best adapter based on:
    // - System availability
    // - Cost
    // - Features required
    // - Phone number routing rules
    
    // For now, return the default adapter
    return this.getDefaultAdapter();
  }

  /**
   * Initialize a call using the best available adapter
   */
  async initializeCall(options: CallInitiateOptions): Promise<string | null> {
    const adapter = options.systemConfigId 
      ? this.getAdapter(options.systemConfigId)
      : await this.selectBestAdapter(options.to);

    if (!adapter) {
      console.error("No phone system adapter available");
      return null;
    }

    try {
      return await adapter.initializeCall(options);
    } catch (error) {
      console.error("Failed to initialize call:", error);
      // Try fallback adapter
      const fallback = this.getDefaultAdapter();
      if (fallback && fallback !== adapter) {
        console.log("Trying fallback adapter...");
        return await fallback.initializeCall(options);
      }
      throw error;
    }
  }

  /**
   * Get call status from any adapter
   */
  async getCallStatus(callId: string): Promise<CallStatus | null> {
    // Check all adapters (call status is stored in DB, so any adapter can retrieve it)
    const adapter = this.getDefaultAdapter();
    return adapter ? await adapter.getCallStatus(callId) : null;
  }
}

// ============================================================================
// Global Phone System Instance
// ============================================================================

let phoneSystemInstances: Map<string, PhoneSystemManager> = new Map();

/**
 * Get or create phone system manager for tenant
 */
export async function getPhoneSystem(tenantId: string): Promise<PhoneSystemManager> {
  if (!phoneSystemInstances.has(tenantId)) {
    const manager = new PhoneSystemManager(tenantId);
    await manager.initialize();
    phoneSystemInstances.set(tenantId, manager);
  }
  
  return phoneSystemInstances.get(tenantId)!;
}

/**
 * Clear phone system cache (for testing or config updates)
 */
export function clearPhoneSystemCache(tenantId?: string) {
  if (tenantId) {
    phoneSystemInstances.delete(tenantId);
  } else {
    phoneSystemInstances.clear();
  }
}