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

export async function seedOntologyTerms(
  stateCode: string,
  programCode: string
): Promise<{ termsCreated: number; relationshipsCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let termsCreated = 0;
  let relationshipsCreated = 0;
  
  let termSeeds: TermSeed[] = [];
  let relationshipSeeds: RelationshipSeed[] = [];
  
  if (stateCode === "MD") {
    switch (programCode) {
      case "SNAP":
        termSeeds = MARYLAND_SNAP_TERMS;
        relationshipSeeds = SNAP_RELATIONSHIPS;
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
      default:
        errors.push(`Unknown program code: ${programCode}`);
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
  const programs = ["SNAP", "MEDICAID", "TANF", "OHEP"];
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
