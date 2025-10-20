/**
 * Twilio Webhook Routes
 * Handle incoming SMS messages and delivery status callbacks
 */

import { Router } from "express";
import { validateTwilioSignature } from "../services/twilioConfig";
import { handleIncomingMessage, updateMessageStatus } from "../services/smsService";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limit for webhook endpoints
const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/sms/incoming
 * Receive incoming SMS messages from Twilio
 */
router.post('/incoming', webhookRateLimit, async (req, res) => {
  try {
    // Validate Twilio signature for security
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // For development, skip validation if explicitly disabled
    const skipValidation = process.env.SKIP_TWILIO_VALIDATION === 'true';
    
    if (!skipValidation && signature) {
      const isValid = validateTwilioSignature(signature, url, req.body);
      if (!isValid) {
        console.warn('⚠️  Invalid Twilio signature');
        return res.status(403).send('Invalid signature');
      }
    }
    
    // Extract Twilio webhook payload
    const {
      From: from,
      Body: body,
      To: to,
      MessageSid: messageSid
    } = req.body;
    
    if (!from || !body || !to) {
      console.error('❌ Missing required Twilio webhook fields');
      return res.status(400).send('Missing required fields');
    }
    
    console.log(`📨 Incoming SMS from ${from} to ${to}: ${body}`);
    
    // Process the message
    const result = await handleIncomingMessage(from, body, to);
    
    // Return TwiML response (empty response, we handle replies in handleIncomingMessage)
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Message processed -->
</Response>`);
  } catch (error) {
    console.error('❌ Error processing incoming SMS:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * POST /api/sms/status
 * Receive message delivery status callbacks from Twilio
 */
router.post('/status', webhookRateLimit, async (req, res) => {
  try {
    // Validate Twilio signature
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    const skipValidation = process.env.SKIP_TWILIO_VALIDATION === 'true';
    
    if (!skipValidation && signature) {
      const isValid = validateTwilioSignature(signature, url, req.body);
      if (!isValid) {
        console.warn('⚠️  Invalid Twilio signature on status callback');
        return res.status(403).send('Invalid signature');
      }
    }
    
    // Extract status update
    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus
    } = req.body;
    
    if (!messageSid || !messageStatus) {
      console.error('❌ Missing MessageSid or MessageStatus in callback');
      return res.status(400).send('Missing required fields');
    }
    
    console.log(`📊 Status update for ${messageSid}: ${messageStatus}`);
    
    // Update message status in database
    await updateMessageStatus(messageSid, messageStatus);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing status callback:', error);
    res.status(500).send('Internal server error');
  }
});

export default router;
