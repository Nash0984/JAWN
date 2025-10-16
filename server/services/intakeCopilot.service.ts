import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import type { IntakeSession, IntakeMessage, ApplicationForm } from "@shared/schema";
import { policyEngineService } from "./policyEngine.service";
import type { PolicyEngineResponse } from "./policyEngine.service";

interface ExtractedData {
  fields: Record<string, any>;
  confidence: Record<string, number>;
  missingFields: string[];
  completeness: number;
}

interface BenefitSuggestions {
  eligible: boolean;
  programs: string[];
  summary: string;
  policyEngineResults?: PolicyEngineResponse;
}

interface DialogueResponse {
  message: string;
  extractedData?: ExtractedData;
  suggestedQuestions?: string[];
  nextStep?: string;
  shouldGenerateForm?: boolean;
  benefitSuggestions?: BenefitSuggestions;
}

export class IntakeCopilotService {
  private gemini: GoogleGenAI;
  private model = "gemini-2.0-flash";

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }
    this.gemini = new GoogleGenAI({ apiKey });
  }

  async processMessage(sessionId: string, userMessage: string): Promise<DialogueResponse> {
    const session = await storage.getIntakeSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const conversationHistory = await storage.getIntakeMessages(sessionId);
    
    const contextPrompt = this.buildContextPrompt(session, conversationHistory);
    const systemPrompt = this.buildSystemPrompt(session.sessionType);
    
    const fullPrompt = `${systemPrompt}\n\n${contextPrompt}\n\nUser: ${userMessage}\n\nAssistant:`;
    
    const response = await this.gemini.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
    });
    const assistantMessage = response.text || "I apologize, but I couldn't process that. Could you please rephrase?";
    const extracted = await this.extractDataFromMessage(userMessage, session);
    
    await this.saveMessage(sessionId, "user", userMessage);
    await this.saveMessage(sessionId, "assistant", assistantMessage, extracted);
    
    const updatedData = this.mergeExtractedData(session.extractedData as any || {}, extracted.fields);
    const completeness = this.calculateCompleteness(updatedData, session.sessionType);
    const missingFields = this.identifyMissingFields(updatedData, session.sessionType);
    
    await storage.updateIntakeSession(sessionId, {
      extractedData: updatedData,
      dataCompleteness: completeness,
      missingFields,
      currentStep: this.determineNextStep(updatedData, session.sessionType),
    });

    const suggestedQuestions = await this.generateFollowUpQuestions(updatedData, missingFields);
    
    // Check for multi-benefit eligibility using PolicyEngine
    let benefitSuggestions: BenefitSuggestions | undefined;
    if (completeness >= 0.5) { // At least 50% complete to run PolicyEngine
      benefitSuggestions = await this.checkMultiBenefitEligibility(updatedData);
    }
    
    return {
      message: assistantMessage,
      extractedData: {
        fields: extracted.fields,
        confidence: extracted.confidence,
        missingFields,
        completeness,
      },
      suggestedQuestions,
      nextStep: this.determineNextStep(updatedData, session.sessionType),
      shouldGenerateForm: completeness >= 0.9,
      benefitSuggestions,
    };
  }

  /**
   * Check multi-benefit eligibility using PolicyEngine
   */
  private async checkMultiBenefitEligibility(extractedData: any): Promise<BenefitSuggestions | undefined> {
    try {
      // Extract household data for PolicyEngine
      const householdSize = extractedData.householdSize || extractedData.householdMembers?.length || 1;
      const adults = extractedData.adults || 1;
      const children = extractedData.children || (householdSize - adults) || 0;
      
      // Calculate annual employment income
      const monthlyIncome = extractedData.monthlyIncome || extractedData.employmentIncome || 0;
      const employmentIncome = typeof monthlyIncome === 'number' ? monthlyIncome * 12 : 0;
      
      // Calculate unearned income
      const unearnedIncome = (extractedData.unearnedIncome || 0) * 12;
      
      // Get state (default to MD)
      const stateCode = extractedData.state || "MD";
      
      // Only proceed if we have basic income and household info
      if (!adults || employmentIncome === null || employmentIncome === undefined) {
        return undefined;
      }
      
      // Call PolicyEngine
      const result = await policyEngineService.calculateBenefits({
        adults,
        children,
        employmentIncome,
        unearnedIncome,
        stateCode,
        householdAssets: extractedData.assets || 0,
        rentOrMortgage: extractedData.rent || extractedData.mortgage || 0,
        utilityCosts: extractedData.utilities || 0,
        medicalExpenses: extractedData.medicalExpenses || 0,
        childcareExpenses: extractedData.childcareExpenses || 0,
        elderlyOrDisabled: extractedData.elderlyOrDisabled || false
      });
      
      if (!result.success) {
        return undefined;
      }
      
      // Identify eligible programs (excluding SNAP since they're already applying)
      const eligiblePrograms: string[] = [];
      if (result.benefits.medicaid) eligiblePrograms.push("Medicaid");
      if (result.benefits.eitc > 0) eligiblePrograms.push(`EITC ($${result.benefits.eitc.toFixed(0)}/year)`);
      if (result.benefits.childTaxCredit > 0) eligiblePrograms.push(`Child Tax Credit ($${result.benefits.childTaxCredit.toFixed(0)}/year)`);
      if (result.benefits.ssi > 0) eligiblePrograms.push(`SSI ($${result.benefits.ssi.toFixed(0)}/month)`);
      if (result.benefits.tanf > 0) eligiblePrograms.push(`TANF ($${result.benefits.tanf.toFixed(0)}/month)`);
      
      if (eligiblePrograms.length === 0) {
        return undefined;
      }
      
      const summary = policyEngineService.formatBenefitsResponse(result);
      
      return {
        eligible: true,
        programs: eligiblePrograms,
        summary,
        policyEngineResults: result
      };
    } catch (error) {
      console.error("PolicyEngine check failed:", error);
      return undefined;
    }
  }

  private buildSystemPrompt(sessionType: string): string {
    return `You are a compassionate Maryland SNAP benefits intake specialist helping applicants complete their application through conversation.

Your role:
- Ask clear, simple questions one at a time
- Use plain language, avoiding jargon
- Be patient and supportive
- Extract information accurately
- Guide applicants through the process step-by-step

Application Type: ${sessionType}

Key Information to Collect:
1. Household Information:
   - Applicant name, DOB, SSN, contact info
   - Household members (names, ages, relationships)
   - Address and living situation

2. Income Information:
   - Employment income (wages, self-employment)
   - Unearned income (SSI, SSDI, child support, etc.)
   - Income frequency and amounts

3. Expense Information:
   - Rent/mortgage
   - Utilities (if not included in rent)
   - Medical expenses (for elderly/disabled)
   - Dependent care costs

4. Assets:
   - Bank accounts and balances
   - Vehicles
   - Other resources

5. Special Circumstances:
   - Elderly or disabled household members
   - Work requirements and exemptions
   - Categorical eligibility indicators

Guidelines:
- Ask about one topic at a time
- Confirm information before moving forward
- Explain why information is needed
- Provide examples when helpful
- Be encouraging and reassuring`;
  }

  private buildContextPrompt(session: IntakeSession, history: IntakeMessage[]): string {
    const extractedData = session.extractedData as any || {};
    
    let context = `Session Context:
- Progress: ${session.progress}%
- Current Step: ${session.currentStep || 'getting_started'}
- Data Completeness: ${Math.round((session.dataCompleteness || 0) * 100)}%\n`;

    if (Object.keys(extractedData).length > 0) {
      context += `\nInformation Collected So Far:\n${JSON.stringify(extractedData, null, 2)}\n`;
    }

    if (session.missingFields && session.missingFields.length > 0) {
      context += `\nStill Needed: ${session.missingFields.join(", ")}\n`;
    }

    context += `\nConversation History (last 5 messages):\n`;
    const recentHistory = history.slice(-5);
    for (const msg of recentHistory) {
      context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }

    return context;
  }

  private async extractDataFromMessage(message: string, session: IntakeSession): Promise<{
    fields: Record<string, any>;
    confidence: Record<string, number>;
  }> {
    const extractionPrompt = `Extract structured data from this user message for a SNAP application.
    
Message: "${message}"

Current session type: ${session.sessionType}
Current step: ${session.currentStep || 'unknown'}

Extract any relevant information into a JSON object. Include confidence scores (0-1) for each field.
Only extract information that is clearly stated. Use null for uncertain fields.

Common fields to look for:
- applicant_name, applicant_dob, applicant_ssn, phone, email, address
- household_size, household_members
- employment_status, employer, monthly_income
- rent_amount, utility_costs
- has_disability, is_elderly
- bank_accounts

Return JSON in this format:
{
  "fields": { "field_name": "value", ... },
  "confidence": { "field_name": 0.95, ... }
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }]
      });
      const text = response.text || "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          fields: parsed.fields || {},
          confidence: parsed.confidence || {},
        };
      }
    } catch (error) {
      console.error("Data extraction error:", error);
    }

    return { fields: {}, confidence: {} };
  }

  private async generateFollowUpQuestions(
    extractedData: Record<string, any>,
    missingFields: string[]
  ): Promise<string[]> {
    if (missingFields.length === 0) return [];

    const questionPrompt = `Based on the collected data and missing fields, suggest 2-3 clear, specific follow-up questions to ask next.

Collected Data: ${JSON.stringify(extractedData)}
Missing Fields: ${missingFields.join(", ")}

Generate natural, conversational questions that:
1. Ask about the most important missing information
2. Are clear and easy to understand
3. Follow a logical sequence
4. One topic per question

Return as a JSON array of strings: ["question1", "question2", "question3"]`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: questionPrompt }] }]
      });
      const text = response.text || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        return questions.slice(0, 3);
      }
    } catch (error) {
      console.error("Question generation error:", error);
    }

    return [];
  }

  private mergeExtractedData(existing: Record<string, any>, newData: Record<string, any>): Record<string, any> {
    return { ...existing, ...newData };
  }

  private calculateCompleteness(data: Record<string, any>, sessionType: string): number {
    const requiredFields = this.getRequiredFields(sessionType);
    const collectedFields = Object.keys(data).filter(key => data[key] != null);
    const matchedFields = requiredFields.filter(field => collectedFields.includes(field));
    return matchedFields.length / requiredFields.length;
  }

  private identifyMissingFields(data: Record<string, any>, sessionType: string): string[] {
    const requiredFields = this.getRequiredFields(sessionType);
    return requiredFields.filter(field => !data[field] || data[field] === null);
  }

  private getRequiredFields(sessionType: string): string[] {
    const baseFields = [
      "applicant_name",
      "applicant_dob",
      "applicant_ssn",
      "phone",
      "address",
      "household_size",
      "monthly_income",
      "rent_amount",
    ];

    if (sessionType === "snap_application") {
      return [...baseFields, "employment_status", "has_disability"];
    }

    return baseFields;
  }

  private determineNextStep(data: Record<string, any>, sessionType: string): string {
    if (!data.applicant_name) return "applicant_info";
    if (!data.household_size) return "household_info";
    if (!data.monthly_income) return "income_info";
    if (!data.rent_amount) return "expense_info";
    if (this.calculateCompleteness(data, sessionType) >= 0.9) return "review";
    return "additional_info";
  }

  private async saveMessage(
    sessionId: string,
    role: string,
    content: string,
    extracted?: { fields: Record<string, any>; confidence: Record<string, any> }
  ): Promise<IntakeMessage> {
    return await storage.createIntakeMessage({
      sessionId,
      role,
      content,
      extractedFields: extracted?.fields || null,
      confidenceScores: extracted?.confidence || null,
      model: role === "assistant" ? this.model : undefined,
    });
  }

  async generateApplicationForm(sessionId: string): Promise<ApplicationForm> {
    const session = await storage.getIntakeSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const existingForm = await storage.getApplicationFormBySession(sessionId);
    if (existingForm) {
      return existingForm;
    }

    const extractedData = session.extractedData as any || {};
    
    // Guard: Ensure minimum required data is present
    const requiredFields = ["applicant_name", "household_size"];
    const missingRequired = requiredFields.filter(field => extractedData[field] === undefined || extractedData[field] === null);
    
    if (missingRequired.length > 0) {
      throw new Error(`Cannot generate form: missing required fields: ${missingRequired.join(", ")}`);
    }
    
    // Warn if completeness is low
    const completeness = this.calculateCompleteness(extractedData, session.sessionType);
    if (completeness < 0.7) {
      console.warn(`Generating form with low completeness (${Math.round(completeness * 100)}%). Consider collecting more data.`);
    }
    
    const applicantInfo = {
      name: extractedData.applicant_name || "",
      dob: extractedData.applicant_dob || "",
      ssn: extractedData.applicant_ssn || "",
      phone: extractedData.phone || "",
      email: extractedData.email || "",
      address: extractedData.address || "",
    };

    const householdMembers = extractedData.household_members || [applicantInfo];
    const householdSize = extractedData.household_size || 1;

    const incomeInfo = {
      employmentStatus: extractedData.employment_status || "unemployed",
      employer: extractedData.employer || null,
      monthlyIncome: extractedData.monthly_income || 0,
      otherIncome: extractedData.other_income || [],
    };

    const expenseInfo = {
      rent: extractedData.rent_amount || 0,
      utilities: extractedData.utility_costs || 0,
      medical: extractedData.medical_expenses || 0,
      childcare: extractedData.childcare_costs || 0,
    };

    const assetInfo = {
      bankAccounts: extractedData.bank_accounts || [],
      vehicles: extractedData.vehicles || [],
    };

    const form = await storage.createApplicationForm({
      sessionId: session.id,
      userId: session.userId,
      benefitProgramId: session.benefitProgramId,
      applicantInfo,
      householdMembers,
      householdSize,
      incomeInfo,
      totalMonthlyIncome: incomeInfo.monthlyIncome,
      expenseInfo,
      totalMonthlyExpenses: Object.values(expenseInfo).reduce((sum: number, val: any) => sum + (val || 0), 0),
      assetInfo,
      categoricalEligibility: extractedData.categorical_eligibility || false,
      expeditedService: extractedData.expedited_service || false,
      exportStatus: "draft",
    });

    await storage.updateIntakeSession(sessionId, {
      status: "completed",
    });

    return form;
  }
}

export const intakeCopilotService = new IntakeCopilotService();
