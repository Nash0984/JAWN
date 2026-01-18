import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import type { IntakeSession, IntakeMessage, ApplicationForm } from "@shared/schema";
import { policyEngineService } from "./policyEngine.service";
import type { PolicyEngineResponse } from "./policyEngine.service";
import { PolicyEngineGuardrailService } from "./policyEngineGuardrail";
import { rulesEngineAdapter, type HybridEligibilityPayload } from "./rulesEngineAdapter";
import { neuroSymbolicHybridGateway } from "./neuroSymbolicHybridGateway";
import { createLogger } from './logger.service';

const logger = createLogger('IntakeCopilot');

const PROGRAM_CODES = ['MD_SNAP', 'MEDICAID', 'MD_TANF', 'MD_OHEP', 'MD_VITA_TAX', 'SSI'] as const;

interface ExtractedData {
  fields: Record<string, any>;
  confidence: Record<string, number>;
  missingFields: string[];
  completeness: number;
}

interface HybridValidationContext {
  z3SolverRunId?: string;
  ontologyTermsMatched?: string[];
  statutoryCitations?: string[];
  verificationStatus?: 'verified' | 'pending' | 'conflict' | 'error';
  grade6Explanation?: string;
}

interface BenefitSuggestions {
  eligible: boolean;
  programs: string[];
  summary: string;
  policyEngineResults?: PolicyEngineResponse;
  hybridValidation?: HybridValidationContext;
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
    let assistantMessage = response.text || "I apologize, but I couldn't process that. Could you please rephrase?";
    
    // MODE 1: EXPLANATION VERIFICATION
    // Verify AI response against statutory rules before outputting to user
    // Per neuro-symbolic gateway: All eligibility statements must be legally grounded
    try {
      const verificationResult = await neuroSymbolicHybridGateway.verifyExplanation(
        assistantMessage,
        session.stateCode || "MD",
        session.programCode || "SNAP",
        {
          caseId: sessionId,
          triggeredBy: "intake_copilot_chat"
        }
      );

      if (!verificationResult.isLegallyConsistent && verificationResult.symbolicVerification.violationCount > 0) {
        // AI response contains legally inaccurate claims - log and modify response
        logger.warn("[IntakeCopilot] AI response failed statutory verification", {
          sessionId,
          violationCount: verificationResult.symbolicVerification.violationCount,
          citations: verificationResult.statutoryCitations,
          gatewayRunId: verificationResult.gatewayRunId,
          service: "IntakeCopilot"
        });

        // Append legal grounding notice if explanation claims were detected
        if (verificationResult.grade6Explanation) {
          assistantMessage += `\n\n*Note: ${verificationResult.grade6Explanation}*`;
        }
      }

      // Log successful verification
      logger.debug("[IntakeCopilot] AI response verified", {
        sessionId,
        isConsistent: verificationResult.isLegallyConsistent,
        assertionCount: verificationResult.parsedExplanation.assertionCount,
        ruleCount: verificationResult.symbolicVerification.tboxRuleCount,
        processingTimeMs: verificationResult.processingTimeMs,
        service: "IntakeCopilot"
      });
    } catch (verificationError) {
      // Log but don't block - verification is defensive, not blocking
      logger.warn("[IntakeCopilot] Explanation verification failed - proceeding with unverified response", {
        sessionId,
        error: verificationError instanceof Error ? verificationError.message : "Unknown",
        service: "IntakeCopilot"
      });
    }
    
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
   * Check multi-benefit eligibility using neuro-symbolic hybrid architecture:
   * 1. Rules-as-Code Layer: Internal rules engines (SNAP, Medicaid, TANF, OHEP, Tax)
   * 2. Symbolic/Z3 Solver Layer: Verification with statutory citations
   * 3. PolicyEngine: Verification-only via guardrail service
   */
  private async checkMultiBenefitEligibility(extractedData: any): Promise<BenefitSuggestions | undefined> {
    try {
      const policyEngineGuardrail = PolicyEngineGuardrailService.getInstance();
      
      // Extract household data
      const householdSize = extractedData.householdSize || extractedData.householdMembers?.length || 1;
      const adults = extractedData.adults || 1;
      const children = extractedData.children || (householdSize - adults) || 0;
      
      // Calculate income
      const monthlyIncome = extractedData.monthlyIncome || extractedData.employmentIncome || 0;
      const employmentIncome = typeof monthlyIncome === 'number' ? monthlyIncome * 12 : 0;
      const unearnedIncome = (extractedData.unearnedIncome || 0) * 12;
      
      // Get state (default to MD)
      const stateCode = extractedData.state || "MD";
      
      // Only proceed if we have basic income and household info
      if (!adults || employmentIncome === null || employmentIncome === undefined) {
        return undefined;
      }
      
      // Build eligibility payload for rules engine adapter
      const eligibilityPayload: HybridEligibilityPayload = {
        householdSize,
        income: monthlyIncome,
        earnedIncome: monthlyIncome,
        unearnedIncome: extractedData.unearnedIncome || 0,
        hasElderly: extractedData.elderlyOrDisabled || false,
        hasDisabled: extractedData.elderlyOrDisabled || false,
        assets: extractedData.assets || 0,
        shelterCosts: extractedData.rent || extractedData.mortgage || 0,
        medicalExpenses: extractedData.medicalExpenses || 0,
        dependentCareExpenses: extractedData.childcareExpenses || 0,
        numberOfQualifyingChildren: children,
        wages: employmentIncome,
        filingStatus: adults > 1 ? 'married_joint' : 'single',
        taxYear: new Date().getFullYear(),
        benefitProgramId: 'multi-benefit-check',
      };
      
      const eligiblePrograms: string[] = [];
      const allCitations: string[] = [];
      let hybridValidation: HybridValidationContext | undefined;
      let totalMonthlyBenefit = 0;
      
      // STEP 1: Calculate eligibility for each program using internal RaC engines
      for (const programCode of PROGRAM_CODES) {
        try {
          const result = await rulesEngineAdapter.calculateEligibility(
            programCode,
            eligibilityPayload
          );
          
          if (result && result.eligible) {
            const benefitAmount = (result.estimatedBenefit || 0) / 100; // Convert cents to dollars
            
            switch (programCode) {
              case 'MD_SNAP':
                if (benefitAmount > 0) {
                  eligiblePrograms.push(`SNAP ($${benefitAmount.toFixed(0)}/month)`);
                  totalMonthlyBenefit += benefitAmount;
                }
                break;
              case 'MEDICAID':
                eligiblePrograms.push('Medicaid');
                break;
              case 'MD_TANF':
                if (benefitAmount > 0) {
                  eligiblePrograms.push(`TANF ($${benefitAmount.toFixed(0)}/month)`);
                  totalMonthlyBenefit += benefitAmount;
                }
                break;
              case 'MD_OHEP':
                if (benefitAmount > 0) {
                  eligiblePrograms.push(`OHEP ($${benefitAmount.toFixed(0)}/year)`);
                }
                break;
              case 'MD_VITA_TAX':
                if (result.refund && result.refund > 0) {
                  const refundAmount = result.refund / 100;
                  eligiblePrograms.push(`Tax Refund ($${refundAmount.toFixed(0)}/year)`);
                }
                break;
            }
            
            // Collect citations from Z3 verification
            if (result.citations) {
              allCitations.push(...result.citations);
            }
            
            // Capture hybrid verification status from the result
            if (result.hybridVerification?.verificationStatus === 'verified' && !hybridValidation) {
              hybridValidation = {
                z3SolverRunId: result.hybridVerification.z3SolverRunId,
                ontologyTermsMatched: result.hybridVerification.ontologyTermsMatched,
                statutoryCitations: result.hybridVerification.statutoryCitations,
                verificationStatus: 'verified',
                grade6Explanation: result.hybridVerification.grade6Explanation
              };
            }
            
            logger.info('[IntakeCopilot] RaC eligibility calculated', {
              programCode,
              eligible: result.eligible,
              benefitAmount,
              z3Verified: result.hybridVerification?.verificationStatus === 'verified',
              service: 'IntakeCopilot'
            });
          }
        } catch (programError) {
          logger.warn('[IntakeCopilot] Program eligibility check failed', {
            programCode,
            error: programError instanceof Error ? programError.message : 'Unknown',
            service: 'IntakeCopilot'
          });
        }
      }
      
      if (eligiblePrograms.length === 0) {
        return undefined;
      }
      
      // STEP 2: PolicyEngine cross-validation (VERIFICATION ONLY)
      let policyEngineResults: PolicyEngineResponse | undefined;
      try {
        policyEngineResults = await policyEngineService.calculateBenefits({
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
        
        if (policyEngineResults.success) {
          // Cross-validate SNAP result
          await policyEngineGuardrail.crossValidate(
            'SNAP',
            eligibilityPayload,
            {
              programId: 'MD_SNAP',
              eligible: eligiblePrograms.some(p => p.includes('SNAP')),
              benefitAmount: totalMonthlyBenefit * 100,
              reasonCodes: ['RaC_PRIMARY_CALCULATION'],
              legalCitations: allCitations,
              calculationMethod: 'RaC_Z3_Hybrid'
            },
            { eligible: policyEngineResults.benefits.snap > 0, benefitAmount: policyEngineResults.benefits.snap * 100 }
          );
        }
      } catch (peError) {
        logger.warn('[IntakeCopilot] PolicyEngine verification unavailable', {
          error: peError instanceof Error ? peError.message : 'Unknown',
          service: 'IntakeCopilot'
        });
      }
      
      // Generate summary
      const summary = `Based on your information, you may be eligible for ${eligiblePrograms.length} benefit programs: ${eligiblePrograms.join(', ')}. ${
        hybridValidation?.verificationStatus === 'verified' 
          ? 'These eligibility determinations have been formally verified against legal requirements.' 
          : 'Final eligibility will be verified before approval.'
      }`;
      
      // Ensure we have hybrid validation context
      if (!hybridValidation) {
        hybridValidation = {
          verificationStatus: 'pending',
          statutoryCitations: allCitations.slice(0, 5),
          grade6Explanation: 'Formal verification is pending. Eligibility will be verified before final approval.'
        };
      }
      
      return {
        eligible: true,
        programs: eligiblePrograms,
        summary,
        policyEngineResults,
        hybridValidation
      };
    } catch (error) {
      logger.error("[IntakeCopilot] Multi-benefit eligibility check failed", {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        service: 'IntakeCopilot'
      });
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
      logger.error("Data extraction error", {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        service: 'IntakeCopilot'
      });
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
      logger.error("Question generation error", {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        service: 'IntakeCopilot'
      });
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
      logger.warn('Generating form with low completeness', {
        completenessPercent: Math.round(completeness * 100),
        completeness,
        message: 'Consider collecting more data',
        service: 'IntakeCopilot'
      });
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
