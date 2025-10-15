import { db } from "../db";
import { eq, and, lte, gte, or, isNull, desc, sql } from "drizzle-orm";
import {
  snapIncomeLimits,
  snapDeductions,
  snapAllotments,
  categoricalEligibilityRules,
  ruleChangeLogs,
  type SnapIncomeLimit,
  type SnapDeduction,
  type SnapAllotment,
  type CategoricalEligibilityRule,
  type InsertRuleChangeLog,
  type RuleChangeLog,
} from "../../shared/schema";

// ============================================================================
// Rules-as-Code Service - Version Control & Snapshot Management
// ============================================================================

export interface RuleSnapshot {
  id: string;
  snapshotDate: Date;
  benefitProgramId: string;
  ruleType: 'income_limit' | 'deduction' | 'allotment' | 'categorical';
  data: any;
  version: number;
  effectiveDate: Date;
  endDate?: Date | null;
}

export interface RuleHistory {
  ruleType: string;
  ruleId: string;
  changes: RuleChangeLog[];
  totalChanges: number;
}

export interface RuleComparison {
  ruleType: string;
  ruleId: string;
  oldVersion: any;
  newVersion: any;
  differences: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'added' | 'removed' | 'modified';
  }>;
}

export interface EffectiveRules {
  benefitProgramId: string;
  effectiveDate: Date;
  incomeLimits: SnapIncomeLimit[];
  deductions: SnapDeduction[];
  allotments: SnapAllotment[];
  categoricalRules: CategoricalEligibilityRule[];
}

class RulesAsCodeService {
  /**
   * Get active income limits for a specific date (defaults to current date)
   */
  async getActiveIncomeLimits(
    benefitProgramId: string,
    householdSize: number,
    effectiveDate: Date = new Date()
  ): Promise<SnapIncomeLimit | null> {
    const [limit] = await db
      .select()
      .from(snapIncomeLimits)
      .where(
        and(
          eq(snapIncomeLimits.benefitProgramId, benefitProgramId),
          eq(snapIncomeLimits.householdSize, householdSize),
          eq(snapIncomeLimits.isActive, true),
          lte(snapIncomeLimits.effectiveDate, effectiveDate),
          or(
            isNull(snapIncomeLimits.endDate),
            gte(snapIncomeLimits.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(snapIncomeLimits.effectiveDate))
      .limit(1);
    
    return limit || null;
  }

  /**
   * Get active deductions for a specific date
   */
  async getActiveDeductions(
    benefitProgramId: string,
    effectiveDate: Date = new Date()
  ): Promise<SnapDeduction[]> {
    return await db
      .select()
      .from(snapDeductions)
      .where(
        and(
          eq(snapDeductions.benefitProgramId, benefitProgramId),
          eq(snapDeductions.isActive, true),
          lte(snapDeductions.effectiveDate, effectiveDate),
          or(
            isNull(snapDeductions.endDate),
            gte(snapDeductions.endDate, effectiveDate)
          )
        )
      )
      .orderBy(snapDeductions.deductionType);
  }

  /**
   * Get active allotment for a specific date
   */
  async getActiveAllotment(
    benefitProgramId: string,
    householdSize: number,
    effectiveDate: Date = new Date()
  ): Promise<SnapAllotment | null> {
    const [allotment] = await db
      .select()
      .from(snapAllotments)
      .where(
        and(
          eq(snapAllotments.benefitProgramId, benefitProgramId),
          eq(snapAllotments.householdSize, householdSize),
          eq(snapAllotments.isActive, true),
          lte(snapAllotments.effectiveDate, effectiveDate),
          or(
            isNull(snapAllotments.endDate),
            gte(snapAllotments.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(snapAllotments.effectiveDate))
      .limit(1);
    
    return allotment || null;
  }

  /**
   * Get active categorical eligibility rule for a specific date
   */
  async getCategoricalEligibilityRule(
    benefitProgramId: string,
    ruleCode: string,
    effectiveDate: Date = new Date()
  ): Promise<CategoricalEligibilityRule | null> {
    if (!ruleCode) return null;

    const [rule] = await db
      .select()
      .from(categoricalEligibilityRules)
      .where(
        and(
          eq(categoricalEligibilityRules.benefitProgramId, benefitProgramId),
          eq(categoricalEligibilityRules.ruleCode, ruleCode),
          eq(categoricalEligibilityRules.isActive, true),
          lte(categoricalEligibilityRules.effectiveDate, effectiveDate),
          or(
            isNull(categoricalEligibilityRules.endDate),
            gte(categoricalEligibilityRules.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(categoricalEligibilityRules.effectiveDate))
      .limit(1);
    
    return rule || null;
  }

  /**
   * Create a snapshot of rules at a point in time
   * This creates a change log entry for tracking versions
   */
  async createRuleSnapshot(
    ruleType: 'income_limit' | 'deduction' | 'allotment' | 'categorical',
    ruleData: any,
    userId: string,
    changeReason?: string
  ): Promise<RuleChangeLog> {
    const changeLog: InsertRuleChangeLog = {
      ruleTable: this.getRuleTableName(ruleType),
      ruleId: ruleData.id,
      changeType: 'create',
      oldValues: null,
      newValues: ruleData,
      changeReason: changeReason || `Snapshot created for ${ruleType}`,
      changedBy: userId,
    };

    const [saved] = await db
      .insert(ruleChangeLogs)
      .values(changeLog)
      .returning();

    return saved;
  }

  /**
   * Get a specific rule snapshot by changelog ID
   */
  async getRuleSnapshot(snapshotId: string): Promise<RuleChangeLog | null> {
    const [snapshot] = await db
      .select()
      .from(ruleChangeLogs)
      .where(eq(ruleChangeLogs.id, snapshotId))
      .limit(1);

    return snapshot || null;
  }

  /**
   * Get version history for a specific rule
   */
  async getRuleHistory(
    ruleType: 'income_limit' | 'deduction' | 'allotment' | 'categorical',
    ruleId?: string,
    limit: number = 50
  ): Promise<RuleHistory> {
    const tableName = this.getRuleTableName(ruleType);

    const conditions = [eq(ruleChangeLogs.ruleTable, tableName)];
    if (ruleId) {
      conditions.push(eq(ruleChangeLogs.ruleId, ruleId));
    }

    const changes = await db
      .select()
      .from(ruleChangeLogs)
      .where(and(...conditions))
      .orderBy(desc(ruleChangeLogs.createdAt))
      .limit(limit);

    return {
      ruleType,
      ruleId: ruleId || 'all',
      changes,
      totalChanges: changes.length,
    };
  }

  /**
   * Compare two rule versions
   */
  async compareRuleVersions(
    snapshotId1: string,
    snapshotId2: string
  ): Promise<RuleComparison | null> {
    const snapshot1 = await this.getRuleSnapshot(snapshotId1);
    const snapshot2 = await this.getRuleSnapshot(snapshotId2);

    if (!snapshot1 || !snapshot2) {
      return null;
    }

    if (snapshot1.ruleTable !== snapshot2.ruleTable || snapshot1.ruleId !== snapshot2.ruleId) {
      throw new Error('Cannot compare snapshots from different rules');
    }

    const differences = this.calculateDifferences(
      snapshot1.newValues as any,
      snapshot2.newValues as any
    );

    return {
      ruleType: snapshot1.ruleTable,
      ruleId: snapshot1.ruleId,
      oldVersion: snapshot1.newValues,
      newVersion: snapshot2.newValues,
      differences,
    };
  }

  /**
   * Get all effective rules for a specific date and program
   * This is useful for retroactive calculations
   */
  async getEffectiveRulesForDate(
    benefitProgramId: string,
    effectiveDate: Date = new Date()
  ): Promise<EffectiveRules> {
    const [incomeLimits, deductions, allotments, categoricalRules] = await Promise.all([
      this.getAllActiveIncomeLimits(benefitProgramId, effectiveDate),
      this.getActiveDeductions(benefitProgramId, effectiveDate),
      this.getAllActiveAllotments(benefitProgramId, effectiveDate),
      this.getAllActiveCategoricalRules(benefitProgramId, effectiveDate),
    ]);

    return {
      benefitProgramId,
      effectiveDate,
      incomeLimits,
      deductions,
      allotments,
      categoricalRules,
    };
  }

  /**
   * Log a rule change for audit trail
   */
  async logRuleChange(
    ruleType: 'income_limit' | 'deduction' | 'allotment' | 'categorical',
    ruleId: string,
    changeType: 'create' | 'update' | 'delete' | 'approve',
    oldValues: any,
    newValues: any,
    userId: string,
    changeReason?: string
  ): Promise<RuleChangeLog> {
    const changeLog: InsertRuleChangeLog = {
      ruleTable: this.getRuleTableName(ruleType),
      ruleId,
      changeType,
      oldValues,
      newValues,
      changeReason,
      changedBy: userId,
    };

    const [saved] = await db
      .insert(ruleChangeLogs)
      .values(changeLog)
      .returning();

    return saved;
  }

  /**
   * Get all active income limits for all household sizes
   */
  private async getAllActiveIncomeLimits(
    benefitProgramId: string,
    effectiveDate: Date
  ): Promise<SnapIncomeLimit[]> {
    return await db
      .select()
      .from(snapIncomeLimits)
      .where(
        and(
          eq(snapIncomeLimits.benefitProgramId, benefitProgramId),
          eq(snapIncomeLimits.isActive, true),
          lte(snapIncomeLimits.effectiveDate, effectiveDate),
          or(
            isNull(snapIncomeLimits.endDate),
            gte(snapIncomeLimits.endDate, effectiveDate)
          )
        )
      )
      .orderBy(snapIncomeLimits.householdSize);
  }

  /**
   * Get all active allotments for all household sizes
   */
  private async getAllActiveAllotments(
    benefitProgramId: string,
    effectiveDate: Date
  ): Promise<SnapAllotment[]> {
    return await db
      .select()
      .from(snapAllotments)
      .where(
        and(
          eq(snapAllotments.benefitProgramId, benefitProgramId),
          eq(snapAllotments.isActive, true),
          lte(snapAllotments.effectiveDate, effectiveDate),
          or(
            isNull(snapAllotments.endDate),
            gte(snapAllotments.endDate, effectiveDate)
          )
        )
      )
      .orderBy(snapAllotments.householdSize);
  }

  /**
   * Get all active categorical eligibility rules
   */
  private async getAllActiveCategoricalRules(
    benefitProgramId: string,
    effectiveDate: Date
  ): Promise<CategoricalEligibilityRule[]> {
    return await db
      .select()
      .from(categoricalEligibilityRules)
      .where(
        and(
          eq(categoricalEligibilityRules.benefitProgramId, benefitProgramId),
          eq(categoricalEligibilityRules.isActive, true),
          lte(categoricalEligibilityRules.effectiveDate, effectiveDate),
          or(
            isNull(categoricalEligibilityRules.endDate),
            gte(categoricalEligibilityRules.endDate, effectiveDate)
          )
        )
      )
      .orderBy(categoricalEligibilityRules.ruleCode);
  }

  /**
   * Get the database table name for a rule type
   */
  private getRuleTableName(ruleType: string): string {
    switch (ruleType) {
      case 'income_limit':
        return 'snap_income_limits';
      case 'deduction':
        return 'snap_deductions';
      case 'allotment':
        return 'snap_allotments';
      case 'categorical':
        return 'categorical_eligibility_rules';
      default:
        throw new Error(`Unknown rule type: ${ruleType}`);
    }
  }

  /**
   * Calculate differences between two rule versions
   */
  private calculateDifferences(
    oldVersion: any,
    newVersion: any
  ): Array<{
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'added' | 'removed' | 'modified';
  }> {
    const differences: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      changeType: 'added' | 'removed' | 'modified';
    }> = [];

    const allKeys = new Set([
      ...Object.keys(oldVersion || {}),
      ...Object.keys(newVersion || {}),
    ]);

    for (const key of Array.from(allKeys)) {
      const oldValue = oldVersion?.[key];
      const newValue = newVersion?.[key];

      if (oldValue === undefined && newValue !== undefined) {
        differences.push({
          field: key,
          oldValue: null,
          newValue,
          changeType: 'added',
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        differences.push({
          field: key,
          oldValue,
          newValue: null,
          changeType: 'removed',
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        differences.push({
          field: key,
          oldValue,
          newValue,
          changeType: 'modified',
        });
      }
    }

    return differences;
  }
}

export const rulesAsCodeService = new RulesAsCodeService();
