# Phone System Integration Documentation

## Overview
This comprehensive phone system integration supports both traditional PBX systems (Asterisk, FreePBX, Cisco) and cloud-based solutions (Twilio Voice). The system provides vendor-agnostic call management, IVR menus, call recording with compliance, and real-time agent desktop interfaces.

## Architecture

### Universal Phone API Layer
The system uses an adapter pattern to support multiple phone providers:
- **PhoneSystemAdapter**: Abstract interface for all phone operations
- **TwilioVoiceAdapter**: Full Twilio Voice implementation with IVR
- **SIPAdapter**: WebRTC/SIP integration for PBX systems
- **AsteriskAdapter**: Specialized adapter for Asterisk/FreePBX
- **CiscoAdapter**: Integration with Cisco call systems

### Key Features
1. **Multi-tenant support**: Isolated phone configurations per organization
2. **Automatic failover**: Falls back to secondary adapters if primary fails
3. **Real-time updates**: WebSocket integration for live call status
4. **Compliance-ready**: HIPAA-compliant with state-specific recording laws

## Configuration

### Twilio Voice Setup

1. **Environment Variables**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
BASE_URL=https://your-app.com
```

2. **Database Configuration**
```sql
INSERT INTO phone_system_configs (
  tenant_id, system_type, system_name,
  twilio_account_sid, twilio_auth_token, twilio_phone_number,
  is_active, is_default
) VALUES (
  'your-tenant-id', 'twilio', 'Twilio Voice Primary',
  'ACxxxxx', 'encrypted_token', '+1234567890',
  true, true
);
```

3. **Webhook Configuration**
In your Twilio Console, set the following webhooks:
- Voice URL: `https://your-app.com/api/phone/twilio/voice-webhook`
- Status Callback: `https://your-app.com/api/phone/twilio/status-webhook`

### SIP/PBX Setup

#### Asterisk Configuration

1. **SIP Configuration** (`/etc/asterisk/sip.conf`)
```ini
[general]
context=default
allowoverlap=no
udpbindaddr=0.0.0.0
tcpenable=yes
tcpbindaddr=0.0.0.0
transport=udp,tcp,ws,wss
websocket_enabled=yes

[webrtc-client]
type=friend
username=webrtc
secret=your_password
host=dynamic
context=from-internal
encryption=yes
avpf=yes
force_avp=yes
icesupport=yes
directmedia=no
transport=ws,wss
dtlsverify=fingerprint
dtlsenable=yes
dtlscertfile=/etc/asterisk/keys/asterisk.pem
dtlssetup=actpass
rtcp_mux=yes
```

2. **Database Configuration**
```sql
INSERT INTO phone_system_configs (
  tenant_id, system_type, system_name,
  sip_host, sip_port, sip_username, sip_password,
  sip_domain, sip_transport, stun_servers,
  is_active
) VALUES (
  'your-tenant-id', 'asterisk', 'Asterisk PBX',
  '192.168.1.100', 5060, 'webrtc', 'encrypted_password',
  'your-domain.com', 'ws',
  '["stun:stun.l.google.com:19302"]',
  true
);
```

#### FreePBX Configuration

FreePBX uses Asterisk under the hood. Follow the Asterisk setup and additionally:

1. Enable WebRTC in FreePBX Admin → Settings → Advanced Settings
2. Create SIP extension with WebRTC enabled
3. Configure firewall rules for WebSocket connections

#### Cisco Call Manager

1. **SIP Trunk Configuration**
- Navigate to Device → Trunk
- Create new SIP Trunk
- Set destination address to your application server
- Enable DTMF relay

2. **CTI Route Point**
- Create CTI Route Point for application control
- Associate with application user
- Set appropriate calling search space

## IVR Configuration

### Creating IVR Menus

```javascript
// Example IVR configuration
const ivrConfig = {
  menuId: "main-menu",
  name: "Main Menu",
  greetingText: "Welcome to Maryland Benefits. Press 1 for benefit screening, Press 2 for application status, Press 3 for tax assistance, Press 4 to speak with a navigator",
  language: "en",
  voiceGender: "female",
  inputType: "both", // dtmf, voice, or both
  options: [
    {
      dtmfKey: "1",
      voiceKeyword: "benefits",
      label: "Benefit Screening",
      promptText: "Press 1 for benefit screening",
      actionType: "menu",
      actionTarget: "benefits-menu",
      priority: 1
    },
    {
      dtmfKey: "2",
      voiceKeyword: "status",
      label: "Application Status",
      promptText: "Press 2 for application status",
      actionType: "transfer",
      actionTarget: "status-queue",
      priority: 2
    },
    {
      dtmfKey: "3",
      voiceKeyword: "tax",
      label: "Tax Assistance",
      promptText: "Press 3 for tax assistance",
      actionType: "transfer",
      actionTarget: "tax-queue",
      priority: 3
    },
    {
      dtmfKey: "4",
      voiceKeyword: "agent",
      label: "Speak to Navigator",
      promptText: "Press 4 to speak with a navigator",
      actionType: "transfer",
      actionTarget: "navigator-queue",
      priority: 4
    }
  ]
};

// POST to /api/phone/ivr/configure
```

### Multi-language Support

```javascript
// Spanish IVR menu
const spanishIVR = {
  menuId: "main-menu-es",
  name: "Menú Principal",
  greetingText: "Bienvenido a Beneficios de Maryland. Presione 1 para evaluación de beneficios...",
  language: "es",
  voiceGender: "female",
  // ... options in Spanish
};
```

## Call Recording Compliance

### Two-Party Consent States
The following states require consent from all parties:
- California, Connecticut, Delaware, Florida, Illinois, Maryland, Massachusetts
- Michigan, Montana, New Hampshire, Nevada, Oregon, Pennsylvania, Vermont, Washington

### Consent Capture Flow

1. **Verbal Consent**
```javascript
// Automatic announcement before recording
"This call may be recorded for quality and training purposes. 
If you do not wish to be recorded, please inform your agent."
```

2. **DTMF Consent**
```javascript
"Press 1 to consent to recording, Press 2 to decline"
```

3. **Logging Consent**
```javascript
await apiRequest('/api/phone/recording/consent', 'POST', {
  callId: 'call_123',
  consentGiven: true,
  consentType: 'verbal',
  stateCode: 'MD',
  consentText: 'Verbal consent given at start of call'
});
```

## Agent Desktop Usage

### Quick Start for Agents

1. **Set Status to Available**
   - Select "Available" from the status dropdown
   - Assign yourself to appropriate queues

2. **Making Outbound Calls**
   - Enter phone number in the dial field
   - Click "Call" button or press Enter
   - Call will initiate using default phone system

3. **Handling Inbound Calls**
   - Notification appears for incoming calls
   - Click "Answer" to accept the call
   - Client information automatically displays

4. **Call Controls**
   - **Hold**: Pause the call temporarily
   - **Mute**: Disable your microphone
   - **Record**: Start/stop recording (with consent)
   - **Transfer**: Send call to another agent or queue

5. **Call Transfer Options**
   - **Blind Transfer**: Immediately transfer without introduction
   - **Attended Transfer**: Speak with target before transferring
   - **Conference**: Add third party to existing call

## API Reference

### Call Control

#### Initiate Call
```http
POST /api/phone/call/initiate
Content-Type: application/json

{
  "to": "+14105551234",
  "from": "+14105559999",  // optional, uses default if not provided
  "agentId": "agent123",
  "recordCall": false,
  "metadata": {
    "clientId": "client456",
    "caseNumber": "2024-001"
  }
}
```

#### Transfer Call
```http
POST /api/phone/call/transfer
Content-Type: application/json

{
  "callId": "call_abc123",
  "targetExtension": "5001",
  "transferType": "blind",  // or "attended", "conference"
  "announcementText": "Call from benefits screening"
}
```

#### Get Call Status
```http
GET /api/phone/call/status/{callId}

Response:
{
  "callId": "call_abc123",
  "status": "in-progress",
  "duration": 145,
  "talkTime": 120,
  "holdTime": 25,
  "position": null,
  "estimatedWaitTime": null
}
```

### Queue Management

#### Get Queue Status
```http
GET /api/phone/queue/status

Response:
{
  "data": [
    {
      "queueId": "queue_123",
      "queueName": "Benefits Queue",
      "waitingCalls": 3,
      "availableAgents": 2,
      "averageWaitTime": 180,
      "longestWaitTime": 420
    }
  ]
}
```

### Agent Management

#### Update Agent Status
```http
POST /api/phone/agent/status
Content-Type: application/json

{
  "status": "available",  // available, busy, on_call, break, offline
  "assignedQueues": ["benefits-queue", "tax-queue"],
  "skills": ["spanish", "benefits-expert"]
}
```

## Network Requirements

### Ports
- **SIP**: 5060 (UDP/TCP), 5061 (TLS)
- **RTP Media**: 10000-20000 (UDP)
- **WebSocket**: 8088 (Asterisk), 8089 (WSS)
- **HTTPS**: 443

### Firewall Rules
```bash
# SIP signaling
iptables -A INPUT -p udp --dport 5060 -j ACCEPT
iptables -A INPUT -p tcp --dport 5060 -j ACCEPT
iptables -A INPUT -p tcp --dport 5061 -j ACCEPT

# RTP media
iptables -A INPUT -p udp --dport 10000:20000 -j ACCEPT

# WebSocket for WebRTC
iptables -A INPUT -p tcp --dport 8088 -j ACCEPT
iptables -A INPUT -p tcp --dport 8089 -j ACCEPT
```

### Bandwidth Requirements
- **G.711 codec**: 87.2 kbps per call
- **G.729 codec**: 31.2 kbps per call
- **Opus codec**: 6-510 kbps (adaptive)

Recommended: 100 kbps per concurrent call minimum

## Security Best Practices

1. **Encryption**
   - Use TLS for SIP signaling (port 5061)
   - Enable SRTP for media encryption
   - Use WSS for WebSocket connections

2. **Authentication**
   - Strong passwords for SIP credentials
   - API key rotation for Twilio
   - OAuth2/JWT for API endpoints

3. **Rate Limiting**
   - Implement rate limiting on all API endpoints
   - Monitor for unusual call patterns
   - Set maximum concurrent call limits

4. **Data Protection**
   - Encrypt call recordings at rest
   - Auto-delete recordings after 90 days
   - Audit log all access to recordings

5. **Network Security**
   - Whitelist IP addresses for SIP trunks
   - Use VPN for remote agent connections
   - Regular security audits

## Troubleshooting

### Common Issues

#### No Audio on Calls
1. Check firewall rules for RTP ports (10000-20000)
2. Verify STUN/TURN server configuration
3. Ensure correct codec negotiation

#### WebRTC Connection Failed
1. Verify WebSocket connectivity
2. Check SSL certificate validity
3. Confirm ICE candidate gathering

#### Call Recording Not Working
1. Verify consent capture is functioning
2. Check storage permissions
3. Confirm webhook URLs are accessible

#### IVR Menu Not Playing
1. Check audio file formats (WAV, MP3)
2. Verify TTS service connectivity
3. Confirm menu configuration in database

### Debug Logging

Enable detailed logging:
```javascript
// In phoneSystemAdapter.ts
process.env.PHONE_DEBUG = "true";

// In twilioVoiceAdapter.ts
twilioClient.on('request', (request) => {
  console.log('Twilio Request:', request);
});
```

### Health Checks

```http
GET /api/phone/health

Response:
{
  "status": "healthy",
  "adapters": {
    "twilio": "connected",
    "asterisk": "connected"
  },
  "activeCallls": 5,
  "queuedCalls": 2,
  "availableAgents": 8
}
```

## Performance Optimization

1. **Connection Pooling**
   - Reuse SIP connections
   - Maintain WebSocket connections
   - Cache frequently accessed data

2. **Queue Optimization**
   - Implement skill-based routing
   - Use priority queuing for VIP clients
   - Load balance across available agents

3. **Media Optimization**
   - Use appropriate codecs for bandwidth
   - Enable VAD (Voice Activity Detection)
   - Implement jitter buffers

## Support

For technical support:
- Review error logs in `/tmp/logs/phone_system_*.log`
- Check WebSocket connection status
- Verify phone system configuration in database
- Contact system administrator for PBX issues