/**
 * Shared Monitoring Dashboard Types
 * 
 * This file defines the contract between backend metricsService and frontend Monitoring dashboard.
 * Both must use these exact types to ensure data compatibility.
 */

export interface MonitoringDashboardMetrics {
  errors: ErrorMetrics;
  security: SecurityMetrics;
  performance: PerformanceMetrics;
  eFiling: EFilingMetrics;
  ai: AIMetrics;
  cache: CacheMetrics;
  health: HealthMetrics;
  gateway?: GatewayMetrics;
}

export interface GatewayMetrics {
  totalInvocations: number;
  successfulVerifications: number;
  conflictOverrides: number;
  errors: number;
  coverageRate: number;
  byProgram: Array<{ program: string; invocations: number; verified: number; conflicts: number }>;
  byOperation: Array<{ operation: string; count: number }>;
  trend: Array<{ timestamp: string; invocations: number; verified: number; conflicts: number }>;
}

export interface ErrorMetrics {
  totalCount: number;
  errorRate: number;
  topErrors: Array<{ type: string; count: number; severity?: string }>;
  trend: Array<{ timestamp: string; count: number }>;
}

export interface SecurityMetrics {
  totalEvents: number;
  highSeverityThreats: number;
  failedLogins: number;
  eventsByType: Array<{ type: string; count: number }>;
  trend?: Array<{ timestamp: string; events: number }>;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowestEndpoints: Array<{ endpoint: string; avgTime: number; count?: number }>;
  trend?: Array<{ timestamp: string; avg: number; p95: number }>;
}

export interface EFilingMetrics {
  totalSubmissions: number;
  errorRate: number;
  avgProcessingTime: number | null;
  byStatus: Array<{ status: string; count: number }>;
  processingTimeTrend?: Array<{ timestamp: string; avgTime: number }>;
  recentSubmissions: Array<{
    id: string;
    status: string;
    createdAt: string;
    efileStatus?: string;
  }>;
}

export interface AIMetrics {
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
  callsByFeature: Record<string, { calls: number; tokens: number; cost: number }>;
  callsByModel: Record<string, { calls: number; tokens: number; cost: number }>;
  costTrend?: Array<{ timestamp: string; cost: number }>;
}

export interface CacheMetrics {
  hitRate: number;
  l1Status: string;
  status: string;
  hitRateByLayer: Array<{ layer: string; hitRate: number }>;
  invalidationEvents: Array<{ timestamp: string; count: number }>;
  layers: {
    L1: {
      status: string;
      caches: Record<string, any>;
    };
    L2?: { status: string; details?: string };
    L3?: { status: string; details?: string };
  };
}

export interface HealthMetrics {
  overallStatus: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  databaseConnected: boolean;
  components: Array<{ name: string; status: string; uptime?: number }> | {
    database: {
      status: 'pass' | 'fail';
      responseTime?: number;
      message?: string;
    };
    aiService: {
      status: 'pass' | 'fail';
      message?: string;
    };
    memory: {
      status: 'pass' | 'fail';
      usagePercent: number;
      message?: string;
    };
    objectStorage: {
      status: 'pass' | 'fail';
      message?: string;
    };
  };
}
