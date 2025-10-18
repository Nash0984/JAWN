/**
 * Resilience Metrics Service
 * 
 * Tracks and aggregates metrics for resilience operations:
 * - Request success/failure rates
 * - Retry counts
 * - Cache hit rates
 * - Circuit breaker states
 * - Response times
 */

import { CircuitState } from './circuitBreaker';

export interface ResilienceMetrics {
  endpointName: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  cacheHits: number;
  circuitState: CircuitState;
  lastFailure?: Date;
  lastSuccess?: Date;
  avgResponseTimeMs?: number;
  p95ResponseTimeMs?: number;
  p99ResponseTimeMs?: number;
}

interface RequestRecord {
  timestamp: Date;
  success: boolean;
  retries: number;
  fromCache: boolean;
  durationMs: number;
}

export class ResilienceMetricsService {
  private metrics: Map<string, ResilienceMetrics>;
  private requestHistory: Map<string, RequestRecord[]>;
  private readonly HISTORY_SIZE = 1000; // Keep last 1000 requests per endpoint

  constructor() {
    this.metrics = new Map();
    this.requestHistory = new Map();
  }

  /**
   * Record a request execution
   * 
   * @param endpointName - Name of the endpoint
   * @param success - Whether request succeeded
   * @param retries - Number of retries performed
   * @param fromCache - Whether result came from cache
   * @param durationMs - Total duration including retries
   */
  recordRequest(
    endpointName: string,
    success: boolean,
    retries: number,
    fromCache: boolean,
    durationMs: number
  ): void {
    // Initialize metrics if not exists
    if (!this.metrics.has(endpointName)) {
      this.metrics.set(endpointName, {
        endpointName,
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        retryCount: 0,
        cacheHits: 0,
        circuitState: CircuitState.CLOSED
      });
    }

    const metric = this.metrics.get(endpointName)!;

    // Update counters
    metric.totalRequests++;
    if (success) {
      metric.successCount++;
      metric.lastSuccess = new Date();
    } else {
      metric.failureCount++;
      metric.lastFailure = new Date();
    }
    metric.retryCount += retries;
    if (fromCache) {
      metric.cacheHits++;
    }

    // Record request history for percentile calculations
    this.recordHistory(endpointName, {
      timestamp: new Date(),
      success,
      retries,
      fromCache,
      durationMs
    });

    // Recalculate response time metrics
    this.updateResponseTimeMetrics(endpointName);
  }

  /**
   * Record circuit state change
   * 
   * @param endpointName - Name of the endpoint
   * @param newState - New circuit state
   */
  recordCircuitStateChange(endpointName: string, newState: CircuitState): void {
    // Initialize metrics if not exists
    if (!this.metrics.has(endpointName)) {
      this.metrics.set(endpointName, {
        endpointName,
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        retryCount: 0,
        cacheHits: 0,
        circuitState: newState
      });
    } else {
      const metric = this.metrics.get(endpointName)!;
      metric.circuitState = newState;
    }

    console.log(`[ResilienceMetrics] ${endpointName}: Circuit state → ${newState}`);
  }

  /**
   * Get metrics for a specific endpoint or all endpoints
   * 
   * @param endpointName - Optional endpoint name filter
   * @returns Array of metrics
   */
  getMetrics(endpointName?: string): ResilienceMetrics[] {
    if (endpointName) {
      const metric = this.metrics.get(endpointName);
      return metric ? [metric] : [];
    }

    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics summary (aggregated across all endpoints)
   */
  getSummary(): {
    totalEndpoints: number;
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    totalRetries: number;
    totalCacheHits: number;
    openCircuits: number;
    halfOpenCircuits: number;
  } {
    const allMetrics = this.getMetrics();

    return {
      totalEndpoints: allMetrics.length,
      totalRequests: allMetrics.reduce((sum, m) => sum + m.totalRequests, 0),
      totalSuccesses: allMetrics.reduce((sum, m) => sum + m.successCount, 0),
      totalFailures: allMetrics.reduce((sum, m) => sum + m.failureCount, 0),
      totalRetries: allMetrics.reduce((sum, m) => sum + m.retryCount, 0),
      totalCacheHits: allMetrics.reduce((sum, m) => sum + m.cacheHits, 0),
      openCircuits: allMetrics.filter(m => m.circuitState === CircuitState.OPEN).length,
      halfOpenCircuits: allMetrics.filter(m => m.circuitState === CircuitState.HALF_OPEN).length
    };
  }

  /**
   * Reset metrics for an endpoint
   * 
   * @param endpointName - Name of the endpoint
   */
  resetMetrics(endpointName: string): void {
    this.metrics.delete(endpointName);
    this.requestHistory.delete(endpointName);
    console.log(`[ResilienceMetrics] Reset metrics for: ${endpointName}`);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metrics.clear();
    this.requestHistory.clear();
    console.log(`[ResilienceMetrics] Reset all metrics`);
  }

  /**
   * Record request in history (for percentile calculations)
   */
  private recordHistory(endpointName: string, record: RequestRecord): void {
    if (!this.requestHistory.has(endpointName)) {
      this.requestHistory.set(endpointName, []);
    }

    const history = this.requestHistory.get(endpointName)!;
    history.push(record);

    // Keep only last HISTORY_SIZE records
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * Update response time metrics (avg, p95, p99)
   */
  private updateResponseTimeMetrics(endpointName: string): void {
    const history = this.requestHistory.get(endpointName);
    if (!history || history.length === 0) return;

    const metric = this.metrics.get(endpointName)!;

    // Calculate average
    const totalDuration = history.reduce((sum, r) => sum + r.durationMs, 0);
    metric.avgResponseTimeMs = Math.round(totalDuration / history.length);

    // Calculate percentiles (only from successful requests)
    const successfulDurations = history
      .filter(r => r.success)
      .map(r => r.durationMs)
      .sort((a, b) => a - b);

    if (successfulDurations.length > 0) {
      metric.p95ResponseTimeMs = this.percentile(successfulDurations, 95);
      metric.p99ResponseTimeMs = this.percentile(successfulDurations, 99);
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return Math.round(sortedArray[Math.max(0, index)]);
  }
}

// Singleton instance
export const resilienceMetricsService = new ResilienceMetricsService();
