/**
 * SIP Adapter for WebRTC and PBX Integration
 * Supports standard SIP protocols (RFC 3261) for interoperability
 * Works with Asterisk, FreePBX, and custom SIP servers
 */

import { BasePhoneSystemAdapter } from "./phoneSystemAdapter";
import type { 
  CallInitiateOptions, 
  CallTransferOptions, 
  RecordingOptions 
} from "./phoneSystemAdapter";

export class SIPAdapter extends BasePhoneSystemAdapter {
  private sipClient: any;
  private webRTCPeer: any;
  private stunServers: string[];
  private turnServers: any[];

  constructor(config: any, tenantId: string) {
    super(config, tenantId);
    this.stunServers = config.stunServers || ["stun:stun.l.google.com:19302"];
    this.turnServers = config.turnServers || [];
    this.initializeSIPClient();
  }

  /**
   * Initialize SIP client connection
   */
  private async initializeSIPClient() {
    try {
      // Dynamic import for SIP.js library
      const SIP = await import("sip.js");
      
      // Create User Agent
      const uri = SIP.UserAgent.makeURI(`sip:${this.config.sipUsername}@${this.config.sipDomain}`);
      if (!uri) throw new Error("Invalid SIP URI");

      const transportOptions = {
        server: `${this.config.sipTransport || "wss"}://${this.config.sipHost}:${this.config.sipPort || 8089}/ws`
      };

      this.sipClient = new SIP.UserAgent({
        uri,
        transportOptions,
        authorizationUsername: this.config.sipUsername,
        authorizationPassword: this.config.sipPassword,
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionConfiguration: {
            iceServers: [
              ...this.stunServers.map(server => ({ urls: server })),
              ...this.turnServers
            ]
          }
        }
      });

      // Start the client
      await this.sipClient.start();
      
      // Register with SIP server
      const registerer = new SIP.Registerer(this.sipClient);
      await registerer.register();

      console.log(`✅ SIP client registered: ${this.config.sipUsername}@${this.config.sipDomain}`);
    } catch (error) {
      console.error("❌ Failed to initialize SIP client:", error);
    }
  }

  /**
   * Initialize an outbound call via SIP
   */
  async initializeCall(options: CallInitiateOptions): Promise<string> {
    if (!this.sipClient) {
      throw new Error("SIP client not initialized");
    }

    try {
      const target = options.to.startsWith("sip:") 
        ? options.to 
        : `sip:${options.to}@${this.config.sipDomain}`;

      const inviter = new (await import("sip.js")).Inviter(this.sipClient, target);
      
      // Generate unique call ID
      const callId = `sip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Store call session
      await this.createCallRecord({
        callId,
        fromNumber: options.from || this.config.sipUsername,
        toNumber: options.to,
        direction: "outbound",
        status: "queued",
        agentId: options.agentId,
        clientId: options.clientId,
        metadata: {
          ...options.metadata,
          sipCallId: inviter.request.callId
        }
      });

      // Set up event handlers
      inviter.stateChange.addListener((state: any) => {
        this.handleSIPStateChange(callId, state);
      });

      // Send INVITE
      await inviter.invite({
        requestDelegate: {
          onAccept: async () => {
            await this.updateCallStatus(callId, "in-progress", {
              answerTime: new Date()
            });
          },
          onReject: async () => {
            await this.updateCallStatus(callId, "failed");
          }
        }
      });

      console.log(`📞 SIP call initiated: ${callId} to ${target}`);
      return callId;
    } catch (error: any) {
      console.error("❌ Failed to initiate SIP call:", error);
      throw new Error(`SIP call initiation failed: ${error.message}`);
    }
  }

  /**
   * Handle SIP session state changes
   */
  private async handleSIPStateChange(callId: string, state: string) {
    const statusMap: Record<string, string> = {
      "Initial": "queued",
      "Establishing": "ringing",
      "Established": "in-progress",
      "Terminating": "ending",
      "Terminated": "completed"
    };

    const mappedStatus = statusMap[state] || state.toLowerCase();
    await this.updateCallStatus(callId, mappedStatus);
  }

  /**
   * Transfer call via SIP REFER
   */
  async transferCall(options: CallTransferOptions): Promise<boolean> {
    try {
      // Implement SIP REFER for call transfer
      // This requires access to the active session
      const session = await this.getActiveSession(options.callId);
      if (!session) return false;

      const target = `sip:${options.targetExtension}@${this.config.sipDomain}`;
      
      if (options.transferType === "blind") {
        // Send REFER without consultation
        await session.refer(target);
      } else if (options.transferType === "attended") {
        // First establish call with target, then transfer
        // This requires more complex SIP signaling
        const consultSession = await this.createConsultationCall(target);
        if (consultSession) {
          await session.refer(target, { replaces: consultSession });
        }
      }

      await this.updateCallStatus(options.callId, "transferred");
      return true;
    } catch (error) {
      console.error("❌ SIP transfer failed:", error);
      return false;
    }
  }

  /**
   * Put call on hold using SIP re-INVITE
   */
  async holdCall(callId: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(callId);
      if (!session) return false;

      // Send re-INVITE with inactive SDP
      await session.sessionDescriptionHandler.holdModifier();
      await this.updateCallStatus(callId, "on-hold");
      
      return true;
    } catch (error) {
      console.error("❌ Failed to hold SIP call:", error);
      return false;
    }
  }

  /**
   * Resume call from hold
   */
  async resumeCall(callId: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(callId);
      if (!session) return false;

      // Send re-INVITE with active SDP
      await session.sessionDescriptionHandler.unHoldModifier();
      await this.updateCallStatus(callId, "in-progress");
      
      return true;
    } catch (error) {
      console.error("❌ Failed to resume SIP call:", error);
      return false;
    }
  }

  /**
   * Start recording via SIP INFO or third-party recorder
   */
  async recordCall(options: RecordingOptions): Promise<boolean> {
    try {
      const session = await this.getActiveSession(options.callId);
      if (!session) return false;

      // Handle consent
      const consentHandled = await this.handleRecordingConsent(options.callId, options);
      if (!consentHandled) return false;

      if (options.consentGiven) {
        // Send SIP INFO to start recording (if PBX supports it)
        const info = {
          contentType: "application/recording-control",
          body: JSON.stringify({
            action: "start",
            callId: options.callId,
            format: "wav",
            channels: "dual"
          })
        };
        
        await session.info(info);
        console.log(`🎙️ SIP recording started for call ${options.callId}`);
      } else {
        // Stop recording
        const info = {
          contentType: "application/recording-control",
          body: JSON.stringify({
            action: "stop",
            callId: options.callId
          })
        };
        
        await session.info(info);
        console.log(`⏹️ SIP recording stopped for call ${options.callId}`);
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to manage SIP recording:", error);
      return false;
    }
  }

  /**
   * End call via SIP BYE
   */
  async endCall(callId: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(callId);
      if (!session) return false;

      await session.bye();
      await this.updateCallStatus(callId, "completed", {
        endTime: new Date()
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to end SIP call:", error);
      return false;
    }
  }

  /**
   * Mute/unmute via SDP renegotiation
   */
  async muteCall(callId: string, muted: boolean): Promise<boolean> {
    try {
      const session = await this.getActiveSession(callId);
      if (!session) return false;

      if (muted) {
        await session.sessionDescriptionHandler.mute();
      } else {
        await session.sessionDescriptionHandler.unmute();
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to mute/unmute SIP call:", error);
      return false;
    }
  }

  /**
   * Send DTMF via SIP INFO or RFC 2833
   */
  async sendDTMF(callId: string, digits: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(callId);
      if (!session) return false;

      // Send each digit
      for (const digit of digits) {
        await session.sessionDescriptionHandler.sendDtmf(digit);
        // Small delay between digits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to send DTMF:", error);
      return false;
    }
  }

  /**
   * Whisper to agent (requires mixer/conference bridge)
   */
  async whisperToAgent(callId: string, message: string): Promise<boolean> {
    try {
      // This typically requires a conference bridge or mixer
      // Implementation depends on PBX capabilities
      console.log(`Whisper to agent on call ${callId}: ${message}`);
      
      // For basic implementation, we could:
      // 1. Put client on hold
      // 2. Play message to agent
      // 3. Resume call
      
      return true;
    } catch (error) {
      console.error("❌ Failed to whisper:", error);
      return false;
    }
  }

  /**
   * Get active SIP session
   */
  private async getActiveSession(callId: string): Promise<any> {
    // In a real implementation, you'd maintain a map of callId to SIP sessions
    // For now, this is a placeholder
    return null;
  }

  /**
   * Create consultation call for attended transfer
   */
  private async createConsultationCall(target: string): Promise<any> {
    try {
      const inviter = new (await import("sip.js")).Inviter(this.sipClient, target);
      await inviter.invite();
      return inviter;
    } catch (error) {
      console.error("❌ Failed to create consultation call:", error);
      return null;
    }
  }

  /**
   * Handle incoming WebRTC offer for browser-based softphone
   */
  async handleWebRTCOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    try {
      // Create peer connection
      this.webRTCPeer = new RTCPeerConnection({
        iceServers: [
          ...this.stunServers.map(server => ({ urls: server })),
          ...this.turnServers
        ]
      });

      // Set remote description
      await this.webRTCPeer.setRemoteDescription(offer);

      // Create answer
      const answer = await this.webRTCPeer.createAnswer();
      await this.webRTCPeer.setLocalDescription(answer);

      return answer;
    } catch (error) {
      console.error("❌ Failed to handle WebRTC offer:", error);
      throw error;
    }
  }

  /**
   * Add ICE candidate for WebRTC
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.webRTCPeer) {
      await this.webRTCPeer.addIceCandidate(candidate);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.sipClient) {
      await this.sipClient.stop();
    }
    if (this.webRTCPeer) {
      this.webRTCPeer.close();
    }
  }
}

/**
 * Asterisk-specific adapter
 */
export class AsteriskAdapter extends SIPAdapter {
  constructor(config: any, tenantId: string) {
    super(config, tenantId);
    // Asterisk-specific configuration
    this.config.sipTransport = config.sipTransport || "ws";
    this.config.sipPort = config.sipPort || 8088; // Asterisk WebSocket port
  }

  /**
   * Use Asterisk AMI for advanced features
   */
  async connectAMI(): Promise<void> {
    // Connect to Asterisk Manager Interface for advanced control
    // This would use the asterisk-manager npm package
    console.log("Connecting to Asterisk AMI...");
  }

  /**
   * Monitor Asterisk queues via AMI
   */
  async monitorQueues(): Promise<void> {
    // Use AMI to monitor queue status
    console.log("Monitoring Asterisk queues...");
  }
}

/**
 * FreePBX-specific adapter (extends Asterisk)
 */
export class FreePBXAdapter extends AsteriskAdapter {
  constructor(config: any, tenantId: string) {
    super(config, tenantId);
    // FreePBX uses Asterisk under the hood
  }

  /**
   * Use FreePBX REST API for configuration
   */
  async configureViaAPI(): Promise<void> {
    // FreePBX provides REST APIs for configuration
    console.log("Configuring via FreePBX API...");
  }
}

/**
 * Cisco-specific adapter
 */
export class CiscoAdapter extends SIPAdapter {
  constructor(config: any, tenantId: string) {
    super(config, tenantId);
    // Cisco-specific configuration
  }

  /**
   * Use Cisco Finesse API for agent desktop integration
   */
  async connectFinesse(): Promise<void> {
    // Connect to Cisco Finesse for agent desktop features
    console.log("Connecting to Cisco Finesse...");
  }

  /**
   * Use JTAPI for advanced call control
   */
  async connectJTAPI(): Promise<void> {
    // Java Telephony API for Cisco systems
    console.log("Connecting to JTAPI...");
  }
}