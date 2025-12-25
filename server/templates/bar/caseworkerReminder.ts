/**
 * Caseworker Reminder Email Template
 * Sent 3 days and 1 day before checkpoint due dates
 */

export interface CaseworkerReminderData {
  caseworkerName: string;
  caseId: string;
  checkpointName: string;
  dueDate: string;
  daysUntil: number;
}

export function caseworkerReminderTemplate(data: CaseworkerReminderData): { subject: string; html: string; text: string } {
  const { caseworkerName, caseId, checkpointName, dueDate, daysUntil } = data;
  
  const subject = `Case Review Checkpoint Due in ${daysUntil} Day${daysUntil !== 1 ? 's' : ''}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #0D4F8B; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Maryland Department of Human Services</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Benefits Access Review System</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #0D4F8B; margin-top: 0; font-size: 20px;">Upcoming Checkpoint Reminder</h2>
        
        <p style="font-size: 16px; margin: 20px 0;">Hello ${caseworkerName},</p>
        
        <p style="font-size: 16px; margin: 20px 0;">
          This is a reminder that the following checkpoint is due in <strong>${daysUntil} day${daysUntil !== 1 ? 's' : ''}</strong>:
        </p>
        
        <div style="background-color: #f9f9f9; border-left: 4px solid #0D4F8B; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #666; width: 160px;">Case ID:</td>
              <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-weight: 600;">${caseId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #666;">Checkpoint:</td>
              <td style="padding: 8px 0;">${checkpointName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #666;">Due Date:</td>
              <td style="padding: 8px 0; color: #d32f2f; font-weight: 600;">${dueDate}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 16px; margin: 24px 0;">
          Please ensure this checkpoint is completed by the due date to maintain compliance with state processing timelines.
        </p>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>⏰ Action Required:</strong> Complete this checkpoint within ${daysUntil} day${daysUntil !== 1 ? 's' : ''} to avoid delays in case processing.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
        
        <p style="font-size: 14px; color: #666; margin: 0;">
          This is an automated reminder from the Maryland DHS Benefits Access Review system.
          <br><br>
          If you have questions about this checkpoint, please contact your supervisor.
        </p>
      </div>
      
      <div style="text-align: center; padding: 24px; color: #999; font-size: 12px;">
        <p style="margin: 0;">Maryland Department of Human Services</p>
        <p style="margin: 8px 0 0 0;">Benefits Access Review System</p>
      </div>
    </body>
    </html>
  `;
  
  const text = `
MARYLAND DEPARTMENT OF HUMAN SERVICES
Benefits Access Review System

${subject}

Hello ${caseworkerName},

This is a reminder that the following checkpoint is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}:

Case ID: ${caseId}
Checkpoint: ${checkpointName}
Due Date: ${dueDate}

Please ensure this checkpoint is completed by the due date to maintain compliance with state processing timelines.

⏰ ACTION REQUIRED: Complete this checkpoint within ${daysUntil} day${daysUntil !== 1 ? 's' : ''} to avoid delays in case processing.

---

This is an automated reminder from the Maryland DHS Benefits Access Review system.
If you have questions about this checkpoint, please contact your supervisor.

Maryland Department of Human Services
Benefits Access Review System
  `.trim();
  
  return { subject, html, text };
}
