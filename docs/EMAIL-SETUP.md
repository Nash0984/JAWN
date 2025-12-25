# Email Notification Setup Guide

## Overview

The Maryland Benefits Navigator system includes an email notification backup system for offline users. When a user is not connected via WebSocket, the system automatically sends email notifications if the user has email enabled in their preferences.

## How It Works

1. **Notification Created** → System attempts to send via WebSocket (real-time)
2. **User Offline?** → System checks if user has active WebSocket connections
3. **Email Enabled?** → System checks user's notification preferences
4. **Send Email** → If offline and email enabled, sends email notification

## Current Status

✅ **Email Service:** Implemented and ready  
⚠️ **SMTP Configuration:** Not configured (emails logged to console)  
✅ **User Preferences:** Email toggle available in notification settings  
✅ **Templates:** Maryland-branded HTML email templates created  

## Production Setup

### Step 1: Install Nodemailer

**Note:** If you encounter peer dependency conflicts with `@tailwindcss/vite` and `vite@7.x`, use the `--legacy-peer-deps` flag:

```bash
npm install nodemailer @types/nodemailer --legacy-peer-deps
```

Alternatively, use `--force`:
```bash
npm install nodemailer @types/nodemailer --force
```

The peer dependency warning is unrelated to nodemailer and can be safely ignored.

### Step 2: Configure Environment Variables

Add the following to your `.env` file or Replit Secrets:

```env
SMTP_HOST=smtp.gmail.com        # Your SMTP host
SMTP_PORT=587                   # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@domain.com # SMTP username
SMTP_PASS=your-app-password     # SMTP password or app-specific password
SMTP_FROM_EMAIL=noreply@maryland.gov  # Sender email address
```

### Step 3: Recommended SMTP Providers

#### Option 1: SendGrid (Recommended for Production)
- **Free Tier:** 100 emails/day
- **Setup:** Create account → Get API key → Use as SMTP password
- **Host:** `smtp.sendgrid.net`
- **Port:** `587`
- **Docs:** https://sendgrid.com/docs/for-developers/sending-email/integrating-with-the-smtp-api/

#### Option 2: Amazon SES (AWS Simple Email Service)
- **Free Tier:** 62,000 emails/month (when sent from EC2)
- **Setup:** Verify domain → Generate SMTP credentials
- **Host:** `email-smtp.us-east-1.amazonaws.com` (varies by region)
- **Port:** `587`
- **Docs:** https://docs.aws.amazon.com/ses/

#### Option 3: Mailgun
- **Free Tier:** 5,000 emails/month
- **Setup:** Create account → Add domain → Get SMTP credentials
- **Host:** `smtp.mailgun.org`
- **Port:** `587`
- **Docs:** https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp

#### Option 4: Gmail (Development Only - Not Recommended for Production)
- **Limit:** 500 emails/day
- **Setup:** Enable "Less secure app access" or use App Password
- **Host:** `smtp.gmail.com`
- **Port:** `587`
- **Note:** Gmail may block automated emails

### Step 4: Uncomment Production Code

In `server/services/email.service.ts`, uncomment the nodemailer code (lines marked with `// PRODUCTION CODE`):

```typescript
// Uncomment this section after installing nodemailer
const nodemailer = require('nodemailer');

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
  text: text || html.replace(/<[^>]*>/g, '')
});
```

### Step 5: Restart Application

```bash
npm run dev
```

You should see:
```
✅ Email service configured successfully
```

Instead of:
```
⚠️ Email service not configured. Email notifications will be logged to console.
```

## Email Template Customization

Email templates are located in `server/services/email.service.ts` in the `sendNotificationEmail` method.

### Template Features
- **Maryland Branding:** Uses official DHS color (#0D4F8B)
- **Responsive Design:** Works on desktop and mobile
- **Plain Text Fallback:** Includes text-only version for email clients
- **Action Links:** Direct links to notification actions
- **User Preferences:** Link to manage notification settings

### Customize Template

Edit the HTML template in `email.service.ts`:

```typescript
const html = `
  <!DOCTYPE html>
  <html>
  <!-- Your custom template here -->
  </html>
`;
```

## User Notification Preferences

Users can manage their notification preferences at `/notifications/settings`:

- **In-App Notifications:** Toggle WebSocket real-time notifications
- **Email Notifications:** Toggle email backup for offline notifications
- **Category Preferences:** Policy changes, feedback alerts, navigator assignments, etc.

## Testing Email Notifications

### Test Scenario 1: Offline User

1. Log in as a user (e.g., `demo.applicant`)
2. Go to Notification Settings
3. Enable "Email Notifications"
4. Close the browser tab (disconnect WebSocket)
5. Have an admin create a notification for that user
6. Check console logs for email output

### Test Scenario 2: Online User

1. Keep user logged in with browser tab open
2. Create notification for that user
3. Should receive WebSocket notification (NO email sent)

### Test Scenario 3: Email Disabled

1. User disables "Email Notifications" in settings
2. Close browser tab
3. Create notification
4. No email sent (user preference respected)

## Monitoring & Logs

### Success Log
```
📧 Email backup sent to offline user: user@example.com
```

### Error Log
```
❌ Failed to send email backup: [error details]
```

### Development Log (No SMTP)
```
📧 [EMAIL SERVICE - NOT CONFIGURED]
──────────────────────────────────────────────────────────
To: user@example.com
Subject: Maryland Benefits: New Assignment
──────────────────────────────────────────────────────────
[Email content here]
──────────────────────────────────────────────────────────
```

## Security Considerations

1. **Never Commit Secrets:** Keep SMTP credentials in environment variables, never in code
2. **Use App Passwords:** For Gmail/personal accounts, use app-specific passwords
3. **Rate Limiting:** SMTP providers have rate limits - monitor usage
4. **SPF/DKIM:** Configure email authentication to prevent spam classification
5. **Encryption:** Always use TLS (port 587) or SSL (port 465)

## Troubleshooting

### Issue: Emails Not Sending

**Check:**
1. ✅ Environment variables are set correctly
2. ✅ SMTP credentials are valid
3. ✅ User has `emailEnabled: true` in preferences
4. ✅ User is actually offline (no WebSocket connection)
5. ✅ Firewall allows outbound SMTP traffic

### Issue: Emails Going to Spam

**Fix:**
1. Configure SPF record for your domain
2. Configure DKIM signing
3. Use verified sender domain
4. Warm up IP (gradually increase volume)

### Issue: Rate Limited

**Fix:**
1. Implement email queuing/batching
2. Upgrade to higher tier plan
3. Use multiple SMTP providers
4. Add delay between sends

## Future Enhancements

- [ ] Email queue system with retry logic
- [ ] Batch digest emails (daily/weekly summary)
- [ ] Email templates for each notification type
- [ ] Rich email analytics (open rate, click rate)
- [ ] Multi-language email templates
- [ ] SMS notification fallback (Twilio integration)

## Support

For issues or questions:
- **Technical Support:** Contact DHS IT team
- **Email Configuration:** Contact system administrator
- **User Support:** See User Guide for notification settings
