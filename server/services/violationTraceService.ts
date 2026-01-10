import { db } from "../db";
import {
  violationTraces, solverRuns, formalRules, caseAssertions,
  statutorySources, explanationClauses, InsertViolationTrace
} from "@shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

export interface ViolationTraceResult {
  id: string;
  solverRunId: string;
  caseId: string;
  ruleName: string;
  eligibilityDomain: string;
  statutoryCitation: string;
  statutoryText: string | null;
  violationType: string;
  violationDescription: string;
  conflictingPredicates: ConflictingPredicate[];
  appealRecommendation: string;
  requiredDocumentation: string[];
  severityLevel: string;
}

interface ConflictingPredicate {
  predicate: string;
  expected: string;
  actual: string;
}

interface DueProcessNotice {
  noticeType: "denial" | "reduction" | "termination" | "suspension";
  caseId: string;
  programName: string;
  stateCode: string;
  determinationDate: string;
  effectiveDate: string;
  violations: ViolationTraceResult[];
  legalBasis: string[];
  contestRights: ContestRights;
  requiredActions: string[];
  contactInfo: StateContactInfo;
}

interface ContestRights {
  hasRightToAppeal: boolean;
  appealDeadlineDays: number;
  hearingType: string;
  representationRights: string;
  procedureDescription: string;
  goldbergCitation: string;
}

interface StateContactInfo {
  agencyName: string;
  phone: string;
  address: string;
  hearingsOffice: string;
  website: string;
}

const STATE_CONTACTS: Record<string, StateContactInfo> = {
  MD: {
    agencyName: "Maryland Department of Human Services",
    phone: "1-800-332-6347",
    address: "311 W. Saratoga Street, Baltimore, MD 21201",
    hearingsOffice: "Office of Administrative Hearings",
    website: "https://dhs.maryland.gov"
  },
  PA: {
    agencyName: "Pennsylvania Department of Human Services",
    phone: "1-800-692-7462",
    address: "P.O. Box 2675, Harrisburg, PA 17105",
    hearingsOffice: "Bureau of Hearings and Appeals",
    website: "https://www.dhs.pa.gov"
  },
  VA: {
    agencyName: "Virginia Department of Social Services",
    phone: "1-800-552-3431",
    address: "801 E. Main Street, Richmond, VA 23219",
    hearingsOffice: "Appeals and Fair Hearings Unit",
    website: "https://www.dss.virginia.gov"
  },
  MI: {
    agencyName: "Michigan Department of Health and Human Services",
    phone: "1-844-799-9876",
    address: "P.O. Box 30037, Lansing, MI 48909",
    hearingsOffice: "Michigan Administrative Hearing System",
    website: "https://www.michigan.gov/mdhhs"
  }
};

const PROGRAM_NAMES: Record<string, string> = {
  SNAP: "Supplemental Nutrition Assistance Program (SNAP)",
  MEDICAID: "Medicaid Health Coverage",
  TANF: "Temporary Assistance for Needy Families (TANF)",
  OHEP: "Office of Home Energy Programs (OHEP)",
  TAX_CREDITS: "Tax Credits (EITC/CTC)",
  SSI: "Supplemental Security Income (SSI)"
};

const DOMAIN_VIOLATION_DESCRIPTIONS: Record<string, Record<string, string>> = {
  income: {
    threshold: "Your household's gross income exceeds the maximum allowed for this program. The income limit is based on federal poverty guidelines adjusted for household size.",
    verification: "Required income documentation was not provided or could not be verified.",
    calculation: "Income calculation includes disallowed deductions or incorrectly excludes countable income."
  },
  resources: {
    threshold: "Your household's countable resources exceed the maximum allowed. Resources include bank accounts, stocks, bonds, and certain property.",
    verification: "Required resource documentation was not provided or could not be verified.",
    excluded: "Resources that should have been excluded were incorrectly counted."
  },
  residency: {
    requirement: "You must be a resident of the state where you are applying for benefits.",
    verification: "Proof of residency was not provided or could not be verified.",
    county: "You must apply for benefits in the county where you currently reside."
  },
  citizenship: {
    requirement: "You must be a U.S. citizen, U.S. national, or qualified non-citizen to receive benefits.",
    verification: "Citizenship or immigration status documentation was not provided or could not be verified.",
    status: "Your current immigration status does not meet the eligibility requirements for this program."
  },
  work_requirement: {
    requirement: "Able-bodied adults without dependents (ABAWDs) must meet work requirements to maintain eligibility.",
    hours: "You did not meet the minimum work hours requirement for this benefit period.",
    exemption: "You do not qualify for an exemption from work requirements."
  },
  student_status: {
    requirement: "Students enrolled in higher education must meet additional criteria to be eligible.",
    work_study: "You do not meet the work-study or employment requirement for student eligibility.",
    exemption: "You do not qualify for a student eligibility exemption."
  },
  household_composition: {
    requirement: "Household composition requirements were not met.",
    verification: "Household member information could not be verified.",
    relationship: "Household relationship documentation was incomplete or inconsistent."
  }
};

const APPEAL_TEMPLATES: Record<string, string> = {
  income: `To contest this determination, you may provide: (1) Updated pay stubs for the last 30 days showing reduced income; (2) Documentation of any income that should be excluded (e.g., student loans, one-time payments); (3) Proof of deductions not previously considered (e.g., dependent care, medical expenses for elderly/disabled household members). You have the right to request a fair hearing within the timeframe specified below.`,
  resources: `To contest this determination, you may provide: (1) Bank statements showing excluded resources (e.g., retirement accounts, home equity); (2) Documentation that resources have been reduced below the limit; (3) Proof that certain assets should be exempt under program rules. You have the right to request a fair hearing.`,
  residency: `To contest this determination, you may provide: (1) Utility bills, lease agreements, or mail showing your current address; (2) Affidavit from landlord or household member confirming residency; (3) Any other documentation proving you reside in this state/county.`,
  citizenship: `To contest this determination, you may provide: (1) Birth certificate, passport, or naturalization certificate; (2) Immigration documents showing qualified non-citizen status; (3) Documentation of pending immigration application if applicable. Note: Certain benefits have different citizenship requirements.`,
  work_requirement: `To contest this determination, you may provide: (1) Pay stubs or employer letter showing you meet work hour requirements; (2) Documentation of disability, pregnancy, or other exempting condition; (3) Proof of participation in qualifying training or work program; (4) Evidence that your county has an ABAWD waiver in effect.`,
  student_status: `To contest this determination, you may provide: (1) Proof of work-study participation or employment of 20+ hours per week; (2) Documentation of an exempting condition (parenting, disability, SNAP E&T participation); (3) Verification that you are enrolled less than half-time.`,
  household_composition: `To contest this determination, you may provide: (1) Updated household member information with identification for all members; (2) Documentation clarifying household relationships; (3) Proof of separate household status if applicable.`
};

const REQUIRED_DOCUMENTATION: Record<string, string[]> = {
  income: [
    "Pay stubs for all household members (last 30 days)",
    "Self-employment income documentation if applicable",
    "Proof of other income (Social Security, pension, child support)",
    "Documentation of income deductions"
  ],
  resources: [
    "Bank statements for all accounts (last 30 days)",
    "Vehicle registration and current value estimate",
    "Property ownership documentation",
    "Retirement account statements"
  ],
  residency: [
    "Utility bill in your name at current address",
    "Lease agreement or mortgage statement",
    "Driver's license or state ID with current address",
    "Mail received at current address"
  ],
  citizenship: [
    "Birth certificate or passport",
    "Naturalization certificate",
    "Immigration documents (green card, work permit, etc.)",
    "Social Security card"
  ],
  work_requirement: [
    "Current pay stubs or employment verification letter",
    "Work-study or job training enrollment documentation",
    "Medical documentation for disability exemption",
    "Proof of qualifying work program participation"
  ],
  student_status: [
    "College enrollment verification",
    "Work-study award letter",
    "Employment verification (20+ hours/week)",
    "Documentation of exempting condition"
  ],
  household_composition: [
    "Identification for all household members",
    "Birth certificates for children",
    "Marriage certificate or domestic partnership documentation",
    "Proof of shared living arrangements"
  ]
};

class ViolationTraceService {
  async generateViolationTraces(solverRunId: string): Promise<ViolationTraceResult[]> {
    const [solverRun] = await db.select()
      .from(solverRuns)
      .where(eq(solverRuns.id, solverRunId));

    if (!solverRun) {
      throw new Error(`Solver run ${solverRunId} not found`);
    }

    if (solverRun.isSatisfied) {
      return [];
    }

    const violatedRuleIds = solverRun.violatedRuleIds || [];
    if (violatedRuleIds.length === 0) {
      return [];
    }

    const violatedRules = await db.select()
      .from(formalRules)
      .where(inArray(formalRules.id, violatedRuleIds));

    const assertions = solverRun.aboxAssertionIds && solverRun.aboxAssertionIds.length > 0
      ? await db.select().from(caseAssertions).where(inArray(caseAssertions.id, solverRun.aboxAssertionIds))
      : [];

    const traces: ViolationTraceResult[] = [];
    let displayOrder = 1;

    for (const rule of violatedRules) {
      const statutorySource = rule.statutoryCitation 
        ? await this.findStatutorySource(rule.statutoryCitation, solverRun.stateCode)
        : null;

      const conflictingPredicates = this.extractConflictingPredicates(rule, assertions);
      const violationType = this.determineViolationType(rule);
      const violationDescription = this.generateViolationDescription(rule, conflictingPredicates);
      const appealRecommendation = this.generateAppealRecommendation(rule.eligibilityDomain);
      const requiredDocs = REQUIRED_DOCUMENTATION[rule.eligibilityDomain] || [];
      const severityLevel = this.determineSeverity(rule, conflictingPredicates);

      const [trace] = await db.insert(violationTraces).values({
        solverRunId,
        caseId: solverRun.caseId,
        formalRuleId: rule.id,
        ruleName: rule.ruleName,
        eligibilityDomain: rule.eligibilityDomain,
        statutoryCitation: rule.statutoryCitation,
        statutorySourceId: statutorySource?.id,
        statutoryText: statutorySource?.sectionText?.substring(0, 500) || null,
        violationType,
        violationDescription,
        conflictingAssertionIds: assertions
          .filter(a => this.isAssertionRelevant(a, rule))
          .map(a => a.id),
        conflictingPredicates,
        appealRecommendation,
        requiredDocumentation: requiredDocs,
        severityLevel,
        displayOrder: displayOrder++
      }).returning();

      traces.push({
        id: trace.id,
        solverRunId: trace.solverRunId,
        caseId: trace.caseId,
        ruleName: trace.ruleName,
        eligibilityDomain: trace.eligibilityDomain,
        statutoryCitation: trace.statutoryCitation,
        statutoryText: trace.statutoryText,
        violationType: trace.violationType,
        violationDescription: trace.violationDescription,
        conflictingPredicates: conflictingPredicates,
        appealRecommendation: trace.appealRecommendation || "",
        requiredDocumentation: trace.requiredDocumentation || [],
        severityLevel: trace.severityLevel
      });
    }

    return traces;
  }

  async generateDueProcessNotice(
    solverRunId: string,
    noticeType: "denial" | "reduction" | "termination" | "suspension" = "denial"
  ): Promise<DueProcessNotice> {
    const violations = await this.getViolationTracesForRun(solverRunId);
    
    const [solverRun] = await db.select()
      .from(solverRuns)
      .where(eq(solverRuns.id, solverRunId));

    if (!solverRun) {
      throw new Error(`Solver run ${solverRunId} not found`);
    }

    const stateCode = solverRun.stateCode;
    const programCode = solverRun.programCode;
    const contactInfo = STATE_CONTACTS[stateCode] || STATE_CONTACTS.MD;

    const legalBasis = violations.map(v => v.statutoryCitation).filter(Boolean);

    const contestRights: ContestRights = {
      hasRightToAppeal: true,
      appealDeadlineDays: this.getAppealDeadline(stateCode),
      hearingType: "Fair Hearing before an Administrative Law Judge",
      representationRights: "You have the right to be represented by an attorney, legal aid organization, or other representative of your choice at no cost to the agency.",
      procedureDescription: this.getAppealProcedure(stateCode),
      goldbergCitation: "Goldberg v. Kelly, 397 U.S. 254 (1970)"
    };

    const requiredActions = this.aggregateRequiredActions(violations);

    return {
      noticeType,
      caseId: solverRun.caseId,
      programName: PROGRAM_NAMES[programCode] || programCode,
      stateCode,
      determinationDate: new Date().toISOString().split("T")[0],
      effectiveDate: this.calculateEffectiveDate(noticeType, stateCode),
      violations,
      legalBasis,
      contestRights,
      requiredActions,
      contactInfo
    };
  }

  async getViolationTracesForRun(solverRunId: string): Promise<ViolationTraceResult[]> {
    const traces = await db.select()
      .from(violationTraces)
      .where(eq(violationTraces.solverRunId, solverRunId))
      .orderBy(violationTraces.displayOrder);

    return traces.map(t => ({
      id: t.id,
      solverRunId: t.solverRunId,
      caseId: t.caseId,
      ruleName: t.ruleName,
      eligibilityDomain: t.eligibilityDomain,
      statutoryCitation: t.statutoryCitation,
      statutoryText: t.statutoryText,
      violationType: t.violationType,
      violationDescription: t.violationDescription,
      conflictingPredicates: (t.conflictingPredicates as ConflictingPredicate[]) || [],
      appealRecommendation: t.appealRecommendation || "",
      requiredDocumentation: t.requiredDocumentation || [],
      severityLevel: t.severityLevel
    }));
  }

  async getViolationTracesForCase(caseId: string): Promise<ViolationTraceResult[]> {
    const traces = await db.select()
      .from(violationTraces)
      .where(eq(violationTraces.caseId, caseId))
      .orderBy(desc(violationTraces.createdAt));

    return traces.map(t => ({
      id: t.id,
      solverRunId: t.solverRunId,
      caseId: t.caseId,
      ruleName: t.ruleName,
      eligibilityDomain: t.eligibilityDomain,
      statutoryCitation: t.statutoryCitation,
      statutoryText: t.statutoryText,
      violationType: t.violationType,
      violationDescription: t.violationDescription,
      conflictingPredicates: (t.conflictingPredicates as ConflictingPredicate[]) || [],
      appealRecommendation: t.appealRecommendation || "",
      requiredDocumentation: t.requiredDocumentation || [],
      severityLevel: t.severityLevel
    }));
  }

  async getViolationTraceById(traceId: string): Promise<ViolationTraceResult | null> {
    const [t] = await db.select()
      .from(violationTraces)
      .where(eq(violationTraces.id, traceId));

    if (!t) return null;

    return {
      id: t.id,
      solverRunId: t.solverRunId,
      caseId: t.caseId,
      ruleName: t.ruleName,
      eligibilityDomain: t.eligibilityDomain,
      statutoryCitation: t.statutoryCitation,
      statutoryText: t.statutoryText,
      violationType: t.violationType,
      violationDescription: t.violationDescription,
      conflictingPredicates: (t.conflictingPredicates as ConflictingPredicate[]) || [],
      appealRecommendation: t.appealRecommendation || "",
      requiredDocumentation: t.requiredDocumentation || [],
      severityLevel: t.severityLevel
    };
  }

  private async findStatutorySource(citation: string, stateCode: string) {
    const [source] = await db.select()
      .from(statutorySources)
      .where(and(
        eq(statutorySources.citation, citation),
        eq(statutorySources.stateCode, stateCode)
      ));
    return source || null;
  }

  private extractConflictingPredicates(
    rule: typeof formalRules.$inferSelect,
    assertions: typeof caseAssertions.$inferSelect[]
  ): ConflictingPredicate[] {
    const predicates: ConflictingPredicate[] = [];

    if (!rule.z3Logic) return predicates;

    const thresholdMatch = rule.z3Logic.match(/\(<=?\s+(\w+)\s+(\d+)\)/i);
    if (thresholdMatch) {
      const varName = thresholdMatch[1];
      const threshold = thresholdMatch[2];
      
      const matchingAssertion = assertions.find(a => 
        a.predicateName.toLowerCase() === varName.toLowerCase() ||
        a.predicateName.toLowerCase().includes(varName.toLowerCase())
      );

      if (matchingAssertion && matchingAssertion.predicateValue) {
        const actualValue = parseFloat(matchingAssertion.predicateValue);
        const thresholdValue = parseFloat(threshold);
        
        if (!isNaN(actualValue) && !isNaN(thresholdValue) && actualValue > thresholdValue) {
          predicates.push({
            predicate: matchingAssertion.predicateName,
            expected: `<= ${threshold}`,
            actual: matchingAssertion.predicateValue
          });
        }
      }
    }

    return predicates;
  }

  private determineViolationType(rule: typeof formalRules.$inferSelect): string {
    if (rule.ruleType === "threshold") return "threshold_exceeded";
    if (rule.ruleType === "requirement") return "requirement_missing";
    if (rule.ruleType === "constraint") return "condition_failed";
    return "condition_failed";
  }

  private generateViolationDescription(
    rule: typeof formalRules.$inferSelect,
    conflictingPredicates: ConflictingPredicate[]
  ): string {
    const domain = rule.eligibilityDomain;
    const ruleType = rule.ruleType || "requirement";
    
    let baseDescription = DOMAIN_VIOLATION_DESCRIPTIONS[domain]?.[ruleType] 
      || `The ${domain} eligibility requirement was not satisfied.`;

    if (conflictingPredicates.length > 0) {
      const predicateDetails = conflictingPredicates.map(p => 
        `Your ${p.predicate} is ${p.actual}, but must be ${p.expected} to qualify.`
      ).join(" ");
      
      baseDescription = `${baseDescription} ${predicateDetails}`;
    }

    return baseDescription;
  }

  private generateAppealRecommendation(domain: string): string {
    return APPEAL_TEMPLATES[domain] || 
      "To contest this determination, you may request a fair hearing. Gather any documentation that supports your eligibility and present it at your hearing.";
  }

  private determineSeverity(
    rule: typeof formalRules.$inferSelect,
    conflictingPredicates: ConflictingPredicate[]
  ): string {
    if (rule.eligibilityDomain === "citizenship" || rule.eligibilityDomain === "residency") {
      return "critical";
    }
    
    if (conflictingPredicates.length > 0) {
      const predicate = conflictingPredicates[0];
      const actual = parseFloat(predicate.actual);
      const expectedMatch = predicate.expected.match(/[\d.]+/);
      
      if (expectedMatch) {
        const expected = parseFloat(expectedMatch[0]);
        const exceedanceRatio = actual / expected;
        
        if (exceedanceRatio > 1.5) return "critical";
        if (exceedanceRatio > 1.2) return "high";
        return "medium";
      }
    }
    
    return "high";
  }

  private isAssertionRelevant(
    assertion: typeof caseAssertions.$inferSelect,
    rule: typeof formalRules.$inferSelect
  ): boolean {
    if (!rule.z3Logic) return false;
    
    const varName = assertion.predicateName.charAt(0).toLowerCase() + 
                    assertion.predicateName.slice(1);
    
    return rule.z3Logic.toLowerCase().includes(varName.toLowerCase());
  }

  private getAppealDeadline(stateCode: string): number {
    const deadlines: Record<string, number> = {
      MD: 90,
      PA: 30,
      VA: 30,
      UT: 30,
      IN: 33,
      MI: 90
    };
    return deadlines[stateCode] || 30;
  }

  private getAppealProcedure(stateCode: string): string {
    return `To request a fair hearing, contact the ${STATE_CONTACTS[stateCode]?.hearingsOffice || "State Hearings Office"} within ${this.getAppealDeadline(stateCode)} days of receiving this notice. You may request a hearing by phone, mail, or online. You have the right to continue receiving benefits pending your hearing if you request a hearing within 10 days of the mail date on this notice. At the hearing, you may present evidence, call witnesses, and cross-examine the agency's witnesses.`;
  }

  private calculateEffectiveDate(noticeType: string, stateCode: string): string {
    const advanceNoticeDays = noticeType === "denial" ? 0 : 10;
    const effectiveDate = new Date();
    effectiveDate.setDate(effectiveDate.getDate() + advanceNoticeDays);
    return effectiveDate.toISOString().split("T")[0];
  }

  private aggregateRequiredActions(violations: ViolationTraceResult[]): string[] {
    const allDocs = new Set<string>();
    
    for (const violation of violations) {
      for (const doc of violation.requiredDocumentation) {
        allDocs.add(doc);
      }
    }
    
    return Array.from(allDocs);
  }

  async getStatisticsForProgram(
    stateCode: string,
    programCode: string
  ): Promise<{
    totalViolations: number;
    byDomain: Record<string, number>;
    byType: Record<string, number>;
    avgSeverity: string;
  }> {
    const traces = await db.select()
      .from(violationTraces)
      .innerJoin(solverRuns, eq(violationTraces.solverRunId, solverRuns.id))
      .where(and(
        eq(solverRuns.stateCode, stateCode),
        eq(solverRuns.programCode, programCode)
      ));

    const byDomain: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const severityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const { violation_traces } of traces) {
      byDomain[violation_traces.eligibilityDomain] = 
        (byDomain[violation_traces.eligibilityDomain] || 0) + 1;
      byType[violation_traces.violationType] = 
        (byType[violation_traces.violationType] || 0) + 1;
      severityCounts[violation_traces.severityLevel] = 
        (severityCounts[violation_traces.severityLevel] || 0) + 1;
    }

    const severityOrder = ["critical", "high", "medium", "low"];
    let avgSeverity = "medium";
    for (const sev of severityOrder) {
      if (severityCounts[sev] > 0) {
        avgSeverity = sev;
        break;
      }
    }

    return {
      totalViolations: traces.length,
      byDomain,
      byType,
      avgSeverity
    };
  }
}

export const violationTraceService = new ViolationTraceService();
