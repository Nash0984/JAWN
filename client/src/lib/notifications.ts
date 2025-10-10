// Notification service for session confirmations
// Integrates with existing notification system

export interface SessionConfirmationData {
  sessionId: string;
  clientName?: string;
  navigatorName: string;
  sessionType: string;
  sessionDate: string;
  location: string;
  nextSteps?: string[];
}

export async function sendSessionConfirmation(
  data: SessionConfirmationData,
  methods: ('email' | 'sms')[] = ['email']
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const response = await fetch('/api/notifications/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        methods
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, errors: [error.message || 'Failed to send confirmation'] };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending session confirmation:', error);
    return { success: false, errors: [(error as Error).message] };
  }
}

export function generateSessionConfirmationText(data: SessionConfirmationData): {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
} {
  const emailSubject = `Session Confirmation - ${data.sessionType.replace('_', ' ')}`;
  
  const emailBody = `
Dear ${data.clientName || 'Client'},

This confirms your session with ${data.navigatorName}.

Session Details:
- Type: ${data.sessionType.replace('_', ' ')}
- Date: ${new Date(data.sessionDate).toLocaleDateString()}
- Location: ${data.location}

${data.nextSteps && data.nextSteps.length > 0 ? `
Next Steps:
${data.nextSteps.map(step => `- ${step}`).join('\n')}
` : ''}

If you have questions, please contact your navigator.

Thank you,
Maryland Benefits Navigator Team
`;

  const smsBody = `Session confirmed with ${data.navigatorName} on ${new Date(data.sessionDate).toLocaleDateString()}. Type: ${data.sessionType}. Location: ${data.location}.`;
  
  return {
    emailSubject,
    emailBody,
    smsBody
  };
}

// Client intake summary confirmation
export interface IntakeSummaryData {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  navigatorName: string;
  sessionDate: string;
  benefitProgram?: string;
  householdSize?: number;
  estimatedIncome?: number;
  nextSteps: string[];
  documentsPending?: string[];
}

export async function sendIntakeSummary(
  data: IntakeSummaryData
): Promise<{ success: boolean; emailSent?: boolean; smsSent?: boolean; errors?: string[] }> {
  const errors: string[] = [];
  let emailSent = false;
  let smsSent = false;
  
  // Send email if email provided
  if (data.clientEmail) {
    try {
      const result = await sendSessionConfirmation({
        sessionId: '', // Not needed for summary
        clientName: data.clientName,
        navigatorName: data.navigatorName,
        sessionType: 'intake_summary',
        sessionDate: data.sessionDate,
        location: 'office',
        nextSteps: data.nextSteps
      }, ['email']);
      
      emailSent = result.success;
      if (!result.success) {
        errors.push(...(result.errors || []));
      }
    } catch (error) {
      errors.push(`Email failed: ${(error as Error).message}`);
    }
  }
  
  // Send SMS if phone provided
  if (data.clientPhone) {
    try {
      const result = await sendSessionConfirmation({
        sessionId: '',
        clientName: data.clientName,
        navigatorName: data.navigatorName,
        sessionType: 'intake_summary',
        sessionDate: data.sessionDate,
        location: 'office',
        nextSteps: data.nextSteps
      }, ['sms']);
      
      smsSent = result.success;
      if (!result.success) {
        errors.push(...(result.errors || []));
      }
    } catch (error) {
      errors.push(`SMS failed: ${(error as Error).message}`);
    }
  }
  
  return {
    success: emailSent || smsSent,
    emailSent,
    smsSent,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Format confirmation message for in-app notification
export function formatConfirmationNotification(data: SessionConfirmationData): {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
} {
  return {
    title: 'Session Confirmation Sent',
    message: `Confirmation sent to ${data.clientName || 'client'} for ${data.sessionType.replace('_', ' ')} session on ${new Date(data.sessionDate).toLocaleDateString()}`,
    type: 'success'
  };
}
