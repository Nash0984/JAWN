/**
 * Unified Metrics Service
 * 
 * Aggregates 8 observability domains for admin monitoring dashboard:
 * 1. Errors - Error tracking and rate trends
 * 2. Security - Security events and threat detection
 * 3. Performance - API/DB response times
 * 4. E-Filing - Tax return submission status
 * 5. AI - AI API usage and costs
 * 6. Cache - Cache performance metrics
 * 7. Health - System health checks
 * 8. Gateway - Neuro-symbolic hybrid gateway routing and verification coverage
 */

import { db } from "../db";
import { 
  monitoringMetrics, 
  securityEvents, 
  auditLogs,
  federalTaxReturns,
  type InsertMonitoringMetric 
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc, count, inArray } from "drizzle-orm";
import { aiOrchestrator } from "./aiOrchestrator";
import { cacheOrchestrator } from "./cacheOrchestrator";
import { logger } from "./logger.service";
import type { 
  MonitoringDashboardMetrics,
  ErrorMetrics,
  SecurityMetrics,
  PerformanceMetrics,
  EFilingMetrics,
  AIMetrics,
  CacheMetrics,
  HealthMetrics,
  GatewayMetrics
} from "@shared/monitoring";
import { hybridGatewayAuditLogs } from "@shared/schema";

// ============================================================================
// Type Definitions
// ============================================================================

export interface TimeRange {
  start: Date;
  end: Date;
}

// Re-export the main interface
export type MetricsDomain = MonitoringDashboardMetrics;

export interface RealtimeMetricUpdate {
  timestamp: Date;
  errors: {
    count: number;
    recent: Array<{ type: string; time: Date }>;
  };
  performance: {
    avgResponseTime: number;
    slowRequests: number;
  };
  security: {
    recentEvents: number;
    severity: string;
  };
}

// Legacy types for backward compatibility
export interface MetricSummary {
  metricType: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface TrendData {
  timestamp: Date;
  value: number;
  count: number;
}

// ============================================================================
// Unified Metrics Service
// ============================================================================

export class MetricsService {
  /**
   * Get all metrics across 7 observability domains
   */
  async getAllMetrics(timeRange?: TimeRange, tenantId?: string): Promise<MetricsDomain> {
    const defaultRange = timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    };

    // Fetch all domains in parallel for efficiency
    const [errors, security, performance, eFiling, ai, cache, health, gateway] = await Promise.all([
      this.getErrorMetrics(defaultRange, tenantId),
      this.getSecurityMetrics(defaultRange, tenantId),
      this.getPerformanceMetrics(defaultRange, tenantId),
      this.getEFilingMetrics(defaultRange, tenantId),
      this.getAIMetrics(defaultRange),
      this.getCacheMetrics(),
      this.getHealthMetrics(),
      this.getGatewayMetrics(defaultRange, tenantId),
    ]);

    return {
      errors,
      security,
      performance,
      eFiling,
      ai,
      cache,
      health,
      gateway
    };
  }

  /**
   * Domain 1: Error Metrics
   */
  private async getErrorMetrics(timeRange: TimeRange, tenantId?: string): Promise<ErrorMetrics> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, 'error'),
        gte(monitoringMetrics.timestamp, timeRange.start),
        lte(monitoringMetrics.timestamp, timeRange.end),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      // Total errors
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(monitoringMetrics)
        .where(and(...conditions));
      
      const total = Number(totalResult[0]?.count || 0);

      // Error rate (errors per minute)
      const durationMinutes = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60);
      const rate = durationMinutes > 0 ? total / durationMinutes : 0;

      // Top error types
      const topTypes = await db
        .select({
          errorType: sql<string>`${monitoringMetrics.metadata}->>'errorType'`,
          count: sql<number>`COUNT(*)`,
          lastOccurrence: sql<Date>`MAX(${monitoringMetrics.timestamp})`,
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(sql`${monitoringMetrics.metadata}->>'errorType'`)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(10);

      // Error trend (hourly buckets)
      const trend = await db
        .select({
          timestamp: sql<Date>`date_trunc('hour', ${monitoringMetrics.timestamp})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(sql`date_trunc('hour', ${monitoringMetrics.timestamp})`)
        .orderBy(sql`date_trunc('hour', ${monitoringMetrics.timestamp})`);

      return {
        totalCount: total,
        errorRate: Number(rate.toFixed(2)),
        topErrors: topTypes.map(t => ({
          type: t.errorType || 'Unknown',
          count: Number(t.count),
          severity: 'medium', // Default severity, could be enhanced later
        })),
        trend: trend.map(t => ({
          timestamp: new Date(t.timestamp as any).toISOString(),
          count: Number(t.count),
        })),
      };
    } catch (error) {
      logger.error('Error fetching error metrics', { error });
      return {
        totalCount: 0,
        errorRate: 0,
        topErrors: [],
        trend: [],
      };
    }
  }

  /**
   * Domain 2: Security Metrics
   */
  private async getSecurityMetrics(timeRange: TimeRange, tenantId?: string): Promise<SecurityMetrics> {
    try {
      const conditions = [
        gte(securityEvents.occurredAt, timeRange.start),
        lte(securityEvents.occurredAt, timeRange.end),
      ];

      // Total security events
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(securityEvents)
        .where(and(...conditions));
      
      const totalEvents = Number(totalResult[0]?.count || 0);

      // Events by type
      const eventsByTypeResult = await db
        .select({
          eventType: securityEvents.eventType,
          count: sql<number>`COUNT(*)`,
        })
        .from(securityEvents)
        .where(and(...conditions))
        .groupBy(securityEvents.eventType);

      const eventsByType: Record<string, number> = {};
      eventsByTypeResult.forEach(e => {
        eventsByType[e.eventType || 'unknown'] = Number(e.count);
      });

      // Failed logins
      const failedLoginConditions = [
        ...conditions,
        eq(securityEvents.eventType, 'failed_login'),
      ];
      const failedLoginsResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(securityEvents)
        .where(and(...failedLoginConditions));
      
      const failedLogins = Number(failedLoginsResult[0]?.count || 0);

      // Top threats (high severity events)
      const threats = await db
        .select({
          eventType: securityEvents.eventType,
          severity: securityEvents.severity,
          count: sql<number>`COUNT(*)`,
          lastOccurrence: sql<Date>`MAX(${securityEvents.occurredAt})`,
        })
        .from(securityEvents)
        .where(and(
          ...conditions,
          inArray(securityEvents.severity, ['high', 'critical'])
        ))
        .groupBy(securityEvents.eventType, securityEvents.severity)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(10);

      // Suspicious activity (rate_limit_exceeded, brute_force_attempt)
      const suspiciousConditions = [
        ...conditions,
        inArray(securityEvents.eventType, ['rate_limit_exceeded', 'brute_force_attempt', 'suspicious_activity']),
      ];
      const suspiciousResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(securityEvents)
        .where(and(...suspiciousConditions));

      // Convert eventsByType Record to Array
      const eventsByTypeArray = Object.entries(eventsByType).map(([type, count]) => ({
        type,
        count,
      }));

      // Calculate threats detected (high severity events)
      const threatsDetected = threats.reduce((sum, t) => sum + Number(t.count), 0);

      // Get security event trend (hourly buckets)
      const trendResult = await db
        .select({
          timestamp: sql<Date>`date_trunc('hour', ${securityEvents.occurredAt})`,
          events: sql<number>`COUNT(*)`,
        })
        .from(securityEvents)
        .where(and(...conditions))
        .groupBy(sql`date_trunc('hour', ${securityEvents.occurredAt})`)
        .orderBy(sql`date_trunc('hour', ${securityEvents.occurredAt})`);

      return {
        totalEvents,
        highSeverityThreats: threatsDetected,
        failedLogins,
        eventsByType: eventsByTypeArray,
        trend: trendResult.map(t => ({
          timestamp: new Date(t.timestamp as any).toISOString(),
          events: Number(t.events),
        })),
      };
    } catch (error) {
      logger.error('Error fetching security metrics', { error });
      return {
        totalEvents: 0,
        highSeverityThreats: 0,
        failedLogins: 0,
        eventsByType: [],
        trend: [],
      };
    }
  }

  /**
   * Domain 3: Performance Metrics
   */
  private async getPerformanceMetrics(timeRange: TimeRange, tenantId?: string): Promise<PerformanceMetrics> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, 'response_time'),
        gte(monitoringMetrics.timestamp, timeRange.start),
        lte(monitoringMetrics.timestamp, timeRange.end),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      // Average response time
      const avgResult = await db
        .select({
          avg: sql<number>`AVG(${monitoringMetrics.metricValue})`,
          p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${monitoringMetrics.metricValue})`,
          p99: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${monitoringMetrics.metricValue})`,
        })
        .from(monitoringMetrics)
        .where(and(...conditions));

      const avgResponseTime = Number(avgResult[0]?.avg || 0);
      const p95ResponseTime = Number(avgResult[0]?.p95 || 0);
      const p99ResponseTime = Number(avgResult[0]?.p99 || 0);

      // Slowest endpoints
      const slowEndpoints = await db
        .select({
          endpoint: sql<string>`${monitoringMetrics.metadata}->>'endpoint'`,
          avgTime: sql<number>`AVG(${monitoringMetrics.metricValue})`,
          p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${monitoringMetrics.metricValue})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(sql`${monitoringMetrics.metadata}->>'endpoint'`)
        .orderBy(desc(sql`AVG(${monitoringMetrics.metricValue})`))
        .limit(10);

      // Database query time
      const dbConditions = [
        eq(monitoringMetrics.metricType, 'database_query'),
        gte(monitoringMetrics.timestamp, timeRange.start),
        lte(monitoringMetrics.timestamp, timeRange.end),
      ];
      const dbResult = await db
        .select({ avg: sql<number>`AVG(${monitoringMetrics.metricValue})` })
        .from(monitoringMetrics)
        .where(and(...dbConditions));

      const databaseQueryTime = Number(dbResult[0]?.avg || 0);

      // API latency
      const apiConditions = [
        eq(monitoringMetrics.metricType, 'api_latency'),
        gte(monitoringMetrics.timestamp, timeRange.start),
        lte(monitoringMetrics.timestamp, timeRange.end),
      ];
      const apiResult = await db
        .select({ avg: sql<number>`AVG(${monitoringMetrics.metricValue})` })
        .from(monitoringMetrics)
        .where(and(...apiConditions));

      const apiLatency = Number(apiResult[0]?.avg || 0);

      // Get performance trend (hourly buckets)
      const trendResult = await db
        .select({
          timestamp: sql<Date>`date_trunc('hour', ${monitoringMetrics.timestamp})`,
          avg: sql<number>`AVG(${monitoringMetrics.metricValue})`,
          p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${monitoringMetrics.metricValue})`,
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(sql`date_trunc('hour', ${monitoringMetrics.timestamp})`)
        .orderBy(sql`date_trunc('hour', ${monitoringMetrics.timestamp})`);

      return {
        avgResponseTime: Number(avgResponseTime.toFixed(2)),
        p95ResponseTime: Number(p95ResponseTime.toFixed(2)),
        p99ResponseTime: Number(p99ResponseTime.toFixed(2)),
        slowestEndpoints: slowEndpoints.map(e => ({
          endpoint: e.endpoint || 'Unknown',
          avgTime: Number(Number(e.avgTime).toFixed(2)),
          count: Number(e.count),
        })),
        trend: trendResult.map(t => ({
          timestamp: new Date(t.timestamp as any).toISOString(),
          avg: Number(Number(t.avg).toFixed(2)),
          p95: Number(Number(t.p95).toFixed(2)),
        })),
      };
    } catch (error) {
      logger.error('Error fetching performance metrics', { error });
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowestEndpoints: [],
        trend: [],
      };
    }
  }

  /**
   * Domain 4: E-Filing Metrics
   */
  private async getEFilingMetrics(timeRange: TimeRange, tenantId?: string): Promise<EFilingMetrics> {
    try {
      const conditions = [
        gte(federalTaxReturns.createdAt, timeRange.start),
        lte(federalTaxReturns.createdAt, timeRange.end),
      ];

      // Total submissions
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(federalTaxReturns)
        .where(and(...conditions));
      
      const totalSubmissions = Number(totalResult[0]?.count || 0);

      // Submissions by e-file status
      const byStatusResult = await db
        .select({
          status: federalTaxReturns.efileStatus,
          count: sql<number>`COUNT(*)`,
        })
        .from(federalTaxReturns)
        .where(and(...conditions))
        .groupBy(federalTaxReturns.efileStatus);

      const byStatus: Record<string, number> = {};
      byStatusResult.forEach(s => {
        byStatus[s.status || 'not_filed'] = Number(s.count);
      });

      // Error rate (rejected / total)
      const rejectedCount = byStatus['rejected'] || 0;
      const errorRate = totalSubmissions > 0 ? (rejectedCount / totalSubmissions) * 100 : 0;

      // Average processing time (for accepted returns)
      const processingTimeResult = await db
        .select({
          avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${federalTaxReturns.efileAcceptedAt} - ${federalTaxReturns.createdAt})))`,
        })
        .from(federalTaxReturns)
        .where(and(
          ...conditions,
          eq(federalTaxReturns.efileStatus, 'accepted')
        ));

      const avgProcessingTime = Number(processingTimeResult[0]?.avgTime || 0) / 60; // Convert to minutes

      // Recent submissions
      const recentSubmissions = await db
        .select({
          id: federalTaxReturns.id,
          efileStatus: federalTaxReturns.efileStatus,
          createdAt: federalTaxReturns.createdAt,
        })
        .from(federalTaxReturns)
        .where(and(...conditions))
        .orderBy(desc(federalTaxReturns.createdAt))
        .limit(10);

      // Convert byStatus Record to Array for statusBreakdown
      const statusBreakdown = Object.entries(byStatus).map(([status, count]) => ({
        status,
        count,
      }));

      // Get processing time trend (hourly buckets for accepted returns)
      const processingTrendResult = await db
        .select({
          timestamp: sql<Date>`date_trunc('hour', ${federalTaxReturns.createdAt})`,
          avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${federalTaxReturns.efileAcceptedAt} - ${federalTaxReturns.createdAt})))`,
        })
        .from(federalTaxReturns)
        .where(and(
          ...conditions,
          eq(federalTaxReturns.efileStatus, 'accepted')
        ))
        .groupBy(sql`date_trunc('hour', ${federalTaxReturns.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${federalTaxReturns.createdAt})`);

      return {
        totalSubmissions,
        errorRate: Number(errorRate.toFixed(2)),
        avgProcessingTime: avgProcessingTime > 0 ? Number(avgProcessingTime.toFixed(2)) : null,
        byStatus: statusBreakdown,
        processingTimeTrend: processingTrendResult.map(t => ({
          timestamp: new Date(t.timestamp as any).toISOString(),
          avgTime: Number((Number(t.avgTime) / 60).toFixed(2)), // Convert to minutes
        })),
        recentSubmissions: recentSubmissions.map(s => ({
          id: s.id,
          status: 'filed',
          createdAt: s.createdAt.toISOString(),
          efileStatus: s.efileStatus || undefined,
        })),
      };
    } catch (error) {
      logger.error('Error fetching e-filing metrics', { error });
      return {
        totalSubmissions: 0,
        errorRate: 0,
        avgProcessingTime: null,
        byStatus: [],
        processingTimeTrend: [],
        recentSubmissions: [],
      };
    }
  }

  /**
   * Domain 5: AI Metrics
   */
  private async getAIMetrics(timeRange?: TimeRange): Promise<AIMetrics> {
    try {
      const costMetrics = await aiOrchestrator.getCostMetrics(timeRange);
      
      // Convert callsByFeature Record to Array
      const callsByFeature = Object.entries(costMetrics.callsByFeature).map(([feature, data]) => ({
        feature,
        calls: data.calls,
        tokens: data.tokens,
        cost: data.cost,
      }));

      // Convert callsByModel Record to Array (tokensByModel)
      const tokensByModel = Object.entries(costMetrics.callsByModel).map(([model, data]) => ({
        model,
        tokens: data.tokens,
        calls: data.calls,
        cost: data.cost,
      }));

      // Create cost trend (mock data for now - could be enhanced with actual trend data)
      const costTrend = [
        { timestamp: new Date().toISOString(), cost: Number(costMetrics.estimatedCost.toFixed(4)) }
      ];
      
      return {
        totalCost: Number(costMetrics.estimatedCost.toFixed(4)),
        totalCalls: costMetrics.totalCalls,
        totalTokens: costMetrics.totalTokens,
        callsByFeature,
        callsByModel: tokensByModel,
        costTrend,
      };
    } catch (error) {
      logger.error('Error fetching AI metrics', { error });
      return {
        totalCost: 0,
        totalCalls: 0,
        totalTokens: 0,
        callsByFeature: {},
        callsByModel: {},
        costTrend: [],
      };
    }
  }

  /**
   * Domain 6: Cache Metrics
   */
  private async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      const cacheHealth = await cacheOrchestrator.getCacheHealth();
      
      // Calculate overall hit rate
      let totalHits = 0;
      let totalRequests = 0;
      const hitRateByLayer: Array<{ layer: string; hitRate: number }> = [];

      Object.entries(cacheHealth.layers.L1.caches).forEach(([key, cache]) => {
        const hitRate = parseFloat(cache.hitRate.replace('%', ''));
        hitRateByLayer.push({ layer: key, hitRate });
        totalHits += hitRate * cache.size; // Approximation
        totalRequests += cache.size;
      });

      const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) : 0;

      // Mock invalidation events (could be enhanced with actual tracking)
      const invalidationEvents = [
        { timestamp: new Date().toISOString(), count: 0 }
      ];

      return {
        hitRate: Number(overallHitRate.toFixed(1)),
        l1Status: cacheHealth.layers.L1.status,
        status: cacheHealth.status,
        hitRateByLayer,
        invalidationEvents,
        layers: {
          L1: cacheHealth.layers.L1,
          L2: cacheHealth.layers.L2,
          L3: cacheHealth.layers.L3,
        },
      };
    } catch (error) {
      logger.error('Error fetching cache metrics', { error });
      return {
        hitRate: 0,
        l1Status: 'critical',
        status: 'critical',
        hitRateByLayer: [],
        invalidationEvents: [],
        layers: {
          L1: { status: 'critical', caches: {} },
        },
      };
    }
  }

  /**
   * Domain 7: Health Metrics
   */
  private async getHealthMetrics(): Promise<HealthMetrics> {
    const health: HealthMetrics = {
      status: 'healthy',
      overallStatus: 'healthy',
      uptime: process.uptime(),
      databaseConnected: false,
      components: {
        database: { status: 'fail', message: 'Not checked' },
        aiService: { status: 'fail', message: 'Not configured' },
        memory: { status: 'fail', usagePercent: 0, message: 'Not checked' },
        objectStorage: { status: 'fail', message: 'Not configured' },
      },
    };

    try {
      // Database check
      const dbStart = Date.now();
      await db.execute(sql`SELECT 1 as health_check`);
      health.components.database = {
        status: 'pass',
        responseTime: Date.now() - dbStart,
        message: 'Database connection successful',
      };
      health.databaseConnected = true;
    } catch (error) {
      health.status = 'unhealthy';
      health.overallStatus = 'unhealthy';
      health.databaseConnected = false;
      health.components.database = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }

    // AI Service check
    const hasAIKey = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    health.components.aiService = {
      status: hasAIKey ? 'pass' : 'fail',
      message: hasAIKey ? 'AI service configured' : 'GOOGLE_API_KEY not configured',
    };
    if (!hasAIKey && health.status === 'healthy') {
      health.status = 'degraded';
      health.overallStatus = 'degraded';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapUsedPercent > 90) {
      health.components.memory = {
        status: 'fail',
        usagePercent: Number(heapUsedPercent.toFixed(1)),
        message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`,
      };
      health.status = 'unhealthy';
      health.overallStatus = 'unhealthy';
    } else {
      health.components.memory = {
        status: 'pass',
        usagePercent: Number(heapUsedPercent.toFixed(1)),
        message: `Memory usage: ${heapUsedPercent.toFixed(1)}%`,
      };
    }

    // Object Storage check
    const hasStorage = !!process.env.GCS_BUCKET_NAME;
    health.components.objectStorage = {
      status: hasStorage ? 'pass' : 'fail',
      message: hasStorage ? 'Object storage configured' : 'GCS bucket not configured',
    };
    if (!hasStorage && health.status === 'healthy') {
      health.status = 'degraded';
      health.overallStatus = 'degraded';
    }

    return health;
  }

  /**
   * Domain 8: Gateway Metrics (Neuro-Symbolic Hybrid Gateway)
   * Tracks Gateway routing coverage, verification success, and conflict resolution
   */
  private async getGatewayMetrics(timeRange: TimeRange, tenantId?: string): Promise<GatewayMetrics> {
    try {
      const conditions = [
        gte(hybridGatewayAuditLogs.createdAt, timeRange.start),
        lte(hybridGatewayAuditLogs.createdAt, timeRange.end),
      ];

      if (tenantId) {
        conditions.push(eq(hybridGatewayAuditLogs.tenantId, tenantId));
      }

      // Get overall counts
      const totals = await db
        .select({
          total: sql<number>`COUNT(*)`.as('total'),
          verified: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.solverResult} = 'SAT' OR ${hybridGatewayAuditLogs.isLegallyGrounded} = true)`.as('verified'),
          conflicts: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.solverResult} = 'UNSAT')`.as('conflicts'),
          errors: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.errorInfo} IS NOT NULL)`.as('errors'),
        })
        .from(hybridGatewayAuditLogs)
        .where(and(...conditions));

      const totalInvocations = Number(totals[0]?.total || 0);
      const successfulVerifications = Number(totals[0]?.verified || 0);
      const conflictOverrides = Number(totals[0]?.conflicts || 0);
      const errors = Number(totals[0]?.errors || 0);

      // Coverage by program
      const byProgram = await db
        .select({
          program: hybridGatewayAuditLogs.programCode,
          invocations: sql<number>`COUNT(*)`.as('invocations'),
          verified: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.solverResult} = 'SAT' OR ${hybridGatewayAuditLogs.isLegallyGrounded} = true)`.as('verified'),
          conflicts: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.solverResult} = 'UNSAT')`.as('conflicts'),
        })
        .from(hybridGatewayAuditLogs)
        .where(and(...conditions))
        .groupBy(hybridGatewayAuditLogs.programCode);

      // Coverage by operation type
      const byOperation = await db
        .select({
          operation: hybridGatewayAuditLogs.operationType,
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(hybridGatewayAuditLogs)
        .where(and(...conditions))
        .groupBy(hybridGatewayAuditLogs.operationType);

      // Trend data (hourly)
      const trend = await db
        .select({
          timestamp: sql`date_trunc('hour', ${hybridGatewayAuditLogs.createdAt})`.as('bucket'),
          invocations: sql<number>`COUNT(*)`.as('invocations'),
          verified: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.solverResult} = 'SAT' OR ${hybridGatewayAuditLogs.isLegallyGrounded} = true)`.as('verified'),
          conflicts: sql<number>`COUNT(*) FILTER (WHERE ${hybridGatewayAuditLogs.solverResult} = 'UNSAT')`.as('conflicts'),
        })
        .from(hybridGatewayAuditLogs)
        .where(and(...conditions))
        .groupBy(sql`date_trunc('hour', ${hybridGatewayAuditLogs.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${hybridGatewayAuditLogs.createdAt})`);

      return {
        totalInvocations,
        successfulVerifications,
        conflictOverrides,
        errors,
        coverageRate: totalInvocations > 0 ? successfulVerifications / totalInvocations : 0,
        byProgram: byProgram.map(p => ({
          program: p.program || 'unknown',
          invocations: Number(p.invocations),
          verified: Number(p.verified),
          conflicts: Number(p.conflicts),
        })),
        byOperation: byOperation.map(o => ({
          operation: o.operation || 'unknown',
          count: Number(o.count),
        })),
        trend: trend.map(t => ({
          timestamp: new Date(t.timestamp as any).toISOString(),
          invocations: Number(t.invocations),
          verified: Number(t.verified),
          conflicts: Number(t.conflicts),
        })),
      };
    } catch (error) {
      logger.error('Error fetching gateway metrics', { error });
      return {
        totalInvocations: 0,
        successfulVerifications: 0,
        conflictOverrides: 0,
        errors: 0,
        coverageRate: 0,
        byProgram: [],
        byOperation: [],
        trend: [],
      };
    }
  }

  /**
   * Get realtime metric update for WebSocket broadcasting
   */
  async getRealtimeUpdate(): Promise<RealtimeMetricUpdate> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Recent errors
      const recentErrors = await db
        .select({
          errorType: sql<string>`${monitoringMetrics.metadata}->>'errorType'`,
          timestamp: monitoringMetrics.timestamp,
        })
        .from(monitoringMetrics)
        .where(and(
          eq(monitoringMetrics.metricType, 'error'),
          gte(monitoringMetrics.timestamp, fiveMinutesAgo)
        ))
        .limit(5);

      // Recent performance
      const performanceResult = await db
        .select({
          avg: sql<number>`AVG(${monitoringMetrics.metricValue})`,
          slowCount: sql<number>`COUNT(*) FILTER (WHERE ${monitoringMetrics.metricValue} > 1000)`,
        })
        .from(monitoringMetrics)
        .where(and(
          eq(monitoringMetrics.metricType, 'response_time'),
          gte(monitoringMetrics.timestamp, fiveMinutesAgo)
        ));

      // Recent security events
      const securityResult = await db
        .select({
          count: sql<number>`COUNT(*)`,
          maxSeverity: sql<string>`MAX(${securityEvents.severity})`,
        })
        .from(securityEvents)
        .where(gte(securityEvents.occurredAt, fiveMinutesAgo));

      return {
        timestamp: now,
        errors: {
          count: recentErrors.length,
          recent: recentErrors.map(e => ({
            type: e.errorType || 'unknown',
            time: e.timestamp,
          })),
        },
        performance: {
          avgResponseTime: Number(performanceResult[0]?.avg || 0),
          slowRequests: Number(performanceResult[0]?.slowCount || 0),
        },
        security: {
          recentEvents: Number(securityResult[0]?.count || 0),
          severity: securityResult[0]?.maxSeverity || 'low',
        },
      };
    } catch (error) {
      logger.error('Error fetching realtime update', { error });
      return {
        timestamp: new Date(),
        errors: { count: 0, recent: [] },
        performance: { avgResponseTime: 0, slowRequests: 0 },
        security: { recentEvents: 0, severity: 'low' },
      };
    }
  }

  // ============================================================================
  // Legacy Methods (Backward Compatibility)
  // ============================================================================

  /**
   * Record a metric
   */
  async recordMetric(
    metricType: string,
    metricValue: number,
    metadata?: Record<string, any>,
    tenantId?: string
  ): Promise<void> {
    try {
      await db.insert(monitoringMetrics).values({
        metricType,
        metricValue,
        metadata: metadata as any,
        tenantId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to record metric', { error });
      // Don't throw - metrics recording should never break the app
    }
  }

  /**
   * Get metrics summary for a specific type and time range
   */
  async getMetricsSummary(
    metricType: string,
    startTime: Date,
    endTime: Date,
    tenantId?: string
  ): Promise<MetricSummary | null> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, metricType),
        gte(monitoringMetrics.timestamp, startTime),
        lte(monitoringMetrics.timestamp, endTime),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      const metrics = await db
        .select({
          value: monitoringMetrics.metricValue,
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .orderBy(monitoringMetrics.metricValue);

      if (metrics.length === 0) {
        return null;
      }

      const values = metrics.map(m => m.value);
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const min = values[0];
      const max = values[count - 1];

      const percentile = (p: number) => {
        const index = Math.ceil((p / 100) * count) - 1;
        return values[index];
      };

      return {
        metricType,
        count,
        avg,
        min,
        max,
        p50: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99),
      };
    } catch (error) {
      logger.error('Failed to get metrics summary', { error });
      return null;
    }
  }

  /**
   * Calculate trends over time (grouped by time buckets)
   */
  async calculateTrends(
    metricType: string,
    startTime: Date,
    endTime: Date,
    bucketSize: 'hour' | 'day' = 'hour',
    tenantId?: string
  ): Promise<TrendData[]> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, metricType),
        gte(monitoringMetrics.timestamp, startTime),
        lte(monitoringMetrics.timestamp, endTime),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      const truncFunc = bucketSize === 'hour' 
        ? sql`date_trunc('hour', ${monitoringMetrics.timestamp})`
        : sql`date_trunc('day', ${monitoringMetrics.timestamp})`;

      const trends = await db
        .select({
          timestamp: truncFunc.as('bucket'),
          avgValue: sql<number>`AVG(${monitoringMetrics.metricValue})`.as('avg_value'),
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(truncFunc)
        .orderBy(truncFunc);

      return trends.map(t => ({
        timestamp: new Date(t.timestamp as any),
        value: Number(t.avgValue),
        count: Number(t.count),
      }));
    } catch (error) {
      logger.error('Failed to calculate trends', { error });
      return [];
    }
  }

  /**
   * Get top errors by frequency
   */
  async getTopErrors(
    startTime: Date,
    endTime: Date,
    limit: number = 10,
    tenantId?: string
  ): Promise<Array<{ errorType: string; count: number; lastOccurrence: Date }>> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, 'error'),
        gte(monitoringMetrics.timestamp, startTime),
        lte(monitoringMetrics.timestamp, endTime),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      const errors = await db
        .select({
          errorType: sql<string>`${monitoringMetrics.metadata}->>'errorType'`.as('error_type'),
          count: sql<number>`COUNT(*)`.as('count'),
          lastOccurrence: sql<Date>`MAX(${monitoringMetrics.timestamp})`.as('last_occurrence'),
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(sql`${monitoringMetrics.metadata}->>'errorType'`)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(limit);

      return errors.map(e => ({
        errorType: e.errorType || 'Unknown',
        count: Number(e.count),
        lastOccurrence: new Date(e.lastOccurrence as any),
      }));
    } catch (error) {
      logger.error('Failed to get top errors', { error });
      return [];
    }
  }

  /**
   * Get slowest endpoints
   */
  async getSlowestEndpoints(
    startTime: Date,
    endTime: Date,
    limit: number = 10,
    tenantId?: string
  ): Promise<Array<{ endpoint: string; avgResponseTime: number; p95: number; count: number }>> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, 'response_time'),
        gte(monitoringMetrics.timestamp, startTime),
        lte(monitoringMetrics.timestamp, endTime),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      const endpoints = await db
        .select({
          endpoint: sql<string>`${monitoringMetrics.metadata}->>'endpoint'`.as('endpoint'),
          avgResponseTime: sql<number>`AVG(${monitoringMetrics.metricValue})`.as('avg_response_time'),
          p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${monitoringMetrics.metricValue})`.as('p95'),
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(monitoringMetrics)
        .where(and(...conditions))
        .groupBy(sql`${monitoringMetrics.metadata}->>'endpoint'`)
        .orderBy(desc(sql`AVG(${monitoringMetrics.metricValue})`))
        .limit(limit);

      return endpoints.map(e => ({
        endpoint: e.endpoint || 'Unknown',
        avgResponseTime: Number(e.avgResponseTime),
        p95: Number(e.p95),
        count: Number(e.count),
      }));
    } catch (error) {
      logger.error('Failed to get slowest endpoints', { error });
      return [];
    }
  }

  /**
   * Get error rate for a time window
   */
  async getErrorRate(
    startTime: Date,
    endTime: Date,
    tenantId?: string
  ): Promise<number> {
    try {
      const conditions = [
        eq(monitoringMetrics.metricType, 'error'),
        gte(monitoringMetrics.timestamp, startTime),
        lte(monitoringMetrics.timestamp, endTime),
      ];

      if (tenantId) {
        conditions.push(eq(monitoringMetrics.tenantId, tenantId));
      }

      const result = await db
        .select({
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(monitoringMetrics)
        .where(and(...conditions));

      const errorCount = Number(result[0]?.count || 0);
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      return durationMinutes > 0 ? errorCount / durationMinutes : 0;
    } catch (error) {
      logger.error('Failed to get error rate', { error });
      return 0;
    }
  }

  /**
   * Clean up old metrics (retention policy)
   */
  async cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db
        .delete(monitoringMetrics)
        .where(lte(monitoringMetrics.timestamp, cutoffDate));

      logger.info('Cleaned up old metrics', { daysToKeep });
      return 0; // Drizzle doesn't return count for deletes
    } catch (error) {
      logger.error('Failed to cleanup old metrics', { error });
      return 0;
    }
  }
}

export const metricsService = new MetricsService();
