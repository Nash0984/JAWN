import { db } from "../db";
import {
  caseAssertions, ontologyTerms, clientCases, householdProfiles,
  InsertCaseAssertion, CaseAssertion
} from "@shared/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity, generateTextWithGemini } from "./gemini.service";
import { legalOntologyService } from "./legalOntologyService";

export type AssertionType = "fact" | "claim" | "explanation_derived";
export type ExtractionMethod = "direct_mapping" | "llm_extraction" | "calculation" | "document_verification";

interface CaseFactInput {
  predicateName: string;
  predicateValue: string | number | boolean;
  predicateOperator?: "=" | "<" | ">" | "<=" | ">=" | "!=" | "in";
  comparisonValue?: string;
  sourceField: string;
  assertionType?: AssertionType;
  extractionMethod?: ExtractionMethod;
}

interface HouseholdData {
  grossMonthlyIncome?: number;
  netMonthlyIncome?: number;
  householdSize?: number;
  countableResources?: number;
  hasElderlyMember?: boolean;
  hasDisabledMember?: boolean;
  isResident?: boolean;
  stateOfResidence?: string;
  citizenshipStatus?: string;
  employmentHours?: number;
  isABAWD?: boolean;
  hasDependent?: boolean;
  dependentAge?: number;
  isStudent?: boolean;
  studentWorkHours?: number;
  earnedIncome?: number;
  shelterCosts?: number;
  dependentCareCosts?: number;
  medicalCosts?: number;
  childSupportPaid?: number;
}

class CaseAssertionService {
  async createAssertion(
    caseId: string,
    stateCode: string,
    programCode: string,
    fact: CaseFactInput,
    householdProfileId?: string,
    tenantId?: string
  ): Promise<CaseAssertion> {
    const ontologyTerm = await this.findMatchingOntologyTerm(
      fact.predicateName,
      stateCode,
      programCode
    );

    const z3Assertion = this.generateZ3Assertion(fact);

    const [assertion] = await db.insert(caseAssertions).values({
      caseId,
      householdProfileId,
      stateCode,
      programCode,
      assertionType: fact.assertionType || "fact",
      ontologyTermId: ontologyTerm?.id,
      predicateName: fact.predicateName,
      predicateValue: String(fact.predicateValue),
      predicateOperator: fact.predicateOperator || "=",
      comparisonValue: fact.comparisonValue,
      z3Assertion,
      sourceField: fact.sourceField,
      sourceValue: String(fact.predicateValue),
      extractionMethod: fact.extractionMethod || "direct_mapping",
      isVerified: false,
      tenantId
    }).returning();

    return assertion;
  }

  async createAssertionsFromHousehold(
    caseId: string,
    stateCode: string,
    programCode: string,
    household: HouseholdData,
    householdProfileId?: string,
    tenantId?: string
  ): Promise<CaseAssertion[]> {
    const facts: CaseFactInput[] = [];

    if (household.grossMonthlyIncome !== undefined) {
      facts.push({
        predicateName: "GrossMonthlyIncome",
        predicateValue: household.grossMonthlyIncome,
        predicateOperator: "=",
        sourceField: "grossMonthlyIncome",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.netMonthlyIncome !== undefined) {
      facts.push({
        predicateName: "NetMonthlyIncome",
        predicateValue: household.netMonthlyIncome,
        predicateOperator: "=",
        sourceField: "netMonthlyIncome",
        extractionMethod: "calculation"
      });
    }

    if (household.householdSize !== undefined) {
      facts.push({
        predicateName: "HouseholdSize",
        predicateValue: household.householdSize,
        predicateOperator: "=",
        sourceField: "householdSize",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.countableResources !== undefined) {
      facts.push({
        predicateName: "CountableResources",
        predicateValue: household.countableResources,
        predicateOperator: "=",
        sourceField: "countableResources",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.hasElderlyMember !== undefined) {
      facts.push({
        predicateName: "HasElderlyMember",
        predicateValue: household.hasElderlyMember,
        predicateOperator: "=",
        sourceField: "hasElderlyMember",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.hasDisabledMember !== undefined) {
      facts.push({
        predicateName: "HasDisabledMember",
        predicateValue: household.hasDisabledMember,
        predicateOperator: "=",
        sourceField: "hasDisabledMember",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.isResident !== undefined) {
      facts.push({
        predicateName: "IsResident",
        predicateValue: household.isResident,
        predicateOperator: "=",
        sourceField: "isResident",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.stateOfResidence) {
      facts.push({
        predicateName: "StateOfResidence",
        predicateValue: household.stateOfResidence,
        predicateOperator: "=",
        sourceField: "stateOfResidence",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.citizenshipStatus) {
      facts.push({
        predicateName: "CitizenshipStatus",
        predicateValue: household.citizenshipStatus,
        predicateOperator: "=",
        sourceField: "citizenshipStatus",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.employmentHours !== undefined) {
      facts.push({
        predicateName: "EmploymentHours",
        predicateValue: household.employmentHours,
        predicateOperator: "=",
        sourceField: "employmentHours",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.isABAWD !== undefined) {
      facts.push({
        predicateName: "IsABAWD",
        predicateValue: household.isABAWD,
        predicateOperator: "=",
        sourceField: "isABAWD",
        extractionMethod: "calculation"
      });
    }

    if (household.hasDependent !== undefined) {
      facts.push({
        predicateName: "HasDependent",
        predicateValue: household.hasDependent,
        predicateOperator: "=",
        sourceField: "hasDependent",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.dependentAge !== undefined) {
      facts.push({
        predicateName: "DependentAge",
        predicateValue: household.dependentAge,
        predicateOperator: "=",
        sourceField: "dependentAge",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.isStudent !== undefined) {
      facts.push({
        predicateName: "IsStudent",
        predicateValue: household.isStudent,
        predicateOperator: "=",
        sourceField: "isStudent",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.studentWorkHours !== undefined) {
      facts.push({
        predicateName: "StudentWorkHours",
        predicateValue: household.studentWorkHours,
        predicateOperator: "=",
        sourceField: "studentWorkHours",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.earnedIncome !== undefined) {
      facts.push({
        predicateName: "EarnedIncome",
        predicateValue: household.earnedIncome,
        predicateOperator: "=",
        sourceField: "earnedIncome",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.shelterCosts !== undefined) {
      facts.push({
        predicateName: "ShelterCosts",
        predicateValue: household.shelterCosts,
        predicateOperator: "=",
        sourceField: "shelterCosts",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.dependentCareCosts !== undefined) {
      facts.push({
        predicateName: "DependentCareCosts",
        predicateValue: household.dependentCareCosts,
        predicateOperator: "=",
        sourceField: "dependentCareCosts",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.medicalCosts !== undefined) {
      facts.push({
        predicateName: "MedicalCosts",
        predicateValue: household.medicalCosts,
        predicateOperator: "=",
        sourceField: "medicalCosts",
        extractionMethod: "direct_mapping"
      });
    }

    if (household.childSupportPaid !== undefined) {
      facts.push({
        predicateName: "ChildSupportPaid",
        predicateValue: household.childSupportPaid,
        predicateOperator: "=",
        sourceField: "childSupportPaid",
        extractionMethod: "direct_mapping"
      });
    }

    const assertions: CaseAssertion[] = [];
    for (const fact of facts) {
      const assertion = await this.createAssertion(
        caseId,
        stateCode,
        programCode,
        fact,
        householdProfileId,
        tenantId
      );
      assertions.push(assertion);
    }

    return assertions;
  }

  private async findMatchingOntologyTerm(
    predicateName: string,
    stateCode: string,
    programCode: string
  ): Promise<{ id: string; termName: string; similarity: number } | null> {
    const searchQuery = this.predicateToNaturalLanguage(predicateName);
    
    try {
      const results = await legalOntologyService.findSimilarTerms(
        searchQuery,
        stateCode,
        programCode,
        0.70,
        5
      );

      if (results.length > 0) {
        return {
          id: results[0].term.id,
          termName: results[0].term.termName,
          similarity: results[0].similarity
        };
      }

      const directMatch = await db.select({ id: ontologyTerms.id, termName: ontologyTerms.termName })
        .from(ontologyTerms)
        .where(and(
          eq(ontologyTerms.stateCode, stateCode),
          eq(ontologyTerms.programCode, programCode),
          sql`LOWER(${ontologyTerms.termName}) LIKE ${`%${predicateName.toLowerCase()}%`}`
        ))
        .limit(1);

      if (directMatch.length > 0) {
        return { ...directMatch[0], similarity: 0.6 };
      }

      console.log(`[CaseAssertion] No ontology match for predicate: ${predicateName} (${stateCode}/${programCode})`);
      return null;
    } catch (error) {
      console.error(`[CaseAssertion] Semantic search failed for ${predicateName}:`, error);
      return null;
    }
  }

  private predicateToNaturalLanguage(predicate: string): string {
    const words = predicate
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
      .split(/\s+/);
    
    const contextMap: Record<string, string> = {
      grossmonthlyincome: "gross monthly income for SNAP eligibility",
      netmonthlyincome: "net monthly income after deductions",
      householdsize: "number of household members",
      countableresources: "countable liquid resources and assets",
      haselderlymember: "household with member aged 60 or older",
      hasdisabledmember: "household with disabled member",
      isresident: "state residency requirement",
      stateofresidence: "state where applicant resides",
      citizenshipstatus: "citizenship or immigration status",
      employmenthours: "hours of employment per month",
      isabawd: "able-bodied adult without dependents status",
      hasdependent: "household has dependent children",
      dependentage: "age of youngest dependent child",
      isstudent: "enrolled in higher education",
      studentworkhours: "student work hours per week",
      earnedincome: "earned income from employment",
      sheltercosts: "shelter and housing costs",
      dependentcarecosts: "dependent care expenses",
      medicalcosts: "medical expenses for elderly or disabled",
      childsupportpaid: "child support payments made"
    };

    const key = predicate.toLowerCase();
    if (contextMap[key]) return contextMap[key];

    return words.join(' ');
  }

  private generateZ3Assertion(fact: CaseFactInput): string {
    const { predicateName, predicateValue, predicateOperator, comparisonValue } = fact;
    
    const varName = predicateName.charAt(0).toLowerCase() + predicateName.slice(1);
    
    if (typeof predicateValue === "boolean" || predicateValue === "true" || predicateValue === "false") {
      const boolVal = typeof predicateValue === "boolean" ? predicateValue : predicateValue === "true";
      return `(= ${varName} ${boolVal ? "true" : "false"})`;
    }
    
    if (typeof predicateValue === "number" || !isNaN(Number(predicateValue))) {
      const numVal = typeof predicateValue === "number" ? predicateValue : Number(predicateValue);
      if (predicateOperator && comparisonValue && predicateOperator !== "=") {
        const op = this.z3Operator(predicateOperator);
        return `(${op} ${varName} ${comparisonValue})`;
      }
      return `(= ${varName} ${numVal})`;
    }
    
    if (typeof predicateValue === "string") {
      const escapedValue = predicateValue.replace(/"/g, '\\"');
      if (predicateOperator === "in" && comparisonValue) {
        const values = comparisonValue.split(",").map(v => v.trim());
        if (values.length === 1) {
          return `(= ${varName} "${values[0].replace(/"/g, '\\"')}")`;
        }
        const orClauses = values.map(v => `(= ${varName} "${v.replace(/"/g, '\\"')}")`).join(" ");
        return `(or ${orClauses})`;
      }
      return `(= ${varName} "${escapedValue}")`;
    }
    
    return `(= ${varName} ${String(predicateValue)})`;
  }

  private z3Operator(op: string): string {
    const mapping: Record<string, string> = {
      "=": "=",
      "<": "<",
      ">": ">",
      "<=": "<=",
      ">=": ">=",
      "!=": "distinct"
    };
    return mapping[op] || "=";
  }

  async getAssertionsForCase(caseId: string): Promise<CaseAssertion[]> {
    return db.select()
      .from(caseAssertions)
      .where(eq(caseAssertions.caseId, caseId))
      .orderBy(desc(caseAssertions.createdAt));
  }

  async getAssertionsForProgram(
    caseId: string,
    stateCode: string,
    programCode: string
  ): Promise<CaseAssertion[]> {
    return db.select()
      .from(caseAssertions)
      .where(and(
        eq(caseAssertions.caseId, caseId),
        eq(caseAssertions.stateCode, stateCode),
        eq(caseAssertions.programCode, programCode)
      ))
      .orderBy(desc(caseAssertions.createdAt));
  }

  async verifyAssertion(
    assertionId: string,
    verificationDocumentId?: string
  ): Promise<CaseAssertion | null> {
    const [updated] = await db.update(caseAssertions)
      .set({
        isVerified: true,
        verificationDocumentId,
        updatedAt: new Date()
      })
      .where(eq(caseAssertions.id, assertionId))
      .returning();
    
    return updated || null;
  }

  async deleteAssertionsForCase(caseId: string): Promise<number> {
    const result = await db.delete(caseAssertions)
      .where(eq(caseAssertions.caseId, caseId));
    
    return result.rowCount || 0;
  }

  async getAssertionStats(): Promise<{
    totalAssertions: number;
    verifiedAssertions: number;
    byType: Record<string, number>;
    byProgram: Record<string, number>;
    byExtractionMethod: Record<string, number>;
  }> {
    const [total] = await db.select({ count: sql<number>`count(*)` })
      .from(caseAssertions);
    
    const [verified] = await db.select({ count: sql<number>`count(*)` })
      .from(caseAssertions)
      .where(eq(caseAssertions.isVerified, true));

    const typeStats = await db.select({
      type: caseAssertions.assertionType,
      count: sql<number>`count(*)`
    })
      .from(caseAssertions)
      .groupBy(caseAssertions.assertionType);

    const programStats = await db.select({
      program: caseAssertions.programCode,
      count: sql<number>`count(*)`
    })
      .from(caseAssertions)
      .groupBy(caseAssertions.programCode);

    const methodStats = await db.select({
      method: caseAssertions.extractionMethod,
      count: sql<number>`count(*)`
    })
      .from(caseAssertions)
      .groupBy(caseAssertions.extractionMethod);

    const byType: Record<string, number> = {};
    for (const s of typeStats) {
      byType[s.type] = Number(s.count);
    }

    const byProgram: Record<string, number> = {};
    for (const s of programStats) {
      byProgram[s.program] = Number(s.count);
    }

    const byExtractionMethod: Record<string, number> = {};
    for (const s of methodStats) {
      if (s.method) byExtractionMethod[s.method] = Number(s.count);
    }

    return {
      totalAssertions: Number(total.count),
      verifiedAssertions: Number(verified.count),
      byType,
      byProgram,
      byExtractionMethod
    };
  }

  async generateZ3AssertionBlock(caseId: string, programCode: string): Promise<string> {
    const assertions = await this.getAssertionsForCase(caseId);
    const programAssertions = assertions.filter(a => a.programCode === programCode);
    
    if (programAssertions.length === 0) {
      return "; No assertions found for this case/program";
    }

    const lines: string[] = [
      `; Case Assertions for Case ${caseId}`,
      `; Program: ${programCode}`,
      `; Generated: ${new Date().toISOString()}`,
      ""
    ];

    const declaredVars = new Set<string>();
    
    for (const assertion of programAssertions) {
      const varName = assertion.predicateName.charAt(0).toLowerCase() + assertion.predicateName.slice(1);
      
      if (!declaredVars.has(varName)) {
        const type = this.inferZ3Type(assertion.predicateValue);
        lines.push(`(declare-const ${varName} ${type})`);
        declaredVars.add(varName);
      }
    }

    lines.push("");
    lines.push("; Assertions");
    
    for (const assertion of programAssertions) {
      if (assertion.z3Assertion) {
        lines.push(`(assert ${assertion.z3Assertion}) ; ${assertion.predicateName}`);
      }
    }

    return lines.join("\n");
  }

  private inferZ3Type(value: string | null): string {
    if (!value) return "Bool";
    
    if (value === "true" || value === "false") return "Bool";
    if (!isNaN(Number(value))) {
      if (value.includes(".")) return "Real";
      return "Int";
    }
    return "String";
  }
}

export const caseAssertionService = new CaseAssertionService();
