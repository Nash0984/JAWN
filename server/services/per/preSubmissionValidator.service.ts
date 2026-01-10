/**
 * Pre-Submission Validator Service
 * 
 * SNAP Payment Error Reduction Module - Pre-Submission Validation Component
 * Performs consistency checks before case approval to catch errors proactively.
 * 
 * Per Arnold Ventures/MD DHS Blueprint: "Internal consistency checks prior to submission"
 */

import { db } from '../../db';
import {
  perConsistencyChecks,
  clientCases,
  householdProfiles,
  eligibilityCalculations,
  documents,
  type InsertPerConsistencyCheck,
  type PerConsistencyCheck
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../logger.service';

// Check types for pre-submission validation
export type CheckType = 
  | 'income_total'
  | 'household_composition'
  | 'documentation_complete'
  | 'duplicate_person'
  | 'income_source_match'
  | 'expense_deductions'
  | 'resource_limits'
  | 'citizenship_status'
  | 'work_requirements';

export interface ValidationCheck {
  type: CheckType;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  expectedValue?: string;
  actualValue?: string;
  discrepancyDetails?: string;
  affectedFields?: string[];
  potentialErrorType?: 'overpayment' | 'underpayment' | 'none';
  estimatedImpact?: number;
  recommendedAction?: string;
  documentationNeeded?: string[];
}

export interface ValidationResult {
  caseId: string;
  overallStatus: 'passed' | 'failed' | 'needs_review';
  overallRiskScore: number;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  checksRun: number;
  checksPassed: number;
  checksFailed: number;
  checksWarning: number;
  checks: ValidationCheck[];
  criticalIssues: string[];
  recommendedActions: string[];
  readyForApproval: boolean;
}

class PreSubmissionValidatorService {
  /**
   * Run all pre-submission validation checks for a case
   */
  async validateCase(
    caseId: string,
    options: {
      stateCode?: string;
      tenantId?: string;
      triggeredBy?: string;
    } = {}
  ): Promise<ValidationResult> {
    const { stateCode = 'MD', tenantId, triggeredBy = 'pre_submission' } = options;

    try {
      // Get case data
      const clientCase = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, caseId)
      });

      if (!clientCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      // Get related data
      const [eligibilityCalcs, caseDocuments] = await Promise.all([
        db.select()
          .from(eligibilityCalculations)
          .where(eq(eligibilityCalculations.caseId, caseId))
          .orderBy(desc(eligibilityCalculations.createdAt))
          .limit(1),
        db.select()
          .from(documents)
          .where(eq(documents.uploadedBy, clientCase.createdBy))
      ]);

      const eligibilityCalc = eligibilityCalcs[0];
      const inputData = eligibilityCalc?.inputData || {};

      // Run all validation checks
      const checks: ValidationCheck[] = [];

      checks.push(await this.checkIncomeTotal(inputData));
      checks.push(await this.checkHouseholdComposition(inputData));
      checks.push(await this.checkDocumentationComplete(inputData, caseDocuments));
      checks.push(await this.checkIncomeSourceMatch(inputData));
      checks.push(await this.checkExpenseDeductions(inputData));
      checks.push(await this.checkResourceLimits(inputData));
      checks.push(await this.checkWorkRequirements(inputData));

      // Calculate overall metrics
      const checksPassed = checks.filter(c => c.status === 'passed').length;
      const checksFailed = checks.filter(c => c.status === 'failed').length;
      const checksWarning = checks.filter(c => c.status === 'warning').length;

      const avgRiskScore = checks.reduce((sum, c) => sum + c.riskScore, 0) / checks.length;
      const maxRiskLevel = this.getMaxRiskLevel(checks);

      const overallStatus = checksFailed > 0 ? 'failed' 
        : checksWarning > 0 ? 'needs_review' 
        : 'passed';

      const criticalIssues = checks
        .filter(c => c.riskLevel === 'critical' || c.status === 'failed')
        .map(c => c.discrepancyDetails || c.name);

      const recommendedActions = checks
        .filter(c => c.recommendedAction)
        .map(c => c.recommendedAction!);

      // Store all checks in database
      for (const check of checks) {
        if (check.status !== 'passed') {
          await this.storeCheck(caseId, check, stateCode, tenantId, triggeredBy);
        }
      }

      const result: ValidationResult = {
        caseId,
        overallStatus,
        overallRiskScore: Math.round(avgRiskScore),
        overallRiskLevel: maxRiskLevel,
        checksRun: checks.length,
        checksPassed,
        checksFailed,
        checksWarning,
        checks,
        criticalIssues,
        recommendedActions,
        readyForApproval: overallStatus === 'passed'
      };

      logger.info('Pre-submission validation completed', {
        service: 'PreSubmissionValidatorService',
        caseId,
        overallStatus,
        checksPassed,
        checksFailed
      });

      return result;

    } catch (error) {
      logger.error('Pre-submission validation failed', {
        service: 'PreSubmissionValidatorService',
        method: 'validateCase',
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get unaddressed checks for a case
   */
  async getUnaddressedChecks(caseId: string): Promise<PerConsistencyCheck[]> {
    return db.select()
      .from(perConsistencyChecks)
      .where(and(
        eq(perConsistencyChecks.caseId, caseId),
        eq(perConsistencyChecks.wasAddressed, false)
      ))
      .orderBy(desc(perConsistencyChecks.createdAt));
  }

  /**
   * Mark a check as addressed
   */
  async addressCheck(
    checkId: string,
    addressedBy: string,
    action: string
  ): Promise<PerConsistencyCheck | null> {
    const [updated] = await db.update(perConsistencyChecks)
      .set({
        wasAddressed: true,
        addressedBy,
        addressedAt: new Date(),
        addressedAction: action
      })
      .where(eq(perConsistencyChecks.id, checkId))
      .returning();

    return updated || null;
  }

  // ============================================================================
  // INDIVIDUAL CHECK IMPLEMENTATIONS
  // ============================================================================

  private async checkIncomeTotal(inputData: any): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'income_total',
      name: 'Income Total Verification',
      description: 'Verify that reported income sources sum correctly',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    try {
      const incomes = this.extractIncomes(inputData);
      const reportedTotal = inputData.totalIncome || inputData.grossIncome || 0;
      const calculatedTotal = incomes.reduce((sum, i) => sum + i.amount, 0);

      if (Math.abs(reportedTotal - calculatedTotal) > 10) {
        check.status = 'failed';
        check.riskScore = 70;
        check.riskLevel = 'high';
        check.expectedValue = `$${calculatedTotal}`;
        check.actualValue = `$${reportedTotal}`;
        check.discrepancyDetails = `Income total mismatch: reported $${reportedTotal} but sources sum to $${calculatedTotal}`;
        check.affectedFields = ['totalIncome', 'grossIncome'];
        check.potentialErrorType = reportedTotal < calculatedTotal ? 'overpayment' : 'underpayment';
        check.estimatedImpact = Math.abs(reportedTotal - calculatedTotal);
        check.recommendedAction = 'Verify all income sources and recalculate total';
      }
    } catch (error) {
      check.status = 'skipped';
      check.discrepancyDetails = 'Could not verify income total';
    }

    return check;
  }

  private async checkHouseholdComposition(inputData: any): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'household_composition',
      name: 'Household Composition Verification',
      description: 'Verify household size matches members listed',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    try {
      const reportedSize = inputData.householdSize || 1;
      const members = inputData.householdMembers || [];
      const actualSize = members.length || 1;

      if (reportedSize !== actualSize) {
        check.status = 'failed';
        check.riskScore = 80;
        check.riskLevel = 'high';
        check.expectedValue = `${actualSize} members`;
        check.actualValue = `${reportedSize} reported`;
        check.discrepancyDetails = `Household size mismatch: ${reportedSize} reported but ${actualSize} members listed`;
        check.affectedFields = ['householdSize', 'householdMembers'];
        check.potentialErrorType = reportedSize > actualSize ? 'overpayment' : 'underpayment';
        check.recommendedAction = 'Verify all household members and update count';
      }

      // Check for missing required member info
      for (const member of members) {
        if (!member.name || !member.relationship) {
          check.status = check.status === 'failed' ? 'failed' : 'warning';
          check.riskScore = Math.max(check.riskScore, 40);
          check.riskLevel = check.riskLevel === 'high' ? 'high' : 'medium';
          check.discrepancyDetails = (check.discrepancyDetails || '') + ' Missing member information.';
          check.documentationNeeded = ['Proof of relationship', 'ID for all members'];
        }
      }
    } catch (error) {
      check.status = 'skipped';
    }

    return check;
  }

  private async checkDocumentationComplete(inputData: any, docs: any[]): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'documentation_complete',
      name: 'Required Documentation Check',
      description: 'Verify all required documents are present',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    const requiredDocs = [
      { type: 'identity', name: 'ID Verification' },
      { type: 'income', name: 'Income Verification' },
      { type: 'residence', name: 'Proof of Residence' }
    ];

    const missingDocs: string[] = [];
    const docTypes = docs.map(d => d.documentTypeId?.toLowerCase() || '');

    for (const required of requiredDocs) {
      const hasDoc = docTypes.some(t => t.includes(required.type));
      if (!hasDoc) {
        missingDocs.push(required.name);
      }
    }

    if (missingDocs.length > 0) {
      check.status = 'warning';
      check.riskScore = 50;
      check.riskLevel = 'medium';
      check.discrepancyDetails = `Missing documentation: ${missingDocs.join(', ')}`;
      check.documentationNeeded = missingDocs;
      check.recommendedAction = 'Request missing documentation before approval';
    }

    return check;
  }

  private async checkIncomeSourceMatch(inputData: any): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'income_source_match',
      name: 'Income Source Consistency',
      description: 'Verify income sources match employment status',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    try {
      const isEmployed = inputData.employmentStatus === 'employed' || inputData.isEmployed;
      const hasEarnedIncome = (inputData.earnedIncome || 0) > 0;

      if (isEmployed && !hasEarnedIncome) {
        check.status = 'warning';
        check.riskScore = 60;
        check.riskLevel = 'medium';
        check.discrepancyDetails = 'Client reports employed but no earned income entered';
        check.recommendedAction = 'Verify employment status and income';
      }

      if (!isEmployed && hasEarnedIncome) {
        check.status = 'warning';
        check.riskScore = 50;
        check.riskLevel = 'medium';
        check.discrepancyDetails = 'Client reports not employed but has earned income';
        check.recommendedAction = 'Verify employment status';
      }
    } catch (error) {
      check.status = 'skipped';
    }

    return check;
  }

  private async checkExpenseDeductions(inputData: any): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'expense_deductions',
      name: 'Expense Deduction Verification',
      description: 'Verify claimed deductions are within normal ranges',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    try {
      const shelter = inputData.shelterCosts || inputData.rent || 0;
      const utilities = inputData.utilityCosts || inputData.utilities || 0;
      const medical = inputData.medicalExpenses || 0;
      const childcare = inputData.childcareCosts || 0;

      // Flag unusually high deductions
      if (shelter > 3000) {
        check.status = 'warning';
        check.riskScore = 40;
        check.riskLevel = 'medium';
        check.discrepancyDetails = `Shelter costs ($${shelter}) unusually high`;
        check.documentationNeeded = ['Lease agreement', 'Rent receipts'];
      }

      if (medical > 1000) {
        check.status = check.status === 'warning' ? 'warning' : 'warning';
        check.riskScore = Math.max(check.riskScore, 30);
        check.discrepancyDetails = (check.discrepancyDetails || '') + ` Medical expenses ($${medical}) require verification.`;
        check.documentationNeeded = [...(check.documentationNeeded || []), 'Medical bills'];
      }
    } catch (error) {
      check.status = 'skipped';
    }

    return check;
  }

  private async checkResourceLimits(inputData: any): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'resource_limits',
      name: 'Resource Limits Check',
      description: 'Verify countable resources are within SNAP limits',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    try {
      const resources = inputData.countableResources || inputData.assets || 0;
      const hasElderly = inputData.hasElderly || inputData.hasDisabled;
      const limit = hasElderly ? 4250 : 2750; // 2025 SNAP limits

      if (resources > limit) {
        check.status = 'failed';
        check.riskScore = 90;
        check.riskLevel = 'critical';
        check.expectedValue = `Under $${limit}`;
        check.actualValue = `$${resources}`;
        check.discrepancyDetails = `Resources ($${resources}) exceed SNAP limit ($${limit})`;
        check.potentialErrorType = 'overpayment';
        check.recommendedAction = 'Review resource documentation - may not be eligible';
      } else if (resources > limit * 0.8) {
        check.status = 'warning';
        check.riskScore = 40;
        check.riskLevel = 'medium';
        check.discrepancyDetails = `Resources ($${resources}) approaching limit ($${limit})`;
        check.documentationNeeded = ['Bank statements', 'Asset documentation'];
      }
    } catch (error) {
      check.status = 'skipped';
    }

    return check;
  }

  private async checkWorkRequirements(inputData: any): Promise<ValidationCheck> {
    const check: ValidationCheck = {
      type: 'work_requirements',
      name: 'Work Requirements Check',
      description: 'Verify ABAWD work requirements status',
      status: 'passed',
      riskScore: 0,
      riskLevel: 'low'
    };

    try {
      const age = inputData.age || 30;
      const isABAWD = age >= 18 && age <= 49 && 
        !inputData.hasChildren && 
        !inputData.isDisabled && 
        !inputData.isPregnant;

      if (isABAWD) {
        const meetsWorkReq = inputData.workHours >= 80 || 
          inputData.isExempt || 
          inputData.inWorkProgram;

        if (!meetsWorkReq) {
          check.status = 'warning';
          check.riskScore = 50;
          check.riskLevel = 'medium';
          check.discrepancyDetails = 'ABAWD - work requirement status needs verification';
          check.recommendedAction = 'Verify work hours or exemption status';
          check.documentationNeeded = ['Pay stubs showing 80+ hours/month', 'Work program enrollment'];
        }
      }
    } catch (error) {
      check.status = 'skipped';
    }

    return check;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private extractIncomes(inputData: any): Array<{ source: string; amount: number }> {
    const incomes: Array<{ source: string; amount: number }> = [];

    if (inputData.earnedIncome) {
      incomes.push({ source: 'earned', amount: inputData.earnedIncome });
    }
    if (inputData.unearnedIncome) {
      incomes.push({ source: 'unearned', amount: inputData.unearnedIncome });
    }
    if (inputData.selfEmploymentIncome) {
      incomes.push({ source: 'self_employment', amount: inputData.selfEmploymentIncome });
    }
    if (Array.isArray(inputData.incomes)) {
      for (const inc of inputData.incomes) {
        incomes.push({ source: inc.type || 'other', amount: inc.amount || 0 });
      }
    }

    return incomes;
  }

  private getMaxRiskLevel(checks: ValidationCheck[]): 'low' | 'medium' | 'high' | 'critical' {
    const levels = ['low', 'medium', 'high', 'critical'];
    let maxIndex = 0;
    for (const check of checks) {
      const index = levels.indexOf(check.riskLevel);
      if (index > maxIndex) maxIndex = index;
    }
    return levels[maxIndex] as 'low' | 'medium' | 'high' | 'critical';
  }

  private async storeCheck(
    caseId: string,
    check: ValidationCheck,
    stateCode: string,
    tenantId?: string,
    triggeredBy: string = 'pre_submission'
  ): Promise<void> {
    const consistencyCheck: InsertPerConsistencyCheck = {
      caseId,
      checkType: check.type,
      checkName: check.name,
      checkDescription: check.description,
      checkStatus: check.status,
      riskScore: check.riskScore,
      riskLevel: check.riskLevel,
      expectedValue: check.expectedValue,
      actualValue: check.actualValue,
      discrepancyDetails: check.discrepancyDetails,
      affectedFields: check.affectedFields,
      potentialErrorType: check.potentialErrorType,
      estimatedImpact: check.estimatedImpact,
      recommendedAction: check.recommendedAction,
      documentationNeeded: check.documentationNeeded,
      triggeredBy,
      stateCode,
      tenantId
    };

    await db.insert(perConsistencyChecks).values(consistencyCheck);
  }
}

export const preSubmissionValidatorService = new PreSubmissionValidatorService();
