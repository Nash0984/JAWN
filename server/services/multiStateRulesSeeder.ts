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

// ============================================================================
// SNAP Z3 FORMAL RULES - Comprehensive SNAP eligibility verification
// Based on 7 CFR 273 (Federal) and COMAR 07.03.17 (Maryland)
// ============================================================================
const SNAP_Z3_RULES = [
  // Income Tests
  {
    ruleName: "SNAP Gross Income Test",
    eligibilityDomain: "snap_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (<= grossMonthlyIncome (* 2.00 federalPovertyLevel)))",
    description: "Gross monthly income must be at or below 200% FPL (Maryland BBCE)",
    statutoryCitation: "COMAR 07.03.17.06",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP Net Income Test",
    eligibilityDomain: "snap_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (<= netMonthlyIncome (* 1.00 federalPovertyLevel)))",
    description: "Net monthly income must be at or below 100% FPL",
    statutoryCitation: "7 CFR § 273.9(a)(2)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP Resource Limit - Standard",
    eligibilityDomain: "resources",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (or (= hasBBCE true) (<= countableResources 2750)))",
    description: "Countable resources must be at or below $2,750 (or exempt under BBCE)",
    statutoryCitation: "7 CFR § 273.8(b)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP Resource Limit - Elderly/Disabled",
    eligibilityDomain: "resources",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (or (= hasElderlyMember true) (= hasDisabledMember true)) (or (= hasBBCE true) (<= countableResources 4250))))",
    description: "Elderly/disabled households: resources at or below $4,250 (or exempt under BBCE)",
    statutoryCitation: "7 CFR § 273.8(b)",
    isValid: true,
    status: "approved"
  },
  // Citizenship and Immigration
  {
    ruleName: "SNAP Citizenship Requirement",
    eligibilityDomain: "citizenship",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (or (= citizenshipStatus \"us_citizen\") (= citizenshipStatus \"us_national\") (= citizenshipStatus \"qualified_alien\") (= citizenshipStatus \"refugee\") (= citizenshipStatus \"asylee\")))",
    description: "Must be U.S. citizen, U.S. national, or qualified non-citizen",
    statutoryCitation: "8 U.S.C. § 1612; 7 CFR § 273.4",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP Qualified Alien 5-Year Bar Exception",
    eligibilityDomain: "citizenship",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (= citizenshipStatus \"qualified_alien\") (or (>= yearsInQualifiedStatus 5) (= isExemptFrom5YearBar true))))",
    description: "Qualified aliens must meet 5-year residency or be exempt (refugees, asylees, children, elderly)",
    statutoryCitation: "8 U.S.C. § 1613; 7 CFR § 273.4(a)(6)",
    isValid: true,
    status: "approved"
  },
  // Residency
  {
    ruleName: "SNAP State Residency",
    eligibilityDomain: "residency",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (= isStateResident true))",
    description: "Applicant must reside in Maryland",
    statutoryCitation: "7 CFR § 273.3; COMAR 07.03.17.04",
    isValid: true,
    status: "approved"
  },
  // Work Requirements (ABAWD)
  {
    ruleName: "SNAP ABAWD Work Requirement",
    eligibilityDomain: "work_requirement",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (= isABAWD true) (or (>= workHoursPerWeek 20) (= isInWorkProgram true) (= hasABAWDExemption true))))",
    description: "ABAWDs must work 20+ hours/week, participate in work program, or be exempt",
    statutoryCitation: "7 CFR § 273.24(a)(1)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP ABAWD Time Limit",
    eligibilityDomain: "work_requirement",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (and (= isABAWD true) (not (or (>= workHoursPerWeek 20) (= isInWorkProgram true) (= hasABAWDExemption true)))) (<= abawdMonthsUsed 3)))",
    description: "Non-working ABAWDs limited to 3 months in 36-month period without exemption",
    statutoryCitation: "7 CFR § 273.24(b)",
    isValid: true,
    status: "approved"
  },
  // Student Eligibility
  {
    ruleName: "SNAP Student Eligibility",
    eligibilityDomain: "student_status",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (= isHigherEdStudent true) (or (>= workHoursPerWeek 20) (= receivesWorkStudy true) (= hasStudentExemption true) (= isParentOfChildUnder6 true) (= isParentOfChildUnder12WithNoChildCare true))))",
    description: "Higher ed students must work 20+ hours, have work-study, or meet exemption",
    statutoryCitation: "7 CFR § 273.5(b)",
    isValid: true,
    status: "approved"
  },
  // Categorical Eligibility
  {
    ruleName: "SNAP Categorical Eligibility - SSI",
    eligibilityDomain: "categorical_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (= receivesSSI true) (= isCategoricallyEligible true)))",
    description: "SSI recipients are categorically eligible for SNAP",
    statutoryCitation: "7 CFR § 273.2(j)(2)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP Categorical Eligibility - TANF",
    eligibilityDomain: "categorical_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (=> (= receivesTANF true) (= isCategoricallyEligible true)))",
    description: "TANF recipients are categorically eligible for SNAP",
    statutoryCitation: "7 CFR § 273.2(j)(2)",
    isValid: true,
    status: "approved"
  },
  // Household Composition
  {
    ruleName: "SNAP Purchase and Prepare Meals Together",
    eligibilityDomain: "household_composition",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (= purchasePrepareMealsTogether true))",
    description: "Household members must customarily purchase and prepare meals together",
    statutoryCitation: "7 CFR § 273.1(a)",
    isValid: true,
    status: "approved"
  },
  // Social Security Number
  {
    ruleName: "SNAP SSN Requirement",
    eligibilityDomain: "identity",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (or (= hasSSN true) (= hasAppliedForSSN true) (= isSSNExempt true)))",
    description: "Must provide SSN, apply for one, or meet exemption",
    statutoryCitation: "7 CFR § 273.6",
    isValid: true,
    status: "approved"
  },
  // Disqualification Rules
  {
    ruleName: "SNAP Intentional Program Violation Disqualification",
    eligibilityDomain: "disqualification",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (= hasActiveIPVDisqualification false))",
    description: "Not currently serving an intentional program violation (IPV) disqualification",
    statutoryCitation: "7 CFR § 273.16(b)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SNAP Drug Felony Compliance",
    eligibilityDomain: "disqualification",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SNAP",
    z3Logic: "(assert (or (= hasDrugFelony false) (= drugFelonyExemptionMet true)))",
    description: "Drug felony provisions - Maryland has opted out of lifetime ban",
    statutoryCitation: "21 U.S.C. § 862a; COMAR 07.03.17.15",
    isValid: true,
    status: "approved"
  }
];

// ============================================================================
// SSI Z3 FORMAL RULES - Supplemental Security Income verification
// Based on 20 CFR 416 (Federal SSA regulations)
// ============================================================================
const SSI_Z3_RULES = [
  {
    ruleName: "SSI Age/Disability Requirement",
    eligibilityDomain: "ssi_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (or (>= age 65) (= isDisabled true) (= isBlind true)))",
    description: "Must be age 65+ or blind/disabled",
    statutoryCitation: "42 U.S.C. § 1382; 20 CFR § 416.202",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SSI Income Limit - Individual",
    eligibilityDomain: "income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (=> (= isIndividual true) (<= countableIncome 943)))",
    description: "Individual countable income must be below SSI Federal Benefit Rate ($943/month 2024)",
    statutoryCitation: "20 CFR § 416.1100",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SSI Income Limit - Couple",
    eligibilityDomain: "income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (=> (= isCouple true) (<= countableIncome 1415)))",
    description: "Couple countable income must be below SSI Federal Benefit Rate ($1,415/month 2024)",
    statutoryCitation: "20 CFR § 416.1100",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SSI Resource Limit - Individual",
    eligibilityDomain: "resources",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (=> (= isIndividual true) (<= countableResources 2000)))",
    description: "Individual resources limited to $2,000",
    statutoryCitation: "42 U.S.C. § 1382(a)(3)(A); 20 CFR § 416.1205",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SSI Resource Limit - Couple",
    eligibilityDomain: "resources",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (=> (= isCouple true) (<= countableResources 3000)))",
    description: "Couple resources limited to $3,000",
    statutoryCitation: "42 U.S.C. § 1382(a)(3)(B); 20 CFR § 416.1205",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SSI Citizenship Requirement",
    eligibilityDomain: "citizenship",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (or (= citizenshipStatus \"us_citizen\") (= citizenshipStatus \"us_national\") (= isQualifiedNoncitizen true)))",
    description: "Must be U.S. citizen, national, or qualified non-citizen",
    statutoryCitation: "42 U.S.C. § 1382c(a)(1)(B); 20 CFR § 416.202",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "SSI Residency Requirement",
    eligibilityDomain: "residency",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "SSI",
    z3Logic: "(assert (and (= isUSResident true) (not (= isOutsideUSOver30Days true))))",
    description: "Must reside in the U.S. and not be outside the country for 30+ consecutive days",
    statutoryCitation: "42 U.S.C. § 1382(f); 20 CFR § 416.215",
    isValid: true,
    status: "approved"
  }
];

// ============================================================================
// MEDICAID Z3 FORMAL RULES - Expanded with full eligibility criteria
// Based on 42 CFR 435 and COMAR 10.09 (Maryland)
// ============================================================================
const MEDICAID_Z3_RULES = [
  {
    ruleName: "Medicaid MAGI Income Test",
    eligibilityDomain: "medicaid_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (<= adjustedGrossIncome (* magiLimitPercent federalPovertyLevel)))",
    description: "Modified Adjusted Gross Income must be at or below state MAGI limit",
    statutoryCitation: "42 CFR § 435.603",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid MAGI Adult Expansion",
    eligibilityDomain: "medicaid_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (=> (and (>= age 19) (< age 65) (= isParent false) (= isPregnant false)) (<= adjustedGrossIncome (* 1.38 federalPovertyLevel))))",
    description: "Adults 19-64 (non-parent, non-pregnant) income limit at 138% FPL",
    statutoryCitation: "42 CFR § 435.119; COMAR 10.09.24.01",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid Age Requirement - Adult",
    eligibilityDomain: "medicaid_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (and (>= age 19) (< age 65)))",
    description: "Adult Medicaid requires age 19-64",
    statutoryCitation: "42 CFR § 435.119",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid Child Income Limit",
    eligibilityDomain: "medicaid_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (=> (< age 19) (<= adjustedGrossIncome (* 3.22 federalPovertyLevel))))",
    description: "Children under 19: income limit at 322% FPL (Maryland MCHP)",
    statutoryCitation: "COMAR 10.09.24.02",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid Pregnant Woman Income Limit",
    eligibilityDomain: "medicaid_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (=> (= isPregnant true) (<= adjustedGrossIncome (* 2.64 federalPovertyLevel))))",
    description: "Pregnant women: income limit at 264% FPL",
    statutoryCitation: "COMAR 10.09.24.03",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid Residency Requirement",
    eligibilityDomain: "residency",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (= isStateResident true))",
    description: "Must be a resident of Maryland",
    statutoryCitation: "42 CFR § 435.403; COMAR 10.09.24.05",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid Citizenship Requirement",
    eligibilityDomain: "citizenship",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (or (= citizenshipStatus \"us_citizen\") (= citizenshipStatus \"qualified_alien\") (= isEmergencyMedicaidOnly true)))",
    description: "Must be U.S. citizen or qualified non-citizen (emergency Medicaid available for others)",
    statutoryCitation: "42 CFR § 435.406; 8 U.S.C. § 1612",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid SSN Requirement",
    eligibilityDomain: "identity",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (or (= hasSSN true) (= hasAppliedForSSN true) (= isSSNExempt true)))",
    description: "Must provide SSN or apply for one",
    statutoryCitation: "42 CFR § 435.910",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Medicaid Not Incarcerated",
    eligibilityDomain: "residency",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "MEDICAID",
    z3Logic: "(assert (= isIncarcerated false))",
    description: "Cannot be incarcerated (inmates ineligible except pre-release services)",
    statutoryCitation: "42 CFR § 435.1008",
    isValid: true,
    status: "approved"
  }
];

// ============================================================================
// TANF Z3 FORMAL RULES - Expanded Temporary Assistance for Needy Families
// Based on 45 CFR 260-265 and COMAR 07.03.03 (Maryland TCA)
// ============================================================================
const TANF_Z3_RULES = [
  // Income Tests
  {
    ruleName: "TANF Income Test",
    eligibilityDomain: "tanf_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (<= countableIncome tanfPaymentStandard))",
    description: "Countable income must be at or below TANF payment standard",
    statutoryCitation: "45 CFR § 260.30; COMAR 07.03.03.09",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "TANF Gross Income Screen",
    eligibilityDomain: "tanf_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (<= grossMonthlyIncome (* 1.85 federalPovertyLevel)))",
    description: "Gross income must be at or below 185% FPL for initial eligibility",
    statutoryCitation: "COMAR 07.03.03.08",
    isValid: true,
    status: "approved"
  },
  // Dependent Child Requirement
  {
    ruleName: "TANF Dependent Child Requirement",
    eligibilityDomain: "tanf_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (and (> dependentChildren 0) (or (< childAge 18) (and (= isStudentChild true) (< childAge 19)))))",
    description: "Household must include a dependent child under 18 (or under 19 if full-time student)",
    statutoryCitation: "45 CFR § 261.2; COMAR 07.03.03.03",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "TANF Caretaker Relative Requirement",
    eligibilityDomain: "tanf_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (or (= isParent true) (= isCaretakerRelative true)))",
    description: "Adult must be parent or specified caretaker relative of dependent child",
    statutoryCitation: "45 CFR § 261.2(b); COMAR 07.03.03.04",
    isValid: true,
    status: "approved"
  },
  // Work Requirements
  {
    ruleName: "TANF Work Requirement - Single Parent",
    eligibilityDomain: "work_requirement",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (=> (and (= isSingleParent true) (not (= isWorkExempt true))) (>= workHoursPerWeek 30)))",
    description: "Single parents must work at least 30 hours per week unless exempt",
    statutoryCitation: "45 CFR § 261.31; COMAR 07.03.03.19",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "TANF Work Requirement - Two Parent",
    eligibilityDomain: "work_requirement",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (=> (and (= isTwoParentHousehold true) (not (= isWorkExempt true))) (>= combinedWorkHoursPerWeek 35)))",
    description: "Two-parent households must work combined 35 hours per week",
    statutoryCitation: "45 CFR § 261.32",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "TANF Work Requirement Exemption - Child Under 1",
    eligibilityDomain: "work_requirement",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (=> (= hasChildUnder1 true) (= isWorkExempt true)))",
    description: "Single parent with child under 1 is exempt from work requirements",
    statutoryCitation: "45 CFR § 261.31(b)(1); COMAR 07.03.03.19",
    isValid: true,
    status: "approved"
  },
  // Time Limits
  {
    ruleName: "TANF 60-Month Federal Time Limit",
    eligibilityDomain: "time_limit",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (or (< tanfMonthsReceived 60) (= hasTimeLimitExtension true)))",
    description: "60-month federal lifetime limit on TANF benefits",
    statutoryCitation: "42 U.S.C. § 608(a)(7); 45 CFR § 264.1",
    isValid: true,
    status: "approved"
  },
  // Resource Limits
  {
    ruleName: "TANF Resource Limit",
    eligibilityDomain: "resources",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (<= countableResources 2000))",
    description: "Countable resources must be at or below $2,000",
    statutoryCitation: "COMAR 07.03.03.07",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "TANF Vehicle Exclusion",
    eligibilityDomain: "resources",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (or (<= vehicleValue 15000) (= vehicleUsedForWork true)))",
    description: "One vehicle excluded; additional vehicles count if over $15,000 equity",
    statutoryCitation: "COMAR 07.03.03.07",
    isValid: true,
    status: "approved"
  },
  // Citizenship
  {
    ruleName: "TANF Citizenship Requirement",
    eligibilityDomain: "citizenship",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (or (= citizenshipStatus \"us_citizen\") (= isQualifiedNoncitizen true)))",
    description: "Must be U.S. citizen or qualified non-citizen meeting 5-year bar or exemption",
    statutoryCitation: "8 U.S.C. § 1612; COMAR 07.03.03.05",
    isValid: true,
    status: "approved"
  },
  // Residency
  {
    ruleName: "TANF Residency Requirement",
    eligibilityDomain: "residency",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (= isStateResident true))",
    description: "Must be a resident of Maryland",
    statutoryCitation: "COMAR 07.03.03.04",
    isValid: true,
    status: "approved"
  },
  // Cooperation Requirements
  {
    ruleName: "TANF Child Support Cooperation",
    eligibilityDomain: "cooperation",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TANF",
    z3Logic: "(assert (or (= cooperatesWithChildSupport true) (= hasGoodCauseExemption true)))",
    description: "Must cooperate with child support enforcement or have good cause exemption",
    statutoryCitation: "45 CFR § 264.30; COMAR 07.03.03.13",
    isValid: true,
    status: "approved"
  }
];

// ============================================================================
// OHEP Z3 FORMAL RULES - Office of Home Energy Programs (Maryland)
// Based on COMAR 07.03.23 and LIHEAP federal requirements
// ============================================================================
const OHEP_Z3_RULES = [
  // Income Tests
  {
    ruleName: "OHEP Income Limit",
    eligibilityDomain: "ohep_income",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (<= grossAnnualIncome (* 1.75 federalPovertyLevel)))",
    description: "Gross household income must be at or below 175% FPL",
    statutoryCitation: "COMAR 07.03.23.02",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "OHEP Categorical Eligibility - SNAP",
    eligibilityDomain: "categorical_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (=> (= receivesSNAP true) (= isCategoricallyEligible true)))",
    description: "SNAP recipients are categorically eligible for OHEP",
    statutoryCitation: "COMAR 07.03.23.02(B)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "OHEP Categorical Eligibility - TANF",
    eligibilityDomain: "categorical_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (=> (= receivesTANF true) (= isCategoricallyEligible true)))",
    description: "TANF recipients are categorically eligible for OHEP",
    statutoryCitation: "COMAR 07.03.23.02(B)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "OHEP Categorical Eligibility - SSI",
    eligibilityDomain: "categorical_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (=> (= receivesSSI true) (= isCategoricallyEligible true)))",
    description: "SSI recipients are categorically eligible for OHEP",
    statutoryCitation: "COMAR 07.03.23.02(B)",
    isValid: true,
    status: "approved"
  },
  // Utility Responsibility
  {
    ruleName: "OHEP Utility Responsibility",
    eligibilityDomain: "ohep_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (or (= hasDirectUtilityPayment true) (= hasIncludedInRent true)))",
    description: "Applicant must pay directly for utilities or have utility costs included in rent",
    statutoryCitation: "COMAR 07.03.23.03",
    isValid: true,
    status: "approved"
  },
  // Residency
  {
    ruleName: "OHEP Residency Requirement",
    eligibilityDomain: "residency",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (= isStateResident true))",
    description: "Must be a resident of Maryland",
    statutoryCitation: "COMAR 07.03.23.04",
    isValid: true,
    status: "approved"
  },
  // Citizenship
  {
    ruleName: "OHEP Citizenship Requirement",
    eligibilityDomain: "citizenship",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (or (= citizenshipStatus \"us_citizen\") (= citizenshipStatus \"qualified_alien\")))",
    description: "At least one household member must be U.S. citizen or qualified non-citizen",
    statutoryCitation: "COMAR 07.03.23.05; LIHEAP statute",
    isValid: true,
    status: "approved"
  },
  // Crisis Assistance
  {
    ruleName: "OHEP Crisis Assistance - Disconnection Notice",
    eligibilityDomain: "ohep_crisis",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (=> (= requestingCrisisAssistance true) (or (= hasDisconnectionNotice true) (= hasServiceTerminated true) (= hasLess7DaysFuel true))))",
    description: "Crisis assistance requires disconnection notice, terminated service, or <7 days fuel supply",
    statutoryCitation: "COMAR 07.03.23.08",
    isValid: true,
    status: "approved"
  },
  // Application Window
  {
    ruleName: "OHEP Application Period",
    eligibilityDomain: "ohep_eligibility",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "OHEP",
    z3Logic: "(assert (or (= isWithinApplicationPeriod true) (= isEmergencyApplication true)))",
    description: "Must apply during program year (November 1 - September 30) or emergency",
    statutoryCitation: "COMAR 07.03.23.06",
    isValid: true,
    status: "approved"
  }
];

// ============================================================================
// TAX CREDITS Z3 FORMAL RULES - EITC and CTC verification
// Based on 26 U.S.C. (Internal Revenue Code) and IRS Publication 596/972
// ============================================================================
const TAX_CREDIT_Z3_RULES = [
  // EITC Rules
  {
    ruleName: "EITC Earned Income Requirement",
    eligibilityDomain: "eitc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (> earnedIncome 0))",
    description: "Must have earned income from employment or self-employment",
    statutoryCitation: "26 U.S.C. § 32(c)(2)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Investment Income Limit",
    eligibilityDomain: "eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (<= investmentIncome 11600))",
    description: "Investment income must be $11,600 or less (2024)",
    statutoryCitation: "26 U.S.C. § 32(i)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Income Limit - No Children",
    eligibilityDomain: "eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (= qualifyingChildren 0) (and (<= earnedIncome 18591) (<= adjustedGrossIncome 18591))))",
    description: "No qualifying children: earned income and AGI must be under $18,591 (single 2024)",
    statutoryCitation: "26 U.S.C. § 32(b); IRS Publication 596",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Income Limit - 1 Child",
    eligibilityDomain: "eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (= qualifyingChildren 1) (and (<= earnedIncome 49084) (<= adjustedGrossIncome 49084))))",
    description: "One qualifying child: earned income and AGI must be under $49,084 (single 2024)",
    statutoryCitation: "26 U.S.C. § 32(b); IRS Publication 596",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Income Limit - 2 Children",
    eligibilityDomain: "eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (= qualifyingChildren 2) (and (<= earnedIncome 55768) (<= adjustedGrossIncome 55768))))",
    description: "Two qualifying children: earned income and AGI must be under $55,768 (single 2024)",
    statutoryCitation: "26 U.S.C. § 32(b); IRS Publication 596",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Income Limit - 3+ Children",
    eligibilityDomain: "eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (>= qualifyingChildren 3) (and (<= earnedIncome 59899) (<= adjustedGrossIncome 59899))))",
    description: "Three or more qualifying children: earned income and AGI must be under $59,899 (single 2024)",
    statutoryCitation: "26 U.S.C. § 32(b); IRS Publication 596",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Filing Status Requirement",
    eligibilityDomain: "eitc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (not (= filingStatus \"married_filing_separately\")))",
    description: "Cannot claim EITC if filing married filing separately",
    statutoryCitation: "26 U.S.C. § 32(d)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Age Requirement - No Children",
    eligibilityDomain: "eitc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (= qualifyingChildren 0) (and (>= age 25) (< age 65))))",
    description: "Without qualifying children, must be at least 25 but under 65",
    statutoryCitation: "26 U.S.C. § 32(c)(1)(A)(ii)(II)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC Qualifying Child Residency",
    eligibilityDomain: "eitc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (> qualifyingChildren 0) (>= childResidencyMonths 6)))",
    description: "Qualifying child must live with taxpayer for more than half the year",
    statutoryCitation: "26 U.S.C. § 32(c)(3)(A)(ii)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "EITC U.S. Residence Requirement",
    eligibilityDomain: "eitc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (>= usResidencyMonths 6))",
    description: "Must have U.S. residence for more than half the tax year",
    statutoryCitation: "26 U.S.C. § 32(c)(1)(A)(ii)(I)",
    isValid: true,
    status: "approved"
  },
  // Child Tax Credit Rules
  {
    ruleName: "CTC Qualifying Child Age",
    eligibilityDomain: "ctc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (> ctcQualifyingChildren 0) (< childAge 17)))",
    description: "Qualifying child must be under age 17 at end of tax year",
    statutoryCitation: "26 U.S.C. § 24(c)(1)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "CTC Maximum Credit Per Child",
    eligibilityDomain: "ctc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (<= ctcCreditPerChild 2000))",
    description: "Maximum CTC is $2,000 per qualifying child (2024)",
    statutoryCitation: "26 U.S.C. § 24(a)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "CTC Income Phaseout - Single",
    eligibilityDomain: "ctc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (and (= filingStatus \"single\") (> adjustedGrossIncome 200000)) (= ctcPhaseoutApplies true)))",
    description: "CTC phases out for single filers with AGI over $200,000",
    statutoryCitation: "26 U.S.C. § 24(b)(1)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "CTC Income Phaseout - Married Joint",
    eligibilityDomain: "ctc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (and (= filingStatus \"married_joint\") (> adjustedGrossIncome 400000)) (= ctcPhaseoutApplies true)))",
    description: "CTC phases out for married filing jointly with AGI over $400,000",
    statutoryCitation: "26 U.S.C. § 24(b)(1)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "CTC Refundable Portion - ACTC",
    eligibilityDomain: "ctc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (> earnedIncome 2500) (<= additionalChildTaxCredit 1700)))",
    description: "Refundable Additional CTC up to $1,700 per child if earned income exceeds $2,500",
    statutoryCitation: "26 U.S.C. § 24(d)(1)(B)(i)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "CTC SSN Requirement",
    eligibilityDomain: "ctc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (> ctcQualifyingChildren 0) (= childHasSSN true)))",
    description: "Qualifying child must have valid Social Security Number for CTC",
    statutoryCitation: "26 U.S.C. § 24(h)(7)",
    isValid: true,
    status: "approved"
  },
  // Maryland State EITC
  {
    ruleName: "Maryland State EITC",
    eligibilityDomain: "md_eitc",
    ruleType: "requirement",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (> federalEITC 0) (= eligibleForMarylandEITC true)))",
    description: "Maryland EITC equals percentage of federal EITC for those who qualify federally",
    statutoryCitation: "Md. Tax-General Code Ann. § 10-704",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Maryland State EITC Percentage - With Children",
    eligibilityDomain: "md_eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (and (> qualifyingChildren 0) (= eligibleForMarylandEITC true)) (= mdEITCRate 0.45)))",
    description: "Maryland EITC is 45% of federal EITC for filers with qualifying children",
    statutoryCitation: "Md. Tax-General Code Ann. § 10-704(b)",
    isValid: true,
    status: "approved"
  },
  {
    ruleName: "Maryland State EITC Percentage - No Children",
    eligibilityDomain: "md_eitc",
    ruleType: "threshold",
    stateCode: "MD",
    programCode: "TAX",
    z3Logic: "(assert (=> (and (= qualifyingChildren 0) (= eligibleForMarylandEITC true)) (= mdEITCRate 1.00)))",
    description: "Maryland EITC is 100% of federal EITC (refundable) for filers without children",
    statutoryCitation: "Md. Tax-General Code Ann. § 10-704(b)(2)",
    isValid: true,
    status: "approved"
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

  private async seedZ3FormalRules(): Promise<{ total: number; byProgram: Record<string, number> }> {
    let rulesInserted = 0;
    const byProgram: Record<string, number> = {};

    // Combine all formal Z3 rules from all programs
    const allRules = [
      ...SNAP_Z3_RULES,
      ...SSI_Z3_RULES,
      ...MEDICAID_Z3_RULES,
      ...TANF_Z3_RULES,
      ...OHEP_Z3_RULES,
      ...TAX_CREDIT_Z3_RULES
    ];

    for (const rule of allRules) {
      const existing = await db.select().from(formalRules)
        .where(eq(formalRules.ruleName, rule.ruleName)).limit(1);

      if (existing.length === 0) {
        await db.insert(formalRules).values({
          ruleName: rule.ruleName,
          eligibilityDomain: rule.eligibilityDomain,
          ruleType: rule.ruleType,
          stateCode: rule.stateCode || "MD",
          programCode: rule.programCode || "GENERAL",
          z3Logic: rule.z3Logic,
          description: rule.description,
          statutoryCitation: rule.statutoryCitation,
          promptingStrategy: "directed_symbolic",
          isVerified: true,
          isValid: rule.isValid ?? true,
          status: rule.status || "approved",
          extractedAt: new Date()
        });
        rulesInserted++;
        
        // Track by program
        const program = rule.programCode || "GENERAL";
        byProgram[program] = (byProgram[program] || 0) + 1;
      }
    }

    logger.info(`Seeded ${rulesInserted} formal Z3 rules`, byProgram);
    return { total: rulesInserted, byProgram };
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
