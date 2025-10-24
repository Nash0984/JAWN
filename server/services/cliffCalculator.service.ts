/**
 * Benefits Cliff Calculator Service
 * 
 * Calculates net income impact of wage increases by comparing:
 * - Current income scenario (wages + benefits - taxes)
 * - Proposed income scenario (higher wages + reduced benefits - taxes)
 * 
 * Detects "benefit cliffs" where earning more results in lower net income
 * due to benefit phase-outs and increased taxes.
 * 
 * Uses PolicyEngine for accurate benefit calculations across all programs:
 * SNAP, Medicaid, EITC, CTC, SSI, TANF, OHEP
 */

import { policyEngineService, PolicyEngineHousehold, BenefitResult } from './policyEngine.service';
import { logger } from './logger.service';

export interface CliffScenario {
  annualIncome: number;
  monthlyIncome: number;
  benefits: BenefitResult;
  netAnnualIncome: number;
  netMonthlyIncome: number;
}

export interface CliffComparison {
  current: CliffScenario;
  proposed: CliffScenario;
  
  // Impact analysis
  wageIncrease: number;
  wageIncreasePercent: number;
  benefitLoss: number;
  netIncomeChange: number;
  netIncomeChangePercent: number;
  
  // Cliff detection
  isCliff: boolean; // True if net income decreases despite wage increase
  cliffSeverity: 'none' | 'minor' | 'moderate' | 'severe';
  
  // Breakdown by program
  programImpacts: {
    program: string;
    currentMonthly: number;
    proposedMonthly: number;
    monthlyChange: number;
  }[];
  
  // Recommendations
  recommendations: string[];
  warnings: string[];
}

class CliffCalculatorService {
  /**
   * Compare two income scenarios to detect benefit cliffs
   */
  async calculateCliffImpact(
    currentIncome: number,
    proposedIncome: number,
    household: Omit<PolicyEngineHousehold, 'employmentIncome'>
  ): Promise<CliffComparison> {
    try {
      // Calculate benefits for both scenarios
      const [currentResult, proposedResult] = await Promise.all([
        policyEngineService.calculateBenefits({
          ...household,
          employmentIncome: currentIncome
        }),
        policyEngineService.calculateBenefits({
          ...household,
          employmentIncome: proposedIncome
        })
      ]);

      if (!currentResult.success || !proposedResult.success) {
        throw new Error('Failed to calculate benefits');
      }

      // Build scenario objects
      const current = this.buildScenario(currentIncome, currentResult.benefits);
      const proposed = this.buildScenario(proposedIncome, proposedResult.benefits);

      // Calculate impacts with zero-denominator protection
      const wageIncrease = proposedIncome - currentIncome;
      const wageIncreasePercent = currentIncome > 0 
        ? (wageIncrease / currentIncome) * 100 
        : (proposedIncome > 0 ? 100 : 0); // If starting from $0, any income is infinite increase; show 100%
      
      const benefitLoss = current.benefits.householdBenefits - proposed.benefits.householdBenefits;
      const netIncomeChange = proposed.netAnnualIncome - current.netAnnualIncome;
      const netIncomeChangePercent = current.netAnnualIncome > 0 
        ? (netIncomeChange / current.netAnnualIncome) * 100 
        : (proposed.netAnnualIncome > 0 ? 100 : 0); // If starting from $0 net, any net increase is 100%

      // Cliff detection
      const isCliff = netIncomeChange < 0 && wageIncrease > 0;
      const cliffSeverity = this.determineCliffSeverity(netIncomeChange, wageIncrease);

      // Program-by-program breakdown
      const programImpacts = this.calculateProgramImpacts(current.benefits, proposed.benefits);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        current,
        proposed,
        isCliff,
        cliffSeverity
      );

      const warnings = this.generateWarnings(
        current,
        proposed,
        isCliff,
        programImpacts
      );

      logger.info('Cliff calculation completed', {
        service: 'CliffCalculator',
        currentIncome,
        proposedIncome,
        isCliff,
        cliffSeverity,
        netIncomeChange
      });

      return {
        current,
        proposed,
        wageIncrease,
        wageIncreasePercent,
        benefitLoss,
        netIncomeChange,
        netIncomeChangePercent,
        isCliff,
        cliffSeverity,
        programImpacts,
        recommendations,
        warnings
      };
    } catch (error) {
      logger.error('Cliff calculation failed', {
        service: 'CliffCalculator',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Build scenario object from income and benefits
   */
  private buildScenario(annualIncome: number, benefits: BenefitResult): CliffScenario {
    // Convert annual tax credits to monthly for consistent comparison
    const monthlyEITC = benefits.eitc / 12;
    const monthlyCTC = benefits.childTaxCredit / 12;
    const monthlyOHEP = benefits.ohep / 12;
    
    // Calculate total monthly benefits
    const totalMonthlyBenefits = 
      benefits.snap +
      benefits.ssi +
      benefits.tanf +
      monthlyEITC +
      monthlyCTC +
      monthlyOHEP;
    
    // Net income = wages + benefits - taxes
    // Defensive: If PolicyEngine returns NaN/undefined, fall back to manual calculation
    let netAnnualIncome = benefits.householdNetIncome;
    if (!Number.isFinite(netAnnualIncome)) {
      // Manual fallback: income + annual benefits - annual tax
      // Ensure all benefit values are finite numbers (default to 0 if invalid)
      const snap = Number.isFinite(benefits.snap) ? benefits.snap : 0;
      const ssi = Number.isFinite(benefits.ssi) ? benefits.ssi : 0;
      const tanf = Number.isFinite(benefits.tanf) ? benefits.tanf : 0;
      const eitc = Number.isFinite(benefits.eitc) ? benefits.eitc : 0;
      const ctc = Number.isFinite(benefits.childTaxCredit) ? benefits.childTaxCredit : 0;
      const ohep = Number.isFinite(benefits.ohep) ? benefits.ohep : 0;
      const tax = Number.isFinite(benefits.householdTax) ? benefits.householdTax : 0;
      
      const annualBenefits = (snap + ssi + tanf) * 12 + eitc + ctc + ohep;
      netAnnualIncome = annualIncome + annualBenefits - tax;
      
      logger.warn('PolicyEngine returned invalid householdNetIncome, using manual calculation', {
        service: 'CliffCalculator',
        rawValue: benefits.householdNetIncome,
        manualCalculation: netAnnualIncome,
        benefitsUsed: { snap, ssi, tanf, eitc, ctc, ohep, tax }
      });
    }
    
    const netMonthlyIncome = netAnnualIncome / 12;

    return {
      annualIncome,
      monthlyIncome: annualIncome / 12,
      benefits,
      netAnnualIncome,
      netMonthlyIncome
    };
  }

  /**
   * Determine cliff severity with zero-denominator protection
   */
  private determineCliffSeverity(
    netIncomeChange: number,
    wageIncrease: number
  ): 'none' | 'minor' | 'moderate' | 'severe' {
    if (netIncomeChange >= 0) {
      return 'none';
    }

    // Handle edge case: if wages didn't increase but net income decreased
    // (e.g., comparing same income in different years with rule changes)
    if (wageIncrease === 0) {
      return netIncomeChange < -1000 ? 'severe' : 'moderate';
    }

    const netLossPercent = Math.abs(netIncomeChange / wageIncrease) * 100;

    if (netLossPercent >= 100) {
      return 'severe'; // Losing more than gained
    } else if (netLossPercent >= 50) {
      return 'moderate'; // Losing 50-100% of wage increase
    } else {
      return 'minor'; // Losing less than 50%
    }
  }

  /**
   * Calculate program-by-program impacts
   */
  private calculateProgramImpacts(
    current: BenefitResult,
    proposed: BenefitResult
  ): CliffComparison['programImpacts'] {
    const impacts: CliffComparison['programImpacts'] = [];

    // SNAP
    if (current.snap > 0 || proposed.snap > 0) {
      impacts.push({
        program: 'SNAP',
        currentMonthly: current.snap,
        proposedMonthly: proposed.snap,
        monthlyChange: proposed.snap - current.snap
      });
    }

    // SSI
    if (current.ssi > 0 || proposed.ssi > 0) {
      impacts.push({
        program: 'SSI',
        currentMonthly: current.ssi,
        proposedMonthly: proposed.ssi,
        monthlyChange: proposed.ssi - current.ssi
      });
    }

    // TANF
    if (current.tanf > 0 || proposed.tanf > 0) {
      impacts.push({
        program: 'TANF',
        currentMonthly: current.tanf,
        proposedMonthly: proposed.tanf,
        monthlyChange: proposed.tanf - current.tanf
      });
    }

    // EITC (convert annual to monthly)
    if (current.eitc > 0 || proposed.eitc > 0) {
      impacts.push({
        program: 'EITC',
        currentMonthly: current.eitc / 12,
        proposedMonthly: proposed.eitc / 12,
        monthlyChange: (proposed.eitc - current.eitc) / 12
      });
    }

    // Child Tax Credit (convert annual to monthly)
    if (current.childTaxCredit > 0 || proposed.childTaxCredit > 0) {
      impacts.push({
        program: 'Child Tax Credit',
        currentMonthly: current.childTaxCredit / 12,
        proposedMonthly: proposed.childTaxCredit / 12,
        monthlyChange: (proposed.childTaxCredit - current.childTaxCredit) / 12
      });
    }

    // OHEP (convert annual to monthly)
    if (current.ohep > 0 || proposed.ohep > 0) {
      impacts.push({
        program: 'Energy Assistance (OHEP)',
        currentMonthly: current.ohep / 12,
        proposedMonthly: proposed.ohep / 12,
        monthlyChange: (proposed.ohep - current.ohep) / 12
      });
    }

    // Medicaid (qualitative - no dollar value)
    if (current.medicaid !== proposed.medicaid) {
      impacts.push({
        program: 'Medicaid',
        currentMonthly: current.medicaid ? 1 : 0,
        proposedMonthly: proposed.medicaid ? 1 : 0,
        monthlyChange: proposed.medicaid ? (current.medicaid ? 0 : 1) : -1
      });
    }

    return impacts;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    current: CliffScenario,
    proposed: CliffScenario,
    isCliff: boolean,
    cliffSeverity: string
  ): string[] {
    const recommendations: string[] = [];

    if (isCliff) {
      if (cliffSeverity === 'severe') {
        recommendations.push(
          'Consider rejecting this wage increase or negotiating a higher amount to overcome the benefit cliff'
        );
        recommendations.push(
          'Explore transitional benefits that may help bridge the gap (e.g., SNAP transitional benefits)'
        );
      } else if (cliffSeverity === 'moderate') {
        recommendations.push(
          'This wage increase results in a net loss. Consider whether non-financial benefits (career advancement, health insurance) justify the short-term income reduction'
        );
        recommendations.push(
          'Ask your employer about pre-tax deductions (401k, health insurance) that could keep you below benefit cutoffs'
        );
      } else {
        recommendations.push(
          'While you\'ll earn slightly less net income initially, this wage increase positions you for future growth beyond benefit cutoffs'
        );
      }
    } else {
      const netGain = proposed.netMonthlyIncome - current.netMonthlyIncome;
      if (netGain > 0 && netGain < 100) {
        recommendations.push(
          `This wage increase provides a modest net gain of $${netGain.toFixed(0)}/month. Benefits will phase out gradually as income rises further.`
        );
      } else if (netGain >= 100) {
        recommendations.push(
          `This wage increase provides a strong net gain of $${netGain.toFixed(0)}/month, with benefits phasing out as expected.`
        );
      }
    }

    // Medicaid warning
    if (current.benefits.medicaid && !proposed.benefits.medicaid) {
      recommendations.push(
        'IMPORTANT: You will lose Medicaid eligibility. Ensure your employer offers health insurance or explore marketplace options.'
      );
    }

    // Tax credit opportunities
    if (proposed.benefits.eitc > 0 || proposed.benefits.childTaxCredit > 0) {
      recommendations.push(
        'File taxes to claim your Earned Income Tax Credit and Child Tax Credit - these credits can significantly offset benefit reductions.'
      );
    }

    return recommendations;
  }

  /**
   * Generate warnings about specific impacts
   */
  private generateWarnings(
    current: CliffScenario,
    proposed: CliffScenario,
    isCliff: boolean,
    programImpacts: CliffComparison['programImpacts']
  ): string[] {
    const warnings: string[] = [];

    if (isCliff) {
      warnings.push(
        '⚠️ BENEFIT CLIFF DETECTED: This wage increase will result in lower net income due to benefit reductions.'
      );
    }

    // Identify programs with significant reductions
    programImpacts.forEach(impact => {
      if (impact.monthlyChange < -50) {
        warnings.push(
          `${impact.program} will decrease by $${Math.abs(impact.monthlyChange).toFixed(0)}/month`
        );
      }
      
      // Medicaid loss is critical
      if (impact.program === 'Medicaid' && impact.monthlyChange < 0) {
        warnings.push(
          '⚠️ CRITICAL: You will lose Medicaid health coverage. This could result in thousands in out-of-pocket medical costs.'
        );
      }
    });

    return warnings;
  }

  /**
   * Find the optimal income target (highest net income point)
   * 
   * Useful for showing clients what income level maximizes their total resources
   */
  async findOptimalIncome(
    startIncome: number,
    endIncome: number,
    household: Omit<PolicyEngineHousehold, 'employmentIncome'>,
    step: number = 1000
  ): Promise<{ optimalIncome: number; maxNetIncome: number; scenarios: CliffScenario[] }> {
    const scenarios: CliffScenario[] = [];
    
    for (let income = startIncome; income <= endIncome; income += step) {
      const result = await policyEngineService.calculateBenefits({
        ...household,
        employmentIncome: income
      });
      
      if (result.success) {
        scenarios.push(this.buildScenario(income, result.benefits));
      }
    }

    // Find scenario with highest net income
    const optimal = scenarios.reduce((best, current) => 
      current.netAnnualIncome > best.netAnnualIncome ? current : best
    );

    return {
      optimalIncome: optimal.annualIncome,
      maxNetIncome: optimal.netAnnualIncome,
      scenarios
    };
  }
}

export const cliffCalculatorService = new CliffCalculatorService();
