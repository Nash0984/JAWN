/**
 * Twilio Configuration Service
 * Checks if Twilio is configured and provides configuration
 * Gracefully handles when Twilio is not available
 */

import { logger } from './logger.service';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  isConfigured: true;
}

interface TwilioNotConfigured {
  isConfigured: false;
  reason: string;
}

type TwilioConfigResult = TwilioConfig | TwilioNotConfigured;

/**
 * Get Twilio configuration from environment variables
 * Returns null if Twilio is not configured
 */
export function getTwilioConfig(): TwilioConfigResult {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    const missing = [];
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!phoneNumber) missing.push('TWILIO_PHONE_NUMBER');
    
    return {
      isConfigured: false,
      reason: `Missing environment variables: ${missing.join(', ')}`
    };
  }

  // Validate phone number format (E.164)
  if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
    return {
      isConfigured: false,
      reason: `Invalid TWILIO_PHONE_NUMBER format. Must be E.164 format (e.g., +12345678900)`
    };
  }

  return {
    accountSid,
    authToken,
    phoneNumber,
    isConfigured: true
  };
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  const config = getTwilioConfig();
  return config.isConfigured;
}

/**
 * Get Twilio client if configured, null otherwise
 */
export function getTwilioClient() {
  const config = getTwilioConfig();
  
  if (!config.isConfigured) {
    logger.warn('Twilio not configured', { reason: config.reason });
    return null;
  }

  try {
    // Dynamically import Twilio (optional dependency)
    const twilio = require('twilio');
    return twilio(config.accountSid, config.authToken);
  } catch (error) {
    logger.error('Twilio package not installed', { message: 'Run: npm install twilio' });
    return null;
  }
}

/**
 * Validate Twilio webhook signature
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, any>
): boolean {
  const config = getTwilioConfig();
  
  if (!config.isConfigured) {
    logger.warn('Cannot validate Twilio signature - Twilio not configured');
    return false;
  }

  try {
    const twilio = require('twilio');
    return twilio.validateRequest(
      config.authToken,
      signature,
      url,
      params
    );
  } catch (error) {
    logger.error('Error validating Twilio signature', { error });
    return false;
  }
}

// Log Twilio configuration status on module load
const config = getTwilioConfig();
if (config.isConfigured) {
  logger.info('Twilio SMS configured', { phoneNumber: config.phoneNumber });
} else {
  logger.warn('Twilio SMS not configured', { 
    reason: config.reason,
    message: 'SMS features will be disabled. Configure environment variables to enable.'
  });
}
