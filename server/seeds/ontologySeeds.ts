import { legalOntologyService, OntologyDomain } from "../services/legalOntologyService";
import { logger } from "../services/logger.service";

interface TermSeed {
  termName: string;
  domain: OntologyDomain;
  definition: string;
  synonyms?: string[];
  statutoryCitation?: string;
}

interface RelationshipSeed {
  fromTermName: string;
  toTermName: string;
  type: "is_a" | "has_property" | "requires" | "implies" | "excludes" | "depends_on" | "constrains" | "part_of" | "equivalent_to";
  description?: string;
}

const MARYLAND_SNAP_TERMS: TermSeed[] = [
  {
    termName: "Gross Income",
    domain: "income",
    definition: "Total household income before any deductions, including earnings, self-employment income, and unearned income such as Social Security, pensions, and child support",
    synonyms: ["total income", "before-deduction income"],
    statutoryCitation: "COMAR 07.03.17.04"
  },
  {
    termName: "Net Income",
    domain: "income",
    definition: "Gross income minus allowable deductions including standard deduction, earned income deduction, dependent care costs, and shelter costs",
    synonyms: ["adjusted income", "after-deduction income"],
    statutoryCitation: "COMAR 07.03.17.05"
  },
  {
    termName: "Earned Income",
    domain: "income",
    definition: "Income from wages, salaries, commissions, self-employment, or training allowances",
    synonyms: ["employment income", "work income"],
    statutoryCitation: "COMAR 07.03.17.04A"
  },
  {
    termName: "Unearned Income",
    domain: "income",
    definition: "Income not derived from employment including Social Security, SSI, VA benefits, pensions, unemployment, child support, and alimony",
    synonyms: ["passive income", "benefit income"],
    statutoryCitation: "COMAR 07.03.17.04B"
  },
  {
    termName: "Standard Deduction",
    domain: "deductions",
    definition: "A flat deduction amount applied to all SNAP households based on household size",
    statutoryCitation: "COMAR 07.03.17.05A"
  },
  {
    termName: "Shelter Deduction",
    domain: "deductions",
    definition: "Deduction for housing costs exceeding 50% of income after other deductions, including rent, mortgage, property taxes, and utilities",
    synonyms: ["housing deduction", "excess shelter cost"],
    statutoryCitation: "COMAR 07.03.17.05D"
  },
  {
    termName: "Dependent Care Deduction",
    domain: "deductions",
    definition: "Deduction for out-of-pocket costs for care of a child or disabled adult when necessary for a household member to work or attend training",
    synonyms: ["childcare deduction", "care costs"],
    statutoryCitation: "COMAR 07.03.17.05B"
  },
  {
    termName: "Household Size",
    domain: "household_composition",
    definition: "Number of individuals who live together and customarily purchase and prepare meals together",
    synonyms: ["family size", "unit size"],
    statutoryCitation: "COMAR 07.03.17.03"
  },
  {
    termName: "Filing Unit",
    domain: "household_composition",
    definition: "Group of individuals whose income and resources are considered together for SNAP eligibility",
    synonyms: ["assistance unit", "benefit unit"],
    statutoryCitation: "COMAR 07.03.17.03A"
  },
  {
    termName: "Categorical Eligibility",
    domain: "categorical_eligibility",
    definition: "Automatic SNAP eligibility based on receipt of TANF, SSI, or general assistance benefits",
    synonyms: ["automatic eligibility", "cat-el"],
    statutoryCitation: "COMAR 07.03.17.02A"
  },
  {
    termName: "Broad-Based Categorical Eligibility",
    domain: "categorical_eligibility",
    definition: "Extended eligibility for households with gross income up to 200% FPL who receive a TANF-funded service",
    synonyms: ["BBCE", "expanded eligibility"],
    statutoryCitation: "COMAR 07.03.17.02B"
  },
  {
    termName: "Resource Limit",
    domain: "assets",
    definition: "Maximum countable assets a household may have to qualify for SNAP, excluding primary residence and certain retirement accounts",
    synonyms: ["asset limit", "resource ceiling"],
    statutoryCitation: "COMAR 07.03.17.06"
  },
  {
    termName: "Able-Bodied Adult Without Dependents",
    domain: "work_requirement",
    definition: "Adults aged 18-49 without disabilities or dependents who must meet work requirements to receive SNAP beyond 3 months in a 36-month period",
    synonyms: ["ABAWD", "work-eligible adult"],
    statutoryCitation: "COMAR 07.03.17.08"
  },
  {
    termName: "Work Registration Requirement",
    domain: "work_requirement",
    definition: "Requirement for non-exempt adults to register for work and accept suitable employment",
    synonyms: ["employment requirement", "work search"],
    statutoryCitation: "COMAR 07.03.17.07"
  },
  {
    termName: "Residency Requirement",
    domain: "residency",
    definition: "Requirement that applicant live in Maryland with intent to remain",
    synonyms: ["state residence", "domicile requirement"],
    statutoryCitation: "COMAR 07.03.17.02C"
  },
  {
    termName: "Citizenship Status",
    domain: "citizenship",
    definition: "Immigration status determining eligibility for SNAP, including US citizens, qualified aliens, and refugees",
    synonyms: ["immigration status", "legal status"],
    statutoryCitation: "COMAR 07.03.17.02D"
  },
  {
    termName: "Verification Documents",
    domain: "verification",
    definition: "Documentation required to verify income, identity, residency, and other eligibility factors",
    synonyms: ["proof documents", "supporting documentation"],
    statutoryCitation: "COMAR 07.03.17.09"
  },
  {
    termName: "Income Verification",
    domain: "verification",
    definition: "Process of confirming household income through pay stubs, employer statements, tax returns, or benefit letters",
    synonyms: ["income proof", "earnings verification"],
    statutoryCitation: "COMAR 07.03.17.09A"
  },
  {
    termName: "Federal Poverty Level",
    domain: "income",
    definition: "Income thresholds set annually by HHS used to determine eligibility for SNAP and other programs",
    synonyms: ["FPL", "poverty guidelines"],
    statutoryCitation: "7 CFR 273.9"
  },
  {
    termName: "Elderly or Disabled Household",
    domain: "household_composition",
    definition: "Household containing a member age 60+ or receiving disability benefits, subject to net income test only",
    synonyms: ["senior household", "disabled household"],
    statutoryCitation: "COMAR 07.03.17.02E"
  }
];

const SNAP_FEDERAL_REGULATION_TERMS: TermSeed[] = [
  // 7 CFR § 273.7 - Work Registration and E&T
  {
    termName: "Work Registration",
    domain: "employment_training",
    definition: "Requirement for non-exempt household members aged 16-59 to register for work as a condition of SNAP eligibility",
    synonyms: ["work requirement", "employment registration"],
    statutoryCitation: "7 CFR § 273.7(a)"
  },
  {
    termName: "Employment and Training Program",
    domain: "employment_training",
    definition: "State-administered program providing employment services, training, and support to SNAP participants",
    synonyms: ["E&T", "SNAP E&T", "employment program"],
    statutoryCitation: "7 CFR § 273.7(c)"
  },
  {
    termName: "Voluntary Quit",
    domain: "employment_training",
    definition: "Voluntarily leaving employment without good cause, which may result in disqualification from SNAP",
    synonyms: ["job quit", "resignation without cause"],
    statutoryCitation: "7 CFR § 273.7(j)"
  },
  {
    termName: "Good Cause for Noncompliance",
    domain: "employment_training",
    definition: "Acceptable reasons for failure to meet work requirements including illness, lack of transportation, domestic violence, or care of incapacitated household member",
    synonyms: ["good cause", "acceptable noncompliance"],
    statutoryCitation: "7 CFR § 273.7(i)"
  },
  {
    termName: "Work Registration Exemption",
    domain: "employment_training",
    definition: "Categories of individuals exempt from work registration including those under 16, over 59, disabled, caring for dependent, or enrolled in school",
    synonyms: ["work exemption", "registration exemption"],
    statutoryCitation: "7 CFR § 273.7(b)"
  },
  {
    termName: "E&T Component",
    domain: "employment_training",
    definition: "Specific activity within E&T program such as job search, job search training, workfare, education, or vocational training",
    synonyms: ["training component", "E&T activity"],
    statutoryCitation: "7 CFR § 273.7(e)"
  },
  
  // 7 CFR § 273.12 - Change Reporting
  {
    termName: "Change Reporting",
    domain: "change_reporting",
    definition: "Requirement for households to report changes in circumstances that may affect SNAP eligibility or benefit amount",
    synonyms: ["reporting requirement", "household changes"],
    statutoryCitation: "7 CFR § 273.12(a)"
  },
  {
    termName: "10-Day Reporting Rule",
    domain: "change_reporting",
    definition: "Requirement to report specified changes within 10 days of when the change becomes known to the household",
    synonyms: ["timely reporting", "10-day notice"],
    statutoryCitation: "7 CFR § 273.12(a)(1)"
  },
  {
    termName: "Simplified Reporting",
    domain: "change_reporting",
    definition: "Reduced reporting requirement where household only reports income exceeding 130% FPL, changes in work hours below 20 per week for ABAWDs, and address changes",
    synonyms: ["SR", "reduced reporting"],
    statutoryCitation: "7 CFR § 273.12(a)(5)"
  },
  {
    termName: "Interim Report",
    domain: "change_reporting",
    definition: "Required periodic report between certification periods to update household information",
    synonyms: ["periodic report", "mid-certification report"],
    statutoryCitation: "7 CFR § 273.12(a)(5)(iii)"
  },
  {
    termName: "Reportable Change",
    domain: "change_reporting",
    definition: "Changes households must report including income changes, household composition, address, and work status",
    synonyms: ["required change", "mandatory report"],
    statutoryCitation: "7 CFR § 273.12(a)(1)"
  },
  
  // 7 CFR § 273.13 - Adverse Action Notice
  {
    termName: "Adverse Action Notice",
    domain: "due_process",
    definition: "Written notification required before reducing or terminating SNAP benefits, stating the action, reasons, and appeal rights",
    synonyms: ["notice of adverse action", "reduction notice"],
    statutoryCitation: "7 CFR § 273.13(a)"
  },
  {
    termName: "10-Day Advance Notice",
    domain: "due_process",
    definition: "Requirement to provide adverse action notice at least 10 days before the effective date of the action",
    synonyms: ["advance notice requirement", "timely notice"],
    statutoryCitation: "7 CFR § 273.13(a)(1)"
  },
  {
    termName: "Notice Content Requirements",
    domain: "due_process",
    definition: "Required elements of adverse action notice including proposed action, reason, regulation citation, right to hearing, and how to request hearing",
    synonyms: ["required notice elements", "notice contents"],
    statutoryCitation: "7 CFR § 273.13(a)(2)"
  },
  {
    termName: "Mass Change Notice",
    domain: "due_process",
    definition: "Abbreviated notice permitted when benefits change due to federal or state law affecting large numbers of households",
    synonyms: ["general notice", "legislative change notice"],
    statutoryCitation: "7 CFR § 273.13(b)"
  },
  {
    termName: "Shortened Notice Period",
    domain: "due_process",
    definition: "Circumstances allowing less than 10 days notice including household request, factual determination, or mass changes",
    synonyms: ["expedited action", "reduced notice"],
    statutoryCitation: "7 CFR § 273.13(a)(3)"
  },
  
  // 7 CFR § 273.14 - Recertification
  {
    termName: "Recertification",
    domain: "recertification",
    definition: "Periodic review of household eligibility and benefit amount at the end of each certification period",
    synonyms: ["renewal", "eligibility review"],
    statutoryCitation: "7 CFR § 273.14(a)"
  },
  {
    termName: "Certification Period",
    domain: "recertification",
    definition: "Length of time for which household is certified to receive SNAP, ranging from 1-24 months depending on circumstances",
    synonyms: ["benefit period", "eligibility period"],
    statutoryCitation: "7 CFR § 273.10(f)"
  },
  {
    termName: "Recertification Application",
    domain: "recertification",
    definition: "Form submitted by household to continue SNAP benefits at the end of certification period",
    synonyms: ["renewal application", "recert form"],
    statutoryCitation: "7 CFR § 273.14(b)"
  },
  {
    termName: "Recertification Interview",
    domain: "recertification",
    definition: "Interview conducted with household as part of recertification process, may be waived for elderly/disabled households",
    synonyms: ["renewal interview", "recert interview"],
    statutoryCitation: "7 CFR § 273.14(b)(3)"
  },
  {
    termName: "Timely Recertification",
    domain: "recertification",
    definition: "Completion of recertification before the end of certification period ensuring no gap in benefits",
    synonyms: ["on-time renewal", "continuous benefits"],
    statutoryCitation: "7 CFR § 273.14(d)"
  },
  {
    termName: "Extended Certification Period",
    domain: "recertification",
    definition: "Longer certification periods of 12-24 months assigned to elderly/disabled households with stable circumstances",
    synonyms: ["extended period", "long certification"],
    statutoryCitation: "7 CFR § 273.10(f)(4)"
  },
  
  // 7 CFR § 273.15 - Fair Hearing Rights
  {
    termName: "Fair Hearing",
    domain: "due_process",
    definition: "Administrative hearing to challenge SNAP agency action, decision, or failure to act",
    synonyms: ["administrative hearing", "appeal hearing"],
    statutoryCitation: "7 CFR § 273.15(a)"
  },
  {
    termName: "Hearing Request",
    domain: "due_process",
    definition: "Formal request by household to receive a fair hearing on agency action",
    synonyms: ["appeal request", "hearing application"],
    statutoryCitation: "7 CFR § 273.15(g)"
  },
  {
    termName: "90-Day Filing Period",
    domain: "due_process",
    definition: "Time limit of 90 days from agency action within which household must request a fair hearing",
    synonyms: ["appeal deadline", "filing deadline"],
    statutoryCitation: "7 CFR § 273.15(g)"
  },
  {
    termName: "Continuation of Benefits Pending Appeal",
    domain: "due_process",
    definition: "Right to continue receiving benefits at previous level during fair hearing process if requested within advance notice period",
    synonyms: ["continued benefits", "pending appeal benefits"],
    statutoryCitation: "7 CFR § 273.15(k)"
  },
  {
    termName: "Hearing Decision Timeframe",
    domain: "due_process",
    definition: "Requirement for hearing authority to issue decision within 60 days of hearing request, or 30 days for expedited hearings",
    synonyms: ["decision deadline", "hearing timeline"],
    statutoryCitation: "7 CFR § 273.15(c)"
  },
  {
    termName: "Impartial Hearing Official",
    domain: "due_process",
    definition: "Official who conducts fair hearings and was not involved in the action being appealed",
    synonyms: ["hearing officer", "administrative law judge"],
    statutoryCitation: "7 CFR § 273.15(e)"
  },
  {
    termName: "Right to Examine Case File",
    domain: "due_process",
    definition: "Household right to review and copy documents in their case file prior to and during fair hearing",
    synonyms: ["file access", "record review"],
    statutoryCitation: "7 CFR § 273.15(p)"
  },
  
  // 7 CFR § 273.16 - Disqualification for Intentional Program Violation
  {
    termName: "Intentional Program Violation",
    domain: "disqualification",
    definition: "Intentional false or misleading statement, misrepresentation, concealment, or withholding of facts to obtain SNAP benefits",
    synonyms: ["IPV", "SNAP fraud", "program violation"],
    statutoryCitation: "7 CFR § 273.16(a)"
  },
  {
    termName: "IPV Disqualification Period - First Offense",
    domain: "disqualification",
    definition: "12-month disqualification from SNAP for first intentional program violation",
    synonyms: ["first offense penalty", "12-month disqualification"],
    statutoryCitation: "7 CFR § 273.16(b)(1)"
  },
  {
    termName: "IPV Disqualification Period - Second Offense",
    domain: "disqualification",
    definition: "24-month disqualification from SNAP for second intentional program violation",
    synonyms: ["second offense penalty", "24-month disqualification"],
    statutoryCitation: "7 CFR § 273.16(b)(2)"
  },
  {
    termName: "IPV Disqualification Period - Third Offense",
    domain: "disqualification",
    definition: "Permanent disqualification from SNAP for third intentional program violation",
    synonyms: ["permanent disqualification", "lifetime ban"],
    statutoryCitation: "7 CFR § 273.16(b)(3)"
  },
  {
    termName: "Administrative Disqualification Hearing",
    domain: "disqualification",
    definition: "Hearing to determine whether household member committed intentional program violation",
    synonyms: ["ADH", "IPV hearing"],
    statutoryCitation: "7 CFR § 273.16(e)"
  },
  {
    termName: "Disqualification Waiver",
    domain: "disqualification",
    definition: "Written waiver of right to administrative disqualification hearing signed by household member admitting IPV",
    synonyms: ["IPV waiver", "hearing waiver"],
    statutoryCitation: "7 CFR § 273.16(f)"
  },
  {
    termName: "Trafficking Disqualification",
    domain: "disqualification",
    definition: "Permanent disqualification for first offense of trafficking SNAP benefits for drugs or weapons, or trafficking $500+ in benefits",
    synonyms: ["trafficking penalty", "EBT trafficking ban"],
    statutoryCitation: "7 CFR § 273.16(b)(4)"
  },
  
  // 7 CFR § 273.18 - Claims Against Households
  {
    termName: "SNAP Claim",
    domain: "claims_recovery",
    definition: "Demand for repayment of benefits obtained through intentional program violation, inadvertent household error, or agency error",
    synonyms: ["overpayment claim", "benefit recovery"],
    statutoryCitation: "7 CFR § 273.18(a)"
  },
  {
    termName: "IPV Claim",
    domain: "claims_recovery",
    definition: "Claim for overissuance caused by intentional program violation, not subject to any dollar threshold for establishment",
    synonyms: ["fraud claim", "intentional violation claim"],
    statutoryCitation: "7 CFR § 273.18(c)(1)"
  },
  {
    termName: "Inadvertent Household Error Claim",
    domain: "claims_recovery",
    definition: "Claim for overissuance caused by household's unintentional failure to provide correct information",
    synonyms: ["IHE claim", "household error claim"],
    statutoryCitation: "7 CFR § 273.18(c)(2)"
  },
  {
    termName: "Agency Error Claim",
    domain: "claims_recovery",
    definition: "Claim for overissuance caused by agency action or failure to act that results in incorrect payment",
    synonyms: ["AE claim", "administrative error claim"],
    statutoryCitation: "7 CFR § 273.18(c)(3)"
  },
  {
    termName: "Allotment Reduction",
    domain: "claims_recovery",
    definition: "Collection method reducing current SNAP benefits to recover claim, not to exceed greater of 10% of allotment or $10/month",
    synonyms: ["benefit offset", "monthly reduction"],
    statutoryCitation: "7 CFR § 273.18(g)(1)"
  },
  {
    termName: "Claim Compromise",
    domain: "claims_recovery",
    definition: "State agency authority to reduce or terminate collection of a claim when full collection is not cost-effective",
    synonyms: ["claim settlement", "debt compromise"],
    statutoryCitation: "7 CFR § 273.18(e)(7)"
  },
  {
    termName: "Treasury Offset",
    domain: "claims_recovery",
    definition: "Federal collection mechanism reducing federal payments (tax refunds, Social Security) to recover delinquent SNAP claims",
    synonyms: ["TOP", "federal offset"],
    statutoryCitation: "7 CFR § 273.18(g)(9)"
  },
  {
    termName: "Claim Collection Rate",
    domain: "claims_recovery",
    definition: "Percentage of SNAP claims successfully recovered by state agency, used as performance measure",
    synonyms: ["recovery rate", "collection percentage"],
    statutoryCitation: "7 CFR § 273.18(k)"
  }
];

const MARYLAND_MEDICAID_TERMS: TermSeed[] = [
  {
    termName: "Modified Adjusted Gross Income",
    domain: "income",
    definition: "Income methodology used for most Medicaid eligibility groups, based on federal tax rules with specific additions",
    synonyms: ["MAGI", "ACA income methodology"],
    statutoryCitation: "COMAR 10.09.24.05"
  },
  {
    termName: "Family Size",
    domain: "household_composition",
    definition: "Number of individuals included in MAGI household for Medicaid purposes, based on tax filing status",
    synonyms: ["household size", "tax household"],
    statutoryCitation: "COMAR 10.09.24.04"
  },
  {
    termName: "Income Disregard",
    domain: "income",
    definition: "Amount of income excluded from consideration for Medicaid eligibility, typically 5% of FPL",
    synonyms: ["income exclusion", "5% disregard"],
    statutoryCitation: "COMAR 10.09.24.05A"
  },
  {
    termName: "Medicaid Expansion",
    domain: "categorical_eligibility",
    definition: "ACA expansion extending Medicaid to adults aged 19-64 with income up to 138% FPL",
    synonyms: ["ACA expansion", "adult expansion"],
    statutoryCitation: "COMAR 10.09.24.03"
  },
  {
    termName: "Maryland Children's Health Program",
    domain: "categorical_eligibility",
    definition: "Medicaid coverage for children with household income above Medicaid limits but at or below 300% FPL",
    synonyms: ["MCHP", "children's Medicaid"],
    statutoryCitation: "COMAR 10.09.24.06"
  },
  {
    termName: "Continuous Eligibility",
    domain: "household_composition",
    definition: "12-month coverage period during which changes in income do not affect eligibility until renewal",
    synonyms: ["continuous coverage", "12-month enrollment"],
    statutoryCitation: "COMAR 10.09.24.08"
  },
  {
    termName: "Presumptive Eligibility",
    domain: "categorical_eligibility",
    definition: "Temporary Medicaid coverage while full application is processed, available for pregnant women and children",
    synonyms: ["PE", "temporary coverage"],
    statutoryCitation: "COMAR 10.09.24.07"
  },
  {
    termName: "Qualified Health Beneficiary",
    domain: "categorical_eligibility",
    definition: "Medicare beneficiaries who qualify for Medicaid payment of Medicare premiums",
    synonyms: ["QMB", "Medicare Savings Program"],
    statutoryCitation: "COMAR 10.09.24.09"
  },
  {
    termName: "Asset Test Exemption",
    domain: "assets",
    definition: "MAGI-based Medicaid groups are exempt from asset/resource tests",
    synonyms: ["no asset limit", "resource test waiver"],
    statutoryCitation: "COMAR 10.09.24.05B"
  },
  {
    termName: "Pregnancy Coverage",
    domain: "categorical_eligibility",
    definition: "Medicaid coverage for pregnant women with income up to 264% FPL",
    synonyms: ["prenatal coverage", "maternal care"],
    statutoryCitation: "COMAR 10.09.24.06A"
  }
];

const MARYLAND_TANF_TERMS: TermSeed[] = [
  {
    termName: "Temporary Cash Assistance",
    domain: "categorical_eligibility",
    definition: "Maryland's TANF cash assistance program providing monthly benefits to eligible families with children",
    synonyms: ["TCA", "TANF cash", "cash assistance"],
    statutoryCitation: "COMAR 07.03.03.01"
  },
  {
    termName: "Time Limit",
    domain: "time_limits",
    definition: "Maximum 60 cumulative months of federal TANF benefits for adults, with hardship extensions available",
    synonyms: ["benefit duration", "60-month limit"],
    statutoryCitation: "COMAR 07.03.03.12"
  },
  {
    termName: "Work Participation Rate",
    domain: "work_requirement",
    definition: "Percentage of TANF recipients engaged in countable work activities to meet federal requirements",
    synonyms: ["WPR", "participation requirement"],
    statutoryCitation: "COMAR 07.03.03.10"
  },
  {
    termName: "Countable Work Activity",
    domain: "work_requirement",
    definition: "Activities that count toward TANF work requirements including employment, job search, education, and training",
    synonyms: ["work activity", "participation activity"],
    statutoryCitation: "COMAR 07.03.03.10A"
  },
  {
    termName: "Child-Only Case",
    domain: "household_composition",
    definition: "TANF case where only children receive benefits because adult is ineligible due to immigration status or SSI receipt",
    synonyms: ["child-only grant", "non-parent case"],
    statutoryCitation: "COMAR 07.03.03.04"
  },
  {
    termName: "Deprivation Requirement",
    domain: "household_composition",
    definition: "Child must be deprived of parental support due to absence, death, incapacity, or unemployment of parent",
    synonyms: ["parental deprivation", "eligibility factor"],
    statutoryCitation: "COMAR 07.03.03.03"
  },
  {
    termName: "Grant Amount",
    domain: "income",
    definition: "Monthly TCA benefit calculated based on family size, income, and shelter costs",
    synonyms: ["benefit amount", "monthly payment"],
    statutoryCitation: "COMAR 07.03.03.06"
  },
  {
    termName: "Sanction",
    domain: "work_requirement",
    definition: "Reduction or termination of benefits due to non-compliance with work requirements or program rules",
    synonyms: ["penalty", "benefit reduction"],
    statutoryCitation: "COMAR 07.03.03.11"
  },
  {
    termName: "Good Cause Exemption",
    domain: "work_requirement",
    definition: "Circumstances excusing non-compliance with work requirements such as domestic violence, illness, or lack of childcare",
    synonyms: ["exemption", "good cause"],
    statutoryCitation: "COMAR 07.03.03.10B"
  },
  {
    termName: "Family Investment Program",
    domain: "work_requirement",
    definition: "Maryland's employment and training program for TANF recipients",
    synonyms: ["FIP", "TANF employment program"],
    statutoryCitation: "COMAR 07.03.03.10"
  }
];

const MARYLAND_OHEP_TERMS: TermSeed[] = [
  {
    termName: "Office of Home Energy Programs",
    domain: "categorical_eligibility",
    definition: "Maryland program providing energy assistance to low-income households for heating and cooling costs",
    synonyms: ["OHEP", "energy assistance", "MEAP"],
    statutoryCitation: "COMAR 07.03.20.01"
  },
  {
    termName: "MEAP Grant",
    domain: "income",
    definition: "Maryland Energy Assistance Program grant for heating fuel costs, amount based on income and household size",
    synonyms: ["heating assistance", "fuel grant"],
    statutoryCitation: "COMAR 07.03.20.05"
  },
  {
    termName: "EUSP Grant",
    domain: "income",
    definition: "Electric Universal Service Program grant for electric utility bills",
    synonyms: ["electric assistance", "utility grant"],
    statutoryCitation: "COMAR 07.03.20.06"
  },
  {
    termName: "Arrearage Retirement",
    domain: "deductions",
    definition: "One-time assistance to pay off past-due utility bills to prevent disconnection",
    synonyms: ["past-due assistance", "arrearage payment"],
    statutoryCitation: "COMAR 07.03.20.07"
  },
  {
    termName: "LIHEAP Income Limit",
    domain: "income",
    definition: "Income threshold for Low Income Home Energy Assistance Program set at 175% of federal poverty level",
    synonyms: ["income limit", "LIHEAP eligibility"],
    statutoryCitation: "COMAR 07.03.20.04"
  },
  {
    termName: "Heating Season",
    domain: "time_limits",
    definition: "Period from November 1 through March 31 when OHEP benefits are primarily available",
    synonyms: ["winter season", "benefit period"],
    statutoryCitation: "COMAR 07.03.20.02"
  },
  {
    termName: "Cooling Assistance",
    domain: "categorical_eligibility",
    definition: "Summer cooling assistance for elderly and disabled households when temperatures exceed threshold",
    synonyms: ["summer cooling", "air conditioning assistance"],
    statutoryCitation: "COMAR 07.03.20.08"
  },
  {
    termName: "Crisis Assistance",
    domain: "categorical_eligibility",
    definition: "Emergency energy assistance for households facing utility shutoff or fuel emergency",
    synonyms: ["emergency assistance", "crisis grant"],
    statutoryCitation: "COMAR 07.03.20.09"
  },
  {
    termName: "Vulnerable Household",
    domain: "household_composition",
    definition: "Household containing elderly member, disabled member, or child under 6, receiving priority for OHEP services",
    synonyms: ["priority household", "at-risk household"],
    statutoryCitation: "COMAR 07.03.20.03"
  },
  {
    termName: "Bill Payment Agreement",
    domain: "verification",
    definition: "Plan with utility company to pay current charges plus arrearage amount over time",
    synonyms: ["payment plan", "utility agreement"],
    statutoryCitation: "COMAR 07.03.20.07A"
  }
];

// VITA Tax Ontology Terms - Federal and State
const VITA_TAX_TERMS: TermSeed[] = [
  // Federal Income Tax Terms
  {
    termName: "Taxable Income",
    domain: "income",
    definition: "Gross income minus allowable deductions and exemptions, the amount subject to federal income tax rates",
    synonyms: ["tax base", "net taxable income"],
    statutoryCitation: "26 U.S.C. § 63"
  },
  {
    termName: "Adjusted Gross Income",
    domain: "income",
    definition: "Total income from all sources minus above-the-line deductions such as educator expenses, student loan interest, and self-employment tax deduction",
    synonyms: ["AGI", "adjusted income"],
    statutoryCitation: "26 U.S.C. § 62"
  },
  {
    termName: "Standard Deduction",
    domain: "deductions",
    definition: "A flat dollar amount that reduces taxable income, varying by filing status: single ($14,600), married filing jointly ($29,200), head of household ($21,900) for 2024",
    synonyms: ["basic deduction", "automatic deduction"],
    statutoryCitation: "26 U.S.C. § 63(c)"
  },
  {
    termName: "Filing Status",
    domain: "household_composition",
    definition: "Tax classification based on marital status and family situation: single, married filing jointly, married filing separately, head of household, or qualifying widow(er)",
    synonyms: ["tax status", "filing category"],
    statutoryCitation: "26 U.S.C. § 1"
  },
  {
    termName: "Earned Income Tax Credit",
    domain: "income",
    definition: "Refundable federal tax credit for low-to-moderate income workers, calculated based on earned income, filing status, and number of qualifying children",
    synonyms: ["EITC", "EIC", "earned income credit"],
    statutoryCitation: "26 U.S.C. § 32"
  },
  {
    termName: "Child Tax Credit",
    domain: "income",
    definition: "Tax credit of $2,000 per qualifying child under age 17, partially refundable up to $1,700 as Additional Child Tax Credit (ACTC)",
    synonyms: ["CTC", "child credit"],
    statutoryCitation: "26 U.S.C. § 24"
  },
  {
    termName: "Additional Child Tax Credit",
    domain: "income",
    definition: "The refundable portion of the Child Tax Credit, up to $1,700 per qualifying child for taxpayers with earned income",
    synonyms: ["ACTC", "refundable CTC"],
    statutoryCitation: "26 U.S.C. § 24(h)"
  },
  {
    termName: "Qualifying Child",
    domain: "household_composition",
    definition: "A child who meets relationship, age, residency, support, and joint return tests for claiming tax credits",
    synonyms: ["eligible child", "dependent child"],
    statutoryCitation: "26 U.S.C. § 152(c)"
  },
  {
    termName: "Self-Employment Income",
    domain: "income",
    definition: "Net earnings from operating a trade or business as a sole proprietor, independent contractor, or member of a partnership",
    synonyms: ["business income", "Schedule C income"],
    statutoryCitation: "26 U.S.C. § 1402"
  },
  {
    termName: "Self-Employment Tax",
    domain: "income",
    definition: "Tax on self-employment earnings consisting of 12.4% Social Security and 2.9% Medicare (15.3% total) on net self-employment income",
    synonyms: ["SE tax", "FICA for self-employed"],
    statutoryCitation: "26 U.S.C. § 1401"
  },
  {
    termName: "American Opportunity Credit",
    domain: "deductions",
    definition: "Education tax credit of up to $2,500 per student for first four years of post-secondary education, 40% refundable (max $1,000)",
    synonyms: ["AOC", "college credit"],
    statutoryCitation: "26 U.S.C. § 25A(b)"
  },
  {
    termName: "Lifetime Learning Credit",
    domain: "deductions",
    definition: "Non-refundable education tax credit of up to $2,000 per return for qualified education expenses",
    synonyms: ["LLC", "continuing education credit"],
    statutoryCitation: "26 U.S.C. § 25A(c)"
  },
  
  // Maryland State Tax Terms
  {
    termName: "Maryland Earned Income Tax Credit",
    domain: "income",
    definition: "Maryland state credit equal to 50% of federal EITC (refundable) or 100% (non-refundable) for qualifying residents",
    synonyms: ["MD EITC", "Maryland earned income credit"],
    statutoryCitation: "MD Tax-General § 10-701"
  },
  {
    termName: "Maryland Child Tax Credit",
    domain: "income",
    definition: "Maryland state credit for qualifying children, providing additional refundable credit beyond federal CTC",
    synonyms: ["MD CTC", "Maryland child credit"],
    statutoryCitation: "MD Tax-General § 10-751"
  },
  {
    termName: "County Income Tax",
    domain: "income",
    definition: "Local income tax imposed by Maryland counties and Baltimore City, ranging from 2.25% to 3.20% of Maryland taxable income",
    synonyms: ["local tax", "piggyback tax"],
    statutoryCitation: "COMAR 03.04.07"
  },
  
  // Pennsylvania State Tax Terms
  {
    termName: "Pennsylvania Flat Tax",
    domain: "income",
    definition: "Pennsylvania personal income tax at flat rate of 3.07% on eight classes of income: compensation, net profits, interest, dividends, rents, royalties, patents, and gambling winnings",
    synonyms: ["PA PIT", "Pennsylvania income tax"],
    statutoryCitation: "72 P.S. § 7302"
  },
  {
    termName: "Tax Forgiveness Credit",
    domain: "deductions",
    definition: "Pennsylvania credit that reduces or eliminates tax liability for low-income taxpayers based on eligibility income and family size",
    synonyms: ["PA tax forgiveness", "poverty exemption"],
    statutoryCitation: "72 P.S. § 7314"
  },
  {
    termName: "Property Tax Rent Rebate",
    domain: "deductions",
    definition: "Pennsylvania rebate program for eligible seniors, widows/widowers, and persons with disabilities on property taxes or rent paid",
    synonyms: ["PTRR", "PA-1000 rebate"],
    statutoryCitation: "72 P.S. § 8701-F"
  },
  
  // Virginia State Tax Terms
  {
    termName: "Virginia Graduated Tax",
    domain: "income",
    definition: "Virginia income tax with rates of 2%, 3%, 5%, and 5.75% on graduated income brackets",
    synonyms: ["VA income tax", "Virginia state tax"],
    statutoryCitation: "Va. Code § 58.1-320"
  },
  {
    termName: "Virginia EITC",
    domain: "income",
    definition: "Virginia earned income tax credit equal to 20% of federal EITC, fully refundable",
    synonyms: ["VA EITC", "Virginia earned income credit"],
    statutoryCitation: "Va. Code § 58.1-339.8"
  },
  
  // Utah State Tax Terms
  {
    termName: "Utah Flat Tax",
    domain: "income",
    definition: "Utah individual income tax at flat rate of 4.65% on Utah taxable income",
    synonyms: ["UT income tax", "Utah state tax"],
    statutoryCitation: "Utah Code § 59-10-104"
  },
  {
    termName: "Utah EITC",
    domain: "income",
    definition: "Utah earned income tax credit equal to 20% of federal EITC, non-refundable",
    synonyms: ["UT EITC", "Utah earned income credit"],
    statutoryCitation: "Utah Code § 59-10-1017"
  }
];

const VITA_TAX_RELATIONSHIPS: RelationshipSeed[] = [
  // Income calculation flow
  { fromTermName: "Taxable Income", toTermName: "Adjusted Gross Income", type: "depends_on", description: "Taxable income is calculated from AGI minus deductions" },
  { fromTermName: "Adjusted Gross Income", toTermName: "Self-Employment Income", type: "part_of", description: "Self-employment income is a component of AGI" },
  { fromTermName: "Standard Deduction", toTermName: "Taxable Income", type: "constrains", description: "Standard deduction reduces taxable income" },
  
  // Credit relationships
  { fromTermName: "Earned Income Tax Credit", toTermName: "Adjusted Gross Income", type: "depends_on", description: "EITC phases out based on AGI" },
  { fromTermName: "Child Tax Credit", toTermName: "Qualifying Child", type: "requires", description: "CTC requires qualifying children" },
  { fromTermName: "Additional Child Tax Credit", toTermName: "Child Tax Credit", type: "part_of", description: "ACTC is the refundable portion of CTC" },
  { fromTermName: "American Opportunity Credit", toTermName: "Adjusted Gross Income", type: "depends_on", description: "AOC phases out based on AGI" },
  { fromTermName: "Lifetime Learning Credit", toTermName: "Adjusted Gross Income", type: "depends_on", description: "LLC phases out based on AGI" },
  
  // Self-employment
  { fromTermName: "Self-Employment Tax", toTermName: "Self-Employment Income", type: "depends_on", description: "SE tax calculated on net SE income" },
  
  // State credit relationships
  { fromTermName: "Maryland Earned Income Tax Credit", toTermName: "Earned Income Tax Credit", type: "depends_on", description: "MD EITC is percentage of federal EITC" },
  { fromTermName: "Maryland Child Tax Credit", toTermName: "Qualifying Child", type: "requires", description: "MD CTC requires qualifying children" },
  { fromTermName: "Virginia EITC", toTermName: "Earned Income Tax Credit", type: "depends_on", description: "VA EITC is 20% of federal EITC" },
  { fromTermName: "Utah EITC", toTermName: "Earned Income Tax Credit", type: "depends_on", description: "UT EITC is 20% of federal EITC" },
  { fromTermName: "Tax Forgiveness Credit", toTermName: "Pennsylvania Flat Tax", type: "constrains", description: "Tax forgiveness reduces PA tax liability" },
  
  // Filing status relationships
  { fromTermName: "Filing Status", toTermName: "Standard Deduction", type: "constrains", description: "Filing status determines standard deduction amount" },
  { fromTermName: "Filing Status", toTermName: "Earned Income Tax Credit", type: "constrains", description: "Filing status affects EITC income limits" }
];

const SNAP_RELATIONSHIPS: RelationshipSeed[] = [
  { fromTermName: "Net Income", toTermName: "Gross Income", type: "depends_on", description: "Net income is calculated from gross income minus deductions" },
  { fromTermName: "Earned Income", toTermName: "Gross Income", type: "part_of", description: "Earned income is a component of gross income" },
  { fromTermName: "Unearned Income", toTermName: "Gross Income", type: "part_of", description: "Unearned income is a component of gross income" },
  { fromTermName: "Standard Deduction", toTermName: "Net Income", type: "constrains", description: "Standard deduction reduces net income calculation" },
  { fromTermName: "Shelter Deduction", toTermName: "Net Income", type: "constrains", description: "Shelter deduction reduces net income calculation" },
  { fromTermName: "Dependent Care Deduction", toTermName: "Net Income", type: "constrains", description: "Dependent care deduction reduces net income calculation" },
  { fromTermName: "Categorical Eligibility", toTermName: "Resource Limit", type: "excludes", description: "Categorically eligible households are exempt from resource limits" },
  { fromTermName: "Broad-Based Categorical Eligibility", toTermName: "Gross Income", type: "constrains", description: "BBCE allows higher gross income limit of 200% FPL" },
  { fromTermName: "Elderly or Disabled Household", toTermName: "Gross Income", type: "excludes", description: "Elderly/disabled households are not subject to gross income test" },
  { fromTermName: "Able-Bodied Adult Without Dependents", toTermName: "Work Registration Requirement", type: "requires", description: "ABAWDs must comply with enhanced work requirements" },
  { fromTermName: "Filing Unit", toTermName: "Household Size", type: "is_a", description: "Filing unit determines household size for benefit calculation" },
  { fromTermName: "Income Verification", toTermName: "Verification Documents", type: "is_a", description: "Income verification is a type of verification document" }
];

const SNAP_FEDERAL_RELATIONSHIPS: RelationshipSeed[] = [
  // Work Registration and E&T relationships
  { fromTermName: "Work Registration", toTermName: "Work Registration Exemption", type: "excludes", description: "Exempt individuals are not subject to work registration" },
  { fromTermName: "Employment and Training Program", toTermName: "E&T Component", type: "has_property", description: "E&T programs consist of multiple components" },
  { fromTermName: "Voluntary Quit", toTermName: "Good Cause for Noncompliance", type: "excludes", description: "Good cause excuses what would otherwise be voluntary quit" },
  { fromTermName: "Able-Bodied Adult Without Dependents", toTermName: "Work Registration", type: "requires", description: "ABAWDs must comply with work registration" },
  
  // Change Reporting relationships
  { fromTermName: "Simplified Reporting", toTermName: "10-Day Reporting Rule", type: "excludes", description: "Simplified reporting replaces standard 10-day rule for most changes" },
  { fromTermName: "Reportable Change", toTermName: "10-Day Reporting Rule", type: "requires", description: "Reportable changes must be reported within 10 days" },
  { fromTermName: "Interim Report", toTermName: "Change Reporting", type: "is_a", description: "Interim report is a form of required change reporting" },
  
  // Adverse Action and Due Process relationships
  { fromTermName: "Adverse Action Notice", toTermName: "10-Day Advance Notice", type: "requires", description: "Adverse actions require 10-day advance notice" },
  { fromTermName: "Adverse Action Notice", toTermName: "Notice Content Requirements", type: "requires", description: "Notices must contain required elements" },
  { fromTermName: "Shortened Notice Period", toTermName: "10-Day Advance Notice", type: "excludes", description: "Certain circumstances allow shorter notice" },
  { fromTermName: "Mass Change Notice", toTermName: "Adverse Action Notice", type: "is_a", description: "Mass change notices are a type of adverse action notice" },
  
  // Fair Hearing relationships
  { fromTermName: "Fair Hearing", toTermName: "Hearing Request", type: "requires", description: "Hearings require formal request from household" },
  { fromTermName: "Hearing Request", toTermName: "90-Day Filing Period", type: "constrains", description: "Requests must be filed within 90 days" },
  { fromTermName: "Continuation of Benefits Pending Appeal", toTermName: "Fair Hearing", type: "depends_on", description: "Continued benefits require pending hearing" },
  { fromTermName: "Fair Hearing", toTermName: "Impartial Hearing Official", type: "requires", description: "Hearings must be conducted by impartial official" },
  { fromTermName: "Fair Hearing", toTermName: "Right to Examine Case File", type: "implies", description: "Hearing right includes right to examine file" },
  
  // Recertification relationships
  { fromTermName: "Recertification", toTermName: "Certification Period", type: "depends_on", description: "Recertification occurs at end of certification period" },
  { fromTermName: "Recertification", toTermName: "Recertification Application", type: "requires", description: "Recertification requires application submission" },
  { fromTermName: "Timely Recertification", toTermName: "Recertification", type: "is_a", description: "Timely recertification is completed before period ends" },
  { fromTermName: "Extended Certification Period", toTermName: "Elderly or Disabled Household", type: "implies", description: "Elderly/disabled households may receive extended periods" },
  
  // IPV/Disqualification relationships
  { fromTermName: "Intentional Program Violation", toTermName: "IPV Disqualification Period - First Offense", type: "implies", description: "First IPV results in 12-month disqualification" },
  { fromTermName: "IPV Disqualification Period - First Offense", toTermName: "IPV Disqualification Period - Second Offense", type: "constrains", description: "Second offense follows first" },
  { fromTermName: "IPV Disqualification Period - Second Offense", toTermName: "IPV Disqualification Period - Third Offense", type: "constrains", description: "Third offense results in permanent ban" },
  { fromTermName: "Intentional Program Violation", toTermName: "Administrative Disqualification Hearing", type: "requires", description: "IPV determination requires hearing or waiver" },
  { fromTermName: "Disqualification Waiver", toTermName: "Administrative Disqualification Hearing", type: "excludes", description: "Waiver eliminates need for hearing" },
  { fromTermName: "Trafficking Disqualification", toTermName: "Intentional Program Violation", type: "is_a", description: "Trafficking is a severe form of IPV" },
  
  // Claims relationships
  { fromTermName: "IPV Claim", toTermName: "SNAP Claim", type: "is_a", description: "IPV claim is a type of SNAP claim" },
  { fromTermName: "Inadvertent Household Error Claim", toTermName: "SNAP Claim", type: "is_a", description: "IHE claim is a type of SNAP claim" },
  { fromTermName: "Agency Error Claim", toTermName: "SNAP Claim", type: "is_a", description: "AE claim is a type of SNAP claim" },
  { fromTermName: "Allotment Reduction", toTermName: "SNAP Claim", type: "depends_on", description: "Allotment reduction is used to collect claims" },
  { fromTermName: "Claim Compromise", toTermName: "SNAP Claim", type: "constrains", description: "Compromise may reduce claim amount" },
  { fromTermName: "Treasury Offset", toTermName: "SNAP Claim", type: "depends_on", description: "Federal offset used for delinquent claims" },
  { fromTermName: "Intentional Program Violation", toTermName: "IPV Claim", type: "implies", description: "IPV determination creates IPV claim" }
];

export async function seedOntologyTerms(
  stateCode: string,
  programCode: string
): Promise<{ termsCreated: number; relationshipsCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let termsCreated = 0;
  let relationshipsCreated = 0;
  
  let termSeeds: TermSeed[] = [];
  let relationshipSeeds: RelationshipSeed[] = [];
  
  if (stateCode === "MD" || stateCode === "US") {
    switch (programCode) {
      case "SNAP":
        termSeeds = [...MARYLAND_SNAP_TERMS, ...SNAP_FEDERAL_REGULATION_TERMS];
        relationshipSeeds = [...SNAP_RELATIONSHIPS, ...SNAP_FEDERAL_RELATIONSHIPS];
        break;
      case "MEDICAID":
        termSeeds = MARYLAND_MEDICAID_TERMS;
        break;
      case "TANF":
        termSeeds = MARYLAND_TANF_TERMS;
        break;
      case "OHEP":
        termSeeds = MARYLAND_OHEP_TERMS;
        break;
      case "VITA":
      case "TAX_CREDITS":
        termSeeds = VITA_TAX_TERMS;
        relationshipSeeds = VITA_TAX_RELATIONSHIPS;
        break;
      default:
        errors.push(`Unknown program code: ${programCode}`);
        return { termsCreated: 0, relationshipsCreated: 0, errors };
    }
  } else if (["PA", "VA", "UT", "IN", "MI"].includes(stateCode)) {
    switch (programCode) {
      case "VITA":
      case "TAX_CREDITS":
        termSeeds = VITA_TAX_TERMS;
        relationshipSeeds = VITA_TAX_RELATIONSHIPS;
        break;
      default:
        errors.push(`Program ${programCode} not yet supported for state ${stateCode}`);
        return { termsCreated: 0, relationshipsCreated: 0, errors };
    }
  } else {
    errors.push(`State ${stateCode} not yet supported for seeding`);
    return { termsCreated: 0, relationshipsCreated: 0, errors };
  }
  
  const createdTerms = new Map<string, string>();
  
  for (const seed of termSeeds) {
    try {
      const term = await legalOntologyService.createTerm({
        stateCode,
        programCode,
        termName: seed.termName,
        domain: seed.domain,
        definition: seed.definition,
        synonyms: seed.synonyms,
        statutoryCitation: seed.statutoryCitation
      });
      
      createdTerms.set(seed.termName, term.id);
      termsCreated++;
      
      logger.info("Seeded ontology term", { 
        termName: seed.termName, 
        id: term.id,
        stateCode,
        programCode
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to create term "${seed.termName}": ${message}`);
      logger.error("Failed to seed term", { termName: seed.termName, error });
    }
  }
  
  for (const rel of relationshipSeeds) {
    try {
      const fromTermId = createdTerms.get(rel.fromTermName);
      const toTermId = createdTerms.get(rel.toTermName);
      
      if (!fromTermId || !toTermId) {
        errors.push(`Relationship skipped: ${rel.fromTermName} -> ${rel.toTermName} (missing term)`);
        continue;
      }
      
      await legalOntologyService.createRelationship({
        fromTermId,
        toTermId,
        relationshipType: rel.type,
        description: rel.description
      });
      
      relationshipsCreated++;
      
      logger.info("Seeded ontology relationship", {
        from: rel.fromTermName,
        to: rel.toTermName,
        type: rel.type
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to create relationship ${rel.fromTermName} -> ${rel.toTermName}: ${message}`);
    }
  }
  
  return { termsCreated, relationshipsCreated, errors };
}

export async function seedAllMarylandPrograms(): Promise<{
  results: Record<string, { termsCreated: number; relationshipsCreated: number; errors: string[] }>;
  totalTerms: number;
  totalRelationships: number;
}> {
  const programs = ["SNAP", "MEDICAID", "TANF", "OHEP", "VITA"];
  const results: Record<string, { termsCreated: number; relationshipsCreated: number; errors: string[] }> = {};
  let totalTerms = 0;
  let totalRelationships = 0;
  
  for (const program of programs) {
    const result = await seedOntologyTerms("MD", program);
    results[program] = result;
    totalTerms += result.termsCreated;
    totalRelationships += result.relationshipsCreated;
  }
  
  return { results, totalTerms, totalRelationships };
}

export async function seedVITAOntologyForAllStates(): Promise<{
  results: Record<string, { termsCreated: number; relationshipsCreated: number; errors: string[] }>;
  totalTerms: number;
  totalRelationships: number;
}> {
  const states = ["MD", "PA", "VA", "UT", "IN", "MI"];
  const results: Record<string, { termsCreated: number; relationshipsCreated: number; errors: string[] }> = {};
  let totalTerms = 0;
  let totalRelationships = 0;
  
  for (const stateCode of states) {
    const result = await seedOntologyTerms(stateCode, "VITA");
    results[stateCode] = result;
    totalTerms += result.termsCreated;
    totalRelationships += result.relationshipsCreated;
  }
  
  logger.info("Seeded VITA ontology for all JAWN states", {
    states,
    totalTerms,
    totalRelationships
  });
  
  return { results, totalTerms, totalRelationships };
}

interface FormalRuleSeed {
  ruleName: string;
  eligibilityDomain: string;
  z3Logic: string;
  statutoryCitation: string;
  ruleType: string;
  description: string;
}

const SNAP_FEDERAL_FORMAL_RULES: FormalRuleSeed[] = [
  // 7 CFR § 273.7 - Work Registration and E&T
  {
    ruleName: "SNAP Work Registration Requirement",
    eligibilityDomain: "employment_training",
    z3Logic: "(assert (=> (and (>= age 16) (<= age 59) (not isExemptFromWorkRegistration)) mustRegisterForWork))",
    statutoryCitation: "7 CFR § 273.7(a)",
    ruleType: "requirement",
    description: "Non-exempt household members aged 16-59 must register for work"
  },
  {
    ruleName: "SNAP Voluntary Quit Disqualification",
    eligibilityDomain: "employment_training",
    z3Logic: "(assert (=> (and voluntarilyQuitJob (not hasGoodCause)) isDisqualifiedVoluntaryQuit))",
    statutoryCitation: "7 CFR § 273.7(j)",
    ruleType: "requirement",
    description: "Voluntary quit without good cause results in disqualification"
  },
  
  // 7 CFR § 273.12 - Change Reporting
  {
    ruleName: "SNAP 10-Day Change Reporting",
    eligibilityDomain: "change_reporting",
    z3Logic: "(assert (=> hasReportableChange (and mustReportWithin10Days isInComplianceWithReporting)))",
    statutoryCitation: "7 CFR § 273.12(a)(1)",
    ruleType: "requirement",
    description: "Reportable changes must be reported within 10 days"
  },
  {
    ruleName: "SNAP Simplified Reporting Eligibility",
    eligibilityDomain: "change_reporting",
    z3Logic: "(assert (=> isOnSimplifiedReporting (not (and (> grossIncome (* 1.3 federalPovertyLevel)) requiresFullReporting))))",
    statutoryCitation: "7 CFR § 273.12(a)(5)",
    ruleType: "exception",
    description: "Simplified reporting reduces change reporting requirements"
  },
  
  // 7 CFR § 273.13 - Adverse Action Notice
  {
    ruleName: "SNAP 10-Day Advance Notice Requirement",
    eligibilityDomain: "due_process",
    z3Logic: "(assert (=> isAdverseAction (and mustProvide10DayNotice noticeContainsRequiredElements)))",
    statutoryCitation: "7 CFR § 273.13(a)(1)",
    ruleType: "requirement",
    description: "Adverse actions require 10-day advance notice with required elements"
  },
  {
    ruleName: "SNAP Notice Content Requirements",
    eligibilityDomain: "due_process",
    z3Logic: "(assert (=> isAdverseActionNotice (and hasProposedAction hasReason hasRegulationCitation hasHearingRights hasHearingInstructions)))",
    statutoryCitation: "7 CFR § 273.13(a)(2)",
    ruleType: "requirement",
    description: "Adverse action notices must contain all required elements"
  },
  
  // 7 CFR § 273.14 - Recertification
  {
    ruleName: "SNAP Timely Recertification",
    eligibilityDomain: "recertification",
    z3Logic: "(assert (=> (and isRecertificationDue submittedBeforeDeadline) maintainsContinuousBenefits))",
    statutoryCitation: "7 CFR § 273.14(d)",
    ruleType: "requirement",
    description: "Timely recertification ensures continuous benefits"
  },
  {
    ruleName: "SNAP Extended Certification Period",
    eligibilityDomain: "recertification",
    z3Logic: "(assert (=> (or hasElderlyMember hasDisabledMember) mayHaveExtendedCertificationPeriod))",
    statutoryCitation: "7 CFR § 273.10(f)(4)",
    ruleType: "exception",
    description: "Elderly/disabled households may receive extended certification periods"
  },
  
  // 7 CFR § 273.15 - Fair Hearing Rights
  {
    ruleName: "SNAP Fair Hearing Right",
    eligibilityDomain: "due_process",
    z3Logic: "(assert (=> hasAgencyAction hasRightToFairHearing))",
    statutoryCitation: "7 CFR § 273.15(a)",
    ruleType: "requirement",
    description: "Households have the right to a fair hearing on agency actions"
  },
  {
    ruleName: "SNAP 90-Day Appeal Deadline",
    eligibilityDomain: "due_process",
    z3Logic: "(assert (=> requestsFairHearing (and (<= daysSinceAction 90) isValidHearingRequest)))",
    statutoryCitation: "7 CFR § 273.15(g)",
    ruleType: "requirement",
    description: "Fair hearing requests must be filed within 90 days"
  },
  {
    ruleName: "SNAP Continuation of Benefits Pending Appeal",
    eligibilityDomain: "due_process",
    z3Logic: "(assert (=> (and requestedHearingWithinNoticePeriod requestsContinuedBenefits) benefitsContinuePendingHearing))",
    statutoryCitation: "7 CFR § 273.15(k)",
    ruleType: "requirement",
    description: "Benefits continue pending hearing if requested within notice period"
  },
  
  // 7 CFR § 273.16 - IPV Disqualification
  {
    ruleName: "SNAP IPV First Offense Disqualification",
    eligibilityDomain: "disqualification",
    z3Logic: "(assert (=> (and hasIPVDetermination (= ipvOffenseCount 1)) (= disqualificationMonths 12)))",
    statutoryCitation: "7 CFR § 273.16(b)(1)",
    ruleType: "requirement",
    description: "First IPV offense results in 12-month disqualification"
  },
  {
    ruleName: "SNAP IPV Second Offense Disqualification",
    eligibilityDomain: "disqualification",
    z3Logic: "(assert (=> (and hasIPVDetermination (= ipvOffenseCount 2)) (= disqualificationMonths 24)))",
    statutoryCitation: "7 CFR § 273.16(b)(2)",
    ruleType: "requirement",
    description: "Second IPV offense results in 24-month disqualification"
  },
  {
    ruleName: "SNAP IPV Third Offense Permanent Disqualification",
    eligibilityDomain: "disqualification",
    z3Logic: "(assert (=> (and hasIPVDetermination (>= ipvOffenseCount 3)) isPermanentlyDisqualified))",
    statutoryCitation: "7 CFR § 273.16(b)(3)",
    ruleType: "requirement",
    description: "Third IPV offense results in permanent disqualification"
  },
  {
    ruleName: "SNAP Trafficking Permanent Disqualification",
    eligibilityDomain: "disqualification",
    z3Logic: "(assert (=> (or traffickingForDrugsOrWeapons (>= traffickingAmount 500)) isPermanentlyDisqualified))",
    statutoryCitation: "7 CFR § 273.16(b)(4)",
    ruleType: "requirement",
    description: "Trafficking for drugs/weapons or $500+ results in permanent disqualification"
  },
  
  // 7 CFR § 273.18 - Claims
  {
    ruleName: "SNAP Maximum Allotment Reduction",
    eligibilityDomain: "claims_recovery",
    z3Logic: "(assert (=> hasActiveClaim (<= monthlyReduction (max (* 0.10 monthlyAllotment) 10))))",
    statutoryCitation: "7 CFR § 273.18(g)(1)",
    ruleType: "threshold",
    description: "Allotment reduction cannot exceed 10% of allotment or $10, whichever is greater"
  },
  {
    ruleName: "SNAP IPV Claim Establishment",
    eligibilityDomain: "claims_recovery",
    z3Logic: "(assert (=> hasIPVDetermination mustEstablishIPVClaim))",
    statutoryCitation: "7 CFR § 273.18(c)(1)",
    ruleType: "requirement",
    description: "IPV claims must be established regardless of dollar amount"
  }
];

export async function seedSNAPFederalFormalRules(): Promise<{ rulesCreated: number; errors: string[] }> {
  const { db } = await import("../db");
  const { formalRules } = await import("@shared/schema");
  const { eq, and } = await import("drizzle-orm");
  
  const errors: string[] = [];
  let rulesCreated = 0;
  
  for (const rule of SNAP_FEDERAL_FORMAL_RULES) {
    try {
      const existing = await db.select()
        .from(formalRules)
        .where(and(
          eq(formalRules.stateCode, "MD"),
          eq(formalRules.programCode, "SNAP"),
          eq(formalRules.ruleName, rule.ruleName)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        logger.info("Formal rule already exists", { ruleName: rule.ruleName });
        rulesCreated++;
        continue;
      }
      
      await db.insert(formalRules).values({
        stateCode: "MD",
        programCode: "SNAP",
        ruleName: rule.ruleName,
        eligibilityDomain: rule.eligibilityDomain,
        z3Logic: rule.z3Logic,
        statutoryCitation: rule.statutoryCitation,
        ruleType: rule.ruleType,
        description: rule.description,
        promptStrategy: "directed_symbolic",
        status: "approved",
        isValid: true,
        version: "1.0"
      });
      
      rulesCreated++;
      logger.info("Created formal rule", { ruleName: rule.ruleName, domain: rule.eligibilityDomain });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to create rule "${rule.ruleName}": ${message}`);
      logger.error("Failed to create formal rule", { ruleName: rule.ruleName, error });
    }
  }
  
  return { rulesCreated, errors };
}
