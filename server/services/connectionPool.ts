import pg from 'pg';
const { Pool } = pg;
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import * as schema from '../../shared/schema';

// Type definitions for pg module
type PoolConfig = any;
type PoolClient = any;

// Connection pool configuration for production scale
const POOL_CONFIG: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '100'), // Increased for 5000+ users
  min: parseInt(process.env.DB_POOL_MIN || '10'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
  allowExitOnIdle: false,
};

// Surge protection configuration
interface SurgeConfig {
  maxQueueSize: number;
  queueTimeout: number;
  backoffMultiplier: number;
  maxRetries: number;
}

const SURGE_CONFIG: SurgeConfig = {
  maxQueueSize: parseInt(process.env.DB_MAX_QUEUE || '1000'),
  queueTimeout: parseInt(process.env.DB_QUEUE_TIMEOUT || '10000'),
  backoffMultiplier: 1.5,
  maxRetries: 3,
};

// Metrics tracking
interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  connectionErrors: number;
  lastReset: Date;
}

interface QueryMetrics {
  query: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
}

export class ScalableConnectionPool {
  private static instance: ScalableConnectionPool;
  private pool: Pool | null = null;
  private neonClient: NeonQueryFunction<boolean, boolean> | null = null;
  private metrics: PoolMetrics;
  private queryMetrics: Map<string, QueryMetrics> = new Map();
  private responseTimes: number[] = [];
  private requestQueue: Array<{
    resolve: (client: PoolClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy = true;
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private circuitBreakerFailures = 0;
  private circuitBreakerThreshold = 5;
  private circuitBreakerResetTime = 30000;
  private lastCircuitBreakerOpen = 0;

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.setupHealthCheck();
    this.setupGracefulShutdown();
  }

  public static getInstance(): ScalableConnectionPool {
    if (!ScalableConnectionPool.instance) {
      ScalableConnectionPool.instance = new ScalableConnectionPool();
    }
    return ScalableConnectionPool.instance;
  }

  private initializeMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      connectionErrors: 0,
      lastReset: new Date(),
    };
  }

  public async connect(): Promise<void> {
    if (this.pool) return;

    try {
      // Initialize Neon pooled connection for serverless
      if (process.env.DATABASE_URL) {
        this.neonClient = neon(process.env.DATABASE_URL, {
          fetchOptions: {
            cache: 'no-store',
          },
        });
        
        // Create standard pool for long-running connections
        this.pool = new Pool(POOL_CONFIG);

        // Set up pool event handlers
        this.pool.on('connect', (client) => {
          this.metrics.totalConnections++;
          console.log(`✅ Database connection established (Total: ${this.metrics.totalConnections})`);
        });

        this.pool.on('error', (err, client) => {
          this.metrics.connectionErrors++;
          console.error('❌ Database pool error:', err.message);
          this.handleCircuitBreaker('error');
        });

        this.pool.on('remove', (client) => {
          this.metrics.totalConnections--;
        });

        // Test connection
        const testClient = await this.pool.connect();
        await testClient.query('SELECT 1');
        testClient.release();

        console.log('✅ Scalable connection pool initialized');
        console.log(`   Max connections: ${POOL_CONFIG.max}`);
        console.log(`   Min connections: ${POOL_CONFIG.min}`);
        console.log(`   Max queue size: ${SURGE_CONFIG.maxQueueSize}`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }
  }

  // Get a connection with surge protection and queuing
  public async getConnection(): Promise<PoolClient> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Check circuit breaker
    if (this.circuitBreakerState === 'OPEN') {
      if (Date.now() - this.lastCircuitBreakerOpen > this.circuitBreakerResetTime) {
        this.circuitBreakerState = 'HALF_OPEN';
        this.circuitBreakerFailures = 0;
      } else {
        this.metrics.failedRequests++;
        throw new Error('Circuit breaker is OPEN - database temporarily unavailable');
      }
    }

    try {
      if (!this.pool) {
        await this.connect();
      }

      // Check if pool is healthy
      if (!this.isHealthy) {
        throw new Error('Connection pool is unhealthy');
      }

      // Try to get connection with timeout
      const client = await this.getConnectionWithTimeout();
      
      // Track metrics
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      
      // Reset circuit breaker on success
      if (this.circuitBreakerState === 'HALF_OPEN') {
        this.circuitBreakerState = 'CLOSED';
        this.circuitBreakerFailures = 0;
      }

      return client;
    } catch (error) {
      this.metrics.failedRequests++;
      this.handleCircuitBreaker('failure');
      throw error;
    }
  }

  private async getConnectionWithTimeout(): Promise<PoolClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - pool exhausted'));
      }, SURGE_CONFIG.queueTimeout);

      // Check queue size
      if (this.requestQueue.length >= SURGE_CONFIG.maxQueueSize) {
        clearTimeout(timeout);
        reject(new Error('Request queue full - too many pending requests'));
        return;
      }

      // Add to queue
      this.requestQueue.push({
        resolve: (client) => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });

      this.metrics.waitingRequests = this.requestQueue.length;
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || !this.pool) return;

    try {
      const client = await this.pool.connect();
      const request = this.requestQueue.shift();
      
      if (request) {
        this.metrics.waitingRequests = this.requestQueue.length;
        request.resolve(client);
      } else {
        client.release();
      }
    } catch (error) {
      const request = this.requestQueue.shift();
      if (request) {
        this.metrics.waitingRequests = this.requestQueue.length;
        request.reject(error as Error);
      }
    }

    // Continue processing queue
    if (this.requestQueue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  // Execute query with metrics tracking
  public async executeQuery<T>(
    query: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T> {
    const startTime = Date.now();
    const shouldRelease = !client;
    
    try {
      if (!client) {
        client = await this.getConnection();
      }

      const result = await client.query(query, params);
      
      // Track query metrics
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(query, duration);
      
      return result.rows as T;
    } finally {
      if (shouldRelease && client) {
        client.release();
      }
    }
  }

  // Get Drizzle ORM instance with Neon pooling
  public getDrizzle(): NeonHttpDatabase<typeof schema> {
    if (!this.neonClient) {
      throw new Error('Neon client not initialized');
    }
    return drizzle(this.neonClient, { schema });
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    // Update metrics
    this.metrics.avgResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    this.metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
    this.metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
  }

  private recordQueryMetrics(query: string, duration: number): void {
    // Normalize query for grouping
    const normalizedQuery = query.replace(/\$\d+/g, '?').substring(0, 100);
    
    const existing = this.queryMetrics.get(normalizedQuery) || {
      query: normalizedQuery,
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity,
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.minTime = Math.min(existing.minTime, duration);

    this.queryMetrics.set(normalizedQuery, existing);
  }

  private handleCircuitBreaker(event: 'error' | 'failure' | 'success'): void {
    switch (event) {
      case 'error':
      case 'failure':
        this.circuitBreakerFailures++;
        if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
          this.circuitBreakerState = 'OPEN';
          this.lastCircuitBreakerOpen = Date.now();
          console.error('⚠️ Circuit breaker OPEN - too many database failures');
        }
        break;
      case 'success':
        if (this.circuitBreakerState === 'HALF_OPEN') {
          this.circuitBreakerState = 'CLOSED';
          this.circuitBreakerFailures = 0;
          console.log('✅ Circuit breaker CLOSED - database recovered');
        }
        break;
    }
  }

  private setupHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.pool) return;

      try {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        this.isHealthy = true;
        
        // Update pool metrics
        if (this.pool) {
          const poolStats = (this.pool as any);
          this.metrics.activeConnections = poolStats.totalCount || 0;
          this.metrics.idleConnections = poolStats.idleCount || 0;
        }
      } catch (error) {
        this.isHealthy = false;
        console.error('❌ Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n📝 Received ${signal}, closing database connections...`);
      
      // Clear health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Reject pending requests
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (request) {
          request.reject(new Error('Server shutting down'));
        }
      }

      // Close pool
      if (this.pool) {
        await this.pool.end();
        console.log('✅ Database pool closed gracefully');
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  public getMetrics(): PoolMetrics & {
    queryMetrics: QueryMetrics[];
    circuitBreaker: {
      state: string;
      failures: number;
      lastOpen: Date | null;
    };
    surgeProtection: {
      queueSize: number;
      maxQueueSize: number;
    };
  } {
    return {
      ...this.metrics,
      queryMetrics: Array.from(this.queryMetrics.values())
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10), // Top 10 slowest queries
      circuitBreaker: {
        state: this.circuitBreakerState,
        failures: this.circuitBreakerFailures,
        lastOpen: this.lastCircuitBreakerOpen ? new Date(this.lastCircuitBreakerOpen) : null,
      },
      surgeProtection: {
        queueSize: this.requestQueue.length,
        maxQueueSize: SURGE_CONFIG.maxQueueSize,
      },
    };
  }

  // Export metrics for Prometheus
  public getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    
    return `
# HELP db_pool_total_connections Total number of connections created
# TYPE db_pool_total_connections counter
db_pool_total_connections ${metrics.totalConnections}

# HELP db_pool_active_connections Number of active connections
# TYPE db_pool_active_connections gauge
db_pool_active_connections ${metrics.activeConnections}

# HELP db_pool_idle_connections Number of idle connections
# TYPE db_pool_idle_connections gauge
db_pool_idle_connections ${metrics.idleConnections}

# HELP db_pool_waiting_requests Number of requests waiting for connection
# TYPE db_pool_waiting_requests gauge
db_pool_waiting_requests ${metrics.waitingRequests}

# HELP db_pool_total_requests Total number of connection requests
# TYPE db_pool_total_requests counter
db_pool_total_requests ${metrics.totalRequests}

# HELP db_pool_failed_requests Total number of failed connection requests
# TYPE db_pool_failed_requests counter
db_pool_failed_requests ${metrics.failedRequests}

# HELP db_pool_response_time_avg Average response time in ms
# TYPE db_pool_response_time_avg gauge
db_pool_response_time_avg ${metrics.avgResponseTime}

# HELP db_pool_response_time_p95 95th percentile response time in ms
# TYPE db_pool_response_time_p95 gauge
db_pool_response_time_p95 ${metrics.p95ResponseTime}

# HELP db_pool_response_time_p99 99th percentile response time in ms
# TYPE db_pool_response_time_p99 gauge
db_pool_response_time_p99 ${metrics.p99ResponseTime}

# HELP db_pool_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)
# TYPE db_pool_circuit_breaker_state gauge
db_pool_circuit_breaker_state ${this.circuitBreakerState === 'CLOSED' ? 0 : this.circuitBreakerState === 'OPEN' ? 1 : 2}
`;
  }
}

// Export singleton instance
export const connectionPool = ScalableConnectionPool.getInstance();