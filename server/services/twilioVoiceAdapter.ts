/**
 * Twilio Voice Adapter
 * Implements voice calling, IVR, recording, and advanced features via Twilio
 */

import { BasePhoneSystemAdapter } from "./phoneSystemAdapter";
import type { 
  CallInitiateOptions, 
  CallTransferOptions, 
  RecordingOptions,
  CallStatus 
} from "./phoneSystemAdapter";
import { db } from "../db";
import { 
  phoneCallRecords, 
  ivrMenus, 
  ivrMenuOptions,
  callQueues,
  callQueueEntries
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class TwilioVoiceAdapter extends BasePhoneSystemAdapter {
  private twilioClient: any;
  private baseWebhookUrl: string;

  constructor(config: any, tenantId: string) {
    super(config, tenantId);
    this.baseWebhookUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.repl.co`;
    this.initializeTwilioClient();
  }

  /**
   * Initialize Twilio client
   */
  private initializeTwilioClient() {
    try {
      const twilio = require("twilio");
      this.twilioClient = twilio(
        this.config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID,
        this.config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN
      );
      console.log("✅ Twilio Voice client initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Twilio client:", error);
    }
  }

  /**
   * Initialize an outbound call
   */
  async initializeCall(options: CallInitiateOptions): Promise<string> {
    if (!this.twilioClient) {
      throw new Error("Twilio client not initialized");
    }

    try {
      // Create call via Twilio
      const call = await this.twilioClient.calls.create({
        from: options.from || this.config.twilioPhoneNumber,
        to: options.to,
        url: `${this.baseWebhookUrl}/api/phone/twilio/voice-webhook`,
        statusCallback: `${this.baseWebhookUrl}/api/phone/twilio/status-webhook`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        record: options.recordCall || false,
        recordingStatusCallback: options.recordCall ? `${this.baseWebhookUrl}/api/phone/twilio/recording-webhook` : undefined,
        machineDetection: "DetectMessageEnd", // Detect answering machines
        machineDetectionTimeout: 30,
        timeout: 60,
        // Pass metadata via query params
        url: `${this.baseWebhookUrl}/api/phone/twilio/voice-webhook?` + new URLSearchParams({
          tenantId: this.tenantId,
          agentId: options.agentId || "",
          clientId: options.clientId || "",
          metadata: JSON.stringify(options.metadata || {})
        }).toString()
      });

      // Create call record in database
      await this.createCallRecord({
        callId: call.sid,
        fromNumber: options.from || this.config.twilioPhoneNumber,
        toNumber: options.to,
        direction: "outbound",
        status: "queued",
        agentId: options.agentId,
        clientId: options.clientId,
        metadata: options.metadata
      });

      console.log(`📞 Call initiated: ${call.sid} from ${options.from} to ${options.to}`);
      return call.sid;
    } catch (error: any) {
      console.error("❌ Failed to initiate call:", error);
      throw new Error(`Call initiation failed: ${error.message}`);
    }
  }

  /**
   * Transfer a call (blind or attended)
   */
  async transferCall(options: CallTransferOptions): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      const call = await this.twilioClient.calls(options.callId).fetch();
      
      if (options.transferType === "blind") {
        // Blind transfer - immediately transfer without announcement
        await call.update({
          url: `${this.baseWebhookUrl}/api/phone/twilio/transfer-webhook?` + new URLSearchParams({
            targetExtension: options.targetExtension,
            transferType: "blind"
          }).toString()
        });
      } else if (options.transferType === "attended") {
        // Attended transfer - connect agent first, then transfer
        await call.update({
          url: `${this.baseWebhookUrl}/api/phone/twilio/transfer-webhook?` + new URLSearchParams({
            targetExtension: options.targetExtension,
            transferType: "attended",
            announcement: options.announcementText || "You have a call transfer"
          }).toString()
        });
      } else if (options.transferType === "conference") {
        // Conference transfer - add both parties to conference
        await call.update({
          url: `${this.baseWebhookUrl}/api/phone/twilio/conference-webhook?` + new URLSearchParams({
            targetExtension: options.targetExtension,
            conferenceName: `conference_${options.callId}`
          }).toString()
        });
      }

      await this.updateCallStatus(options.callId, "transferred", {
        transferTarget: options.targetExtension,
        transferType: options.transferType
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to transfer call:", error);
      return false;
    }
  }

  /**
   * Place call on hold
   */
  async holdCall(callId: string): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      const call = await this.twilioClient.calls(callId).fetch();
      
      // Update call to play hold music
      await call.update({
        url: `${this.baseWebhookUrl}/api/phone/twilio/hold-webhook?action=hold`
      });

      // Update hold time tracking
      const startHoldTime = Date.now();
      await this.updateCallStatus(callId, "on-hold", {
        holdStartTime: new Date(startHoldTime)
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to hold call:", error);
      return false;
    }
  }

  /**
   * Resume call from hold
   */
  async resumeCall(callId: string): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      const call = await this.twilioClient.calls(callId).fetch();
      
      // Resume normal call flow
      await call.update({
        url: `${this.baseWebhookUrl}/api/phone/twilio/hold-webhook?action=resume`
      });

      // Calculate hold duration
      const callRecord = await db.query.phoneCallRecords.findFirst({
        where: eq(phoneCallRecords.callId, callId)
      });

      if (callRecord && callRecord.metadata?.holdStartTime) {
        const holdDuration = Date.now() - new Date(callRecord.metadata.holdStartTime).getTime();
        const totalHoldTime = (callRecord.holdTime || 0) + Math.floor(holdDuration / 1000);
        
        await this.updateCallStatus(callId, "in-progress", {
          holdTime: totalHoldTime
        });
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to resume call:", error);
      return false;
    }
  }

  /**
   * Start or stop call recording
   */
  async recordCall(options: RecordingOptions): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      // Handle recording consent
      const consentHandled = await this.handleRecordingConsent(options.callId, options);
      if (!consentHandled) return false;

      const call = await this.twilioClient.calls(options.callId).fetch();
      
      if (options.consentGiven) {
        // Start recording
        const recording = await call.recordings.create({
          recordingStatusCallback: `${this.baseWebhookUrl}/api/phone/twilio/recording-webhook`,
          recordingStatusCallbackEvent: ["completed", "failed"],
          trim: "trim-silence",
          recordingChannels: "dual" // Separate channels for each party
        });

        await this.updateCallStatus(options.callId, call.status, {
          recordingId: recording.sid,
          recordingStartTime: new Date()
        });

        console.log(`🎙️ Recording started for call ${options.callId}`);
      } else {
        // Stop any active recordings
        const recordings = await call.recordings.list({ status: "in-progress" });
        for (const recording of recordings) {
          await recording.update({ status: "stopped" });
        }
        console.log(`⏹️ Recording stopped for call ${options.callId}`);
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to manage recording:", error);
      return false;
    }
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      await this.twilioClient.calls(callId).update({
        status: "completed"
      });

      await this.updateCallStatus(callId, "completed", {
        endTime: new Date()
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to end call:", error);
      return false;
    }
  }

  /**
   * Mute or unmute participant
   */
  async muteCall(callId: string, muted: boolean): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      const call = await this.twilioClient.calls(callId).fetch();
      
      // If call is in a conference, mute the participant
      if (call.conferenceId) {
        const participant = await this.twilioClient
          .conferences(call.conferenceId)
          .participants(callId)
          .update({ muted });
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to mute/unmute call:", error);
      return false;
    }
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(callId: string, digits: string): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      await this.twilioClient.calls(callId).update({
        url: `${this.baseWebhookUrl}/api/phone/twilio/dtmf-webhook?digits=${encodeURIComponent(digits)}`
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to send DTMF:", error);
      return false;
    }
  }

  /**
   * Whisper message to agent without client hearing
   */
  async whisperToAgent(callId: string, message: string): Promise<boolean> {
    if (!this.twilioClient) return false;

    try {
      // Create a whisper using Twilio's coaching feature
      await this.twilioClient.calls(callId).update({
        url: `${this.baseWebhookUrl}/api/phone/twilio/whisper-webhook?` + new URLSearchParams({
          message: message,
          whisperTo: "agent"
        }).toString()
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to whisper to agent:", error);
      return false;
    }
  }

  /**
   * Generate TwiML for IVR menu
   */
  async generateIVRTwiML(menuId: string, retryCount: number = 0): Promise<string> {
    const menu = await db.query.ivrMenus.findFirst({
      where: and(
        eq(ivrMenus.id, menuId),
        eq(ivrMenus.tenantId, this.tenantId)
      )
    });

    if (!menu) {
      return this.generateErrorTwiML("Menu not found");
    }

    const menuOptions = await db.query.ivrMenuOptions.findMany({
      where: and(
        eq(ivrMenuOptions.menuId, menuId),
        eq(ivrMenuOptions.isActive, true)
      )
    });

    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Add greeting
    if (menu.greetingAudioUrl) {
      response.play(menu.greetingAudioUrl);
    } else {
      response.say({
        voice: menu.voiceName || "Polly.Joanna",
        language: menu.language || "en-US"
      }, menu.greetingText);
    }

    // Build gather for input
    const gather = response.gather({
      numDigits: menu.maxDigits || 1,
      timeout: menu.timeout || 5,
      input: menu.inputType || "dtmf",
      action: `${this.baseWebhookUrl}/api/phone/twilio/ivr-input?menuId=${menuId}&retry=${retryCount}`,
      method: "POST",
      speechModel: menu.speechModel,
      hints: menu.intentKeywords ? (menu.intentKeywords as any).join(",") : undefined
    });

    // Add menu options prompts
    for (const option of menuOptions.sort((a, b) => a.priority - b.priority)) {
      gather.say({
        voice: menu.voiceName || "Polly.Joanna",
        language: menu.language || "en-US"
      }, option.promptText);
      
      // Add pause between options
      gather.pause({ length: 1 });
    }

    // Handle no input (redirect back to menu with retry)
    if (retryCount < (menu.maxRetries || 3)) {
      response.redirect(`${this.baseWebhookUrl}/api/phone/twilio/ivr-menu?menuId=${menuId}&retry=${retryCount + 1}`);
    } else {
      response.say("We didn't receive your selection. Please call back later.");
      response.hangup();
    }

    return response.toString();
  }

  /**
   * Generate error TwiML
   */
  private generateErrorTwiML(message: string): string {
    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say(message);
    response.hangup();
    return response.toString();
  }

  /**
   * Handle IVR input and route to appropriate action
   */
  async handleIVRInput(menuId: string, input: string): Promise<string> {
    // Find the matching menu option
    const menuOption = await db.query.ivrMenuOptions.findFirst({
      where: and(
        eq(ivrMenuOptions.menuId, menuId),
        eq(ivrMenuOptions.dtmfKey, input),
        eq(ivrMenuOptions.isActive, true)
      )
    });

    if (!menuOption) {
      // Invalid input, replay menu
      return await this.generateIVRTwiML(menuId, 1);
    }

    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Handle action based on type
    switch (menuOption.actionType) {
      case "menu":
        // Navigate to submenu
        response.redirect(`${this.baseWebhookUrl}/api/phone/twilio/ivr-menu?menuId=${menuOption.actionTarget}`);
        break;

      case "transfer":
        // Transfer to agent or number
        response.dial({
          action: `${this.baseWebhookUrl}/api/phone/twilio/dial-complete`,
          timeout: 30
        }, menuOption.actionTarget);
        break;

      case "callback":
        // Schedule callback
        response.say("We'll call you back as soon as an agent is available.");
        // TODO: Implement callback scheduling
        response.hangup();
        break;

      case "hangup":
        response.say("Thank you for calling. Goodbye.");
        response.hangup();
        break;

      case "record":
        // Record a message
        response.say("Please leave your message after the beep. Press pound when finished.");
        response.record({
          maxLength: 120,
          finishOnKey: "#",
          transcribe: true,
          transcribeCallback: `${this.baseWebhookUrl}/api/phone/twilio/voicemail-transcription`
        });
        break;

      default:
        response.say("This option is not available. Please try again.");
        response.redirect(`${this.baseWebhookUrl}/api/phone/twilio/ivr-menu?menuId=${menuId}`);
    }

    return response.toString();
  }

  /**
   * Add call to queue
   */
  async addCallToQueue(callId: string, queueId: string, priority: number = 0): Promise<boolean> {
    try {
      // Get call record
      const callRecord = await db.query.phoneCallRecords.findFirst({
        where: eq(phoneCallRecords.callId, callId)
      });

      if (!callRecord) return false;

      // Get current queue size
      const queueEntries = await db.query.callQueueEntries.findMany({
        where: and(
          eq(callQueueEntries.queueId, queueId),
          eq(callQueueEntries.status, "waiting")
        )
      });

      // Add to queue
      await db.insert(callQueueEntries).values({
        queueId,
        callRecordId: callRecord.id,
        position: queueEntries.length + 1,
        priority,
        status: "waiting",
        estimatedWaitTime: this.estimateWaitTime(queueEntries.length)
      });

      // Update call status
      await this.updateCallStatus(callId, "queued");

      return true;
    } catch (error) {
      console.error("❌ Failed to add call to queue:", error);
      return false;
    }
  }

  /**
   * Estimate wait time based on queue position
   */
  private estimateWaitTime(queuePosition: number): number {
    // Simple estimate: 3 minutes per call in queue
    return queuePosition * 180; // seconds
  }

  /**
   * Get next call from queue
   */
  async getNextCallFromQueue(queueId: string): Promise<any> {
    try {
      // Get next waiting call (considering priority)
      const nextEntry = await db.query.callQueueEntries.findFirst({
        where: and(
          eq(callQueueEntries.queueId, queueId),
          eq(callQueueEntries.status, "waiting")
        ),
        orderBy: [
          callQueueEntries.priority,
          callQueueEntries.position
        ]
      });

      if (!nextEntry) return null;

      // Update entry status
      await db.update(callQueueEntries)
        .set({
          status: "answered",
          answeredAt: new Date(),
          actualWaitTime: Math.floor((Date.now() - nextEntry.joinedAt.getTime()) / 1000)
        })
        .where(eq(callQueueEntries.id, nextEntry.id));

      // Get call details
      const callRecord = await db.query.phoneCallRecords.findFirst({
        where: eq(phoneCallRecords.id, nextEntry.callRecordId)
      });

      return callRecord;
    } catch (error) {
      console.error("❌ Failed to get next call from queue:", error);
      return null;
    }
  }
}