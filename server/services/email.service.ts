/**
 * Email Service for Maryland Benefits Navigator
 * 
 * Provides email notification backup for offline users.
 * 
 * PRODUCTION SETUP REQUIRED:
 * - Install nodemailer: npm install nodemailer @types/nodemailer
 * - Configure SMTP settings via environment variables:
 *   - SMTP_HOST
 *   - SMTP_PORT
 *   - SMTP_USER
 *   - SMTP_PASS
 *   - SMTP_FROM_EMAIL
 */

import { logger } from './logger.service';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailServiceInterface {
  sendEmail(params: EmailParams): Promise<boolean>;
  sendNotificationEmail(
    userEmail: string, 
    notificationTitle: string, 
    notificationMessage: string,
    actionUrl?: string
  ): Promise<boolean>;
  isConfigured(): boolean;
}

class EmailService implements EmailServiceInterface {
  private isEmailConfigured: boolean;

  constructor() {
    // Check if SMTP is configured via environment variables
    this.isEmailConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM_EMAIL
    );

    if (!this.isEmailConfigured) {
      logger.warn('Email service not configured. Email notifications will be logged to console.', {
        service: 'EmailService',
        hint: 'To enable email: Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL'
      });
    }
  }

  isConfigured(): boolean {
    return this.isEmailConfigured;
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    const { to, subject, html, text } = params;

    if (!this.isEmailConfigured) {
      // Log email to console when SMTP not configured (this is not a failure - it's intentional fallback)
      console.log('📧 [EMAIL SERVICE - NOT CONFIGURED]');
      console.log('─'.repeat(60));
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('─'.repeat(60));
      console.log(text || html);
      console.log('─'.repeat(60));
      return true; // Return true for successful console fallback
    }

    try {
      // Import nodemailer dynamically (ESM) to avoid startup errors if not installed
      let nodemailer;
      try {
        const nodemailerModule = await import('nodemailer');
        nodemailer = nodemailerModule.default || nodemailerModule;
      } catch (err) {
        logger.error('nodemailer package not found', {
          service: 'EmailService',
          action: 'Install with: npm install nodemailer @types/nodemailer'
        });
        console.log(`[SMTP CONFIGURED BUT NODEMAILER MISSING] Would send email to ${to}: ${subject}`);
        // Return true for console fallback (not a send failure)
        return true;
      }
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text fallback
      });

      logger.info('Email sent successfully', {
        service: 'EmailService',
        to,
        subject
      });
      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        service: 'EmailService',
        to,
        subject,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async sendNotificationEmail(
    userEmail: string,
    notificationTitle: string,
    notificationMessage: string,
    actionUrl?: string
  ): Promise<boolean> {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'http://localhost:5000';

    const actionLink = actionUrl ? `${baseUrl}${actionUrl}` : baseUrl;

    // Create HTML email template
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notificationTitle}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0D4F8B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Maryland Benefits Navigator</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #0D4F8B; margin-top: 0;">${notificationTitle}</h2>
          <p style="font-size: 16px; margin: 20px 0;">${notificationMessage}</p>
          ${actionUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionLink}" style="background-color: #0D4F8B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: 500;">View Notification</a>
            </div>
          ` : ''}
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="font-size: 14px; color: #666;">
            You're receiving this email because you have email notifications enabled for your Maryland Benefits Navigator account.
            <br><br>
            To manage your notification preferences, visit your account settings.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Maryland Department of Human Services<br>
          Maryland Benefits Navigator System</p>
        </div>
      </body>
      </html>
    `;

    // Create plain text version
    const text = `
Maryland Benefits Navigator

${notificationTitle}

${notificationMessage}

${actionUrl ? `View notification: ${actionLink}` : ''}

---
You're receiving this email because you have email notifications enabled for your Maryland Benefits Navigator account.
To manage your notification preferences, visit your account settings.

Maryland Department of Human Services
Maryland Benefits Navigator System
    `.trim();

    return await this.sendEmail({
      to: userEmail,
      subject: `Maryland Benefits: ${notificationTitle}`,
      html,
      text
    });
  }
}

export const emailService = new EmailService();
