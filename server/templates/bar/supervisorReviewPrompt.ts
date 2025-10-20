/**
 * Supervisor Review Prompt Email Template
 * Sent when a supervisor needs to review sampled cases
 */

export interface SupervisorReviewPromptData {
  supervisorName: string;
  anonymizedCaseId: string;
  reviewDeadline: string;
  dashboardLink: string;
}

export function supervisorReviewPromptTemplate(data: SupervisorReviewPromptData): { subject: string; html: string; text: string } {
  const { supervisorName, anonymizedCaseId, reviewDeadline, dashboardLink } = data;
  
  const subject = 'Mandatory Case Review Required - Benefits Access Review';
  
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
        <div style="background-color: #d32f2f; color: white; padding: 12px 20px; border-radius: 4px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; font-size: 16px; font-weight: 600;">⚠️ MANDATORY REVIEW REQUIRED</p>
        </div>
        
        <h2 style="color: #0D4F8B; margin-top: 0; font-size: 20px;">Case Review Assignment</h2>
        
        <p style="font-size: 16px; margin: 20px 0;">Hello ${supervisorName},</p>
        
        <p style="font-size: 16px; margin: 20px 0;">
          You have been assigned to review a case as part of the Maryland Benefits Access Review (BAR) program. This review is <strong>mandatory</strong> and must be completed by the deadline specified below.
        </p>
        
        <div style="background-color: #f9f9f9; border-left: 4px solid #0D4F8B; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #666; width: 180px;">Anonymized Case ID:</td>
              <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-weight: 600;">${anonymizedCaseId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #666;">Review Deadline:</td>
              <td style="padding: 8px 0; color: #d32f2f; font-weight: 600;">${reviewDeadline}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #666;">Review Type:</td>
              <td style="padding: 8px 0;">Blind Case Review (Stratified Sample)</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1565c0;">
            📋 Review Instructions:
          </p>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #333;">
            <li style="margin-bottom: 8px;">Access the Supervisor Dashboard using the link below</li>
            <li style="margin-bottom: 8px;">Review case processing timeline and checkpoint completion</li>
            <li style="margin-bottom: 8px;">Evaluate caseworker performance and compliance</li>
            <li style="margin-bottom: 8px;">Submit your review and recommendations by the deadline</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${dashboardLink}" style="background-color: #0D4F8B; color: white; padding: 14px 32px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: 600; font-size: 16px;">Access Supervisor Dashboard</a>
        </div>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>⚠️ Important:</strong> This review is <strong>mandatory</strong> under Maryland DHS quality assurance protocols. Failure to complete by the deadline may result in escalation to your regional supervisor.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
        
        <p style="font-size: 14px; color: #666; margin: 0;">
          <strong>About BAR:</strong> The Benefits Access Review program ensures consistent, high-quality case processing across Maryland. Cases are selected using stratified random sampling to ensure representative coverage.
          <br><br>
          For technical support or questions about the review process, please contact your regional BAR coordinator.
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

⚠️ MANDATORY REVIEW REQUIRED

${subject}

Hello ${supervisorName},

You have been assigned to review a case as part of the Maryland Benefits Access Review (BAR) program. This review is MANDATORY and must be completed by the deadline specified below.

Anonymized Case ID: ${anonymizedCaseId}
Review Deadline: ${reviewDeadline}
Review Type: Blind Case Review (Stratified Sample)

REVIEW INSTRUCTIONS:
1. Access the Supervisor Dashboard using the link below
2. Review case processing timeline and checkpoint completion
3. Evaluate caseworker performance and compliance
4. Submit your review and recommendations by the deadline

Access Supervisor Dashboard: ${dashboardLink}

⚠️ IMPORTANT: This review is MANDATORY under Maryland DHS quality assurance protocols. Failure to complete by the deadline may result in escalation to your regional supervisor.

---

About BAR: The Benefits Access Review program ensures consistent, high-quality case processing across Maryland. Cases are selected using stratified random sampling to ensure representative coverage.

For technical support or questions about the review process, please contact your regional BAR coordinator.

Maryland Department of Human Services
Benefits Access Review System
  `.trim();
  
  return { subject, html, text };
}
