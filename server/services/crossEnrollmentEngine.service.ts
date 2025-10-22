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
import { cacheService, CACHE_KEYS } from "./cacheService";
import { notificationService } from "./notification.service";
import { logger } from "./logger.service";

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

  private async generateRecommendations(
    household: HouseholdData,
    programs: any[]
  ): Promise<BenefitRecommendation[]> {
    const recommendations: BenefitRecommendation[] = [];
    
    for (const program of programs) {
      // Use Gemini AI to predict eligibility and generate explanation
      const prompt = `
        Analyze eligibility for ${program.name} (${program.code}) for a household with:
        - Size: ${household.householdSize} people
        - Monthly Income: $${household.monthlyIncome}
        - Has Children: ${household.hasChildren}
        - Has Elderly: ${household.hasElderly}
        - Has Disabled: ${household.hasDisabled}
        - County: ${household.county || 'Unknown'}
        - Employment Status: ${household.employmentStatus || 'Unknown'}
        - Housing Status: ${household.housingStatus || 'Unknown'}
        - Current Benefits: ${household.currentEnrollments.join(', ') || 'None'}
        
        Based on Maryland benefit program rules, provide:
        1. Eligibility confidence score (0-1)
        2. Estimated monthly benefit amount in dollars
        3. Impact score (0-100) based on household need
        4. Priority level (low, medium, high, critical)
        5. Clear explanation of eligibility
        6. List of requirements to qualify
        7. Estimated processing time in days
        
        Format response as JSON:
        {
          "confidence": 0.85,
          "estimatedBenefit": 250,
          "impactScore": 75,
          "priority": "high",
          "explanation": "Your household likely qualifies for...",
          "requirements": ["Income verification", "Proof of residency"],
          "processingTime": 30
        }
      `;
      
      try {
        const aiResponse = await generateTextWithGemini(prompt);
        const prediction = JSON.parse(aiResponse);
        
        // Verify with PolicyEngine if available
        let verifiedConfidence = prediction.confidence;
        if (program.hasPolicyEngineValidation) {
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
          
          // Adjust confidence based on PolicyEngine validation
          if (policyEngineResult[program.code]) {
            verifiedConfidence = Math.min(1, prediction.confidence * 1.2);
          }
        }
        
        recommendations.push({
          programId: program.id,
          programName: program.name,
          confidence: verifiedConfidence,
          estimatedBenefit: prediction.estimatedBenefit,
          impactScore: prediction.impactScore,
          priority: prediction.priority,
          explanation: prediction.explanation,
          requirements: prediction.requirements,
          processingTime: prediction.processingTime,
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