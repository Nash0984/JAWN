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
import { programDetection, type ProgramMatch } from './programDetection';
import { rulesEngineAdapter, type HybridEligibilityPayload, type HybridCalculationResult } from './rulesEngineAdapter';
import { cacheService, CACHE_KEYS, generateHouseholdHash } from './cacheService';

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
    policyCitations?: Array<{
      sectionNumber: string;
      sectionTitle: string;
      ruleType: string;
      description: string;
    }>;
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
    citations?: Array<{
      sectionNumber: string;
      sectionTitle: string;
      sourceUrl?: string;
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
    
    // Step 1: Load program metadata and create bidirectional maps
    const programs = await storage.getBenefitPrograms();
    const programIdMap: Record<string, string> = {}; // code → UUID
    const programCodeMap: Record<string, string> = {}; // UUID → code
    for (const program of programs) {
      programIdMap[program.code] = program.id;
      programCodeMap[program.id] = program.code;
    }
    
    // Step 2: If benefitProgramId is a UUID, map it to program code for detection
    let programCode: string | undefined;
    if (benefitProgramId && programCodeMap[benefitProgramId]) {
      programCode = programCodeMap[benefitProgramId];
    }
    
    // Step 3: Detect which program(s) the query is about
    // Pass program code instead of UUID for proper detection
    const programMatches = programDetection.detectProgram(query, programCode);
    console.log('Detected programs:', programMatches);
    
    // Step 4: Check if we can calculate directly from extracted parameters
    if (queryClassifier.canCalculateDirectly(classification) && classification.extractedParams) {
      const params = classification.extractedParams;
      
      // Step 5: Try each program candidate until we get a result
      for (const match of programMatches) {
        // Resolve program ID if needed (for SNAP and other DB-dependent programs)
        const resolvedProgramId = match.programCode === 'MD_SNAP' 
          ? (benefitProgramId || programIdMap[match.programCode])
          : undefined;
        
        // Build normalized input payload
        const input: HybridEligibilityPayload = {
          householdSize: params.householdSize,
          income: params.income,
          hasElderly: params.hasElderly,
          hasDisabled: params.hasDisabled,
          hasSSI: params.hasSSI,
          hasTANF: params.hasTANF,
          benefitProgramId: resolvedProgramId,
        };
        
        // Step 5: Route to appropriate rules engine via adapter
        const calculation = await rulesEngineAdapter.calculateEligibility(match.programCode, input);
        
        if (calculation) {
          const answer = this.formatAdapterCalculationAnswer(calculation, match, params);

          return {
            answer,
            type: 'deterministic',
            classification,
            calculation: {
              eligible: calculation.eligible,
              estimatedBenefit: calculation.estimatedBenefit,
              reason: calculation.reason,
              breakdown: calculation.breakdown,
              appliedRules: calculation.breakdown,
              policyCitations: calculation.citations.map(c => ({
                sectionNumber: c.split(':')[0] || '',
                sectionTitle: '',
                ruleType: 'eligibility',
                description: c,
              })),
            },
            nextSteps: this.generateAdapterNextSteps(calculation, match, params),
            responseTime: 0,
          };
        }
      }
    }

    // If we can't calculate directly, provide guidance + RAG context
    const ragResult = await ragService.search(query, benefitProgramId);
    
    const guidanceMessage = classification.extractedParams 
      ? this.buildGuidanceMessage(classification.extractedParams)
      : 'To check your eligibility, I need some information about your household.';

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
        'Indicate any special circumstances (disability, elderly, etc.)',
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
    
    // Load program metadata and create bidirectional maps
    const programs = await storage.getBenefitPrograms();
    const programIdMap: Record<string, string> = {}; // code → UUID
    const programCodeMap: Record<string, string> = {}; // UUID → code
    for (const program of programs) {
      programIdMap[program.code] = program.id;
      programCodeMap[program.id] = program.code;
    }
    
    // If benefitProgramId is a UUID, map it to program code for detection
    let programCode: string | undefined;
    if (benefitProgramId && programCodeMap[benefitProgramId]) {
      programCode = programCodeMap[benefitProgramId];
    }
    
    // Detect programs (pass code instead of UUID)
    const programMatches = programDetection.detectProgram(query, programCode);
    
    // Generate cache key for hybrid calculation
    const cacheData = {
      query,
      params: classification.extractedParams,
      programCode: programMatches[0]?.programCode || 'UNKNOWN'
    };
    const householdHash = generateHouseholdHash(cacheData);
    const cacheKey = CACHE_KEYS.HYBRID_CALC(programMatches[0]?.programCode || 'UNKNOWN', householdHash);
    
    // Check cache first
    const cachedResult = cacheService.get<HybridSearchResult>(cacheKey);
    if (cachedResult) {
      console.log(`✅ Hybrid cache hit for query (hash: ${householdHash})`);
      return cachedResult;
    }
    
    console.log(`❌ Hybrid cache miss for query (hash: ${householdHash})`);
    
    // Run both Rules Engine and RAG in parallel
    const [calculationResult, ragResult] = await Promise.all([
      (async () => {
        if (queryClassifier.canCalculateDirectly(classification) && classification.extractedParams) {
          const params = classification.extractedParams;
          
          // Try each program candidate
          for (const match of programMatches) {
            // Resolve program ID if needed
            const resolvedProgramId = match.programCode === 'MD_SNAP' 
              ? (benefitProgramId || programIdMap[match.programCode])
              : undefined;
            
            const input: HybridEligibilityPayload = {
              householdSize: params.householdSize,
              income: params.income,
              assets: params.assets,
              hasElderly: params.hasElderly,
              hasDisabled: params.hasDisabled,
              hasSSI: params.hasSSI,
              hasTANF: params.hasTANF,
              benefitProgramId: resolvedProgramId,
            };
            
            const result = await rulesEngineAdapter.calculateEligibility(match.programCode, input);
            if (result) {
              return { calculation: result, match };
            }
          }
        }
        return null;
      })(),
      ragService.search(query, benefitProgramId),
    ]);

    // Combine results
    let answer = '';
    
    if (calculationResult) {
      answer = this.formatAdapterCalculationAnswer(
        calculationResult.calculation, 
        calculationResult.match, 
        classification.extractedParams || {}
      );
      answer += '\n\n**Why This Calculation:**\n' + ragResult.answer;
    } else {
      answer = ragResult.answer;
    }

    const result: HybridSearchResult = {
      answer,
      type: 'hybrid',
      classification,
      calculation: calculationResult ? {
        eligible: calculationResult.calculation.eligible,
        estimatedBenefit: calculationResult.calculation.estimatedBenefit,
        reason: calculationResult.calculation.reason,
        breakdown: calculationResult.calculation.breakdown,
        appliedRules: calculationResult.calculation.breakdown,
        policyCitations: calculationResult.calculation.citations.map(c => ({
          sectionNumber: c.split(':')[0] || '',
          sectionTitle: '',
          ruleType: 'eligibility',
          description: c,
        })),
      } : undefined,
      aiExplanation: {
        answer: ragResult.answer,
        sources: ragResult.sources,
        citations: ragResult.citations,
        relevanceScore: ragResult.relevanceScore,
      },
      nextSteps: calculationResult 
        ? this.generateAdapterNextSteps(calculationResult.calculation, calculationResult.match, classification.extractedParams || {})
        : this.generatePolicyNextSteps(query),
      responseTime: 0,
    };
    
    // Cache the hybrid result
    cacheService.set(cacheKey, result);
    console.log(`💾 Cached hybrid calculation result (hash: ${householdHash})`);
    
    return result;
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
      'Review the full Policy Manual for detailed regulations',
      'Contact your local Department of Social Services for personalized assistance',
    ];
  }

  /**
   * Format adapter calculation result into plain language answer
   */
  private formatAdapterCalculationAnswer(calculation: HybridCalculationResult, match: ProgramMatch, params: any): string {
    const householdInfo = params.householdSize 
      ? `for a household of ${params.householdSize}` 
      : '';
    const incomeInfo = params.income 
      ? ` with monthly income of $${(params.income / 100).toFixed(2)}` 
      : '';

    if (calculation.eligible) {
      const benefit = calculation.estimatedBenefit 
        ? `$${(calculation.estimatedBenefit / 100).toFixed(2)}` 
        : '';
      
      if (calculation.calculationType === 'tax') {
        return `**Tax Calculation Results** ${householdInfo}${incomeInfo}:\n\n${calculation.reason}\n\n` +
          `**Federal Tax:** $${((calculation.federalTax || 0) / 100).toFixed(2)}\n` +
          `**Maryland Tax:** $${((calculation.stateTax || 0) / 100).toFixed(2)}\n` +
          `**Total Refund:** ${benefit}`;
      } else {
        return `**Good news!** Based on Maryland ${match.displayName} rules, you appear to be eligible ${householdInfo}${incomeInfo}.\n\n` +
          `${benefit ? `Your estimated benefit is **${benefit} per month**.\n\n` : ''}${calculation.reason || ''}`;
      }
    } else {
      return `Based on Maryland ${match.displayName} rules ${householdInfo}${incomeInfo}, you may not be eligible at this time.\n\n${calculation.reason || ''}`;
    }
  }

  /**
   * Generate context-aware next steps for adapter results
   */
  private generateAdapterNextSteps(calculation: HybridCalculationResult, match: ProgramMatch, params: any): string[] {
    const steps: string[] = [];

    if (calculation.eligible) {
      if (calculation.programCode === 'MD_VITA_TAX') {
        steps.push('Schedule a VITA tax preparation appointment');
        steps.push('Gather all tax documents (W-2s, 1099s, etc.)');
        steps.push('Bring identification and Social Security cards');
      } else {
        steps.push(`Complete a full ${match.displayName} application at MarylandBenefits.gov`);
        steps.push('Gather required documents (proof of income, identity, residency)');
        steps.push('Schedule an interview with your local Department of Social Services');
      }
    } else {
      steps.push('Use the Benefit Calculator to explore different scenarios');
      steps.push('Check if you qualify for other assistance programs');
      if (calculation.reason.toLowerCase().includes('income')) {
        steps.push('Consider deductions like shelter costs and medical expenses that may help you qualify');
      }
    }

    return steps;
  }
}

export const hybridService = new HybridService();
