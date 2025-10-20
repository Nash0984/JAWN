/**
 * Phone System API Routes
 * Comprehensive endpoints for voice calling, IVR, and PBX integration
 */

import { Router } from "express";
import { db } from "../db";
import { 
  phoneSystemConfigs, 
  phoneCallRecords, 
  ivrMenus,
  ivrMenuOptions,
  callQueues,
  callQueueEntries,
  agentCallStatus,
  callRecordingConsents
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPhoneSystem, PhoneSystemManager } from "../services/phoneSystemAdapter";
import { TwilioVoiceAdapter } from "../services/twilioVoiceAdapter";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { getWebSocketService } from "../services/websocket.service";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiting for API endpoints
const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many API requests, please try again later'
});

// ============================================================================
// Call Control Endpoints
// ============================================================================

/**
 * POST /api/phone/call/initiate
 * Start an outbound call
 */
router.post("/call/initiate", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      to: z.string().min(10),
      from: z.string().optional(),
      agentId: z.string().optional(),
      clientId: z.string().optional(),
      recordCall: z.boolean().optional(),
      systemConfigId: z.string().optional(),
      metadata: z.record(z.any()).optional()
    });

    const data = schema.parse(req.body);
    const tenantId = req.user?.tenantId || "default";

    // Get phone system manager
    const phoneSystem = await getPhoneSystem(tenantId);
    
    // Initialize call
    const callId = await phoneSystem.initializeCall({
      ...data,
      agentId: data.agentId || req.user?.id
    });

    if (!callId) {
      return res.status(500).json({ 
        success: false, 
        error: "Failed to initiate call" 
      });
    }

    // Update agent status
    if (data.agentId || req.user?.id) {
      await db.update(agentCallStatus)
        .set({
          status: "on_call",
          currentCallId: callId,
          updatedAt: new Date()
        })
        .where(eq(agentCallStatus.agentId, data.agentId || req.user!.id));
    }

    res.json({ 
      success: true, 
      callId,
      message: "Call initiated successfully"
    });
  } catch (error: any) {
    console.error("Error initiating call:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
});

/**
 * POST /api/phone/call/transfer
 * Transfer an active call
 */
router.post("/call/transfer", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      callId: z.string(),
      targetExtension: z.string(),
      transferType: z.enum(["blind", "attended", "conference"]),
      announcementText: z.string().optional()
    });

    const data = schema.parse(req.body);
    const tenantId = req.user?.tenantId || "default";

    // Verify call belongs to tenant
    const callRecord = await db.query.phoneCallRecords.findFirst({
      where: and(
        eq(phoneCallRecords.callId, data.callId),
        eq(phoneCallRecords.tenantId, tenantId)
      )
    });

    if (!callRecord) {
      return res.status(404).json({ 
        success: false, 
        error: "Call not found" 
      });
    }

    // Get phone system and transfer
    const phoneSystem = await getPhoneSystem(tenantId);
    const adapter = callRecord.systemConfigId 
      ? phoneSystem.getAdapter(callRecord.systemConfigId)
      : phoneSystem.getDefaultAdapter();

    if (!adapter) {
      return res.status(500).json({ 
        success: false, 
        error: "No phone system available" 
      });
    }

    const success = await adapter.transferCall(data);

    res.json({ 
      success,
      message: success ? "Call transferred successfully" : "Transfer failed"
    });
  } catch (error: any) {
    console.error("Error transferring call:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
});

/**
 * POST /api/phone/call/hold
 * Put call on hold
 */
router.post("/call/hold", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const { callId } = req.body;
    const tenantId = req.user?.tenantId || "default";

    const phoneSystem = await getPhoneSystem(tenantId);
    const success = await phoneSystem.getDefaultAdapter()?.holdCall(callId);

    res.json({ 
      success,
      message: success ? "Call placed on hold" : "Failed to hold call"
    });
  } catch (error: any) {
    console.error("Error holding call:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/phone/call/resume
 * Resume call from hold
 */
router.post("/call/resume", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const { callId } = req.body;
    const tenantId = req.user?.tenantId || "default";

    const phoneSystem = await getPhoneSystem(tenantId);
    const success = await phoneSystem.getDefaultAdapter()?.resumeCall(callId);

    res.json({ 
      success,
      message: success ? "Call resumed" : "Failed to resume call"
    });
  } catch (error: any) {
    console.error("Error resuming call:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/phone/call/end
 * End an active call
 */
router.post("/call/end", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const { callId } = req.body;
    const tenantId = req.user?.tenantId || "default";

    const phoneSystem = await getPhoneSystem(tenantId);
    const success = await phoneSystem.getDefaultAdapter()?.endCall(callId);

    // Update agent status
    const callRecord = await db.query.phoneCallRecords.findFirst({
      where: eq(phoneCallRecords.callId, callId)
    });

    if (callRecord?.agentId) {
      await db.update(agentCallStatus)
        .set({
          status: "after_call_work",
          currentCallId: null,
          lastCallEndedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(agentCallStatus.agentId, callRecord.agentId));
    }

    res.json({ 
      success,
      message: success ? "Call ended" : "Failed to end call"
    });
  } catch (error: any) {
    console.error("Error ending call:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/phone/call/status/:callId
 * Get call status and details
 */
router.get("/call/status/:callId", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const tenantId = req.user?.tenantId || "default";

    const phoneSystem = await getPhoneSystem(tenantId);
    const status = await phoneSystem.getCallStatus(callId);

    if (!status) {
      return res.status(404).json({ 
        success: false, 
        error: "Call not found" 
      });
    }

    res.json({ 
      success: true, 
      data: status 
    });
  } catch (error: any) {
    console.error("Error getting call status:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// Recording & Consent Endpoints
// ============================================================================

/**
 * POST /api/phone/recording/start
 * Start call recording with consent
 */
router.post("/recording/start", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      callId: z.string(),
      consentGiven: z.boolean(),
      consentType: z.enum(["verbal", "dtmf", "written"]),
      stateCode: z.string().optional()
    });

    const data = schema.parse(req.body);
    const tenantId = req.user?.tenantId || "default";

    const phoneSystem = await getPhoneSystem(tenantId);
    const success = await phoneSystem.getDefaultAdapter()?.recordCall(data);

    res.json({ 
      success,
      message: success ? "Recording started" : "Failed to start recording"
    });
  } catch (error: any) {
    console.error("Error starting recording:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/phone/recording/consent
 * Log recording consent
 */
router.post("/recording/consent", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      callId: z.string(),
      consentGiven: z.boolean(),
      consentType: z.enum(["verbal", "dtmf", "written"]),
      consentMethod: z.string().optional(),
      consentText: z.string().optional(),
      dtmfResponse: z.string().optional(),
      stateCode: z.string().optional()
    });

    const data = schema.parse(req.body);

    // Find call record
    const callRecord = await db.query.phoneCallRecords.findFirst({
      where: eq(phoneCallRecords.callId, data.callId)
    });

    if (!callRecord) {
      return res.status(404).json({ 
        success: false, 
        error: "Call not found" 
      });
    }

    // Log consent
    await db.insert(callRecordingConsents).values({
      callRecordId: callRecord.id,
      ...data,
      requiresTwoPartyConsent: ["CA", "CT", "DE", "FL", "IL", "MD", "MA", "MI", "MT", "NH", "NV", "OR", "PA", "VT", "WA"]
        .includes(data.stateCode?.toUpperCase() || "")
    });

    res.json({ 
      success: true,
      message: "Consent logged successfully"
    });
  } catch (error: any) {
    console.error("Error logging consent:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// IVR Configuration Endpoints
// ============================================================================

/**
 * POST /api/phone/ivr/configure
 * Create or update IVR menu
 */
router.post("/ivr/configure", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      menuId: z.string(),
      name: z.string(),
      greetingText: z.string(),
      greetingAudioUrl: z.string().optional(),
      language: z.string().default("en"),
      voiceGender: z.string().default("female"),
      inputType: z.enum(["dtmf", "voice", "both"]).default("dtmf"),
      options: z.array(z.object({
        dtmfKey: z.string().optional(),
        voiceKeyword: z.string().optional(),
        label: z.string(),
        promptText: z.string(),
        actionType: z.enum(["menu", "transfer", "callback", "hangup", "record"]),
        actionTarget: z.string().optional(),
        priority: z.number().default(0)
      }))
    });

    const data = schema.parse(req.body);
    const tenantId = req.user?.tenantId || "default";

    // Create or update menu
    const [menu] = await db.insert(ivrMenus)
      .values({
        tenantId,
        menuId: data.menuId,
        name: data.name,
        greetingText: data.greetingText,
        greetingAudioUrl: data.greetingAudioUrl,
        language: data.language,
        voiceGender: data.voiceGender,
        inputType: data.inputType
      })
      .onConflictDoUpdate({
        target: [ivrMenus.tenantId, ivrMenus.menuId],
        set: {
          name: data.name,
          greetingText: data.greetingText,
          greetingAudioUrl: data.greetingAudioUrl,
          language: data.language,
          voiceGender: data.voiceGender,
          inputType: data.inputType,
          updatedAt: new Date()
        }
      })
      .returning();

    // Delete existing options
    await db.delete(ivrMenuOptions)
      .where(eq(ivrMenuOptions.menuId, menu.id));

    // Insert new options
    for (const option of data.options) {
      await db.insert(ivrMenuOptions).values({
        menuId: menu.id,
        ...option
      });
    }

    res.json({ 
      success: true,
      menuId: menu.id,
      message: "IVR menu configured successfully"
    });
  } catch (error: any) {
    console.error("Error configuring IVR:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/phone/ivr/menus
 * List all IVR menus
 */
router.get("/ivr/menus", requireAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || "default";

    const menus = await db.query.ivrMenus.findMany({
      where: and(
        eq(ivrMenus.tenantId, tenantId),
        eq(ivrMenus.isActive, true)
      )
    });

    res.json({ 
      success: true,
      data: menus
    });
  } catch (error: any) {
    console.error("Error getting IVR menus:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// Queue Management Endpoints
// ============================================================================

/**
 * GET /api/phone/queue/status
 * Get queue status and metrics
 */
router.get("/queue/status", requireAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || "default";

    // Get all active queues
    const queues = await db.query.callQueues.findMany({
      where: and(
        eq(callQueues.tenantId, tenantId),
        eq(callQueues.isActive, true)
      )
    });

    // Get queue metrics
    const queueMetrics = await Promise.all(queues.map(async (queue) => {
      const entries = await db.query.callQueueEntries.findMany({
        where: and(
          eq(callQueueEntries.queueId, queue.id),
          eq(callQueueEntries.status, "waiting")
        )
      });

      const agents = await db.query.agentCallStatus.findMany({
        where: eq(agentCallStatus.status, "available")
      });

      return {
        queueId: queue.id,
        queueName: queue.queueName,
        waitingCalls: entries.length,
        availableAgents: agents.filter(a => 
          (a.assignedQueues as any[])?.includes(queue.id)
        ).length,
        averageWaitTime: entries.reduce((sum, e) => 
          sum + (e.estimatedWaitTime || 0), 0
        ) / Math.max(entries.length, 1),
        longestWaitTime: Math.max(
          ...entries.map(e => 
            Math.floor((Date.now() - e.joinedAt.getTime()) / 1000)
          ), 0
        )
      };
    }));

    res.json({ 
      success: true,
      data: queueMetrics
    });
  } catch (error: any) {
    console.error("Error getting queue status:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/phone/queue/add
 * Add call to queue
 */
router.post("/queue/add", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      callId: z.string(),
      queueId: z.string(),
      priority: z.number().default(0)
    });

    const data = schema.parse(req.body);

    // Find call record
    const callRecord = await db.query.phoneCallRecords.findFirst({
      where: eq(phoneCallRecords.callId, data.callId)
    });

    if (!callRecord) {
      return res.status(404).json({ 
        success: false, 
        error: "Call not found" 
      });
    }

    // Get current queue size
    const entries = await db.query.callQueueEntries.findMany({
      where: and(
        eq(callQueueEntries.queueId, data.queueId),
        eq(callQueueEntries.status, "waiting")
      )
    });

    // Add to queue
    await db.insert(callQueueEntries).values({
      queueId: data.queueId,
      callRecordId: callRecord.id,
      position: entries.length + 1,
      priority: data.priority,
      status: "waiting",
      estimatedWaitTime: entries.length * 180 // 3 min per call estimate
    });

    res.json({ 
      success: true,
      position: entries.length + 1,
      estimatedWaitTime: entries.length * 180
    });
  } catch (error: any) {
    console.error("Error adding call to queue:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// Agent Status Endpoints
// ============================================================================

/**
 * POST /api/phone/agent/status
 * Update agent availability status
 */
router.post("/agent/status", requireAuth, apiRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(["available", "busy", "on_call", "after_call_work", "break", "offline"]),
      assignedQueues: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional()
    });

    const data = schema.parse(req.body);
    const agentId = req.user!.id;

    await db.insert(agentCallStatus)
      .values({
        agentId,
        status: data.status,
        assignedQueues: data.assignedQueues,
        skills: data.skills,
        availableSince: data.status === "available" ? new Date() : null,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: agentCallStatus.agentId,
        set: {
          status: data.status,
          assignedQueues: data.assignedQueues,
          skills: data.skills,
          availableSince: data.status === "available" ? new Date() : null,
          updatedAt: new Date()
        }
      });

    // Broadcast status change
    const ws = getWebSocketService();
    if (ws) {
      ws.broadcast({
        type: "agent_status_changed",
        data: {
          agentId,
          status: data.status
        }
      });
    }

    res.json({ 
      success: true,
      message: "Agent status updated"
    });
  } catch (error: any) {
    console.error("Error updating agent status:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/phone/agent/stats
 * Get agent call statistics
 */
router.get("/agent/stats", requireAuth, async (req, res) => {
  try {
    const agentId = req.user!.id;

    const agentStatus = await db.query.agentCallStatus.findFirst({
      where: eq(agentCallStatus.agentId, agentId)
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaysCalls = await db.query.phoneCallRecords.findMany({
      where: and(
        eq(phoneCallRecords.agentId, agentId),
        eq(phoneCallRecords.status, "completed")
      )
    });

    const stats = {
      currentStatus: agentStatus?.status || "offline",
      callsHandledToday: todaysCalls.length,
      totalTalkTimeToday: todaysCalls.reduce((sum, call) => 
        sum + (call.talkTime || 0), 0
      ),
      averageHandleTime: todaysCalls.length > 0
        ? todaysCalls.reduce((sum, call) => 
            sum + (call.duration || 0), 0
          ) / todaysCalls.length
        : 0,
      currentCallId: agentStatus?.currentCallId
    };

    res.json({ 
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error("Error getting agent stats:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// Twilio Webhook Endpoints
// ============================================================================

/**
 * POST /api/phone/twilio/voice-webhook
 * Handle incoming Twilio voice calls
 */
router.post("/twilio/voice-webhook", async (req, res) => {
  try {
    const { CallSid, From, To, CallStatus } = req.body;
    const { tenantId, agentId, clientId, metadata } = req.query;

    // Create call record if new
    if (CallStatus === "ringing") {
      await db.insert(phoneCallRecords).values({
        callId: CallSid,
        tenantId: tenantId as string || "default",
        fromNumber: From,
        toNumber: To,
        direction: "inbound",
        status: "ringing",
        agentId: agentId as string || null,
        clientId: clientId as string || null,
        metadata: metadata ? JSON.parse(metadata as string) : null,
        startTime: new Date()
      }).onConflictDoNothing();
    }

    // Generate TwiML response
    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Get IVR menu for tenant
    const mainMenu = await db.query.ivrMenus.findFirst({
      where: and(
        eq(ivrMenus.tenantId, tenantId as string || "default"),
        eq(ivrMenus.parentMenuId, null),
        eq(ivrMenus.isActive, true)
      )
    });

    if (mainMenu) {
      // Redirect to IVR menu
      response.redirect(`/api/phone/twilio/ivr-menu?menuId=${mainMenu.id}`);
    } else {
      // Default greeting if no IVR configured
      response.say("Thank you for calling. Please hold while we connect you.");
      response.dial({
        action: "/api/phone/twilio/dial-complete"
      }, process.env.DEFAULT_AGENT_NUMBER || "+1234567890");
    }

    res.type("text/xml");
    res.send(response.toString());
  } catch (error) {
    console.error("Error handling voice webhook:", error);
    res.status(500).send("Error");
  }
});

/**
 * POST /api/phone/twilio/status-webhook
 * Handle call status updates
 */
router.post("/twilio/status-webhook", async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    await db.update(phoneCallRecords)
      .set({
        status: CallStatus,
        duration: CallDuration ? parseInt(CallDuration) : null,
        updatedAt: new Date()
      })
      .where(eq(phoneCallRecords.callId, CallSid));

    res.sendStatus(200);
  } catch (error) {
    console.error("Error handling status webhook:", error);
    res.sendStatus(500);
  }
});

export default router;