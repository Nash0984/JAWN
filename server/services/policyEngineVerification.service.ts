import { PolicyEngineService } from './policyEngine.service';
import type { IStorage } from '../storage';
import type { InsertPolicyEngineVerification, PolicyEngineVerification } from '@shared/schema';

interface VerificationResult {
  isMatch: boolean;
  variance: number | null;
  variancePercentage: number | null;
  confidenceScore: number;
  ourResult: any;
  policyEngineResult: any;
  errorDetails?: string;
}

export class PolicyEngineVerificationService {
  private policyEngineService: PolicyEngineService;
  private storage: IStorage;
  
  // Tolerance for numeric comparisons (2% variance acceptable)
  private readonly VARIANCE_TOLERANCE_PERCENT = 2;

  constructor(storage: IStorage) {
    this.policyEngineService = new PolicyEngineService();
    this.storage = storage;
  }

  /**
   * Verify SNAP benefit calculation against PolicyEngine
   */
  async verifySNAPCalculation(
    householdData: any,
    ourCalculation: any,
    options: {
      sessionId?: string;
      performedBy?: string;
      benefitProgramId: string;
    }
  ): Promise<PolicyEngineVerification> {
    try {
      // Get PolicyEngine's calculation
      const peResult = await this.policyEngineService.calculateBenefits(householdData);
      
      // Extract SNAP amount from both results
      const ourSNAPAmount = ourCalculation.snapBenefitAmount || 0;
      const peSNAPAmount = peResult.snap || 0;
      
      // Calculate variance
      const variance = Math.abs(ourSNAPAmount - peSNAPAmount);
      const variancePercentage = peSNAPAmount > 0 
        ? (variance / peSNAPAmount) * 100 
        : (ourSNAPAmount > 0 ? 100 : 0);
      
      // Determine if results match within tolerance
      const isMatch = variancePercentage <= this.VARIANCE_TOLERANCE_PERCENT;
      
      // Calculate confidence score based on match quality
      const confidenceScore = this.calculateConfidenceScore(variancePercentage);
      
      // Store verification record
      const verification: InsertPolicyEngineVerification = {
        benefitProgramId: options.benefitProgramId,
        verificationType: 'benefit_amount',
        inputData: householdData,
        ourResult: {
          snapBenefitAmount: ourSNAPAmount,
          calculationMethod: ourCalculation.calculationMethod || 'rules_as_code',
          details: ourCalculation
        },
        policyEngineResult: {
          snap: peSNAPAmount,
          allBenefits: peResult,
          version: peResult.version || 'unknown'
        },
        policyEngineVersion: peResult.version || 'unknown',
        variance,
        variancePercentage,
        isMatch,
        confidenceScore,
        sessionId: options.sessionId,
        performedBy: options.performedBy,
      };
      
      return await this.storage.createPolicyEngineVerification(verification);
    } catch (error) {
      console.error('PolicyEngine verification failed:', error);
      
      // Store failed verification
      const failedVerification: InsertPolicyEngineVerification = {
        benefitProgramId: options.benefitProgramId,
        verificationType: 'benefit_amount',
        inputData: householdData,
        ourResult: ourCalculation,
        policyEngineResult: null,
        policyEngineVersion: null,
        variance: null,
        variancePercentage: null,
        isMatch: false,
        confidenceScore: 0,
        sessionId: options.sessionId,
        performedBy: options.performedBy,
        errorDetails: error instanceof Error ? error.message : String(error),
      };
      
      return await this.storage.createPolicyEngineVerification(failedVerification);
    }
  }

  /**
   * Verify tax calculation against PolicyEngine
   */
  async verifyTaxCalculation(
    householdData: any,
    ourTaxCalculation: any,
    options: {
      sessionId?: string;
      performedBy?: string;
      benefitProgramId: string;
    }
  ): Promise<PolicyEngineVerification> {
    try {
      // Get PolicyEngine's tax calculation
      const peResult = await this.policyEngineService.calculateBenefits(householdData);
      
      // Compare EITC, CTC, and other tax credits
      const comparisons = {
        eitc: {
          ours: ourTaxCalculation.eitc || 0,
          theirs: peResult.eitc || 0
        },
        ctc: {
          ours: ourTaxCalculation.ctc || 0,
          theirs: peResult.ctc || 0
        },
        totalTaxCredits: {
          ours: (ourTaxCalculation.eitc || 0) + (ourTaxCalculation.ctc || 0),
          theirs: (peResult.eitc || 0) + (peResult.ctc || 0)
        }
      };
      
      // Calculate overall variance
      const totalVariance = Math.abs(
        comparisons.totalTaxCredits.ours - comparisons.totalTaxCredits.theirs
      );
      const variancePercentage = comparisons.totalTaxCredits.theirs > 0
        ? (totalVariance / comparisons.totalTaxCredits.theirs) * 100
        : (comparisons.totalTaxCredits.ours > 0 ? 100 : 0);
      
      const isMatch = variancePercentage <= this.VARIANCE_TOLERANCE_PERCENT;
      const confidenceScore = this.calculateConfidenceScore(variancePercentage);
      
      const verification: InsertPolicyEngineVerification = {
        benefitProgramId: options.benefitProgramId,
        verificationType: 'tax_calculation',
        inputData: householdData,
        ourResult: {
          ...ourTaxCalculation,
          comparisons,
          calculationMethod: ourTaxCalculation.calculationMethod || 'vita_rules'
        },
        policyEngineResult: {
          eitc: peResult.eitc,
          ctc: peResult.ctc,
          allTaxCredits: peResult,
          version: peResult.version || 'unknown'
        },
        policyEngineVersion: peResult.version || 'unknown',
        variance: totalVariance,
        variancePercentage,
        isMatch,
        confidenceScore,
        sessionId: options.sessionId,
        performedBy: options.performedBy,
      };
      
      return await this.storage.createPolicyEngineVerification(verification);
    } catch (error) {
      console.error('Tax verification failed:', error);
      
      const failedVerification: InsertPolicyEngineVerification = {
        benefitProgramId: options.benefitProgramId,
        verificationType: 'tax_calculation',
        inputData: householdData,
        ourResult: ourTaxCalculation,
        policyEngineResult: null,
        policyEngineVersion: null,
        variance: null,
        variancePercentage: null,
        isMatch: false,
        confidenceScore: 0,
        sessionId: options.sessionId,
        performedBy: options.performedBy,
        errorDetails: error instanceof Error ? error.message : String(error),
      };
      
      return await this.storage.createPolicyEngineVerification(failedVerification);
    }
  }

  /**
   * Verify eligibility determination against PolicyEngine
   */
  async verifyEligibility(
    householdData: any,
    ourEligibilityResult: { isEligible: boolean; reason?: string },
    programCode: string,
    options: {
      sessionId?: string;
      performedBy?: string;
      benefitProgramId: string;
    }
  ): Promise<PolicyEngineVerification> {
    try {
      const peResult = await this.policyEngineService.calculateBenefits(householdData);
      
      // Determine PolicyEngine's eligibility based on benefit amount > 0
      let peEligible = false;
      let peBenefitAmount = 0;
      
      if (programCode === 'MD_SNAP' || programCode === 'SNAP') {
        peEligible = (peResult.snap || 0) > 0;
        peBenefitAmount = peResult.snap || 0;
      } else if (programCode === 'VITA') {
        // For tax programs, eligible if any credits > 0
        peEligible = ((peResult.eitc || 0) + (peResult.ctc || 0)) > 0;
        peBenefitAmount = (peResult.eitc || 0) + (peResult.ctc || 0);
      }
      
      const isMatch = ourEligibilityResult.isEligible === peEligible;
      const confidenceScore = isMatch ? 1.0 : 0.0;
      
      const verification: InsertPolicyEngineVerification = {
        benefitProgramId: options.benefitProgramId,
        verificationType: 'eligibility_check',
        inputData: householdData,
        ourResult: {
          ...ourEligibilityResult,
          programCode
        },
        policyEngineResult: {
          isEligible: peEligible,
          benefitAmount: peBenefitAmount,
          allResults: peResult
        },
        policyEngineVersion: peResult.version || 'unknown',
        variance: null, // Not applicable for boolean eligibility
        variancePercentage: null,
        isMatch,
        confidenceScore,
        sessionId: options.sessionId,
        performedBy: options.performedBy,
      };
      
      return await this.storage.createPolicyEngineVerification(verification);
    } catch (error) {
      console.error('Eligibility verification failed:', error);
      
      const failedVerification: InsertPolicyEngineVerification = {
        benefitProgramId: options.benefitProgramId,
        verificationType: 'eligibility_check',
        inputData: householdData,
        ourResult: ourEligibilityResult,
        policyEngineResult: null,
        policyEngineVersion: null,
        variance: null,
        variancePercentage: null,
        isMatch: false,
        confidenceScore: 0,
        sessionId: options.sessionId,
        performedBy: options.performedBy,
        errorDetails: error instanceof Error ? error.message : String(error),
      };
      
      return await this.storage.createPolicyEngineVerification(failedVerification);
    }
  }

  /**
   * Calculate confidence score based on variance percentage
   * 0% variance = 1.0 confidence
   * At tolerance threshold = 0.7 confidence
   * > tolerance = 0.0 confidence
   */
  private calculateConfidenceScore(variancePercentage: number): number {
    if (variancePercentage <= this.VARIANCE_TOLERANCE_PERCENT) {
      // Linear scale from 1.0 (0% variance) to 0.7 (at tolerance)
      return 1.0 - (variancePercentage / this.VARIANCE_TOLERANCE_PERCENT) * 0.3;
    }
    return 0.0; // No confidence if outside tolerance
  }

  /**
   * Get verification statistics for a program
   */
  async getVerificationStats(benefitProgramId: string): Promise<{
    totalVerifications: number;
    matchRate: number;
    averageConfidence: number;
    averageVariancePercent: number;
  }> {
    const verifications = await this.storage.getPolicyEngineVerificationsByProgram(benefitProgramId);
    
    if (verifications.length === 0) {
      return {
        totalVerifications: 0,
        matchRate: 0,
        averageConfidence: 0,
        averageVariancePercent: 0
      };
    }
    
    const matches = verifications.filter(v => v.isMatch).length;
    const totalConfidence = verifications.reduce((sum, v) => sum + (v.confidenceScore || 0), 0);
    const validVariances = verifications.filter(v => v.variancePercentage !== null);
    const totalVariance = validVariances.reduce((sum, v) => sum + (v.variancePercentage || 0), 0);
    
    return {
      totalVerifications: verifications.length,
      matchRate: (matches / verifications.length) * 100,
      averageConfidence: totalConfidence / verifications.length,
      averageVariancePercent: validVariances.length > 0 
        ? totalVariance / validVariances.length 
        : 0
    };
  }
}
