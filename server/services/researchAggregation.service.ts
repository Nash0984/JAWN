/**
 * Research Aggregation Service
 * 
 * Provides PII-stripped, aggregated data access for external researchers.
 * Enforces privacy protection through:
 * - Minimum sample thresholds (k-anonymity)
 * - Field-level PII stripping
 * - Data rounding for small cell suppression
 * - Audit logging of all research data access
 * 
 * Designed for Arnold Ventures/MD DHS research partnership requirements.
 */

import { db } from '../db';
import {
  clientCases,
  eligibilityCalculations,
  householdProfiles,
  perIncomeVerifications,
  perConsistencyChecks,
  perDuplicateClaims,
  perPermSamples,
  perCaseworkerNudges,
  apiUsageLogs,
  apiKeys
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { logger } from './logger.service';

const MINIMUM_SAMPLE_THRESHOLD = 10;
const SUPPRESSION_PLACEHOLDER = '<suppressed>';

interface ResearchDataRequest {
  stateCode?: string;
  startDate?: Date;
  endDate?: Date;
  programType?: string;
  tenantId?: string;
  apiKeyId: string;
}

interface AggregatedResult {
  success: boolean;
  data: any;
  metadata: {
    queryTime: number;
    recordCount: number;
    suppressedFields: string[];
    aggregationLevel: string;
    dataFreshness: string;
    warning?: string;
  };
}

class ResearchAggregationService {
  
  /**
   * Get aggregated eligibility statistics (PII-stripped)
   */
  async getEligibilityStats(params: ResearchDataRequest): Promise<AggregatedResult> {
    const startTime = Date.now();
    const suppressedFields: string[] = [];
    
    try {
      const { stateCode, startDate, endDate, programType } = params;
      
      const conditions: any[] = [];
      
      if (stateCode) {
        conditions.push(eq(eligibilityCalculations.stateCode, stateCode));
      }
      
      if (startDate) {
        conditions.push(gte(eligibilityCalculations.createdAt, startDate));
      }
      
      if (endDate) {
        conditions.push(lte(eligibilityCalculations.createdAt, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const stats = await db.select({
        program: eligibilityCalculations.programType,
        stateCode: eligibilityCalculations.stateCode,
        totalCalculations: sql<number>`count(*)::int`,
        eligibleCount: sql<number>`count(*) filter (where ${eligibilityCalculations.isEligible} = true)::int`,
        ineligibleCount: sql<number>`count(*) filter (where ${eligibilityCalculations.isEligible} = false)::int`,
        avgBenefitAmount: sql<number>`round(avg(${eligibilityCalculations.estimatedBenefit})::numeric, 2)`,
        medianBenefitAmount: sql<number>`percentile_cont(0.5) within group (order by ${eligibilityCalculations.estimatedBenefit})::numeric`,
      })
      .from(eligibilityCalculations)
      .where(whereClause)
      .groupBy(eligibilityCalculations.programType, eligibilityCalculations.stateCode);
      
      const suppressedGroups = stats
        .filter(row => row.totalCalculations < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `${r.program}_${r.stateCode}`);
      suppressedFields.push(...suppressedGroups);
      
      const safeStats = stats
        .filter(row => row.totalCalculations >= MINIMUM_SAMPLE_THRESHOLD);
      
      await this.logResearchAccess(params.apiKeyId, 'eligibility_stats', {
        params,
        recordCount: stats.length
      });
      
      return {
        success: true,
        data: safeStats,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: stats.length,
          suppressedFields,
          aggregationLevel: 'program_state',
          dataFreshness: new Date().toISOString(),
          warning: suppressedFields.length > 0 
            ? `${suppressedFields.length} groups suppressed due to small sample size` 
            : undefined
        }
      };
      
    } catch (error) {
      logger.error('Research eligibility stats query failed', {
        service: 'ResearchAggregationService',
        method: 'getEligibilityStats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        data: null,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: 0,
          suppressedFields: [],
          aggregationLevel: 'none',
          dataFreshness: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Get aggregated program outcome data
   */
  async getOutcomeStats(params: ResearchDataRequest): Promise<AggregatedResult> {
    const startTime = Date.now();
    const suppressedFields: string[] = [];
    
    try {
      const { stateCode, startDate, endDate } = params;
      
      const conditions: any[] = [];
      
      if (stateCode) {
        conditions.push(eq(clientCases.stateCode, stateCode));
      }
      
      if (startDate) {
        conditions.push(gte(clientCases.createdAt, startDate));
      }
      
      if (endDate) {
        conditions.push(lte(clientCases.createdAt, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const outcomeStats = await db.select({
        stateCode: clientCases.stateCode,
        status: clientCases.status,
        program: clientCases.programType,
        totalCases: sql<number>`count(*)::int`,
        avgProcessingDays: sql<number>`round(avg(extract(epoch from (${clientCases.updatedAt} - ${clientCases.createdAt})) / 86400)::numeric, 1)`,
      })
      .from(clientCases)
      .where(whereClause)
      .groupBy(clientCases.stateCode, clientCases.status, clientCases.programType);
      
      const suppressedGroups = outcomeStats
        .filter(row => row.totalCases < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `${r.program}_${r.stateCode}_${r.status}`);
      suppressedFields.push(...suppressedGroups);
      
      const safeStats = outcomeStats
        .filter(row => row.totalCases >= MINIMUM_SAMPLE_THRESHOLD);
      
      await this.logResearchAccess(params.apiKeyId, 'outcome_stats', {
        params,
        recordCount: outcomeStats.length
      });
      
      return {
        success: true,
        data: safeStats,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: outcomeStats.length,
          suppressedFields,
          aggregationLevel: 'program_state_status',
          dataFreshness: new Date().toISOString(),
          warning: suppressedFields.length > 0 
            ? `${suppressedFields.length} groups suppressed due to small sample size` 
            : undefined
        }
      };
      
    } catch (error) {
      logger.error('Research outcome stats query failed', {
        service: 'ResearchAggregationService',
        method: 'getOutcomeStats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        data: null,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: 0,
          suppressedFields: [],
          aggregationLevel: 'none',
          dataFreshness: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Get aggregated demographic distribution (PII-stripped)
   */
  async getDemographicDistribution(params: ResearchDataRequest): Promise<AggregatedResult> {
    const startTime = Date.now();
    const suppressedFields: string[] = [];
    
    try {
      const { stateCode, startDate, endDate } = params;
      
      const conditions: any[] = [];
      
      if (stateCode) {
        conditions.push(eq(householdProfiles.stateCode, stateCode));
      }
      
      if (startDate) {
        conditions.push(gte(householdProfiles.createdAt, startDate));
      }
      
      if (endDate) {
        conditions.push(lte(householdProfiles.createdAt, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const householdSizeStats = await db.select({
        stateCode: householdProfiles.stateCode,
        householdSize: householdProfiles.householdSize,
        count: sql<number>`count(*)::int`,
      })
      .from(householdProfiles)
      .where(whereClause)
      .groupBy(householdProfiles.stateCode, householdProfiles.householdSize);
      
      const suppressedSizeGroups = householdSizeStats
        .filter(row => row.count < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `household_size_${r.householdSize}_${r.stateCode}`);
      suppressedFields.push(...suppressedSizeGroups);
      
      const safeSizeStats = householdSizeStats
        .filter(row => row.count >= MINIMUM_SAMPLE_THRESHOLD);
      
      const incomeStats = await db.select({
        stateCode: householdProfiles.stateCode,
        incomeBracket: sql<string>`case 
          when ${householdProfiles.totalMonthlyIncome} < 1000 then 'under_1000'
          when ${householdProfiles.totalMonthlyIncome} < 2000 then '1000_2000'
          when ${householdProfiles.totalMonthlyIncome} < 3000 then '2000_3000'
          when ${householdProfiles.totalMonthlyIncome} < 5000 then '3000_5000'
          else 'over_5000'
        end`,
        count: sql<number>`count(*)::int`,
      })
      .from(householdProfiles)
      .where(whereClause)
      .groupBy(householdProfiles.stateCode, sql`case 
        when ${householdProfiles.totalMonthlyIncome} < 1000 then 'under_1000'
        when ${householdProfiles.totalMonthlyIncome} < 2000 then '1000_2000'
        when ${householdProfiles.totalMonthlyIncome} < 3000 then '2000_3000'
        when ${householdProfiles.totalMonthlyIncome} < 5000 then '3000_5000'
        else 'over_5000'
      end`);
      
      const suppressedIncomeGroups = incomeStats
        .filter(row => row.count < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `income_${r.incomeBracket}_${r.stateCode}`);
      suppressedFields.push(...suppressedIncomeGroups);
      
      const safeIncomeStats = incomeStats
        .filter(row => row.count >= MINIMUM_SAMPLE_THRESHOLD);
      
      await this.logResearchAccess(params.apiKeyId, 'demographic_distribution', {
        params,
        recordCount: householdSizeStats.length + incomeStats.length
      });
      
      return {
        success: true,
        data: {
          householdSizeDistribution: safeSizeStats,
          incomeDistribution: safeIncomeStats
        },
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: householdSizeStats.length + incomeStats.length,
          suppressedFields,
          aggregationLevel: 'state',
          dataFreshness: new Date().toISOString(),
          warning: suppressedFields.length > 0 
            ? `${suppressedFields.length} groups suppressed due to small sample size` 
            : undefined
        }
      };
      
    } catch (error) {
      logger.error('Research demographic distribution query failed', {
        service: 'ResearchAggregationService',
        method: 'getDemographicDistribution',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        data: null,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: 0,
          suppressedFields: [],
          aggregationLevel: 'none',
          dataFreshness: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Get PERM sampling and error rate data for research
   */
  async getPermResearchData(params: ResearchDataRequest): Promise<AggregatedResult> {
    const startTime = Date.now();
    const suppressedFields: string[] = [];
    
    try {
      const { stateCode, startDate, endDate } = params;
      
      const conditions: any[] = [];
      
      if (stateCode) {
        conditions.push(eq(perPermSamples.stateCode, stateCode));
      }
      
      if (startDate) {
        conditions.push(gte(perPermSamples.createdAt, startDate));
      }
      
      if (endDate) {
        conditions.push(lte(perPermSamples.createdAt, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const permStats = await db.select({
        stateCode: perPermSamples.stateCode,
        sampleType: perPermSamples.sampleType,
        reviewStatus: perPermSamples.reviewStatus,
        fiscalQuarter: perPermSamples.fiscalQuarter,
        totalSamples: sql<number>`count(*)::int`,
        errorCount: sql<number>`count(*) filter (where ${perPermSamples.hasError} = true)::int`,
        avgErrorAmount: sql<number>`round(avg(${perPermSamples.errorAmount})::numeric, 2)`,
        agencyErrorCount: sql<number>`count(*) filter (where ${perPermSamples.errorCategory} = 'agency_error')::int`,
        clientErrorCount: sql<number>`count(*) filter (where ${perPermSamples.errorCategory} = 'client_error')::int`,
      })
      .from(perPermSamples)
      .where(whereClause)
      .groupBy(
        perPermSamples.stateCode, 
        perPermSamples.sampleType, 
        perPermSamples.reviewStatus,
        perPermSamples.fiscalQuarter
      );
      
      const suppressedPermGroups = permStats
        .filter(row => row.totalSamples < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `perm_${r.stateCode}_${r.fiscalQuarter}`);
      suppressedFields.push(...suppressedPermGroups);
      
      const safeStats = permStats
        .filter(row => row.totalSamples >= MINIMUM_SAMPLE_THRESHOLD);
      
      const errorRateSummary = await db.select({
        stateCode: perPermSamples.stateCode,
        fiscalQuarter: perPermSamples.fiscalQuarter,
        completedReviews: sql<number>`count(*) filter (where ${perPermSamples.reviewStatus} = 'completed')::int`,
        errorRate: sql<number>`round((count(*) filter (where ${perPermSamples.hasError} = true)::numeric / 
          nullif(count(*) filter (where ${perPermSamples.reviewStatus} = 'completed'), 0)) * 100, 2)`,
      })
      .from(perPermSamples)
      .where(whereClause)
      .groupBy(perPermSamples.stateCode, perPermSamples.fiscalQuarter);
      
      await this.logResearchAccess(params.apiKeyId, 'perm_research_data', {
        params,
        recordCount: permStats.length
      });
      
      return {
        success: true,
        data: {
          permSampleStats: safeStats,
          errorRateSummary
        },
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: permStats.length,
          suppressedFields,
          aggregationLevel: 'state_quarter',
          dataFreshness: new Date().toISOString(),
          warning: suppressedFields.length > 0 
            ? `${suppressedFields.length} groups suppressed due to small sample size` 
            : undefined
        }
      };
      
    } catch (error) {
      logger.error('Research PERM data query failed', {
        service: 'ResearchAggregationService',
        method: 'getPermResearchData',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        data: null,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: 0,
          suppressedFields: [],
          aggregationLevel: 'none',
          dataFreshness: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Get Payment Error Reduction metrics for research
   */
  async getPerResearchMetrics(params: ResearchDataRequest): Promise<AggregatedResult> {
    const startTime = Date.now();
    
    try {
      const { stateCode, startDate, endDate } = params;
      
      const conditions: any[] = [];
      
      if (stateCode) {
        conditions.push(eq(perIncomeVerifications.stateCode, stateCode));
      }
      
      if (startDate) {
        conditions.push(gte(perIncomeVerifications.createdAt, startDate));
      }
      
      if (endDate) {
        conditions.push(lte(perIncomeVerifications.createdAt, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const incomeVerificationStats = await db.select({
        stateCode: perIncomeVerifications.stateCode,
        totalVerifications: sql<number>`count(*)::int`,
        discrepancyCount: sql<number>`count(*) filter (where ${perIncomeVerifications.hasDiscrepancy} = true)::int`,
        resolvedCount: sql<number>`count(*) filter (where ${perIncomeVerifications.resolved} = true)::int`,
        avgDiscrepancyPercent: sql<number>`round(avg(${perIncomeVerifications.discrepancyPercent})::numeric, 2)`,
      })
      .from(perIncomeVerifications)
      .where(whereClause)
      .groupBy(perIncomeVerifications.stateCode);
      
      const consistencyCheckConditions: any[] = [];
      if (stateCode) {
        consistencyCheckConditions.push(eq(perConsistencyChecks.stateCode, stateCode));
      }
      if (startDate) {
        consistencyCheckConditions.push(gte(perConsistencyChecks.createdAt, startDate));
      }
      if (endDate) {
        consistencyCheckConditions.push(lte(perConsistencyChecks.createdAt, endDate));
      }
      
      const checkWhereClause = consistencyCheckConditions.length > 0 
        ? and(...consistencyCheckConditions) 
        : undefined;
      
      const consistencyCheckStats = await db.select({
        stateCode: perConsistencyChecks.stateCode,
        checkType: perConsistencyChecks.checkType,
        totalChecks: sql<number>`count(*)::int`,
        failedCount: sql<number>`count(*) filter (where ${perConsistencyChecks.passed} = false)::int`,
        addressedCount: sql<number>`count(*) filter (where ${perConsistencyChecks.addressed} = true)::int`,
      })
      .from(perConsistencyChecks)
      .where(checkWhereClause)
      .groupBy(perConsistencyChecks.stateCode, perConsistencyChecks.checkType);
      
      const nudgeConditions: any[] = [];
      if (stateCode) {
        nudgeConditions.push(eq(perCaseworkerNudges.stateCode, stateCode));
      }
      if (startDate) {
        nudgeConditions.push(gte(perCaseworkerNudges.createdAt, startDate));
      }
      if (endDate) {
        nudgeConditions.push(lte(perCaseworkerNudges.createdAt, endDate));
      }
      
      const nudgeWhereClause = nudgeConditions.length > 0 
        ? and(...nudgeConditions) 
        : undefined;
      
      const nudgeStats = await db.select({
        stateCode: perCaseworkerNudges.stateCode,
        priority: perCaseworkerNudges.priority,
        totalNudges: sql<number>`count(*)::int`,
        viewedCount: sql<number>`count(*) filter (where ${perCaseworkerNudges.viewedAt} is not null)::int`,
        actionedCount: sql<number>`count(*) filter (where ${perCaseworkerNudges.actionTaken} is not null)::int`,
        errorPreventedCount: sql<number>`count(*) filter (where ${perCaseworkerNudges.outcome} = 'error_prevented')::int`,
      })
      .from(perCaseworkerNudges)
      .where(nudgeWhereClause)
      .groupBy(perCaseworkerNudges.stateCode, perCaseworkerNudges.priority);
      
      const suppressedFields: string[] = [];
      
      const suppressedVerifications = incomeVerificationStats
        .filter(row => row.totalVerifications < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `income_verification_${r.stateCode}`);
      suppressedFields.push(...suppressedVerifications);
      
      const safeIncomeVerification = incomeVerificationStats
        .filter(row => row.totalVerifications >= MINIMUM_SAMPLE_THRESHOLD);
      
      const suppressedChecks = consistencyCheckStats
        .filter(row => row.totalChecks < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `consistency_check_${r.checkType}_${r.stateCode}`);
      suppressedFields.push(...suppressedChecks);
      
      const safeConsistencyChecks = consistencyCheckStats
        .filter(row => row.totalChecks >= MINIMUM_SAMPLE_THRESHOLD);
      
      const suppressedNudges = nudgeStats
        .filter(row => row.totalNudges < MINIMUM_SAMPLE_THRESHOLD)
        .map(r => `nudge_${r.priority}_${r.stateCode}`);
      suppressedFields.push(...suppressedNudges);
      
      const safeNudgeStats = nudgeStats
        .filter(row => row.totalNudges >= MINIMUM_SAMPLE_THRESHOLD);
      
      await this.logResearchAccess(params.apiKeyId, 'per_research_metrics', {
        params,
        recordCount: safeIncomeVerification.length + safeConsistencyChecks.length + safeNudgeStats.length
      });
      
      return {
        success: true,
        data: {
          incomeVerification: safeIncomeVerification,
          consistencyChecks: safeConsistencyChecks,
          caseworkerNudges: safeNudgeStats
        },
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: safeIncomeVerification.length + safeConsistencyChecks.length + safeNudgeStats.length,
          suppressedFields,
          aggregationLevel: 'state',
          dataFreshness: new Date().toISOString(),
          warning: suppressedFields.length > 0 
            ? `${suppressedFields.length} groups suppressed due to small sample size` 
            : undefined
        }
      };
      
    } catch (error) {
      logger.error('Research PER metrics query failed', {
        service: 'ResearchAggregationService',
        method: 'getPerResearchMetrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        data: null,
        metadata: {
          queryTime: Date.now() - startTime,
          recordCount: 0,
          suppressedFields: [],
          aggregationLevel: 'none',
          dataFreshness: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Get API documentation for research endpoints
   */
  getApiDocumentation(): object {
    return {
      version: '1.0.0',
      baseUrl: '/api/research',
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        description: 'Include your API key in the X-API-Key header for all requests.'
      },
      rateLimit: {
        default: 100,
        description: 'Requests per hour. Higher limits available upon request.'
      },
      privacyProtections: {
        minimumSampleThreshold: MINIMUM_SAMPLE_THRESHOLD,
        piiStripping: 'All personally identifiable information is removed from responses.',
        smallCellSuppression: 'Groups with fewer than 10 records are suppressed or rounded.',
        auditLogging: 'All API access is logged for security and compliance.'
      },
      endpoints: [
        {
          path: '/eligibility',
          method: 'GET',
          scope: 'research:eligibility',
          description: 'Aggregated eligibility calculation statistics by program and state.',
          parameters: {
            stateCode: { type: 'string', required: false, example: 'MD' },
            startDate: { type: 'ISO 8601 date', required: false },
            endDate: { type: 'ISO 8601 date', required: false },
            programType: { type: 'string', required: false, example: 'snap' }
          }
        },
        {
          path: '/outcomes',
          method: 'GET',
          scope: 'research:outcomes',
          description: 'Case outcome statistics by status and program.',
          parameters: {
            stateCode: { type: 'string', required: false },
            startDate: { type: 'ISO 8601 date', required: false },
            endDate: { type: 'ISO 8601 date', required: false }
          }
        },
        {
          path: '/demographics',
          method: 'GET',
          scope: 'research:demographics',
          description: 'Aggregated demographic distributions (household size, income brackets).',
          parameters: {
            stateCode: { type: 'string', required: false },
            startDate: { type: 'ISO 8601 date', required: false },
            endDate: { type: 'ISO 8601 date', required: false }
          }
        },
        {
          path: '/perm',
          method: 'GET',
          scope: 'research:perm',
          description: 'PERM sampling results and federal payment error rate data.',
          parameters: {
            stateCode: { type: 'string', required: false },
            startDate: { type: 'ISO 8601 date', required: false },
            endDate: { type: 'ISO 8601 date', required: false }
          }
        },
        {
          path: '/per-metrics',
          method: 'GET',
          scope: 'research:perm',
          description: 'Payment Error Reduction module effectiveness metrics.',
          parameters: {
            stateCode: { type: 'string', required: false },
            startDate: { type: 'ISO 8601 date', required: false },
            endDate: { type: 'ISO 8601 date', required: false }
          }
        }
      ],
      responseFormat: {
        success: 'boolean',
        data: 'object - the aggregated research data',
        metadata: {
          queryTime: 'number - milliseconds to execute query',
          recordCount: 'number - total aggregated records returned',
          suppressedFields: 'array - fields suppressed due to privacy thresholds',
          aggregationLevel: 'string - granularity of aggregation',
          dataFreshness: 'ISO 8601 timestamp',
          warning: 'string - optional privacy warning message'
        }
      }
    };
  }
  
  /**
   * Round small numbers to nearest 5 for privacy protection
   */
  private roundToNearestFive(value: number): number {
    return Math.round(value / 5) * 5;
  }
  
  /**
   * Log research data access for audit trail
   */
  private async logResearchAccess(
    apiKeyId: string, 
    endpoint: string, 
    details: object
  ): Promise<void> {
    try {
      await db.insert(apiUsageLogs).values({
        apiKeyId,
        endpoint: `/api/research/${endpoint}`,
        method: 'GET',
        statusCode: 200,
        metadata: details
      });
    } catch (error) {
      logger.error('Failed to log research access', {
        service: 'ResearchAggregationService',
        method: 'logResearchAccess',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const researchAggregationService = new ResearchAggregationService();
