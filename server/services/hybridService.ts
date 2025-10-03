/**
 * Hybrid Service - Intelligent Routing Layer
 * 
 * Routes queries to the appropriate backend:
 * - Rules Engine: For deterministic eligibility calculations
 * - RAG System: For policy interpretation and explanations  
 * - Combined: For queries needing both calculation and explanation
 */

import { queryClassifier, type ClassificationResult } from './queryClassifier';
import { rulesEngine } from './rulesEngine';
import { ragService } from './ragService';
import { storage } from '../storage';

export interface HybridSearchResult {
  answer: string;
  type: 'deterministic' | 'ai_generated' | 'hybrid';
  classification: ClassificationResult;
  
  // Deterministic calculation results (if applicable)
  calculation?: {
    eligible: boolean;
    estimatedBenefit?: number;
    reason: string;
    breakdown?: any;
    appliedRules?: string[];
  };
  
  // AI-generated explanation (if applicable)
  aiExplanation?: {
    answer: string;
    sources: Array<{
      documentId: string;
      filename: string;
      content: string;
      relevanceScore: number;
    }>;
    relevanceScore?: number;
  };
  
  // Suggested next actions
  nextSteps?: string[];
  
  responseTime: number;
}

class HybridService {
  /**
   * Main search entry point with intelligent routing
   */
  async search(query: string, benefitProgramId?: string): Promise<HybridSearchResult> {
    const startTime = Date.now();
    
    // Step 1: Classify the query
    const classification = queryClassifier.classify(query);
    console.log('Query classification:', classification);

    let result: HybridSearchResult;

    // Step 2: Route based on classification
    switch (classification.type) {
      case 'eligibility':
        result = await this.handleEligibilityQuery(query, classification, benefitProgramId);
        break;
        
      case 'policy':
        result = await this.handlePolicyQuery(query, benefitProgramId);
        break;
        
      case 'hybrid':
        result = await this.handleHybridQuery(query, classification, benefitProgramId);
        break;
    }

    result.responseTime = Date.now() - startTime;
    return result;
  }

  /**
   * Handle eligibility questions with Rules Engine
   */
  private async handleEligibilityQuery(
    query: string,
    classification: ClassificationResult,
    benefitProgramId?: string
  ): Promise<HybridSearchResult> {
    
    // Check if we can calculate directly from extracted parameters
    if (queryClassifier.canCalculateDirectly(classification) && classification.extractedParams) {
      const params = classification.extractedParams;
      
      // Get SNAP program if not provided
      if (!benefitProgramId) {
        const programs = await storage.getBenefitPrograms();
        const snapProgram = programs.find(p => p.code === 'MD_SNAP');
        if (snapProgram) {
          benefitProgramId = snapProgram.id;
        }
      }

      if (benefitProgramId) {
        // Calculate eligibility using Rules Engine
        const household = {
          size: params.householdSize || 1,
          grossMonthlyIncome: params.income || 0,
          earnedIncome: 0,
          unearnedIncome: params.income || 0,
          hasElderly: params.hasElderly || false,
          hasDisabled: params.hasDisabled || false,
          dependentCareExpenses: 0,
          medicalExpenses: 0,
          shelterCosts: 0,
          categoricalEligibility: params.hasSSI ? 'SSI' : params.hasTANF ? 'TANF' : undefined,
        };
        
        const calculation = await rulesEngine.calculateEligibility(benefitProgramId, household);

        const answer = this.formatCalculationAnswer(calculation, params);

        return {
          answer,
          type: 'deterministic',
          classification,
          calculation: {
            eligible: calculation.isEligible,
            estimatedBenefit: calculation.monthlyBenefit,
            reason: calculation.reason || '',
            breakdown: calculation.calculationBreakdown,
            appliedRules: calculation.calculationBreakdown,
          },
          nextSteps: this.generateNextSteps(calculation, params),
          responseTime: 0,
        };
      }
    }

    // If we can't calculate directly, provide guidance + RAG context
    const ragResult = await ragService.search(query, benefitProgramId);
    
    const guidanceMessage = classification.extractedParams 
      ? this.buildGuidanceMessage(classification.extractedParams)
      : 'To check your SNAP eligibility, I need some information about your household.';

    return {
      answer: `${guidanceMessage}\n\n${ragResult.answer}`,
      type: 'ai_generated',
      classification,
      aiExplanation: {
        answer: ragResult.answer,
        sources: ragResult.sources,
        relevanceScore: ragResult.relevanceScore,
      },
      nextSteps: [
        'Use the Eligibility Checker tool to get a personalized calculation',
        'Provide your household size and monthly income',
        'Indicate if anyone receives SSI or TANF benefits',
      ],
      responseTime: 0,
    };
  }

  /**
   * Handle policy/interpretation questions with RAG
   */
  private async handlePolicyQuery(
    query: string,
    benefitProgramId?: string
  ): Promise<HybridSearchResult> {
    
    const ragResult = await ragService.search(query, benefitProgramId);

    return {
      answer: ragResult.answer,
      type: 'ai_generated',
      classification: {
        type: 'policy',
        confidence: 0.9,
        reasoning: 'Policy interpretation question',
      },
      aiExplanation: {
        answer: ragResult.answer,
        sources: ragResult.sources,
        relevanceScore: ragResult.relevanceScore,
      },
      nextSteps: this.generatePolicyNextSteps(query),
      responseTime: 0,
    };
  }

  /**
   * Handle hybrid questions - calculation + explanation
   */
  private async handleHybridQuery(
    query: string,
    classification: ClassificationResult,
    benefitProgramId?: string
  ): Promise<HybridSearchResult> {
    
    // Run both Rules Engine and RAG in parallel
    const [calculationResult, ragResult] = await Promise.all([
      (async () => {
        if (queryClassifier.canCalculateDirectly(classification) && classification.extractedParams) {
          const params = classification.extractedParams;
          
          if (!benefitProgramId) {
            const programs = await storage.getBenefitPrograms();
            const snapProgram = programs.find(p => p.code === 'MD_SNAP');
            if (snapProgram) benefitProgramId = snapProgram.id;
          }

          if (benefitProgramId) {
            const household = {
              size: params.householdSize || 1,
              grossMonthlyIncome: params.income || 0,
              earnedIncome: 0,
              unearnedIncome: params.income || 0,
              hasElderly: params.hasElderly || false,
              hasDisabled: params.hasDisabled || false,
              dependentCareExpenses: 0,
              medicalExpenses: 0,
              shelterCosts: 0,
              categoricalEligibility: params.hasSSI ? 'SSI' : params.hasTANF ? 'TANF' : undefined,
            };
            return await rulesEngine.calculateEligibility(benefitProgramId, household);
          }
        }
        return null;
      })(),
      ragService.search(query, benefitProgramId),
    ]);

    // Combine results
    let answer = '';
    
    if (calculationResult) {
      answer = this.formatCalculationAnswer(calculationResult, classification.extractedParams || {});
      answer += '\n\n**Why This Calculation:**\n' + ragResult.answer;
    } else {
      answer = ragResult.answer;
    }

    return {
      answer,
      type: 'hybrid',
      classification,
      calculation: calculationResult ? {
        eligible: calculationResult.isEligible,
        estimatedBenefit: calculationResult.monthlyBenefit,
        reason: calculationResult.reason || '',
        breakdown: calculationResult.calculationBreakdown,
        appliedRules: calculationResult.calculationBreakdown,
      } : undefined,
      aiExplanation: {
        answer: ragResult.answer,
        sources: ragResult.sources,
        relevanceScore: ragResult.relevanceScore,
      },
      nextSteps: calculationResult 
        ? this.generateNextSteps(calculationResult, classification.extractedParams || {})
        : this.generatePolicyNextSteps(query),
      responseTime: 0,
    };
  }

  /**
   * Format calculation result into plain language answer
   */
  private formatCalculationAnswer(calculation: any, params: any): string {
    const householdInfo = params.householdSize 
      ? `for a household of ${params.householdSize}` 
      : '';
    const incomeInfo = params.income 
      ? ` with monthly income of $${(params.income / 100).toFixed(2)}` 
      : '';

    if (calculation.isEligible) {
      const benefit = calculation.monthlyBenefit 
        ? `$${(calculation.monthlyBenefit / 100).toFixed(2)} per month` 
        : 'benefits';
      
      return `**Good news!** Based on Maryland SNAP rules, you appear to be eligible ${householdInfo}${incomeInfo}. ` +
        `Your estimated benefit is **${benefit}**.\n\n${calculation.reason || ''}`;
    } else {
      return `Based on Maryland SNAP rules ${householdInfo}${incomeInfo}, you may not be eligible at this time.\n\n${calculation.reason || ''}`;
    }
  }

  /**
   * Build guidance message for incomplete eligibility queries
   */
  private buildGuidanceMessage(params: any): string {
    const missing = [];
    if (!params.householdSize) missing.push('household size');
    if (!params.income && !params.hasSSI && !params.hasTANF) missing.push('monthly income');

    if (missing.length === 0) {
      return 'Let me check your SNAP eligibility based on the information provided.';
    }

    return `To calculate your SNAP eligibility, I need to know your ${missing.join(' and ')}.`;
  }

  /**
   * Generate context-aware next steps
   */
  private generateNextSteps(calculation: any, params: any): string[] {
    const steps: string[] = [];

    if (calculation.eligible) {
      steps.push('Complete a full SNAP application at MarylandBenefits.gov');
      steps.push('Gather required documents (proof of income, identity, residency)');
      if (!params.shelterCosts) {
        steps.push('Calculate your exact benefit by including shelter and utility costs');
      }
      steps.push('Schedule an interview with your local Department of Social Services');
    } else {
      steps.push('Use the Benefit Calculator to explore different scenarios');
      steps.push('Check if you qualify for other assistance programs');
      if (calculation.reason.includes('income')) {
        steps.push('Consider deductions like shelter costs and medical expenses that may help you qualify');
      }
    }

    return steps;
  }

  /**
   * Generate next steps for policy questions
   */
  private generatePolicyNextSteps(query: string): string[] {
    return [
      'Use the Eligibility Checker to see if you qualify',
      'Review the full SNAP Policy Manual for detailed regulations',
      'Contact your local Department of Social Services for personalized assistance',
    ];
  }
}

export const hybridService = new HybridService();
