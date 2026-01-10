import { db } from "../db";
import {
  federalTaxBrackets, federalStandardDeductions, eitcTables, ctcRules,
  marylandTaxRates, marylandCountyTaxRates, marylandStateCredits,
  statePolicyRules, stateConfigurations, formalRules,
  ontologyTerms, statutorySources
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.service";

const SUPPORTED_STATES = ["MD", "PA", "VA", "MI"] as const;

const MARYLAND_COUNTIES: Record<string, number> = {
  "ALLEGANY": 0.0305,
  "ANNE ARUNDEL": 0.0281,
  "BALTIMORE CITY": 0.0320,
  "BALTIMORE COUNTY": 0.0283,
  "CALVERT": 0.0300,
  "CAROLINE": 0.0320,
  "CARROLL": 0.0305,
  "CECIL": 0.0300,
  "CHARLES": 0.0300,
  "DORCHESTER": 0.0320,
  "FREDERICK": 0.0296,
  "GARRETT": 0.0265,
  "HARFORD": 0.0306,
  "HOWARD": 0.0320,
  "KENT": 0.0285,
  "MONTGOMERY": 0.0320,
  "PRINCE GEORGES": 0.0320,
  "QUEEN ANNES": 0.0320,
  "SAINT MARYS": 0.0300,
  "SOMERSET": 0.0320,
  "TALBOT": 0.0240,
  "WASHINGTON": 0.0295,
  "WICOMICO": 0.0320,
  "WORCESTER": 0.0125
};

const FEDERAL_TAX_BRACKETS_2024 = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: null, rate: 0.37 }
  ],
  married_joint: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: null, rate: 0.37 }
  ],
  head_of_household: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: null, rate: 0.37 }
  ]
};

const EITC_2024 = {
  noChildren: { maxCredit: 632, phaseoutStart: { single: 9800, married: 16370 }, phaseoutEnd: { single: 18591, married: 25511 } },
  oneChild: { maxCredit: 4213, phaseoutStart: { single: 12730, married: 19650 }, phaseoutEnd: { single: 49084, married: 56004 } },
  twoChildren: { maxCredit: 6960, phaseoutStart: { single: 12730, married: 19650 }, phaseoutEnd: { single: 55768, married: 62688 } },
  threeOrMore: { maxCredit: 7830, phaseoutStart: { single: 12730, married: 19650 }, phaseoutEnd: { single: 59899, married: 66819 } }
};

const STATE_POLICY_RULES = {
  PA: {
    snap: [
      {
        ruleName: "PA Gross Income Limit - SNAP",
        ruleCode: "PA-SNAP-INCOME-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "55 Pa. Code § 501.1",
        ruleLogic: { type: "gross_income_test", fplPercent: 200, bbce: true },
        notes: "PA uses Broad-Based Categorical Eligibility (BBCE) at 200% FPL"
      },
      {
        ruleName: "PA Net Income Limit - SNAP",
        ruleCode: "PA-SNAP-INCOME-002",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "55 Pa. Code § 501.4",
        ruleLogic: { type: "net_income_test", fplPercent: 100 },
        notes: "Net income must be at or below 100% FPL"
      },
      {
        ruleName: "PA Asset Limit - SNAP",
        ruleCode: "PA-SNAP-ASSET-001",
        ruleCategory: "eligibility",
        ruleType: "asset_test",
        sourceRegulation: "55 Pa. Code § 501.21",
        ruleLogic: { type: "asset_limit", standardLimit: null, elderlyDisabledLimit: null, eliminated: true },
        notes: "PA eliminated asset test under BBCE"
      }
    ],
    medicaid: [
      {
        ruleName: "PA Medicaid MAGI Income Limit",
        ruleCode: "PA-MAGI-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "55 Pa. Code § 140.1",
        ruleLogic: { type: "magi_income", fplPercent: { adult: 138, child: 318, pregnant: 220 } },
        notes: "PA expanded Medicaid under ACA"
      }
    ],
    tanf: [
      {
        ruleName: "PA TANF Income Limit",
        ruleCode: "PA-TANF-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "55 Pa. Code § 181.31",
        ruleLogic: { type: "tanf_income", countableIncomePercent: 100 },
        notes: "TANF Cash Assistance eligibility"
      }
    ]
  },
  VA: {
    snap: [
      {
        ruleName: "VA Gross Income Limit - SNAP",
        ruleCode: "VA-SNAP-INCOME-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "22 VAC 40-640-10",
        ruleLogic: { type: "gross_income_test", fplPercent: 200, bbce: true },
        notes: "VA uses Broad-Based Categorical Eligibility (BBCE) at 200% FPL"
      },
      {
        ruleName: "VA Net Income Limit - SNAP",
        ruleCode: "VA-SNAP-INCOME-002",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "22 VAC 40-640-20",
        ruleLogic: { type: "net_income_test", fplPercent: 100 },
        notes: "Net income must be at or below 100% FPL"
      },
      {
        ruleName: "VA Asset Limit - SNAP",
        ruleCode: "VA-SNAP-ASSET-001",
        ruleCategory: "eligibility",
        ruleType: "asset_test",
        sourceRegulation: "22 VAC 40-640-30",
        ruleLogic: { type: "asset_limit", standardLimit: null, elderlyDisabledLimit: null, eliminated: true },
        notes: "VA eliminated asset test under BBCE"
      }
    ],
    medicaid: [
      {
        ruleName: "VA Medicaid MAGI Income Limit",
        ruleCode: "VA-MAGI-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "22 VAC 40-325-10",
        ruleLogic: { type: "magi_income", fplPercent: { adult: 138, child: 205, pregnant: 205 } },
        notes: "VA expanded Medicaid under ACA (effective Jan 2019)"
      }
    ],
    tanf: [
      {
        ruleName: "VA TANF Income Limit",
        ruleCode: "VA-TANF-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "22 VAC 40-295-20",
        ruleLogic: { type: "tanf_income", countableIncomePercent: 100 },
        notes: "VIEW (Virginia Initiative for Education and Work) eligibility"
      }
    ]
  },
  MI: {
    snap: [
      {
        ruleName: "MI Gross Income Limit - SNAP",
        ruleCode: "MI-SNAP-INCOME-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "Mich. Admin. Code R 400.3101",
        ruleLogic: { type: "gross_income_test", fplPercent: 200, bbce: true },
        notes: "MI uses Broad-Based Categorical Eligibility (BBCE) at 200% FPL"
      },
      {
        ruleName: "MI Net Income Limit - SNAP",
        ruleCode: "MI-SNAP-INCOME-002",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "Mich. Admin. Code R 400.3107",
        ruleLogic: { type: "net_income_test", fplPercent: 100 },
        notes: "Net income must be at or below 100% FPL"
      },
      {
        ruleName: "MI Asset Limit - SNAP",
        ruleCode: "MI-SNAP-ASSET-001",
        ruleCategory: "eligibility",
        ruleType: "asset_test",
        sourceRegulation: "Mich. Admin. Code R 400.3116",
        ruleLogic: { type: "asset_limit", standardLimit: null, elderlyDisabledLimit: null, eliminated: true },
        notes: "MI eliminated asset test under BBCE"
      }
    ],
    medicaid: [
      {
        ruleName: "MI Medicaid MAGI Income Limit",
        ruleCode: "MI-MAGI-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "Mich. Admin. Code R 400.1001",
        ruleLogic: { type: "magi_income", fplPercent: { adult: 138, child: 217, pregnant: 200 } },
        notes: "MI Healthy Michigan Plan (expanded Medicaid)"
      }
    ],
    tanf: [
      {
        ruleName: "MI TANF Income Limit",
        ruleCode: "MI-TANF-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "Mich. Admin. Code R 400.3201",
        ruleLogic: { type: "tanf_income", countableIncomePercent: 100 },
        notes: "Family Independence Program (FIP) eligibility"
      }
    ]
  },
  MD: {
    snap: [
      {
        ruleName: "MD Gross Income Limit - SNAP",
        ruleCode: "MD-SNAP-INCOME-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "COMAR 07.03.17.01",
        ruleLogic: { type: "gross_income_test", fplPercent: 200, bbce: true },
        notes: "MD uses Broad-Based Categorical Eligibility (BBCE) at 200% FPL"
      },
      {
        ruleName: "MD Net Income Limit - SNAP",
        ruleCode: "MD-SNAP-INCOME-002",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "COMAR 07.03.17.03",
        ruleLogic: { type: "net_income_test", fplPercent: 100 },
        notes: "Net income must be at or below 100% FPL"
      },
      {
        ruleName: "MD Asset Limit - SNAP",
        ruleCode: "MD-SNAP-ASSET-001",
        ruleCategory: "eligibility",
        ruleType: "asset_test",
        sourceRegulation: "COMAR 07.03.17.05",
        ruleLogic: { type: "asset_limit", standardLimit: null, elderlyDisabledLimit: null, eliminated: true },
        notes: "MD eliminated asset test under BBCE"
      }
    ],
    medicaid: [
      {
        ruleName: "MD Medicaid MAGI Income Limit",
        ruleCode: "MD-MAGI-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "COMAR 10.09.24.01",
        ruleLogic: { type: "magi_income", fplPercent: { adult: 138, child: 322, pregnant: 264 } },
        notes: "Maryland Medicaid income limits by category"
      }
    ],
    tanf: [
      {
        ruleName: "MD TCA Income Limit",
        ruleCode: "MD-TCA-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "COMAR 07.03.03.01",
        ruleLogic: { type: "tanf_income", countableIncomePercent: 100 },
        notes: "Temporary Cash Assistance (TCA) eligibility"
      }
    ],
    ohep: [
      {
        ruleName: "MD OHEP Income Limit",
        ruleCode: "MD-OHEP-001",
        ruleCategory: "eligibility",
        ruleType: "income_limit",
        sourceRegulation: "COMAR 07.03.23.01",
        ruleLogic: { type: "ohep_income", fplPercent: 175 },
        notes: "Office of Home Energy Programs income limit"
      }
    ]
  }
};

const MEDICAID_Z3_RULES = [
  {
    ruleName: "Medicaid MAGI Income Test",
    eligibilityDomain: "medicaid",
    z3Logic: "(assert (<= adjustedGrossIncome (* magiLimitPercent federalPovertyLevel)))",
    description: "Modified Adjusted Gross Income must be at or below state MAGI limit",
    statutoryCitation: "42 CFR § 435.603"
  },
  {
    ruleName: "Medicaid Age Requirement - Adult",
    eligibilityDomain: "medicaid",
    z3Logic: "(assert (and (>= age 19) (< age 65)))",
    description: "Adult Medicaid requires age 19-64",
    statutoryCitation: "42 CFR § 435.119"
  }
];

const TANF_Z3_RULES = [
  {
    ruleName: "TANF Income Test",
    eligibilityDomain: "tanf",
    z3Logic: "(assert (<= countableIncome tanfStandard))",
    description: "Countable income must be at or below TANF payment standard",
    statutoryCitation: "45 CFR § 260.30"
  },
  {
    ruleName: "TANF Dependent Child Requirement",
    eligibilityDomain: "tanf",
    z3Logic: "(assert (and (> dependentChildren 0) (or (< childAge 18) (and (= isStudentChild true) (< childAge 19)))))",
    description: "Household must include a dependent child under 18 (or under 19 if student)",
    statutoryCitation: "45 CFR § 261.2"
  },
  {
    ruleName: "TANF Work Requirement",
    eligibilityDomain: "tanf",
    z3Logic: "(assert (or (>= workHours 30) (= isExemptFromWork true)))",
    description: "Work-eligible individuals must participate in work activities for 30 hours/week unless exempt",
    statutoryCitation: "45 CFR § 261.31"
  }
];

const OHEP_Z3_RULES = [
  {
    ruleName: "OHEP Income Limit",
    eligibilityDomain: "ohep",
    z3Logic: "(assert (<= grossAnnualIncome (* 1.75 federalPovertyLevel)))",
    description: "Gross household income must be at or below 175% FPL",
    statutoryCitation: "COMAR 07.03.23.02"
  },
  {
    ruleName: "OHEP Utility Responsibility",
    eligibilityDomain: "ohep",
    z3Logic: "(assert (= hasUtilityResponsibility true))",
    description: "Applicant must be responsible for utility payments",
    statutoryCitation: "COMAR 07.03.23.03"
  }
];

export class MultiStateRulesSeeder {
  async seedAll(): Promise<{ success: boolean; results: Record<string, any> }> {
    const results: Record<string, any> = {};

    try {
      results.federalTax = await this.seedFederalTaxData();
      results.marylandTax = await this.seedMarylandTaxData();
      results.statePolicyRules = await this.seedStatePolicyRules();
      results.z3Rules = await this.seedZ3FormalRules();
      results.ontologyTerms = await this.seedOntologyTerms();

      logger.info("Multi-state rules seeding completed", results);
      return { success: true, results };
    } catch (error) {
      logger.error("Multi-state rules seeding failed", error);
      return { success: false, results: { error: String(error) } };
    }
  }

  private async seedFederalTaxData(): Promise<{ brackets: number; eitc: number }> {
    let bracketsInserted = 0;
    let eitcInserted = 0;

    for (const year of [2023, 2024, 2025]) {
      const brackets = year === 2025 ? FEDERAL_TAX_BRACKETS_2024 : FEDERAL_TAX_BRACKETS_2024;
      
      for (const [status, statusBrackets] of Object.entries(brackets)) {
        for (let i = 0; i < statusBrackets.length; i++) {
          const bracket = statusBrackets[i];
          const existing = await db.select().from(federalTaxBrackets)
            .where(and(
              eq(federalTaxBrackets.taxYear, year),
              eq(federalTaxBrackets.filingStatus, status),
              eq(federalTaxBrackets.bracketNumber, i + 1)
            )).limit(1);

          if (existing.length === 0) {
            await db.insert(federalTaxBrackets).values({
              taxYear: year,
              filingStatus: status,
              bracketNumber: i + 1,
              minIncome: Math.round(bracket.min * 100),
              maxIncome: bracket.max ? Math.round(bracket.max * 100) : null,
              taxRate: bracket.rate,
              effectiveDate: new Date(`${year}-01-01`),
              isActive: true
            });
            bracketsInserted++;
          }
        }
      }

      const eitcData = EITC_2024;
      for (const [childCount, data] of Object.entries(eitcData)) {
        const numChildren = childCount === 'noChildren' ? 0 : 
                           childCount === 'oneChild' ? 1 : 
                           childCount === 'twoChildren' ? 2 : 3;
        
        const existing = await db.select().from(eitcTables)
          .where(and(
            eq(eitcTables.taxYear, year),
            eq(eitcTables.numChildren, numChildren)
          )).limit(1);

        if (existing.length === 0) {
          await db.insert(eitcTables).values({
            taxYear: year,
            numChildren,
            maxCredit: Math.round(data.maxCredit * 100),
            phaseoutStartSingle: Math.round(data.phaseoutStart.single * 100),
            phaseoutStartMarried: Math.round(data.phaseoutStart.married * 100),
            phaseoutEndSingle: Math.round(data.phaseoutEnd.single * 100),
            phaseoutEndMarried: Math.round(data.phaseoutEnd.married * 100),
            effectiveDate: new Date(`${year}-01-01`),
            isActive: true
          });
          eitcInserted++;
        }
      }
    }

    return { brackets: bracketsInserted, eitc: eitcInserted };
  }

  private async seedMarylandTaxData(): Promise<{ stateRates: number; countyRates: number; credits: number }> {
    let stateRatesInserted = 0;
    let countyRatesInserted = 0;
    let creditsInserted = 0;

    const mdStateBrackets = [
      { min: 0, max: 1000, rate: 0.02 },
      { min: 1000, max: 2000, rate: 0.03 },
      { min: 2000, max: 3000, rate: 0.04 },
      { min: 3000, max: 100000, rate: 0.0475 },
      { min: 100000, max: 125000, rate: 0.05 },
      { min: 125000, max: 150000, rate: 0.0525 },
      { min: 150000, max: 250000, rate: 0.055 },
      { min: 250000, max: null, rate: 0.0575 }
    ];

    for (const year of [2023, 2024, 2025]) {
      for (let i = 0; i < mdStateBrackets.length; i++) {
        const bracket = mdStateBrackets[i];
        const existing = await db.select().from(marylandTaxRates)
          .where(and(
            eq(marylandTaxRates.taxYear, year),
            eq(marylandTaxRates.bracketNumber, i + 1)
          )).limit(1);

        if (existing.length === 0) {
          await db.insert(marylandTaxRates).values({
            taxYear: year,
            filingStatus: "all",
            bracketNumber: i + 1,
            minIncome: Math.round(bracket.min * 100),
            maxIncome: bracket.max ? Math.round(bracket.max * 100) : null,
            taxRate: bracket.rate,
            effectiveDate: new Date(`${year}-01-01`),
            isActive: true
          });
          stateRatesInserted++;
        }
      }

      for (const [countyName, rate] of Object.entries(MARYLAND_COUNTIES)) {
        const existing = await db.select().from(marylandCountyTaxRates)
          .where(and(
            eq(marylandCountyTaxRates.taxYear, year),
            eq(marylandCountyTaxRates.countyCode, countyName.replace(/ /g, "_"))
          )).limit(1);

        if (existing.length === 0) {
          await db.insert(marylandCountyTaxRates).values({
            taxYear: year,
            countyCode: countyName.replace(/ /g, "_"),
            countyName: countyName,
            taxRate: rate,
            effectiveDate: new Date(`${year}-01-01`),
            isActive: true
          });
          countyRatesInserted++;
        }
      }

      const mdCredits = [
        { code: "MD_EITC", name: "Maryland Earned Income Tax Credit", type: "refundable", method: { percentOfFederal: 0.50 }, maxCredit: null },
        { code: "POVERTY_CREDIT", name: "Maryland Poverty Level Credit", type: "refundable", method: { type: "poverty_credit" }, maxCredit: null },
        { code: "CTC_REFUNDABLE", name: "Maryland Child Tax Credit (Refundable)", type: "refundable", method: { perChild: 500 }, maxCredit: 1500 }
      ];

      for (const credit of mdCredits) {
        const existing = await db.select().from(marylandStateCredits)
          .where(and(
            eq(marylandStateCredits.taxYear, year),
            eq(marylandStateCredits.creditCode, credit.code)
          )).limit(1);

        if (existing.length === 0) {
          await db.insert(marylandStateCredits).values({
            taxYear: year,
            creditCode: credit.code,
            creditName: credit.name,
            creditType: credit.type,
            calculationMethod: credit.method,
            maxCredit: credit.maxCredit ? Math.round(credit.maxCredit * 100) : null,
            effectiveDate: new Date(`${year}-01-01`),
            isActive: true
          });
          creditsInserted++;
        }
      }
    }

    return { stateRates: stateRatesInserted, countyRates: countyRatesInserted, credits: creditsInserted };
  }

  private async seedStatePolicyRules(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const stateCode of SUPPORTED_STATES) {
      let rulesInserted = 0;
      const stateRules = STATE_POLICY_RULES[stateCode];
      
      const stateConfig = await db.select().from(stateConfigurations)
        .where(eq(stateConfigurations.stateCode, stateCode)).limit(1);
      
      if (stateConfig.length === 0) {
        logger.warn(`State configuration not found for ${stateCode}`);
        continue;
      }

      const stateConfigId = stateConfig[0].id;

      for (const [program, rules] of Object.entries(stateRules)) {
        for (const rule of rules) {
          const existing = await db.select().from(statePolicyRules)
            .where(and(
              eq(statePolicyRules.stateConfigId, stateConfigId),
              eq(statePolicyRules.ruleCode, rule.ruleCode)
            )).limit(1);

          if (existing.length === 0) {
            await db.insert(statePolicyRules).values({
              stateConfigId,
              ruleName: rule.ruleName,
              ruleCode: rule.ruleCode,
              ruleCategory: rule.ruleCategory,
              ruleType: rule.ruleType,
              ruleLogic: rule.ruleLogic,
              sourceRegulation: rule.sourceRegulation,
              notes: rule.notes,
              isActive: true,
              effectiveDate: new Date("2024-01-01")
            });
            rulesInserted++;
          }
        }
      }

      results[stateCode] = rulesInserted;
    }

    return results;
  }

  private async seedZ3FormalRules(): Promise<number> {
    let rulesInserted = 0;

    const allRules = [...MEDICAID_Z3_RULES, ...TANF_Z3_RULES, ...OHEP_Z3_RULES];

    for (const rule of allRules) {
      const existing = await db.select().from(formalRules)
        .where(eq(formalRules.ruleName, rule.ruleName)).limit(1);

      if (existing.length === 0) {
        await db.insert(formalRules).values({
          ruleName: rule.ruleName,
          eligibilityDomain: rule.eligibilityDomain,
          z3Logic: rule.z3Logic,
          description: rule.description,
          statutoryCitation: rule.statutoryCitation,
          promptingStrategy: "directed_symbolic",
          isVerified: true,
          extractedAt: new Date()
        });
        rulesInserted++;
      }
    }

    return rulesInserted;
  }

  private async seedOntologyTerms(): Promise<number> {
    let termsInserted = 0;

    const newTerms = [
      { term: "Modified Adjusted Gross Income (MAGI)", category: "income", domain: "medicaid", definition: "Federal AGI plus certain deductions (tax-exempt interest, foreign income)" },
      { term: "TANF Time Limit", category: "work_requirement", domain: "tanf", definition: "60-month federal lifetime limit on TANF benefits" },
      { term: "Work Participation Rate", category: "work_requirement", domain: "tanf", definition: "Percentage of TANF recipients engaged in work activities" },
      { term: "OHEP Crisis Assistance", category: "benefit", domain: "ohep", definition: "Emergency assistance to prevent utility shutoff" },
      { term: "LIHEAP", category: "program", domain: "ohep", definition: "Low Income Home Energy Assistance Program (federal funding for OHEP)" },
      { term: "Categorical Eligibility", category: "eligibility", domain: "snap", definition: "Automatic SNAP eligibility based on receipt of other benefits" },
      { term: "ABAWD", category: "work_requirement", domain: "snap", definition: "Able-Bodied Adults Without Dependents subject to work requirements" },
      { term: "Fair Hearing", category: "due_process", domain: "all", definition: "Administrative appeal process for benefit denials" },
      { term: "Notice of Action", category: "due_process", domain: "all", definition: "Written notice explaining eligibility decision" },
      { term: "Benefit Period", category: "certification", domain: "snap", definition: "Duration of certified eligibility between recertifications" }
    ];

    const existingStatSource = await db.select().from(statutorySources).limit(1);
    const sourceId = existingStatSource[0]?.id;

    for (const termData of newTerms) {
      const existing = await db.select().from(ontologyTerms)
        .where(eq(ontologyTerms.term, termData.term)).limit(1);

      if (existing.length === 0) {
        await db.insert(ontologyTerms).values({
          term: termData.term,
          category: termData.category,
          definition: termData.definition,
          statutorySourceId: sourceId,
          extractedAt: new Date()
        });
        termsInserted++;
      }
    }

    return termsInserted;
  }
}

export const multiStateRulesSeeder = new MultiStateRulesSeeder();
