/**
 * Overdue Alert Email Template
 * Sent to caseworkers and supervisors when checkpoints are overdue
 */

export interface OverdueAlertData {
  recipientName: string;
  checkpointName: string;
  caseId: string;
  daysOverdue: number;
  isUrgent: boolean;
}

export function overdueAlertTemplate(data: OverdueAlertData): { subject: string; html: string; text: string } {
  const { recipientName, checkpointName, caseId, daysOverdue, isUrgent } = data;
  
  const subject = isUrgent 
    ? `URGENT: Case Checkpoint Overdue - ${daysOverdue} Days`
    : `Case Checkpoint Overdue - ${daysOverdue} Days`;
  
  const urgencyColor = isUrgent ? '#d32f2f' : '#f57c00';
  const urgencyBg = isUrgent ? '#ffebee' : '#fff3e0';
  const urgencyBorder = isUrgent ? '#f44336' : '#ff9800';
  
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
        <div style="background-color: ${urgencyColor}; color: white; padding: 14px 20px; border-radius: 4px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; font-size: 18px; font-weight: 700;">
            ${isUrgent ? '🚨 URGENT: CHECKPOINT OVERDUE' : '⚠️ CHECKPOINT OVERDUE'}
          </p>
        </div>
        
        <h2 style="color: ${urgencyColor}; margin-top: 0; font-size: 20px;">Overdue Case Checkpoint Alert</h2>
        
        <p style="font-size: 16px; margin: 20px 0;">Hello ${recipientName},</p>
        
        <p style="font-size: 16px; margin: 20px 0;">
          A case checkpoint is <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</strong>. Immediate action is required to bring this case back into compliance with state processing timelines.
        </p>
        
        <div style="background-color: ${urgencyBg}; border-left: 4px solid ${urgencyBorder}; padding: 20px; margin: 24px 0;">
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
              <td style="padding: 8px 0; font-weight: 600; color: #666;">Days Overdue:</td>
              <td style="padding: 8px 0; color: ${urgencyColor}; font-weight: 700; font-size: 18px;">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">
            Required Actions:
          </p>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #333;">
            <li style="margin-bottom: 8px;">Complete the overdue checkpoint immediately</li>
            <li style="margin-bottom: 8px;">Document any delays or barriers in the case notes</li>
            <li style="margin-bottom: 8px;">Update case status in the system</li>
            ${isUrgent ? '<li style="margin-bottom: 8px; color: #d32f2f; font-weight: 600;">Notify your supervisor of completion status</li>' : ''}
          </ol>
        </div>
        
        ${isUrgent ? `
        <div style="background-color: #ffebee; border: 2px solid #d32f2f; border-radius: 4px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #b71c1c; font-weight: 600;">
            🚨 ESCALATION NOTICE: This case is critically overdue (${daysOverdue}+ days). Continued delays may result in:
          </p>
          <ul style="margin: 8px 0 0 20px; padding: 0; font-size: 13px; color: #b71c1c;">
            <li>Escalation to regional supervisor</li>
            <li>Impact on departmental compliance metrics</li>
            <li>Potential delays in client benefits</li>
          </ul>
        </div>
        ` : `
        <div style="background-color: #fff3e0; border: 1px solid #ff9800; border-radius: 4px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #e65100;">
            <strong>⚠️ Compliance Alert:</strong> Please complete this checkpoint as soon as possible. Cases overdue by more than 5 days will trigger escalation protocols.
          </p>
        </div>
        `}
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
        
        <p style="font-size: 14px; color: #666; margin: 0;">
          This is an automated alert from the Maryland DHS Benefits Access Review system.
          <br><br>
          For assistance with this case or questions about processing requirements, please contact your supervisor immediately.
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

${isUrgent ? '🚨 URGENT: CHECKPOINT OVERDUE' : '⚠️ CHECKPOINT OVERDUE'}

${subject}

Hello ${recipientName},

A case checkpoint is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Immediate action is required to bring this case back into compliance with state processing timelines.

Case ID: ${caseId}
Checkpoint: ${checkpointName}
Days Overdue: ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}

REQUIRED ACTIONS:
1. Complete the overdue checkpoint immediately
2. Document any delays or barriers in the case notes
3. Update case status in the system
${isUrgent ? '4. Notify your supervisor of completion status\n' : ''}

${isUrgent ? `
🚨 ESCALATION NOTICE: This case is critically overdue (${daysOverdue}+ days). Continued delays may result in:
- Escalation to regional supervisor
- Impact on departmental compliance metrics
- Potential delays in client benefits
` : `
⚠️ COMPLIANCE ALERT: Please complete this checkpoint as soon as possible. Cases overdue by more than 5 days will trigger escalation protocols.
`}

---

This is an automated alert from the Maryland DHS Benefits Access Review system.

For assistance with this case or questions about processing requirements, please contact your supervisor immediately.

Maryland Department of Human Services
Benefits Access Review System
  `.trim();
  
  return { subject, html, text };
}
