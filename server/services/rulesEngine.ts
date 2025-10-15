import { db } from "../db";
import { eq, and, lte, gte, or, isNull, desc } from "drizzle-orm";
import {
  povertyLevels,
  snapIncomeLimits,
  snapDeductions,
  snapAllotments,
  categoricalEligibilityRules,
  documentRequirementRules,
  eligibilityCalculations,
  ruleChangeLogs,
  type SnapIncomeLimit,
  type SnapDeduction,
  type SnapAllotment,
  type CategoricalEligibilityRule,
  type DocumentRequirementRule,
  type InsertEligibilityCalculation,
  type InsertRuleChangeLog,
} from "../../shared/schema";
import { rulesAsCodeService } from "./rulesAsCodeService";

// ============================================================================
// Maryland SNAP Rules Engine - Deterministic Eligibility Calculations
// ============================================================================

export interface HouseholdInput {
  size: number;
  grossMonthlyIncome: number; // in cents
  earnedIncome: number; // in cents
  unearnedIncome: number; // in cents
  hasElderly?: boolean; // 60+ years
  hasDisabled?: boolean;
  dependentCareExpenses?: number; // in cents
  medicalExpenses?: number; // in cents (only for elderly/disabled)
  shelterCosts?: number; // in cents (rent + utilities)
  categoricalEligibility?: string; // SSI, TANF, GA, BBCE
}

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  ineligibilityReasons?: string[];
  grossIncomeTest: {
    passed: boolean;
    limit: number; // in cents
    actual: number; // in cents
    bypassedBy?: string; // categorical eligibility rule
  };
  netIncomeTest: {
    passed: boolean;
    limit: number; // in cents
    actual: number; // in cents
    bypassedBy?: string;
  };
  deductions: {
    standardDeduction: number; // in cents
    earnedIncomeDeduction: number; // 20% of earned income
    dependentCareDeduction: number;
    medicalExpenseDeduction: number;
    shelterDeduction: number;
    total: number;
  };
  monthlyBenefit: number; // in cents
  maxAllotment: number; // in cents
  calculationBreakdown: string[];
  rulesSnapshot: {
    incomeLimitId: string;
    deductionIds: string[];
    allotmentId: string;
    categoricalRuleId?: string;
  };
  policyCitations: Array<{
    sectionNumber: string;
    sectionTitle: string;
    ruleType: string; // 'income' | 'deduction' | 'categorical' | 'allotment'
    description: string;
  }>;
}

export interface DocumentChecklistItem {
  category: string;
  documentType: string;
  required: boolean;
  acceptableDocuments: string[];
  validityDays?: number;
  notes?: string;
}

class RulesEngine {
  /**
   * Get active rules for a specific date (defaults to current date)
   * Delegates to rulesAsCodeService for versioning logic
   */
  private async getActiveIncomeLimits(
    benefitProgramId: string,
    householdSize: number,
    effectiveDate: Date = new Date()
  ): Promise<SnapIncomeLimit | null> {
    return await rulesAsCodeService.getActiveIncomeLimits(
      benefitProgramId,
      householdSize,
      effectiveDate
    );
  }

  private async getActiveDeductions(
    benefitProgramId: string,
    effectiveDate: Date = new Date()
  ): Promise<SnapDeduction[]> {
    return await rulesAsCodeService.getActiveDeductions(
      benefitProgramId,
      effectiveDate
    );
  }

  private async getActiveAllotment(
    benefitProgramId: string,
    householdSize: number,
    effectiveDate: Date = new Date()
  ): Promise<SnapAllotment | null> {
    return await rulesAsCodeService.getActiveAllotment(
      benefitProgramId,
      householdSize,
      effectiveDate
    );
  }

  private async getCategoricalEligibilityRule(
    benefitProgramId: string,
    ruleCode: string,
    effectiveDate: Date = new Date()
  ): Promise<CategoricalEligibilityRule | null> {
    return await rulesAsCodeService.getCategoricalEligibilityRule(
      benefitProgramId,
      ruleCode,
      effectiveDate
    );
  }

  /**
   * Calculate SNAP eligibility and benefit amount
   */
  async calculateEligibility(
    benefitProgramId: string,
    household: HouseholdInput,
    userId?: string
  ): Promise<EligibilityResult> {
    const calculationBreakdown: string[] = [];
    const ineligibilityReasons: string[] = [];

    // Step 1: Get active rules
    const incomeLimit = await this.getActiveIncomeLimits(benefitProgramId, household.size);
    const deductions = await this.getActiveDeductions(benefitProgramId);
    const allotment = await this.getActiveAllotment(benefitProgramId, household.size);
    const categoricalRule = household.categoricalEligibility
      ? await this.getCategoricalEligibilityRule(benefitProgramId, household.categoricalEligibility)
      : null;

    if (!incomeLimit || !allotment) {
      throw new Error(`No active rules found for household size ${household.size}`);
    }

    calculationBreakdown.push(`Household size: ${household.size}`);
    calculationBreakdown.push(`Gross monthly income: $${(household.grossMonthlyIncome / 100).toFixed(2)}`);

    // Step 2: Check categorical eligibility
    let bypassGrossIncomeTest = false;
    let bypassNetIncomeTest = false;
    let categoricalRuleName = undefined;

    if (categoricalRule) {
      bypassGrossIncomeTest = categoricalRule.bypassGrossIncomeTest;
      bypassNetIncomeTest = categoricalRule.bypassNetIncomeTest;
      categoricalRuleName = categoricalRule.ruleName;
      calculationBreakdown.push(`Categorical eligibility: ${categoricalRule.ruleName}`);
      if (bypassGrossIncomeTest) {
        calculationBreakdown.push(`✓ Gross income test bypassed (categorical eligibility)`);
      }
      if (bypassNetIncomeTest) {
        calculationBreakdown.push(`✓ Net income test bypassed (categorical eligibility)`);
      }
    }

    // Step 3: Gross Income Test
    const grossIncomeTest = {
      passed: false,
      limit: incomeLimit.grossMonthlyLimit,
      actual: household.grossMonthlyIncome,
      bypassedBy: bypassGrossIncomeTest ? categoricalRuleName : undefined,
    };

    if (bypassGrossIncomeTest) {
      grossIncomeTest.passed = true;
    } else if (household.grossMonthlyIncome <= incomeLimit.grossMonthlyLimit) {
      grossIncomeTest.passed = true;
      calculationBreakdown.push(
        `✓ Gross income test: $${(household.grossMonthlyIncome / 100).toFixed(2)} ≤ $${(incomeLimit.grossMonthlyLimit / 100).toFixed(2)}`
      );
    } else if (household.hasElderly || household.hasDisabled) {
      // Elderly/disabled households are exempt from gross income test
      grossIncomeTest.passed = true;
      grossIncomeTest.bypassedBy = "Elderly/Disabled Exemption";
      calculationBreakdown.push(
        `✓ Gross income test waived (household has elderly or disabled member)`
      );
    } else {
      grossIncomeTest.passed = false;
      ineligibilityReasons.push(
        `Gross income ($${(household.grossMonthlyIncome / 100).toFixed(2)}) exceeds limit ($${(incomeLimit.grossMonthlyLimit / 100).toFixed(2)})`
      );
      calculationBreakdown.push(
        `✗ Gross income test failed: $${(household.grossMonthlyIncome / 100).toFixed(2)} > $${(incomeLimit.grossMonthlyLimit / 100).toFixed(2)}`
      );
    }

    // Step 4: Calculate Deductions
    const deductionAmounts = {
      standardDeduction: 0,
      earnedIncomeDeduction: 0,
      dependentCareDeduction: 0,
      medicalExpenseDeduction: 0,
      shelterDeduction: 0,
      total: 0,
    };

    // Standard Deduction
    const standardDeductionRule = deductions.find(d => d.deductionType === 'standard');
    if (standardDeductionRule) {
      deductionAmounts.standardDeduction = standardDeductionRule.amount || 0;
      calculationBreakdown.push(
        `Standard deduction: $${(deductionAmounts.standardDeduction / 100).toFixed(2)}`
      );
    }

    // Earned Income Deduction (20% of earned income)
    const earnedIncomeDeductionRule = deductions.find(d => d.deductionType === 'earned_income');
    if (earnedIncomeDeductionRule && household.earnedIncome > 0) {
      const percentage = earnedIncomeDeductionRule.percentage || 20;
      deductionAmounts.earnedIncomeDeduction = Math.floor(household.earnedIncome * percentage / 100);
      calculationBreakdown.push(
        `Earned income deduction (${percentage}% of $${(household.earnedIncome / 100).toFixed(2)}): $${(deductionAmounts.earnedIncomeDeduction / 100).toFixed(2)}`
      );
    }

    // Dependent Care Deduction
    if (household.dependentCareExpenses && household.dependentCareExpenses > 0) {
      const dependentCareRule = deductions.find(d => d.deductionType === 'dependent_care');
      const maxCap = dependentCareRule?.maxAmount;
      deductionAmounts.dependentCareDeduction = maxCap
        ? Math.min(household.dependentCareExpenses, maxCap)
        : household.dependentCareExpenses;
      calculationBreakdown.push(
        `Dependent care deduction: $${(deductionAmounts.dependentCareDeduction / 100).toFixed(2)}`
      );
    }

    // Medical Expense Deduction (only for elderly/disabled)
    if ((household.hasElderly || household.hasDisabled) && household.medicalExpenses) {
      const medicalRule = deductions.find(d => d.deductionType === 'medical');
      const threshold = medicalRule?.minAmount || 0;
      
      if (household.medicalExpenses > threshold) {
        deductionAmounts.medicalExpenseDeduction = household.medicalExpenses - threshold;
        calculationBreakdown.push(
          `Medical expense deduction (amount over $${(threshold / 100).toFixed(2)}): $${(deductionAmounts.medicalExpenseDeduction / 100).toFixed(2)}`
        );
      }
    }

    // Shelter Deduction (Excess shelter costs over 50% of income after other deductions)
    if (household.shelterCosts && household.shelterCosts > 0) {
      const shelterRule = deductions.find(d => d.deductionType === 'shelter');
      const incomeAfterOtherDeductions = household.grossMonthlyIncome - (
        deductionAmounts.standardDeduction +
        deductionAmounts.earnedIncomeDeduction +
        deductionAmounts.dependentCareDeduction +
        deductionAmounts.medicalExpenseDeduction
      );
      
      const halfIncome = Math.floor(incomeAfterOtherDeductions / 2);
      const excessShelter = Math.max(0, household.shelterCosts - halfIncome);
      
      // Apply cap unless household has elderly/disabled
      const shelterCap = shelterRule?.maxAmount;
      if (shelterCap && !(household.hasElderly || household.hasDisabled)) {
        deductionAmounts.shelterDeduction = Math.min(excessShelter, shelterCap);
        calculationBreakdown.push(
          `Shelter deduction (capped at $${(shelterCap / 100).toFixed(2)}): $${(deductionAmounts.shelterDeduction / 100).toFixed(2)}`
        );
      } else {
        deductionAmounts.shelterDeduction = excessShelter;
        calculationBreakdown.push(
          `Shelter deduction (uncapped): $${(deductionAmounts.shelterDeduction / 100).toFixed(2)}`
        );
      }
    }

    deductionAmounts.total = 
      deductionAmounts.standardDeduction +
      deductionAmounts.earnedIncomeDeduction +
      deductionAmounts.dependentCareDeduction +
      deductionAmounts.medicalExpenseDeduction +
      deductionAmounts.shelterDeduction;

    calculationBreakdown.push(`Total deductions: $${(deductionAmounts.total / 100).toFixed(2)}`);

    // Step 5: Calculate Net Income
    const netMonthlyIncome = Math.max(0, household.grossMonthlyIncome - deductionAmounts.total);
    calculationBreakdown.push(`Net monthly income: $${(netMonthlyIncome / 100).toFixed(2)}`);

    // Step 6: Net Income Test
    const netIncomeTest = {
      passed: false,
      limit: incomeLimit.netMonthlyLimit,
      actual: netMonthlyIncome,
      bypassedBy: bypassNetIncomeTest ? categoricalRuleName : undefined,
    };

    if (bypassNetIncomeTest) {
      netIncomeTest.passed = true;
    } else if (netMonthlyIncome <= incomeLimit.netMonthlyLimit) {
      netIncomeTest.passed = true;
      calculationBreakdown.push(
        `✓ Net income test: $${(netMonthlyIncome / 100).toFixed(2)} ≤ $${(incomeLimit.netMonthlyLimit / 100).toFixed(2)}`
      );
    } else {
      netIncomeTest.passed = false;
      ineligibilityReasons.push(
        `Net income ($${(netMonthlyIncome / 100).toFixed(2)}) exceeds limit ($${(incomeLimit.netMonthlyLimit / 100).toFixed(2)})`
      );
      calculationBreakdown.push(
        `✗ Net income test failed: $${(netMonthlyIncome / 100).toFixed(2)} > $${(incomeLimit.netMonthlyLimit / 100).toFixed(2)}`
      );
    }

    // Step 7: Determine Eligibility
    const isEligible = grossIncomeTest.passed && netIncomeTest.passed;

    // Step 8: Calculate Benefit Amount (if eligible)
    let monthlyBenefit = 0;
    if (isEligible) {
      // SNAP benefit = Max Allotment - (30% of net income)
      const thirtyPercentOfNetIncome = Math.floor(netMonthlyIncome * 30 / 100);
      monthlyBenefit = Math.max(0, allotment.maxMonthlyBenefit - thirtyPercentOfNetIncome);

      // Apply minimum benefit if applicable
      if (allotment.minMonthlyBenefit && monthlyBenefit < allotment.minMonthlyBenefit) {
        if (household.size <= 2 && (household.hasElderly || household.hasDisabled)) {
          monthlyBenefit = allotment.minMonthlyBenefit;
          calculationBreakdown.push(
            `Minimum benefit applied (1-2 person household with elderly/disabled): $${(allotment.minMonthlyBenefit / 100).toFixed(2)}`
          );
        } else if (monthlyBenefit > 0) {
          // Household is eligible but benefit rounds to $0
          calculationBreakdown.push(
            `Benefit calculation: $${(allotment.maxMonthlyBenefit / 100).toFixed(2)} - (30% × $${(netMonthlyIncome / 100).toFixed(2)}) = $${(monthlyBenefit / 100).toFixed(2)}`
          );
        }
      } else {
        calculationBreakdown.push(
          `Benefit calculation: $${(allotment.maxMonthlyBenefit / 100).toFixed(2)} - (30% × $${(netMonthlyIncome / 100).toFixed(2)}) = $${(monthlyBenefit / 100).toFixed(2)}`
        );
      }

      if (monthlyBenefit > 0) {
        calculationBreakdown.push(`✓ Monthly SNAP benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
      }
    }

    // Build policy citations linking to manual sections
    const policyCitations: Array<{
      sectionNumber: string;
      sectionTitle: string;
      ruleType: string;
      description: string;
    }> = [];

    // Income limits citation
    policyCitations.push({
      sectionNumber: '409',
      sectionTitle: 'Income Eligibility',
      ruleType: 'income',
      description: `Maryland SNAP income limits for household size ${household.size}`
    });

    // Deductions citations
    if (deductionAmounts.standardDeduction > 0) {
      policyCitations.push({
        sectionNumber: '212',
        sectionTitle: 'Deductions',
        ruleType: 'deduction',
        description: 'Standard deduction for SNAP households'
      });
    }

    if (deductionAmounts.earnedIncomeDeduction > 0) {
      policyCitations.push({
        sectionNumber: '213',
        sectionTitle: 'Determining Income Deductions',
        ruleType: 'deduction',
        description: '20% earned income deduction'
      });
    }

    if (deductionAmounts.shelterDeduction > 0) {
      policyCitations.push({
        sectionNumber: '214',
        sectionTitle: 'Utility Allowances',
        ruleType: 'deduction',
        description: 'Shelter and utility cost deductions'
      });
    }

    // Categorical eligibility citation
    if (categoricalRule) {
      policyCitations.push({
        sectionNumber: '115',
        sectionTitle: 'Categorical Eligibility',
        ruleType: 'categorical',
        description: `${categoricalRule.ruleName} categorical eligibility bypass`
      });
    }

    // Allotment calculation citation
    policyCitations.push({
      sectionNumber: '600',
      sectionTitle: 'Standards for Income and Deductions',
      ruleType: 'allotment',
      description: 'Maximum SNAP allotment tables and benefit calculation'
    });

    return {
      isEligible,
      reason: isEligible 
        ? `Eligible for $${(monthlyBenefit / 100).toFixed(2)}/month in SNAP benefits`
        : ineligibilityReasons.join('; '),
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      grossIncomeTest,
      netIncomeTest,
      deductions: deductionAmounts,
      monthlyBenefit,
      maxAllotment: allotment.maxMonthlyBenefit,
      calculationBreakdown,
      rulesSnapshot: {
        incomeLimitId: incomeLimit.id,
        deductionIds: deductions.map(d => d.id),
        allotmentId: allotment.id,
        categoricalRuleId: categoricalRule?.id,
      },
      policyCitations,
    };
  }

  /**
   * Get personalized document checklist based on household circumstances
   */
  async getDocumentChecklist(
    benefitProgramId: string,
    household: HouseholdInput
  ): Promise<DocumentChecklistItem[]> {
    const rules = await db
      .select()
      .from(documentRequirementRules)
      .where(
        and(
          eq(documentRequirementRules.benefitProgramId, benefitProgramId),
          eq(documentRequirementRules.isActive, true),
          lte(documentRequirementRules.effectiveDate, new Date()),
          or(
            isNull(documentRequirementRules.endDate),
            gte(documentRequirementRules.endDate, new Date())
          )
        )
      );

    const checklist: DocumentChecklistItem[] = [];

    for (const rule of rules) {
      // Evaluate if this document is required based on household circumstances
      const requiredWhen = rule.requiredWhen as any;
      let isRequired = rule.isRequired;

      // Simple condition evaluation (can be extended)
      if (requiredWhen) {
        if (requiredWhen.hasIncome && household.grossMonthlyIncome > 0) {
          isRequired = true;
        }
        if (requiredWhen.hasEarnedIncome && household.earnedIncome > 0) {
          isRequired = true;
        }
        if (requiredWhen.hasDependentCare && household.dependentCareExpenses) {
          isRequired = true;
        }
        if (requiredWhen.hasMedicalExpenses && household.medicalExpenses) {
          isRequired = true;
        }
        if (requiredWhen.hasShelterCosts && household.shelterCosts) {
          isRequired = true;
        }
      }

      checklist.push({
        category: rule.documentType,
        documentType: rule.requirementName,
        required: isRequired,
        acceptableDocuments: (rule.acceptableDocuments as string[]) || [],
        validityDays: rule.validityPeriod || undefined,
        notes: rule.notes || undefined,
      });
    }

    return checklist;
  }

  /**
   * Log eligibility calculation for audit trail
   */
  async logCalculation(
    benefitProgramId: string,
    household: HouseholdInput,
    result: EligibilityResult,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const calculation: InsertEligibilityCalculation = {
      userId,
      benefitProgramId,
      householdSize: household.size,
      grossMonthlyIncome: household.grossMonthlyIncome,
      netMonthlyIncome: result.netIncomeTest.actual,
      deductions: result.deductions,
      categoricalEligibility: household.categoricalEligibility || null,
      isEligible: result.isEligible,
      monthlyBenefit: result.monthlyBenefit,
      ineligibilityReasons: result.ineligibilityReasons || null,
      rulesSnapshot: result.rulesSnapshot,
      calculatedBy: userId || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    };

    const [saved] = await db
      .insert(eligibilityCalculations)
      .values(calculation)
      .returning();

    return saved.id;
  }
}

export const rulesEngine = new RulesEngine();
