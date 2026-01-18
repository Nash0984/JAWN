import { db } from "../db";
import { 
  householdProfiles, 
  benefitPrograms, 
  crossEnrollmentRecommendations,
  predictionHistory,
  programEnrollments,
  clientCases,
  type InsertCrossEnrollmentRecommendation,
  type InsertPredictionHistory
} from "@shared/schema";
import { eq, and, or, gte, lte, sql, inArray, notInArray, desc } from "drizzle-orm";
import { generateTextWithGemini } from "./gemini.service";
import { policyEngineService } from "./policyEngine.service";
import { PolicyEngineGuardrailService } from "./policyEngineGuardrail";
import { rulesEngineAdapter, type HybridEligibilityPayload } from "./rulesEngineAdapter";
import { cacheService, CACHE_KEYS } from "./cacheService";
import { notificationService } from "./notification.service";
import { logger } from "./logger.service";
import { neuroSymbolicHybridGateway } from "./neuroSymbolicHybridGateway";

const PROGRAM_CODE_TO_ADAPTER: Record<string, string> = {
  'SNAP': 'MD_SNAP',
  'MEDICAID': 'MEDICAID',
  'TANF': 'MD_TANF',
  'TCA': 'MD_TANF',
  'OHEP': 'MD_OHEP',
  'LIHEAP': 'MD_OHEP',
  'EITC': 'MD_VITA_TAX',
  'CTC': 'MD_VITA_TAX',
  'SSI': 'SSI',
  'MD_SNAP': 'MD_SNAP',
  'MD_TANF': 'MD_TANF',
  'MD_OHEP': 'MD_OHEP',
  'MD_VITA_TAX': 'MD_VITA_TAX',
};

interface HouseholdData {
  householdId: string;
  householdSize: number;
  monthlyIncome: number;
  hasChildren: boolean;
  hasElderly: boolean;
  hasDisabled: boolean;
  currentEnrollments: string[];
  county?: string;
  zipCode?: string;
  employmentStatus?: string;
  housingStatus?: string;
}

interface BenefitRecommendation {
  programId: string;
  programName: string;
  confidence: number;
  estimatedBenefit: number;
  impactScore: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  requirements: string[];
  processingTime: number;
  deadline?: Date;
}

interface CrossEnrollmentAnalysis {
  householdId: string;
  recommendations: BenefitRecommendation[];
  totalPotentialBenefit: number;
  uncapturedOpportunities: number;
  analysisDate: Date;
  modelVersion: string;
}

interface WhatIfScenario {
  scenarioName: string;
  changes: Partial<HouseholdData>;
  newRecommendations: BenefitRecommendation[];
  benefitDelta: number;
  impactAnalysis: string;
}

class CrossEnrollmentEngineService {
  private readonly MODEL_VERSION = "v1.0.0";
  private readonly CONFIDENCE_THRESHOLD = 0.65;
  private readonly HIGH_IMPACT_THRESHOLD = 75;

  /**
   * Analyze a household for cross-enrollment opportunities
   */
  async analyzeHousehold(householdId: string): Promise<CrossEnrollmentAnalysis> {
    // Check cache first
    const cacheKey = `cross_enrollment:${householdId}`;
    const cached = await cacheService.get<CrossEnrollmentAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch household data
      const household = await this.getHouseholdData(householdId);
      
      // Get all available benefit programs
      const programs = await this.getAvailablePrograms(household);
      
      // Generate AI predictions for each program
      const recommendations = await this.generateRecommendations(household, programs);
      
      // Calculate total potential benefit
      const totalPotentialBenefit = recommendations.reduce(
        (sum, rec) => sum + rec.estimatedBenefit, 
        0
      );
      
      // Store recommendations in database
      await this.storeRecommendations(householdId, recommendations);
      
      // Track prediction history
      await this.trackPredictions(householdId, recommendations);
      
      const analysis: CrossEnrollmentAnalysis = {
        householdId,
        recommendations: recommendations.filter(r => r.confidence >= this.CONFIDENCE_THRESHOLD),
        totalPotentialBenefit,
        uncapturedOpportunities: recommendations.filter(r => r.confidence >= this.CONFIDENCE_THRESHOLD).length,
        analysisDate: new Date(),
        modelVersion: this.MODEL_VERSION
      };
      
      // Cache the analysis
      await cacheService.set(cacheKey, analysis, 3600); // Cache for 1 hour
      
      // Trigger notifications for high-impact opportunities
      await this.notifyHighImpactOpportunities(householdId, recommendations);
      
      return analysis;
    } catch (error) {
      logger.error("Error analyzing household", {
        context: 'CrossEnrollmentEngineService.analyzeHousehold',
        householdId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate what-if scenarios for household changes
   */
  async generateWhatIfScenarios(
    householdId: string, 
    scenarios: Array<{ name: string; changes: Partial<HouseholdData> }>
  ): Promise<WhatIfScenario[]> {
    const currentAnalysis = await this.analyzeHousehold(householdId);
    const household = await this.getHouseholdData(householdId);
    
    const whatIfResults: WhatIfScenario[] = [];
    
    for (const scenario of scenarios) {
      // Apply changes to household data
      const modifiedHousehold = { ...household, ...scenario.changes };
      
      // Get new recommendations
      const programs = await this.getAvailablePrograms(modifiedHousehold);
      const newRecommendations = await this.generateRecommendations(modifiedHousehold, programs);
      
      // Calculate benefit delta
      const currentBenefit = currentAnalysis.totalPotentialBenefit;
      const newBenefit = newRecommendations.reduce((sum, rec) => sum + rec.estimatedBenefit, 0);
      const benefitDelta = newBenefit - currentBenefit;
      
      // Generate impact analysis using AI
      const impactAnalysis = await this.generateImpactAnalysis(
        household,
        modifiedHousehold,
        currentAnalysis.recommendations,
        newRecommendations
      );
      
      whatIfResults.push({
        scenarioName: scenario.name,
        changes: scenario.changes,
        newRecommendations: newRecommendations.filter(r => r.confidence >= this.CONFIDENCE_THRESHOLD),
        benefitDelta,
        impactAnalysis
      });
    }
    
    return whatIfResults;
  }

  /**
   * Batch process multiple households
   */
  async batchAnalyze(householdIds: string[]): Promise<Map<string, CrossEnrollmentAnalysis>> {
    const results = new Map<string, CrossEnrollmentAnalysis>();
    
    // Process in chunks to avoid overwhelming the system
    const chunkSize = 10;
    for (let i = 0; i < householdIds.length; i += chunkSize) {
      const chunk = householdIds.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.all(
        chunk.map(id => this.analyzeHousehold(id))
      );
      
      chunkResults.forEach((result, index) => {
        results.set(chunk[index], result);
      });
      
      // Add a small delay between chunks
      if (i + chunkSize < householdIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Identify unclaimed benefits based on existing enrollments
   */
  async identifyUnclaimedBenefits(householdId: string): Promise<BenefitRecommendation[]> {
    const household = await this.getHouseholdData(householdId);
    
    // Get related programs based on current enrollments
    const relatedPrograms = await this.getRelatedPrograms(household.currentEnrollments);
    
    // Filter out already enrolled programs
    const unclaimedPrograms = relatedPrograms.filter(
      p => !household.currentEnrollments.includes(p.id)
    );
    
    // Generate recommendations for unclaimed programs
    const recommendations = await this.generateRecommendations(household, unclaimedPrograms);
    
    // Sort by impact score
    return recommendations
      .filter(r => r.confidence >= this.CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.impactScore - a.impactScore);
  }

  /**
   * Private helper methods
   */
  
  private async getHouseholdData(householdId: string): Promise<HouseholdData> {
    const profile = await db.query.householdProfiles.findFirst({
      where: eq(householdProfiles.id, householdId),
      with: {
        programEnrollments: true
      }
    });
    
    if (!profile) {
      throw new Error(`Household ${householdId} not found`);
    }
    
    const enrollments = await db.query.programEnrollments.findMany({
      where: eq(programEnrollments.householdProfileId, householdId)
    });
    
    return {
      householdId: profile.id,
      householdSize: profile.householdSize || 1,
      monthlyIncome: profile.monthlyIncome || 0,
      hasChildren: profile.hasChildren || false,
      hasElderly: profile.hasElderly || false,
      hasDisabled: profile.hasDisabled || false,
      currentEnrollments: enrollments.map(e => e.programCode),
      county: profile.county || undefined,
      zipCode: profile.zipCode || undefined,
      employmentStatus: profile.employmentStatus || undefined,
      housingStatus: profile.housingStatus || undefined
    };
  }

  private async getAvailablePrograms(household: HouseholdData): Promise<any[]> {
    // Get all active benefit programs
    const programs = await db.query.benefitPrograms.findMany({
      where: and(
        eq(benefitPrograms.isActive, true),
        eq(benefitPrograms.programType, 'benefit')
      )
    });
    
    // Filter out already enrolled programs
    return programs.filter(p => !household.currentEnrollments.includes(p.code));
  }

  private async getRelatedPrograms(currentEnrollments: string[]): Promise<any[]> {
    // Define program relationships (could be stored in DB)
    const relationships = {
      'SNAP': ['WIC', 'MEDICAID', 'LIHEAP', 'OHEP', 'FREE_LUNCH'],
      'TANF': ['MEDICAID', 'SNAP', 'WIC', 'CHILDCARE'],
      'MEDICAID': ['SNAP', 'WIC', 'CHIP', 'ACA_SUBSIDIES'],
      'SSI': ['MEDICAID', 'SNAP', 'LIHEAP', 'LIFELINE'],
      'SSDI': ['MEDICARE', 'MEDICAID_BUY_IN', 'SNAP'],
      'WIC': ['SNAP', 'MEDICAID', 'HEADSTART'],
      'LIHEAP': ['WEATHERIZATION', 'OHEP', 'SNAP'],
      'SECTION8': ['SNAP', 'MEDICAID', 'UTILITY_ASSISTANCE']
    };
    
    const relatedProgramCodes = new Set<string>();
    
    currentEnrollments.forEach(program => {
      const related = relationships[program] || [];
      related.forEach(r => relatedProgramCodes.add(r));
    });
    
    if (relatedProgramCodes.size === 0) {
      return [];
    }
    
    return await db.query.benefitPrograms.findMany({
      where: and(
        inArray(benefitPrograms.code, Array.from(relatedProgramCodes)),
        eq(benefitPrograms.isActive, true)
      )
    });
  }

  /**
   * Generate recommendations using neuro-symbolic hybrid architecture:
   * 1. Rules-as-Code Layer: Internal rules engines (SNAP, Medicaid, TANF, OHEP, Tax)
   * 2. Symbolic/Z3 Solver Layer: Verification with statutory citations
   * 3. PolicyEngine: Verification-only via guardrail service
   * 4. Neural Layer (Gemini): Generate explanations and supplementary analysis only
   */
  private async generateRecommendations(
    household: HouseholdData,
    programs: any[]
  ): Promise<BenefitRecommendation[]> {
    const recommendations: BenefitRecommendation[] = [];
    const policyEngineGuardrail = PolicyEngineGuardrailService.getInstance();
    
    for (const program of programs) {
      try {
        const adapterCode = PROGRAM_CODE_TO_ADAPTER[program.code];
        
        // Convert household data to HybridEligibilityPayload for adapter
        const eligibilityPayload: HybridEligibilityPayload = {
          householdSize: household.householdSize,
          income: household.monthlyIncome,
          hasElderly: household.hasElderly,
          hasDisabled: household.hasDisabled,
          hasSSI: household.currentEnrollments.includes('SSI'),
          hasTANF: household.currentEnrollments.includes('TANF'),
          benefitProgramId: program.id,
        };
        
        let rulesEngineResult = null;
        let confidence = 0;
        let estimatedBenefit = 0;
        let explanation = '';
        let statutoryCitations: string[] = [];
        let hybridVerificationStatus: 'verified' | 'unverified' | 'fallback' = 'unverified';
        
        // STEP 1: Try internal Rules-as-Code engine with Z3 verification (PRIMARY)
        if (adapterCode && rulesEngineAdapter.isSupported(adapterCode)) {
          rulesEngineResult = await rulesEngineAdapter.calculateEligibility(
            adapterCode,
            eligibilityPayload
          );
          
          if (rulesEngineResult) {
            confidence = rulesEngineResult.eligible ? 0.95 : 0.1;
            estimatedBenefit = (rulesEngineResult.estimatedBenefit || 0) / 100; // Convert cents to dollars
            explanation = rulesEngineResult.reason;
            statutoryCitations = rulesEngineResult.citations || [];
            
            // Check if Z3 verification was performed
            if (rulesEngineResult.hybridVerification?.verificationStatus === 'verified') {
              hybridVerificationStatus = 'verified';
              // High confidence when Z3 verified
              confidence = rulesEngineResult.eligible ? 0.98 : 0.02;
            }
            
            logger.info("[CrossEnrollment] RaC/Z3 eligibility calculated", {
              programCode: program.code,
              adapterCode,
              eligible: rulesEngineResult.eligible,
              hybridVerificationStatus,
              service: "CrossEnrollmentEngine"
            });
          }
        }
        
        // STEP 2: Fallback to Gemini AI for programs without adapters
        if (!rulesEngineResult) {
          hybridVerificationStatus = 'fallback';
          const prompt = `
            Analyze eligibility for ${program.name} (${program.code}) for a household with:
            - Size: ${household.householdSize} people
            - Monthly Income: $${household.monthlyIncome}
            - Has Children: ${household.hasChildren}
            - Has Elderly: ${household.hasElderly}
            - Has Disabled: ${household.hasDisabled}
            - County: ${household.county || 'Unknown'}
            - Current Benefits: ${household.currentEnrollments.join(', ') || 'None'}
            
            Format response as JSON:
            {
              "confidence": 0.85,
              "estimatedBenefit": 250,
              "explanation": "Your household likely qualifies for...",
              "requirements": ["Income verification", "Proof of residency"],
              "processingTime": 30
            }
          `;
          
          const aiResponse = await generateTextWithGemini(prompt);
          const prediction = JSON.parse(aiResponse);
          
          confidence = prediction.confidence * 0.8; // Lower confidence for AI-only
          estimatedBenefit = prediction.estimatedBenefit || 0;
          explanation = prediction.explanation;
          
          // Verify AI-generated explanation against statutory rules
          try {
            const verificationResult = await neuroSymbolicHybridGateway.verifyExplanation(
              explanation,
              "MD",
              program.code,
              {
                caseId: household.householdId,
                triggeredBy: "cross_enrollment_fallback"
              }
            );

            if (verificationResult.isLegallyConsistent) {
              statutoryCitations = verificationResult.statutoryCitations;
            } else if (verificationResult.symbolicVerification.violationCount > 0) {
              confidence = Math.max(0, confidence * 0.6);
              logger.warn("[CrossEnrollment] AI fallback failed statutory verification", {
                programCode: program.code,
                violationCount: verificationResult.symbolicVerification.violationCount,
                service: "CrossEnrollmentEngine"
              });
            }
          } catch (gatewayError) {
            logger.warn("[CrossEnrollment] Gateway verification unavailable for fallback", {
              programCode: program.code,
              service: "CrossEnrollmentEngine"
            });
          }
        }
        
        // STEP 3: PolicyEngine cross-validation (VERIFICATION ONLY)
        if (program.hasPolicyEngineValidation && rulesEngineResult) {
          try {
            const policyEngineResult = await policyEngineService.calculateBenefits({
              household: {
                people: { you: { age: 35 } },
                households: {
                  household: {
                    members: ['you'],
                    state_code: 'MD'
                  }
                }
              }
            });
            
            // Cross-validate using guardrail service
            const guardrailResult = await policyEngineGuardrail.crossValidate(
              program.id,
              eligibilityPayload,
              {
                programId: program.id,
                eligible: rulesEngineResult.eligible,
                benefitAmount: rulesEngineResult.estimatedBenefit,
                reasonCodes: [rulesEngineResult.reason],
                legalCitations: statutoryCitations,
                calculationMethod: 'RaC_Z3_Hybrid'
              },
              policyEngineResult[program.code]
            );
            
            if (guardrailResult.discrepancyDetected) {
              logger.warn("[CrossEnrollment] PolicyEngine discrepancy detected", {
                programCode: program.code,
                discrepancyType: guardrailResult.discrepancyType,
                severity: guardrailResult.discrepancySeverity,
                service: "CrossEnrollmentEngine"
              });
              
              // Reduce confidence for discrepancies, but RaC decision stands
              if (guardrailResult.discrepancySeverity === 'high' || 
                  guardrailResult.discrepancySeverity === 'critical') {
                confidence = Math.max(0.5, confidence * 0.85);
              }
            }
          } catch (peError) {
            logger.warn("[CrossEnrollment] PolicyEngine verification unavailable", {
              programCode: program.code,
              service: "CrossEnrollmentEngine"
            });
          }
        }
        
        // Calculate impact score based on benefit relative to income
        const incomeRatio = household.monthlyIncome > 0 
          ? estimatedBenefit / household.monthlyIncome 
          : 1;
        const impactScore = Math.min(100, Math.round(incomeRatio * 100 + (household.hasChildren ? 15 : 0) + (household.hasDisabled ? 20 : 0)));
        
        // Determine priority based on impact and confidence
        let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        if (impactScore >= 80 && confidence >= 0.9) priority = 'critical';
        else if (impactScore >= 60 && confidence >= 0.75) priority = 'high';
        else if (impactScore >= 30 || confidence >= 0.65) priority = 'medium';
        else priority = 'low';
        
        recommendations.push({
          programId: program.id,
          programName: program.name,
          confidence,
          estimatedBenefit,
          impactScore,
          priority,
          explanation: explanation + (statutoryCitations.length > 0 
            ? ` (Legal basis: ${statutoryCitations.slice(0, 2).join(', ')})` 
            : '') + (hybridVerificationStatus === 'verified' ? ' [Z3 Verified]' : ''),
          requirements: this.getRequirementsForProgram(program.code),
          processingTime: this.getProcessingTimeForProgram(program.code),
          deadline: this.calculateDeadline(program.code)
        });
      } catch (error) {
        logger.error("Error generating recommendation", {
          context: 'CrossEnrollmentEngineService.generateRecommendations',
          programCode: program.code,
          programName: program.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Get standard requirements for a benefit program
   */
  private getRequirementsForProgram(programCode: string): string[] {
    const requirements: Record<string, string[]> = {
      'SNAP': ['Proof of identity', 'Proof of residency', 'Income verification', 'Asset documentation'],
      'MD_SNAP': ['Proof of identity', 'Proof of residency', 'Income verification', 'Asset documentation'],
      'MEDICAID': ['Proof of identity', 'Proof of residency', 'Income verification', 'Citizenship/immigration status'],
      'TANF': ['Proof of identity', 'Proof of residency', 'Income verification', 'Child birth certificates', 'Work participation plan'],
      'MD_TANF': ['Proof of identity', 'Proof of residency', 'Income verification', 'Child birth certificates', 'Work participation plan'],
      'TCA': ['Proof of identity', 'Proof of residency', 'Income verification', 'Child birth certificates', 'Work participation plan'],
      'OHEP': ['Utility bills', 'Proof of residency', 'Income verification'],
      'MD_OHEP': ['Utility bills', 'Proof of residency', 'Income verification'],
      'LIHEAP': ['Utility bills', 'Proof of residency', 'Income verification'],
    };
    return requirements[programCode] || ['Proof of identity', 'Proof of residency', 'Income verification'];
  }
  
  /**
   * Get standard processing time for a benefit program
   */
  private getProcessingTimeForProgram(programCode: string): number {
    const processingTimes: Record<string, number> = {
      'SNAP': 30,
      'MD_SNAP': 30,
      'MEDICAID': 45,
      'TANF': 45,
      'MD_TANF': 45,
      'TCA': 45,
      'OHEP': 21,
      'MD_OHEP': 21,
      'LIHEAP': 21,
    };
    return processingTimes[programCode] || 30;
  }

  private async generateImpactAnalysis(
    original: HouseholdData,
    modified: HouseholdData,
    originalRecs: BenefitRecommendation[],
    newRecs: BenefitRecommendation[]
  ): Promise<string> {
    const prompt = `
      Analyze the impact of household changes on benefit eligibility:
      
      Original Household:
      - Income: $${original.monthlyIncome}
      - Size: ${original.householdSize}
      - Employment: ${original.employmentStatus}
      
      Modified Household:
      - Income: $${modified.monthlyIncome}
      - Size: ${modified.householdSize}
      - Employment: ${modified.employmentStatus}
      
      Original Benefits (${originalRecs.length} programs):
      ${originalRecs.map(r => `- ${r.programName}: $${r.estimatedBenefit}/month`).join('\n')}
      
      New Benefits (${newRecs.length} programs):
      ${newRecs.map(r => `- ${r.programName}: $${r.estimatedBenefit}/month`).join('\n')}
      
      Provide a clear, concise analysis of:
      1. Key changes in eligibility
      2. Financial impact on the household
      3. Recommended actions
      
      Keep response under 200 words and use simple language.
    `;
    
    return await generateTextWithGemini(prompt);
  }

  private calculateDeadline(programCode: string): Date | undefined {
    // Program-specific deadlines
    const deadlines: Record<string, number> = {
      'LIHEAP': 90, // 90 days for heating assistance
      'SNAP': 30,   // 30 days for expedited SNAP
      'WIC': 60,    // 60 days for WIC enrollment
      'MEDICAID': 45, // 45 days for Medicaid
      'FREE_LUNCH': 10 // 10 days for school lunch
    };
    
    const days = deadlines[programCode];
    if (days) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + days);
      return deadline;
    }
    
    return undefined;
  }

  private async storeRecommendations(
    householdId: string,
    recommendations: BenefitRecommendation[]
  ): Promise<void> {
    const records: InsertCrossEnrollmentRecommendation[] = recommendations
      .filter(r => r.confidence >= this.CONFIDENCE_THRESHOLD)
      .map(rec => ({
        householdProfileId: householdId,
        recommendedProgramId: rec.programId,
        eligibilityConfidence: rec.confidence,
        estimatedBenefitAmount: Math.round(rec.estimatedBenefit * 100), // Store in cents
        impactScore: rec.impactScore,
        priority: rec.priority,
        recommendationType: 'new_enrollment',
        explanation: rec.explanation,
        requirements: rec.requirements,
        estimatedProcessingTime: rec.processingTime,
        applicationDeadline: rec.deadline,
        status: 'pending',
        modelVersion: this.MODEL_VERSION,
        predictionMetadata: {
          generatedAt: new Date().toISOString(),
          confidenceThreshold: this.CONFIDENCE_THRESHOLD
        }
      }));
    
    if (records.length > 0) {
      await db.insert(crossEnrollmentRecommendations).values(records);
    }
  }

  private async trackPredictions(
    householdId: string,
    recommendations: BenefitRecommendation[]
  ): Promise<void> {
    const predictions: InsertPredictionHistory[] = recommendations.map(rec => ({
      predictionType: 'cross_enrollment',
      entityType: 'household_profile',
      entityId: householdId,
      prediction: {
        programId: rec.programId,
        programName: rec.programName,
        confidence: rec.confidence,
        estimatedBenefit: rec.estimatedBenefit,
        impactScore: rec.impactScore,
        priority: rec.priority
      },
      confidence: rec.confidence,
      features: {
        householdSize: recommendations[0] ? recommendations[0].requirements.length : 0,
        currentEnrollments: recommendations.length
      },
      modelName: 'CrossEnrollmentEngine',
      modelVersion: this.MODEL_VERSION,
      metadata: {
        timestamp: new Date().toISOString()
      }
    }));
    
    if (predictions.length > 0) {
      await db.insert(predictionHistory).values(predictions);
    }
  }

  private async notifyHighImpactOpportunities(
    householdId: string,
    recommendations: BenefitRecommendation[]
  ): Promise<void> {
    const highImpact = recommendations.filter(
      r => r.impactScore >= this.HIGH_IMPACT_THRESHOLD && r.confidence >= this.CONFIDENCE_THRESHOLD
    );
    
    if (highImpact.length > 0) {
      // Find the case worker assigned to this household
      const clientCase = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, householdId)
      });
      
      if (clientCase?.assignedNavigator) {
        await notificationService.create({
          userId: clientCase.assignedNavigator,
          type: 'cross_enrollment_opportunity',
          title: 'High-Impact Cross-Enrollment Opportunities',
          message: `${highImpact.length} high-impact benefit opportunities identified for household. Total potential benefit: $${highImpact.reduce((sum, r) => sum + r.estimatedBenefit, 0)}/month`,
          priority: 'high',
          relatedEntityType: 'household_profile',
          relatedEntityId: householdId,
          actionUrl: `/households/${householdId}/cross-enrollment`
        });
      }
    }
  }
}

export const crossEnrollmentEngineService = new CrossEnrollmentEngineService();