import { db } from "../db";
import { eq, and, lte, gte, isNull, desc, or } from "drizzle-orm";
import {
  ohepIncomeLimits,
  ohepBenefitTiers,
  ohepSeasonalFactors,
  povertyLevels,
  type OhepIncomeLimit,
  type OhepBenefitTier,
  type OhepSeasonalFactor,
} from "../../shared/schema";

// ============================================================================
// Maryland OHEP Rules Engine - Energy Assistance Program
// ============================================================================

export interface OHEPHouseholdInput {
  size: number;
  grossMonthlyIncome: number; // in cents
  grossAnnualIncome: number; // in cents
  hasElderlyMember?: boolean; // 60+ years
  hasDisabledMember?: boolean;
  hasChildUnder6?: boolean;
  isCrisisSituation?: boolean; // Disconnect notice, no heat, etc
  hasArrearage?: boolean; // Past due utility bills
  heatingFuelType?: string; // electric, gas, oil, propane, wood
  utilityDisconnectDate?: Date;
}

export interface OHEPEligibilityResult {
  isEligible: boolean;
  reason?: string;
  ineligibilityReasons?: string[];
  incomeTest: {
    passed: boolean;
    percentOfFPL: number; // Household % of FPL
    limit: number; // Income limit in cents
    actual: number; // Actual income in cents
  };
  benefitType: string; // crisis, regular, arrearage, none
  benefitAmount: number; // Estimated benefit in cents
  priorityGroup?: string; // elderly, disabled, young_children
  season: string; // heating, cooling
  calculationBreakdown: string[];
  rulesSnapshot: {
    incomeLimitId: string;
    benefitTierId: string;
    seasonalFactorId?: string;
  };
  policyCitations: Array<{
    sectionNumber: string;
    sectionTitle: string;
    ruleType: string;
    description: string;
  }>;
}

class OHEPRulesEngine {
  /**
   * Get active OHEP income limits for household size
   */
  private async getActiveIncomeLimits(
    householdSize: number,
    effectiveDate: Date = new Date()
  ): Promise<OhepIncomeLimit | null> {
    const limits = await db
      .select()
      .from(ohepIncomeLimits)
      .where(
        and(
          eq(ohepIncomeLimits.householdSize, householdSize),
          eq(ohepIncomeLimits.isActive, true),
          lte(ohepIncomeLimits.effectiveDate, effectiveDate),
          or(
            isNull(ohepIncomeLimits.endDate),
            gte(ohepIncomeLimits.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(ohepIncomeLimits.effectiveDate))
      .limit(1);

    return limits[0] || null;
  }

  /**
   * Get active benefit tiers
   */
  private async getActiveBenefitTiers(
    effectiveDate: Date = new Date()
  ): Promise<OhepBenefitTier[]> {
    return await db
      .select()
      .from(ohepBenefitTiers)
      .where(
        and(
          eq(ohepBenefitTiers.isActive, true),
          lte(ohepBenefitTiers.effectiveDate, effectiveDate),
          or(
            isNull(ohepBenefitTiers.endDate),
            gte(ohepBenefitTiers.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(ohepBenefitTiers.effectiveDate));
  }

  /**
   * Get current season (heating or cooling)
   */
  private async getCurrentSeason(
    effectiveDate: Date = new Date()
  ): Promise<OhepSeasonalFactor | null> {
    const month = effectiveDate.getMonth() + 1; // 1-12
    const year = effectiveDate.getFullYear();

    const seasons = await db
      .select()
      .from(ohepSeasonalFactors)
      .where(
        and(
          eq(ohepSeasonalFactors.effectiveYear, year),
          eq(ohepSeasonalFactors.isActive, true)
        )
      );

    for (const season of seasons) {
      // Handle season that crosses year boundary (e.g., heating season Oct-Apr)
      if (season.startMonth <= season.endMonth) {
        if (month >= season.startMonth && month <= season.endMonth) {
          return season;
        }
      } else {
        // Season crosses year boundary
        if (month >= season.startMonth || month <= season.endMonth) {
          return season;
        }
      }
    }

    return null;
  }

  /**
   * Calculate household % of Federal Poverty Level
   */
  private async calculatePercentOfFPL(
    householdSize: number,
    annualIncome: number,
    effectiveDate: Date = new Date()
  ): Promise<number> {
    const fpl = await db
      .select()
      .from(povertyLevels)
      .where(
        and(
          eq(povertyLevels.householdSize, householdSize),
          eq(povertyLevels.isActive, true),
          lte(povertyLevels.effectiveDate, effectiveDate)
        )
      )
      .orderBy(desc(povertyLevels.effectiveDate))
      .limit(1);

    if (!fpl[0]) {
      throw new Error(
        `No Federal Poverty Level data found for household size ${householdSize}`
      );
    }

    return Math.round((annualIncome / fpl[0].annualIncome) * 100);
  }

  /**
   * Determine priority group
   */
  private determinePriorityGroup(household: OHEPHouseholdInput): string | undefined {
    if (household.hasElderlyMember) return "elderly";
    if (household.hasDisabledMember) return "disabled";
    if (household.hasChildUnder6) return "children_under_6";
    return undefined;
  }

  /**
   * Determine benefit type based on household circumstances
   */
  private determineBenefitType(
    household: OHEPHouseholdInput,
    tiers: OhepBenefitTier[]
  ): { tierType: string; tier: OhepBenefitTier | null } {
    // Crisis assistance takes priority
    if (household.isCrisisSituation) {
      const crisisTier = tiers.find((t) => t.tierType === "crisis");
      if (crisisTier) {
        return { tierType: "crisis", tier: crisisTier };
      }
    }

    // Arrearage assistance for past due bills
    if (household.hasArrearage) {
      const arrearageTier = tiers.find((t) => t.tierType === "arrearage");
      if (arrearageTier) {
        return { tierType: "arrearage", tier: arrearageTier };
      }
    }

    // Regular assistance
    const regularTier = tiers.find((t) => t.tierType === "regular");
    if (regularTier) {
      return { tierType: "regular", tier: regularTier };
    }

    return { tierType: "none", tier: null };
  }

  /**
   * Main OHEP eligibility calculation
   */
  async calculateEligibility(
    household: OHEPHouseholdInput,
    effectiveDate: Date = new Date(),
    benefitProgramId?: string
  ): Promise<OHEPEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];

    breakdown.push(
      `OHEP Eligibility Calculation for household size ${household.size}`
    );
    breakdown.push(
      `Annual Income: $${(household.grossAnnualIncome / 100).toFixed(2)}`
    );

    // Step 1: Get income limits
    const incomeLimit = await this.getActiveIncomeLimits(
      household.size,
      effectiveDate
    );

    if (!incomeLimit) {
      return {
        isEligible: false,
        reason: `No income limits found for household size ${household.size}`,
        ineligibilityReasons: [
          `No OHEP income limits configured for household size ${household.size}`,
        ],
        incomeTest: {
          passed: false,
          percentOfFPL: 0,
          limit: 0,
          actual: household.grossAnnualIncome,
        },
        benefitType: "none",
        benefitAmount: 0,
        season: "heating",
        calculationBreakdown: breakdown,
        rulesSnapshot: {
          incomeLimitId: "",
          benefitTierId: "",
        },
        policyCitations: [],
      };
    }

    // Step 2: Calculate % of FPL
    const percentOfFPL = await this.calculatePercentOfFPL(
      household.size,
      household.grossAnnualIncome,
      effectiveDate
    );

    breakdown.push(
      `Household is at ${percentOfFPL}% of Federal Poverty Level (FPL)`
    );
    breakdown.push(
      `OHEP Income Limit: ${incomeLimit.percentOfFPL}% FPL = $${(
        incomeLimit.annualIncomeLimit / 100
      ).toFixed(2)}/year`
    );

    // Step 3: Income test
    const incomeTestPassed =
      household.grossAnnualIncome <= incomeLimit.annualIncomeLimit;

    if (!incomeTestPassed) {
      ineligibilityReasons.push(
        `Income exceeds ${incomeLimit.percentOfFPL}% FPL limit of $${(
          incomeLimit.annualIncomeLimit / 100
        ).toFixed(2)}/year`
      );
      breakdown.push(`✗ Income test FAILED`);
    } else {
      breakdown.push(`✓ Income test PASSED`);
    }

    // Step 4: Get benefit tiers and determine benefit type
    const tiers = await this.getActiveBenefitTiers(effectiveDate);
    const { tierType, tier } = this.determineBenefitType(household, tiers);

    // Step 5: Get current season
    const season = await this.getCurrentSeason(effectiveDate);
    const seasonName = season?.season || "heating"; // Default to heating

    breakdown.push(`Season: ${seasonName}`);

    // Step 6: Determine priority group
    const priorityGroup = this.determinePriorityGroup(household);
    if (priorityGroup) {
      breakdown.push(`Priority Group: ${priorityGroup}`);
    }

    // Step 7: Calculate benefit amount
    let benefitAmount = 0;
    if (incomeTestPassed && tier) {
      benefitAmount = tier.maxBenefitAmount;
      breakdown.push(
        `Benefit Type: ${tierType} - $${(benefitAmount / 100).toFixed(2)}`
      );
    } else {
      breakdown.push(`No benefit available`);
    }

    return {
      isEligible: incomeTestPassed,
      reason: incomeTestPassed
        ? `Eligible for OHEP ${tierType} assistance`
        : ineligibilityReasons[0],
      ineligibilityReasons: incomeTestPassed ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomeTestPassed,
        percentOfFPL: percentOfFPL,
        limit: incomeLimit.annualIncomeLimit,
        actual: household.grossAnnualIncome,
      },
      benefitType: tierType,
      benefitAmount,
      priorityGroup,
      season: seasonName,
      calculationBreakdown: breakdown,
      rulesSnapshot: {
        incomeLimitId: incomeLimit.id,
        benefitTierId: tier?.id || "",
        seasonalFactorId: season?.id,
      },
      policyCitations: [
        {
          sectionNumber: "OHEP-100",
          sectionTitle: "OHEP Income Eligibility",
          ruleType: "income",
          description: `Household must be at or below ${incomeLimit.percentOfFPL}% of Federal Poverty Level`,
        },
        {
          sectionNumber: "OHEP-200",
          sectionTitle: "OHEP Benefit Amounts",
          ruleType: "benefit",
          description: `${tierType} assistance: $${(
            benefitAmount / 100
          ).toFixed(2)}`,
        },
      ],
    };
  }
}

export const ohepRulesEngine = new OHEPRulesEngine();
