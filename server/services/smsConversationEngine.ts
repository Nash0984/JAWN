/**
 * SMS Conversation State Machine
 * Handles conversational flows for benefit screening and intake via SMS
 */

import { db } from "../db";
import { smsConversations, tenants } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { smsTemplates } from "../templates/smsTemplates";
import { GoogleGenAI } from "@google/genai";

interface ConversationContext {
  zipCode?: string;
  householdSize?: number;
  monthlyIncome?: number;
  hasSavingsOver2750?: boolean;
  hasElderlyDisabled?: boolean;
  step?: string;
  eligibilityResult?: {
    eligible: boolean;
    benefitAmount?: number;
    reason?: string;
  };
  // Intake-specific fields
  fullName?: string;
  address?: string;
  email?: string;
  [key: string]: any;
}

interface ConversationState {
  id: string;
  tenantId: string;
  phoneNumber: string;
  sessionType: string;
  state: string;
  context: ConversationContext;
}

/**
 * Process incoming message and determine next state
 */
export async function processConversationMessage(
  conversation: ConversationState,
  userMessage: string
): Promise<{ response: string; newState: string; newContext: ConversationContext }> {
  const { sessionType, state, context } = conversation;
  
  // Handle global keywords first
  const upperMessage = userMessage.toUpperCase().trim();
  
  if (upperMessage === 'STOP') {
    return {
      response: smsTemplates.stopConfirmation({ tenantName: await getTenantName(conversation.tenantId) }),
      newState: 'stopped',
      newContext: context
    };
  }
  
  if (upperMessage === 'START') {
    return {
      response: smsTemplates.startConfirmation({ tenantName: await getTenantName(conversation.tenantId) }),
      newState: 'started',
      newContext: {}
    };
  }
  
  if (upperMessage === 'RESET' || upperMessage === 'RESTART') {
    return {
      response: smsTemplates.sessionReset(),
      newState: 'started',
      newContext: {}
    };
  }
  
  if (upperMessage === 'HELP') {
    return {
      response: smsTemplates.help({ tenantName: await getTenantName(conversation.tenantId) }),
      newState: state,
      newContext: context
    };
  }
  
  // Route to appropriate flow
  switch (sessionType) {
    case 'screener':
      return processScreenerFlow(conversation, userMessage);
    case 'intake':
      return processIntakeFlow(conversation, userMessage);
    case 'document_help':
      return processDocumentHelpFlow(conversation, userMessage);
    case 'general_inquiry':
      return processGeneralInquiry(conversation, userMessage);
    default:
      return {
        response: smsTemplates.error(),
        newState: state,
        newContext: context
      };
  }
}

/**
 * SNAP Benefit Screener Flow
 */
async function processScreenerFlow(
  conversation: ConversationState,
  userMessage: string
): Promise<{ response: string; newState: string; newContext: ConversationContext }> {
  const { state, context } = conversation;
  const newContext = { ...context };
  
  switch (state) {
    case 'started':
      // Ask for ZIP code
      return {
        response: smsTemplates.screenerStart(),
        newState: 'collecting_info',
        newContext: { ...newContext, step: 'zip' }
      };
    
    case 'collecting_info':
      switch (context.step) {
        case 'zip':
          // Validate ZIP code
          const zipMatch = userMessage.match(/\b\d{5}\b/);
          if (!zipMatch) {
            return {
              response: smsTemplates.invalidZip(),
              newState: state,
              newContext
            };
          }
          newContext.zipCode = zipMatch[0];
          return {
            response: smsTemplates.askHouseholdSize(),
            newState: state,
            newContext: { ...newContext, step: 'household_size' }
          };
        
        case 'household_size':
          // Validate household size
          const householdSize = parseInt(userMessage);
          if (isNaN(householdSize) || householdSize < 1 || householdSize > 20) {
            return {
              response: smsTemplates.invalidNumber(),
              newState: state,
              newContext
            };
          }
          newContext.householdSize = householdSize;
          return {
            response: smsTemplates.askMonthlyIncome(),
            newState: state,
            newContext: { ...newContext, step: 'income' }
          };
        
        case 'income':
          // Extract income amount
          const incomeMatch = userMessage.match(/\d+/);
          if (!incomeMatch) {
            return {
              response: smsTemplates.invalidNumber(),
              newState: state,
              newContext
            };
          }
          newContext.monthlyIncome = parseInt(incomeMatch[0]);
          return {
            response: smsTemplates.askSavings(),
            newState: state,
            newContext: { ...newContext, step: 'savings' }
          };
        
        case 'savings':
          // Parse yes/no
          const upperMsg = userMessage.toUpperCase().trim();
          if (!['YES', 'NO', 'Y', 'N'].includes(upperMsg)) {
            return {
              response: smsTemplates.invalidYesNo(),
              newState: state,
              newContext
            };
          }
          newContext.hasSavingsOver2750 = ['YES', 'Y'].includes(upperMsg);
          return {
            response: smsTemplates.askElderlyDisabled(),
            newState: state,
            newContext: { ...newContext, step: 'elderly_disabled' }
          };
        
        case 'elderly_disabled':
          // Parse yes/no and calculate eligibility
          const elderlyMsg = userMessage.toUpperCase().trim();
          if (!['YES', 'NO', 'Y', 'N'].includes(elderlyMsg)) {
            return {
              response: smsTemplates.invalidYesNo(),
              newState: state,
              newContext
            };
          }
          newContext.hasElderlyDisabled = ['YES', 'Y'].includes(elderlyMsg);
          
          // Calculate eligibility
          const eligibility = calculateEligibility(newContext);
          newContext.eligibilityResult = eligibility;
          
          const tenant = await getTenantInfo(conversation.tenantId);
          const response = eligibility.eligible
            ? smsTemplates.eligible({
                benefitAmount: eligibility.benefitAmount,
                websiteUrl: tenant?.websiteUrl || 'our website',
                phoneNumber: tenant?.phoneNumber
              })
            : smsTemplates.ineligible({
                websiteUrl: tenant?.websiteUrl || 'our website',
                phoneNumber: tenant?.phoneNumber
              });
          
          return {
            response,
            newState: 'completed',
            newContext
          };
        
        default:
          return {
            response: smsTemplates.error(),
            newState: 'started',
            newContext: {}
          };
      }
    
    default:
      return {
        response: smsTemplates.screenerStart(),
        newState: 'collecting_info',
        newContext: { step: 'zip' }
      };
  }
}

/**
 * Intake Flow (similar to Intake Copilot)
 */
async function processIntakeFlow(
  conversation: ConversationState,
  userMessage: string
): Promise<{ response: string; newState: string; newContext: ConversationContext }> {
  const { state, context } = conversation;
  const newContext = { ...context };
  
  // Use Gemini to extract structured data from natural language
  const extractedData = await extractIntakeDataWithGemini(userMessage, context);
  Object.assign(newContext, extractedData);
  
  // Determine next question
  const nextQuestion = determineNextIntakeQuestion(newContext);
  
  if (!nextQuestion) {
    // All data collected
    return {
      response: smsTemplates.intakeComplete({
        phoneNumber: conversation.phoneNumber
      }),
      newState: 'completed',
      newContext
    };
  }
  
  return {
    response: nextQuestion,
    newState: 'collecting_info',
    newContext
  };
}

/**
 * Document Help Flow
 */
async function processDocumentHelpFlow(
  conversation: ConversationState,
  userMessage: string
): Promise<{ response: string; newState: string; newContext: ConversationContext }> {
  return {
    response: smsTemplates.documentHelp(),
    newState: 'completed',
    newContext: conversation.context
  };
}

/**
 * General Inquiry Flow
 */
async function processGeneralInquiry(
  conversation: ConversationState,
  userMessage: string
): Promise<{ response: string; newState: string; newContext: ConversationContext }> {
  // Use Gemini to generate contextual response
  const response = await generateAIResponse(userMessage, conversation);
  
  return {
    response,
    newState: conversation.state,
    newContext: conversation.context
  };
}

/**
 * Calculate SNAP eligibility based on context
 */
function calculateEligibility(context: ConversationContext): {
  eligible: boolean;
  benefitAmount?: number;
  reason?: string;
} {
  const { householdSize, monthlyIncome, hasSavingsOver2750, hasElderlyDisabled } = context;
  
  if (!householdSize || monthlyIncome === undefined) {
    return { eligible: false, reason: 'Missing information' };
  }
  
  // Simplified income limits (130% FPL for gross income)
  const incomeLimits: Record<number, number> = {
    1: 1580,
    2: 2137,
    3: 2694,
    4: 3250,
    5: 3807,
    6: 4364,
    7: 4921,
    8: 5478,
  };
  
  const limit = incomeLimits[householdSize] || (incomeLimits[8] + (householdSize - 8) * 557);
  
  // Check income eligibility
  if (monthlyIncome > limit && !hasElderlyDisabled) {
    return { 
      eligible: false, 
      reason: 'Income exceeds limit for household size' 
    };
  }
  
  // Check asset limit (if not elderly/disabled)
  if (hasSavingsOver2750 && !hasElderlyDisabled) {
    return { 
      eligible: false, 
      reason: 'Assets exceed $2,750 limit' 
    };
  }
  
  // Calculate estimated benefit (simplified)
  const maxAllotments: Record<number, number> = {
    1: 291,
    2: 535,
    3: 766,
    4: 973,
    5: 1155,
    6: 1386,
    7: 1532,
    8: 1751,
  };
  
  const maxBenefit = maxAllotments[householdSize] || (maxAllotments[8] + (householdSize - 8) * 219);
  const estimatedBenefit = Math.max(20, Math.round(maxBenefit * (1 - monthlyIncome / (limit * 2))));
  
  return {
    eligible: true,
    benefitAmount: estimatedBenefit
  };
}

/**
 * Extract intake data using Gemini
 */
async function extractIntakeDataWithGemini(
  message: string,
  existingContext: ConversationContext
): Promise<Partial<ConversationContext>> {
  const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return {}; // Fall back to simple parsing
  }
  
  try {
    const genai = new GoogleGenAI({ apiKey: geminiKey });
    const prompt = `Extract structured data from this message: "${message}"
    
Current context: ${JSON.stringify(existingContext)}

Extract any of these fields if mentioned:
- fullName
- address
- email
- phone
- householdSize
- monthlyIncome

Return as JSON object with only the fields found.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error extracting data with Gemini:', error);
  }
  
  return {};
}

/**
 * Determine next intake question
 */
function determineNextIntakeQuestion(context: ConversationContext): string | null {
  if (!context.fullName) {
    return smsTemplates.intakeStart();
  }
  if (!context.address) {
    return smsTemplates.intakeNextStep('what is your address?');
  }
  if (!context.householdSize) {
    return smsTemplates.intakeNextStep('how many people are in your household?');
  }
  if (context.monthlyIncome === undefined) {
    return smsTemplates.intakeNextStep('what is your monthly income?');
  }
  
  return null; // All required data collected
}

/**
 * Generate AI response using Gemini
 */
async function generateAIResponse(message: string, conversation: ConversationState): Promise<string> {
  const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return smsTemplates.error();
  }
  
  try {
    const genai = new GoogleGenAI({ apiKey: geminiKey });
    const prompt = `You are a benefits assistance chatbot. Answer this question concisely (under 160 chars): "${message}"
    
Context: User is asking about benefit programs. Keep response helpful and brief.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    return (response.text || smsTemplates.error()).substring(0, 160);
  } catch (error) {
    console.error('Error generating AI response:', error);
    return smsTemplates.error();
  }
}

/**
 * Helper to get tenant name
 */
async function getTenantName(tenantId: string): Promise<string> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId)
    });
    return tenant?.name || 'Benefits';
  } catch (error) {
    return 'Benefits';
  }
}

/**
 * Helper to get tenant info
 */
async function getTenantInfo(tenantId: string): Promise<{ websiteUrl?: string; phoneNumber?: string } | null> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId)
    });
    return {
      websiteUrl: (tenant?.config as any)?.websiteUrl,
      phoneNumber: (tenant?.config as any)?.phoneNumber
    };
  } catch (error) {
    return null;
  }
}
