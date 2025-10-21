import { storage } from '../storage';
import { policyEngineService, PolicyEngineHousehold } from './policyEngine.service';
import type { EeClient, ClientCase, BenefitProgram, CrossEnrollmentOpportunity } from '@shared/schema';

/**
 * E&E Cross-Enrollment Analysis Service
 * Integrates PolicyEngine to calculate real eligibility scores for cross-enrollment opportunities
 * 
 * Flow:
 * 1. Get matched E&E clients with cross-enrollment opportunities
 * 2. Build PolicyEngine household scenarios from client data
 * 3. Calculate multi-benefit eligibility using PolicyEngine API
 * 4. Update opportunities with real eligibility scores and reasoning
 * 5. Prioritize opportunities based on benefit amounts and household need
 */

interface EligibilityAnalysisResult {
  opportunityId: string;
  clientId: string;
  targetProgram: string;
  isEligible: boolean;
  eligibilityScore: number;
  estimatedBenefit: number;
  eligibilityReason: string;
  priority: 'high' | 'medium' | 'low';
}

interface BatchAnalysisStats {
  totalOpportunities: number;
  analyzed: number;
  eligible: number;
  notEligible: number;
  errors: number;
  highPriority: number;
}

class EeCrossEnrollmentAnalysisService {
  
  /**
   * Analyze all cross-enrollment opportunities for a dataset
   * Updates opportunities with PolicyEngine-calculated eligibility
   */
  async analyzeDatasetOpportunities(datasetId: string): Promise<BatchAnalysisStats> {
    const stats: BatchAnalysisStats = {
      totalOpportunities: 0,
      analyzed: 0,
      eligible: 0,
      notEligible: 0,
      errors: 0,
      highPriority: 0,
    };

    // Get all E&E clients from the dataset
    const eeClients = await storage.getEeClients({ datasetId });
    
    // Get opportunities for these clients
    const opportunities: CrossEnrollmentOpportunity[] = [];
    for (const client of eeClients) {
      const clientOpps = await storage.getCrossEnrollmentOpportunities({
        eeClientId: client.id,
        outreachStatus: 'identified',
      });
      opportunities.push(...clientOpps);
    }

    stats.totalOpportunities = opportunities.length;

    for (const opportunity of opportunities) {
      try {
        const result = await this.analyzeOpportunity(opportunity);
        
        // Update opportunity with real eligibility data
        await storage.updateCrossEnrollmentOpportunity(opportunity.id, {
          eligibilityScore: result.eligibilityScore,
          eligibilityReason: result.eligibilityReason,
          estimatedBenefitAmount: result.estimatedBenefit,
          priority: result.priority,
          outreachStatus: result.isEligible ? 'eligible' : 'ineligible',
        });

        stats.analyzed++;
        if (result.isEligible) {
          stats.eligible++;
          if (result.priority === 'high') stats.highPriority++;
        } else {
          stats.notEligible++;
        }
      } catch (err) {
        console.error(`Error analyzing opportunity ${opportunity.id}:`, err);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Analyze a single cross-enrollment opportunity using PolicyEngine
   */
  async analyzeOpportunity(opportunity: CrossEnrollmentOpportunity): Promise<EligibilityAnalysisResult> {
    // Get the E&E client data
    if (!opportunity.eeClientId) {
      throw new Error('Opportunity missing eeClientId');
    }
    const eeClient = await storage.getEeClient(opportunity.eeClientId);
    if (!eeClient) {
      throw new Error(`E&E client ${opportunity.eeClientId} not found`);
    }

    // Get the matched client case
    if (!opportunity.clientCaseId) {
      throw new Error('Opportunity missing clientCaseId');
    }
    const clientCase = await storage.getClientCase(opportunity.clientCaseId);
    if (!clientCase) {
      throw new Error(`Client case ${opportunity.clientCaseId} not found`);
    }

    // Get the target program
    if (!opportunity.targetProgramId) {
      throw new Error('Opportunity missing targetProgramId');
    }
    const targetProgram = await storage.getBenefitProgram(opportunity.targetProgramId);
    if (!targetProgram) {
      throw new Error(`Target program ${opportunity.targetProgramId} not found`);
    }

    // Build household scenario from E&E client data
    const household = this.buildHouseholdScenario(eeClient, clientCase);

    // Calculate benefits using PolicyEngine
    const policyEngineResult = await policyEngineService.calculateBenefits(household);

    if (!policyEngineResult.success) {
      return {
        opportunityId: opportunity.id,
        clientId: eeClient.id,
        targetProgram: targetProgram.code,
        isEligible: false,
        eligibilityScore: 0,
        estimatedBenefit: 0,
        eligibilityReason: `PolicyEngine calculation failed: ${policyEngineResult.error}`,
        priority: 'low',
      };
    }

    // Extract eligibility for the target program
    const { isEligible, benefit, reason } = this.extractProgramEligibility(
      targetProgram,
      policyEngineResult.benefits,
      household
    );

    // Calculate eligibility score (0-1 scale)
    const eligibilityScore = isEligible ? this.calculateEligibilityScore(benefit, household) : 0;

    // Determine priority based on benefit amount and household characteristics
    const priority = this.determinePriority(benefit, household, isEligible);

    return {
      opportunityId: opportunity.id,
      clientId: eeClient.id,
      targetProgram: targetProgram.code,
      isEligible,
      eligibilityScore,
      estimatedBenefit: benefit,
      eligibilityReason: reason,
      priority,
    };
  }

  /**
   * Build PolicyEngine household scenario from E&E client and client case data
   */
  private buildHouseholdScenario(eeClient: EeClient, clientCase: ClientCase): PolicyEngineHousehold {
    // Use E&E data as primary source, fall back to client case data
    const householdSize = eeClient.householdSize || 1;
    
    // Assume at least 1 adult, rest are children
    const adults = 1;
    const children = Math.max(0, householdSize - adults);

    // householdIncome is in cents monthly, convert to annual dollars
    const monthlyIncomeDollars = eeClient.householdIncome ? eeClient.householdIncome / 100 : 0;

    return {
      adults,
      children,
      employmentIncome: monthlyIncomeDollars * 12,
      unearnedIncome: 0,
      stateCode: 'MD', // Maryland-specific
      year: new Date().getFullYear(),
      elderlyOrDisabled: false, // Not available in current E&E data
    };
  }

  /**
   * Extract eligibility and benefit amount for specific program from PolicyEngine results
   */
  private extractProgramEligibility(
    targetProgram: BenefitProgram,
    benefits: any,
    household: PolicyEngineHousehold
  ): { isEligible: boolean; benefit: number; reason: string } {
    const programCode = targetProgram.code.toUpperCase();

    switch (programCode) {
      case 'SNAP':
        return {
          isEligible: benefits.snap > 0,
          benefit: benefits.snap,
          reason: benefits.snap > 0 
            ? `Eligible for $${benefits.snap}/month based on household income and size`
            : 'Income exceeds SNAP eligibility threshold',
        };

      case 'MEDICAID':
        return {
          isEligible: benefits.medicaid,
          benefit: benefits.medicaid ? 1 : 0, // Binary indicator for coverage eligibility
          reason: benefits.medicaid
            ? 'Eligible for Medicaid coverage based on income and household composition'
            : 'Income exceeds Medicaid eligibility threshold',
        };

      case 'TCA':
      case 'TANF':
        return {
          isEligible: benefits.tanf > 0,
          benefit: benefits.tanf,
          reason: benefits.tanf > 0
            ? `Eligible for $${benefits.tanf}/month in temporary cash assistance`
            : 'Does not meet TANF eligibility criteria',
        };

      case 'EITC':
        return {
          isEligible: benefits.eitc > 0,
          benefit: benefits.eitc / 12, // Convert annual to monthly
          reason: benefits.eitc > 0
            ? `Eligible for $${benefits.eitc}/year EITC ($${Math.round(benefits.eitc / 12)}/month average)`
            : 'Income or household composition does not qualify for EITC',
        };

      case 'CTC':
        return {
          isEligible: benefits.childTaxCredit > 0,
          benefit: benefits.childTaxCredit / 12, // Convert annual to monthly
          reason: benefits.childTaxCredit > 0
            ? `Eligible for $${benefits.childTaxCredit}/year Child Tax Credit`
            : 'No qualifying children or income too high',
        };

      default:
        return {
          isEligible: false,
          benefit: 0,
          reason: `Program ${programCode} not supported by PolicyEngine integration`,
        };
    }
  }

  /**
   * Calculate normalized eligibility score (0-1)
   * Higher scores indicate stronger eligibility and greater benefit
   */
  private calculateEligibilityScore(benefitAmount: number, household: PolicyEngineHousehold): number {
    if (benefitAmount <= 0) return 0;

    // Normalize benefit amount relative to household income
    const annualIncome = household.employmentIncome + (household.unearnedIncome || 0);
    
    // Annualize monthly benefit for proper comparison
    const annualBenefit = benefitAmount * 12;
    const benefitToIncomeRatio = annualIncome > 0 ? annualBenefit / annualIncome : 1;

    // Score: 0.5 base + up to 0.5 based on benefit-to-income ratio
    // Higher ratio = more impactful benefit = higher score
    const score = 0.5 + Math.min(0.5, benefitToIncomeRatio);

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Determine priority level for outreach
   * High: Large benefit relative to income or critical need
   * Medium: Moderate benefit
   * Low: Small benefit or uncertain eligibility
   */
  private determinePriority(
    benefitAmount: number,
    household: PolicyEngineHousehold,
    isEligible: boolean
  ): 'high' | 'medium' | 'low' {
    if (!isEligible || benefitAmount <= 0) return 'low';

    const annualIncome = household.employmentIncome + (household.unearnedIncome || 0);
    const benefitToIncomeRatio = annualIncome > 0 ? (benefitAmount * 12) / annualIncome : 1;

    // High priority: Benefit is >20% of annual income OR monthly benefit >$200
    if (benefitToIncomeRatio > 0.2 || benefitAmount > 200) {
      return 'high';
    }

    // Medium priority: Benefit is >10% of income OR monthly benefit >$50
    if (benefitToIncomeRatio > 0.1 || benefitAmount > 50) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get high-priority opportunities for a specific client (Navigator view)
   */
  async getClientOpportunities(clientCaseId: string): Promise<CrossEnrollmentOpportunity[]> {
    const opportunities = await storage.getCrossEnrollmentOpportunities({
      clientCaseId,
      outreachStatus: 'eligible',
    });

    // Return sorted by priority (high first) and eligibility score
    return opportunities.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const aPriority = a.priority || 'low';
      const bPriority = b.priority || 'low';
      const priorityDiff = priorityOrder[bPriority] - priorityOrder[aPriority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return (b.eligibilityScore || 0) - (a.eligibilityScore || 0);
    });
  }

  /**
   * Get state-level analytics for admin dashboard
   */
  async getStateAnalytics(datasetId?: string): Promise<any> {
    // Get all opportunities or filter by dataset
    let opportunities: CrossEnrollmentOpportunity[] = [];
    if (datasetId) {
      // Get all E&E clients from the dataset
      const eeClients = await storage.getEeClients({ datasetId });
      for (const client of eeClients) {
        const clientOpps = await storage.getCrossEnrollmentOpportunities({
          eeClientId: client.id,
        });
        opportunities.push(...clientOpps);
      }
    } else {
      // Get all opportunities (no filter support for all)
      const allClients = await storage.getEeClients({});
      for (const client of allClients) {
        const clientOpps = await storage.getCrossEnrollmentOpportunities({
          eeClientId: client.id,
        });
        opportunities.push(...clientOpps);
      }
    }

    const analytics = {
      totalOpportunities: opportunities.length,
      byStatus: {
        identified: 0,
        eligible: 0,
        ineligible: 0,
        contacted: 0,
        enrolled: 0,
      },
      byPriority: {
        high: 0,
        medium: 0,
        low: 0,
      },
      byProgram: {} as Record<string, number>,
      estimatedTotalBenefit: 0,
      averageEligibilityScore: 0,
    };

    let totalScore = 0;

    for (const opp of opportunities) {
      // Count by status
      const status = opp.outreachStatus || 'identified';
      if (status in analytics.byStatus) {
        analytics.byStatus[status as keyof typeof analytics.byStatus]++;
      }

      // Count by priority
      const priority = opp.priority || 'low';
      if (priority in analytics.byPriority) {
        analytics.byPriority[priority as keyof typeof analytics.byPriority]++;
      }

      // Count by target program
      if (opp.targetProgramId) {
        analytics.byProgram[opp.targetProgramId] = (analytics.byProgram[opp.targetProgramId] || 0) + 1;
      }

      // Sum estimated benefits
      if (opp.estimatedBenefitAmount) {
        analytics.estimatedTotalBenefit += opp.estimatedBenefitAmount;
      }

      // Sum eligibility scores
      totalScore += (opp.eligibilityScore || 0);
    }

    analytics.averageEligibilityScore = opportunities.length > 0 ? totalScore / opportunities.length : 0;

    return analytics;
  }
}

export const eeCrossEnrollmentAnalysisService = new EeCrossEnrollmentAnalysisService();
