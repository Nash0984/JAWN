/**
 * Metrics Service
 * 
 * Records and aggregates performance and error metrics
 * Used for monitoring dashboard and alerting
 */

import { db } from "../db";
import { monitoringMetrics, type InsertMonitoringMetric } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

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

export class MetricsService {
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
      console.error("Failed to record metric:", error);
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
      console.error("Failed to get metrics summary:", error);
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
      console.error("Failed to calculate trends:", error);
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
      console.error("Failed to get top errors:", error);
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
      console.error("Failed to get slowest endpoints:", error);
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
      console.error("Failed to get error rate:", error);
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

      console.log(`Cleaned up metrics older than ${daysToKeep} days`);
      return 0; // Drizzle doesn't return count for deletes
    } catch (error) {
      console.error("Failed to cleanup old metrics:", error);
      return 0;
    }
  }
}

export const metricsService = new MetricsService();
