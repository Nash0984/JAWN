import { Request, Response } from 'express';
import { connectionPool } from './connectionPool';
import { distributedCache } from './distributedCache';
import { webSocketService } from './scalableWebSocket';
import * as os from 'os';
import * as process from 'process';

// Metric types for Prometheus
interface Counter {
  name: string;
  help: string;
  value: number;
  labels?: Record<string, string>;
}

interface Gauge {
  name: string;
  help: string;
  value: number;
  labels?: Record<string, string>;
}

interface Histogram {
  name: string;
  help: string;
  buckets: number[];
  values: Map<number, number>;
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

// Metrics collector
class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private startTime: number = Date.now();

  // HTTP metrics
  private httpRequestsTotal = 0;
  private httpRequestDuration: number[] = [];
  private httpRequestsByMethod: Map<string, number> = new Map();
  private httpRequestsByStatus: Map<number, number> = new Map();
  private httpRequestsByPath: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // Process metrics
    this.registerGauge('process_uptime_seconds', 'Process uptime in seconds');
    this.registerGauge('process_cpu_usage_percent', 'Process CPU usage percentage');
    this.registerGauge('process_memory_heap_used_bytes', 'Process heap memory used in bytes');
    this.registerGauge('process_memory_heap_total_bytes', 'Process heap memory total in bytes');
    this.registerGauge('process_memory_rss_bytes', 'Process resident set size in bytes');
    this.registerGauge('nodejs_version_info', 'Node.js version info', {
      version: process.version,
      platform: process.platform,
    });

    // System metrics
    this.registerGauge('system_cpu_cores', 'Number of CPU cores');
    this.registerGauge('system_memory_total_bytes', 'System total memory in bytes');
    this.registerGauge('system_memory_free_bytes', 'System free memory in bytes');
    this.registerGauge('system_load_average_1m', 'System load average 1 minute');
    this.registerGauge('system_load_average_5m', 'System load average 5 minutes');
    this.registerGauge('system_load_average_15m', 'System load average 15 minutes');

    // HTTP metrics
    this.registerCounter('http_requests_total', 'Total number of HTTP requests');
    this.registerHistogram(
      'http_request_duration_seconds',
      'HTTP request latencies in seconds',
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    );

    // Database metrics (will be updated from connectionPool)
    this.registerGauge('db_pool_total_connections', 'Total database connections created');
    this.registerGauge('db_pool_active_connections', 'Active database connections');
    this.registerGauge('db_pool_idle_connections', 'Idle database connections');
    this.registerGauge('db_pool_waiting_requests', 'Requests waiting for database connection');
    this.registerCounter('db_pool_total_requests', 'Total database connection requests');
    this.registerCounter('db_pool_failed_requests', 'Failed database connection requests');
    this.registerGauge('db_pool_response_time_avg', 'Average database response time in ms');
    this.registerGauge('db_pool_response_time_p95', 'P95 database response time in ms');
    this.registerGauge('db_pool_response_time_p99', 'P99 database response time in ms');

    // Cache metrics (will be updated from distributedCache)
    this.registerCounter('cache_hits_total', 'Total cache hits');
    this.registerCounter('cache_misses_total', 'Total cache misses');
    this.registerGauge('cache_hit_rate', 'Cache hit rate percentage');
    this.registerGauge('cache_keys_total', 'Total number of cache keys');
    this.registerGauge('cache_memory_usage_bytes', 'Cache memory usage in bytes');
    this.registerGauge('redis_connected', 'Redis connection status (1=connected, 0=disconnected)');

    // WebSocket metrics
    this.registerGauge('websocket_clients_total', 'Total connected WebSocket clients');
    this.registerGauge('websocket_rooms_total', 'Total WebSocket rooms');
    this.registerGauge('websocket_messages_sent_total', 'Total WebSocket messages sent');
    this.registerGauge('websocket_messages_received_total', 'Total WebSocket messages received');

    // Application metrics
    this.registerCounter('benefit_calculations_total', 'Total benefit calculations performed');
    this.registerCounter('document_processing_total', 'Total documents processed');
    this.registerCounter('ai_requests_total', 'Total AI/Gemini API requests');
    this.registerCounter('policyengine_requests_total', 'Total PolicyEngine API requests');
    this.registerGauge('active_sessions', 'Number of active user sessions');
    this.registerGauge('rate_limit_violations_total', 'Total rate limit violations');
  }

  public registerCounter(name: string, help: string, labels?: Record<string, string>): void {
    this.counters.set(name, { name, help, value: 0, labels });
  }

  public registerGauge(name: string, help: string, labels?: Record<string, string>): void {
    this.gauges.set(name, { name, help, value: 0, labels });
  }

  public registerHistogram(
    name: string,
    help: string,
    buckets: number[],
    labels?: Record<string, string>
  ): void {
    const values = new Map<number, number>();
    buckets.forEach(bucket => values.set(bucket, 0));
    this.histograms.set(name, { name, help, buckets, values, sum: 0, count: 0, labels });
  }

  public incrementCounter(name: string, value: number = 1): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.value += value;
    }
  }

  public setGauge(name: string, value: number): void {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.value = value;
    }
  }

  public observeHistogram(name: string, value: number): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.count++;
      histogram.sum += value;
      
      // Update bucket counts
      for (const bucket of histogram.buckets) {
        if (value <= bucket) {
          const current = histogram.values.get(bucket) || 0;
          histogram.values.set(bucket, current + 1);
        }
      }
    }
  }

  // Collect system metrics
  private async collectSystemMetrics(): Promise<void> {
    // Process metrics
    const memUsage = process.memoryUsage();
    this.setGauge('process_uptime_seconds', process.uptime());
    this.setGauge('process_cpu_usage_percent', process.cpuUsage().user / 1000000);
    this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
    this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);
    this.setGauge('process_memory_rss_bytes', memUsage.rss);

    // System metrics
    this.setGauge('system_cpu_cores', os.cpus().length);
    this.setGauge('system_memory_total_bytes', os.totalmem());
    this.setGauge('system_memory_free_bytes', os.freemem());
    
    const loadAvg = os.loadavg();
    this.setGauge('system_load_average_1m', loadAvg[0]);
    this.setGauge('system_load_average_5m', loadAvg[1]);
    this.setGauge('system_load_average_15m', loadAvg[2]);
  }

  // Collect database metrics
  private async collectDatabaseMetrics(): Promise<void> {
    try {
      const dbMetrics = connectionPool.getMetrics();
      
      this.setGauge('db_pool_total_connections', dbMetrics.totalConnections);
      this.setGauge('db_pool_active_connections', dbMetrics.activeConnections);
      this.setGauge('db_pool_idle_connections', dbMetrics.idleConnections);
      this.setGauge('db_pool_waiting_requests', dbMetrics.waitingRequests);
      this.incrementCounter('db_pool_total_requests', dbMetrics.totalRequests);
      this.incrementCounter('db_pool_failed_requests', dbMetrics.failedRequests);
      this.setGauge('db_pool_response_time_avg', dbMetrics.avgResponseTime);
      this.setGauge('db_pool_response_time_p95', dbMetrics.p95ResponseTime);
      this.setGauge('db_pool_response_time_p99', dbMetrics.p99ResponseTime);
    } catch (error) {
      console.error('Failed to collect database metrics:', error);
    }
  }

  // Collect cache metrics
  private async collectCacheMetrics(): Promise<void> {
    try {
      const cacheMetrics = await distributedCache.getMetrics();
      
      this.incrementCounter('cache_hits_total', cacheMetrics.overall.hits);
      this.incrementCounter('cache_misses_total', cacheMetrics.overall.misses);
      this.setGauge('cache_hit_rate', cacheMetrics.overall.hitRate);
      this.setGauge('cache_keys_total', cacheMetrics.overall.totalKeys);
      this.setGauge('cache_memory_usage_bytes', cacheMetrics.overall.memoryUsage);
      this.setGauge('redis_connected', cacheMetrics.redis.connected ? 1 : 0);
    } catch (error) {
      console.error('Failed to collect cache metrics:', error);
    }
  }

  // Collect WebSocket metrics
  private async collectWebSocketMetrics(): Promise<void> {
    try {
      const wsMetrics = webSocketService.getMetrics();
      
      this.setGauge('websocket_clients_total', wsMetrics.totalClients);
      this.setGauge('websocket_rooms_total', wsMetrics.totalRooms);
      
      // Set metrics by role
      Object.entries(wsMetrics.clientsByRole).forEach(([role, count]) => {
        this.setGauge(`websocket_clients_by_role{role="${role}"}`, count);
      });
    } catch (error) {
      console.error('Failed to collect WebSocket metrics:', error);
    }
  }

  // Collect all metrics
  public async collectAllMetrics(): Promise<void> {
    await this.collectSystemMetrics();
    await this.collectDatabaseMetrics();
    await this.collectCacheMetrics();
    await this.collectWebSocketMetrics();
  }

  // Format metrics in Prometheus text format
  public formatPrometheusMetrics(): string {
    const lines: string[] = [];

    // Format counters
    this.counters.forEach(counter => {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      const labels = this.formatLabels(counter.labels);
      lines.push(`${counter.name}${labels} ${counter.value}`);
    });

    // Format gauges
    this.gauges.forEach(gauge => {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      const labels = this.formatLabels(gauge.labels);
      lines.push(`${gauge.name}${labels} ${gauge.value}`);
    });

    // Format histograms
    this.histograms.forEach(histogram => {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`);
      lines.push(`# TYPE ${histogram.name} histogram`);
      
      // Bucket values
      histogram.values.forEach((count, bucket) => {
        const labels = this.formatLabels({ ...histogram.labels, le: bucket.toString() });
        lines.push(`${histogram.name}_bucket${labels} ${count}`);
      });
      
      // +Inf bucket
      const infLabels = this.formatLabels({ ...histogram.labels, le: '+Inf' });
      lines.push(`${histogram.name}_bucket${infLabels} ${histogram.count}`);
      
      // Sum and count
      const baseLabels = this.formatLabels(histogram.labels);
      lines.push(`${histogram.name}_sum${baseLabels} ${histogram.sum}`);
      lines.push(`${histogram.name}_count${baseLabels} ${histogram.count}`);
    });

    return lines.join('\n');
  }

  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const pairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `{${pairs}}`;
  }

  // Middleware to track HTTP metrics
  public httpMetricsMiddleware() {
    return async (req: Request, res: Response, next: any) => {
      const startTime = Date.now();
      
      // Track request
      this.httpRequestsTotal++;
      const method = req.method;
      const path = req.route?.path || req.path;
      
      this.httpRequestsByMethod.set(method, (this.httpRequestsByMethod.get(method) || 0) + 1);
      this.httpRequestsByPath.set(path, (this.httpRequestsByPath.get(path) || 0) + 1);

      // Track response
      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        const status = res.statusCode;
        
        this.httpRequestDuration.push(duration);
        this.httpRequestsByStatus.set(status, (this.httpRequestsByStatus.get(status) || 0) + 1);
        
        // Update metrics
        this.incrementCounter('http_requests_total');
        this.observeHistogram('http_request_duration_seconds', duration);
        
        // Keep only last 1000 durations for memory efficiency
        if (this.httpRequestDuration.length > 1000) {
          this.httpRequestDuration = this.httpRequestDuration.slice(-1000);
        }
      });

      next();
    };
  }
}

// Create global metrics collector instance
export const metricsCollector = new MetricsCollector();

// Prometheus metrics endpoint handler
export async function prometheusMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    // Collect latest metrics
    await metricsCollector.collectAllMetrics();
    
    // Format and send metrics
    const metrics = metricsCollector.formatPrometheusMetrics();
    
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(metrics);
  } catch (error) {
    console.error('Error generating Prometheus metrics:', error);
    res.status(500).send('Error generating metrics');
  }
}

// Export middleware
export const httpMetricsMiddleware = metricsCollector.httpMetricsMiddleware.bind(metricsCollector);