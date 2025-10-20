/**
 * SMS Message Templates
 * Pre-defined templates for common SMS responses
 * Keep messages under 160 characters when possible for single SMS
 */

interface TemplateContext {
  tenantName?: string;
  zipCode?: string;
  householdSize?: number;
  monthlyIncome?: number;
  benefitAmount?: number;
  phoneNumber?: string;
  websiteUrl?: string;
  link?: string;
  expiresIn?: string;
  completedDate?: string;
}

export const smsTemplates = {
  // Welcome & Help Messages
  welcome: (ctx: TemplateContext) => 
    `Welcome to ${ctx.tenantName || 'Benefits'}! Reply SNAP for food assistance, TAX for tax help, or HELP for options.`,
  
  help: (ctx: TemplateContext) => 
    `Available commands:\nSNAP/FOOD - Check food assistance\nTAX/VITA - Get tax help\nRESET - Start over\nSTOP - Unsubscribe\nHELP - This menu`,
  
  // Screener Flow Messages
  screenerStart: () => 
    `Let's check your eligibility! First, what's your ZIP code?`,
  
  askHouseholdSize: () => 
    `Got it! How many people live in your household?`,
  
  askMonthlyIncome: () => 
    `What's your total monthly household income before taxes?`,
  
  askSavings: () => 
    `Do you have more than $2,750 in savings/bank accounts? Reply YES or NO.`,
  
  askElderlyDisabled: () => 
    `Is anyone in your household elderly (60+) or disabled? Reply YES or NO.`,
  
  // Results Messages
  eligible: (ctx: TemplateContext) => 
    `Good news! You may qualify for up to $${ctx.benefitAmount}/month in SNAP benefits! Visit ${ctx.websiteUrl || 'our website'} to apply or call ${ctx.phoneNumber || 'us'}.`,
  
  ineligible: (ctx: TemplateContext) => 
    `Based on your info, you may not qualify for SNAP now. But check out other programs at ${ctx.websiteUrl || 'our website'} or call ${ctx.phoneNumber || 'us'} for help.`,
  
  // Tax/VITA Messages
  vitaInfo: (ctx: TemplateContext) => 
    `Free tax preparation is available through VITA! Visit ${ctx.websiteUrl || 'our website'} to schedule or text TAX for more info.`,
  
  // Error Messages
  error: () => 
    `Sorry, I didn't understand. Reply HELP for options or STOP to end.`,
  
  invalidZip: () => 
    `That ZIP code doesn't look right. Please enter a valid 5-digit ZIP code.`,
  
  invalidNumber: () => 
    `Please enter a valid number.`,
  
  invalidYesNo: () => 
    `Please reply YES or NO.`,
  
  // Compliance Messages (Required by TCPA)
  stopConfirmation: (ctx: TemplateContext) => 
    `You've been unsubscribed from ${ctx.tenantName || 'Benefits'} SMS. Reply START to resubscribe.`,
  
  startConfirmation: (ctx: TemplateContext) => 
    `You're subscribed to ${ctx.tenantName || 'Benefits'} SMS! Reply HELP for options.`,
  
  // Intake Messages
  intakeStart: () => 
    `Let's complete your application! I'll guide you through the process. First, what's your full name?`,
  
  intakeNextStep: (step: string) => 
    `Great! Next, ${step}`,
  
  intakeComplete: (ctx: TemplateContext) => 
    `Application submitted! We'll contact you at ${ctx.phoneNumber} within 2 business days.`,
  
  // Document Help
  documentHelp: () => 
    `For document requirements, visit our checklist at [link] or call for assistance.`,
  
  // Session Management
  sessionExpired: () => 
    `Your session expired. Reply START to begin a new conversation.`,
  
  sessionReset: () => 
    `Session reset. Reply SNAP, TAX, or HELP to start.`,
    
  // Screening Link Messages
  screeningLinkWelcome: (ctx: TemplateContext) => 
    `Welcome to Maryland Benefits Screening! Click this secure link to check your eligibility: ${ctx.link} (expires in ${ctx.expiresIn})`,
  
  screeningLinkExpired: () => 
    `Your screening link has expired. Text START for a new one.`,
  
  screeningComplete: (ctx: TemplateContext) => 
    `Your screening was completed on ${ctx.completedDate}. A navigator will contact you within 48 hours.`,
  
  screeningPending: (ctx: TemplateContext) => 
    `You have an active screening link: ${ctx.link}. Click to continue your application.`,
  
  noActiveScreening: () => 
    `No active screening found. Text START to begin checking your eligibility.`,
  
  resumeScreening: (ctx: TemplateContext) => 
    `Continue your screening here: ${ctx.link}. Your progress has been saved.`,
  
  newScreeningLink: (ctx: TemplateContext) => 
    `Here's your new screening link: ${ctx.link}. Click to start checking your eligibility.`,
  
  dailyLimitReached: () => 
    `You've reached the daily limit for screening links. Please try again tomorrow or call for assistance.`,
};

/**
 * Get a template by name and fill in context
 */
export function getTemplate(
  templateName: keyof typeof smsTemplates,
  context: TemplateContext = {}
): string {
  const template = smsTemplates[templateName];
  if (typeof template === 'function') {
    return template(context as any);
  }
  return template as string;
}

/**
 * Split long messages into SMS-sized chunks (160 characters)
 */
export function splitSmsMessage(message: string, maxLength: number = 160): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  const words = message.split(' ');
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Format phone number to E.164
 */
export function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Assume US number if 10 digits
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Already has country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Already formatted
  if (phone.startsWith('+')) {
    return phone;
  }
  
  return `+${digits}`;
}
