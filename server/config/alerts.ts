/**
 * Alert Configuration
 * 
 * Defines thresholds and rules for automated alerting
 * based on error rates, performance metrics, and system health
 */

export interface AlertThreshold {
  metric: string;
  threshold: number;
  window: number; // Time window in seconds
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console';
  enabled: boolean;
  config?: Record<string, any>;
}

/**
 * Alert thresholds configuration
 */
export const ALERT_THRESHOLDS: AlertThreshold[] = [
  // Error rate thresholds
  {
    metric: 'error_rate',
    threshold: 10, // errors per minute
    window: 60,
    severity: 'critical',
    description: 'High error rate detected'
  },
  {
    metric: 'error_rate',
    threshold: 5, // errors per minute
    window: 60,
    severity: 'warning',
    description: 'Elevated error rate'
  },
  
  // Performance thresholds
  {
    metric: 'response_time_p95',
    threshold: 5000, // 5 seconds
    window: 300, // 5 minutes
    severity: 'critical',
    description: 'Very slow response times (p95 > 5s)'
  },
  {
    metric: 'response_time_p95',
    threshold: 3000, // 3 seconds
    window: 300,
    severity: 'warning',
    description: 'Slow response times (p95 > 3s)'
  },
  {
    metric: 'response_time_p50',
    threshold: 2000, // 2 seconds
    window: 300,
    severity: 'warning',
    description: 'Elevated median response time (p50 > 2s)'
  },
  
  // Database thresholds
  {
    metric: 'database_error_rate',
    threshold: 5, // errors per minute
    window: 60,
    severity: 'critical',
    description: 'Database connection failures'
  },
  {
    metric: 'database_slow_query_rate',
    threshold: 10, // slow queries per minute
    window: 300,
    severity: 'warning',
    description: 'High rate of slow database queries'
  },
  
  // External API thresholds
  {
    metric: 'gemini_api_error_rate',
    threshold: 0.3, // 30% error rate
    window: 300,
    severity: 'critical',
    description: 'High Gemini API error rate'
  },
  {
    metric: 'policy_engine_error_rate',
    threshold: 0.3, // 30% error rate
    window: 300,
    severity: 'critical',
    description: 'High PolicyEngine API error rate'
  },
  
  // Cache thresholds
  {
    metric: 'cache_hit_rate',
    threshold: 0.5, // below 50% hit rate
    window: 600, // 10 minutes
    severity: 'warning',
    description: 'Low cache hit rate'
  },
  
  // Authentication thresholds
  {
    metric: 'auth_failure_rate',
    threshold: 10, // failures per minute
    window: 60,
    severity: 'critical',
    description: 'High authentication failure rate (possible attack)'
  },
];

/**
 * Critical error patterns that should always alert
 */
export const CRITICAL_ERROR_PATTERNS = [
  'database connection',
  'authentication failed',
  'out of memory',
  'disk full',
  'deadlock detected',
  'connection timeout',
  'service unavailable',
  'internal server error',
];

/**
 * Alert channels configuration
 */
export const ALERT_CHANNELS: AlertChannel[] = [
  {
    type: 'console',
    enabled: true,
    config: {}
  },
  {
    type: 'email',
    enabled: !!process.env.ALERT_EMAIL_TO,
    config: {
      to: process.env.ALERT_EMAIL_TO,
      from: process.env.ALERT_EMAIL_FROM || 'alerts@system.local',
      smtp: process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined
    }
  },
  {
    type: 'slack',
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      username: process.env.SLACK_BOT_USERNAME || 'System Alerts',
    }
  },
  {
    type: 'webhook',
    enabled: !!process.env.ALERT_WEBHOOK_URL,
    config: {
      url: process.env.ALERT_WEBHOOK_URL,
      method: 'POST',
      headers: process.env.ALERT_WEBHOOK_HEADERS ? JSON.parse(process.env.ALERT_WEBHOOK_HEADERS) : {},
    }
  },
];

/**
 * Alert rate limiting configuration
 */
export const ALERT_RATE_LIMITS = {
  // Maximum alerts per metric per hour
  maxAlertsPerMetricPerHour: 5,
  
  // Cooldown period between alerts for same metric (in seconds)
  alertCooldownPeriod: 600, // 10 minutes
  
  // Maximum total alerts per hour across all metrics
  maxTotalAlertsPerHour: 20,
};

export default {
  ALERT_THRESHOLDS,
  CRITICAL_ERROR_PATTERNS,
  ALERT_CHANNELS,
  ALERT_RATE_LIMITS,
};
