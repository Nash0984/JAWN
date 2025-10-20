import { db } from '../db';
import { sql } from 'drizzle-orm';
import { redisCache } from './redisCache';
import { databaseBackupService } from './databaseBackup.service';
import os from 'os';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: any;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  uptime: number;
  platform: string;
  nodeVersion: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  services: ServiceStatus[];
  metrics: SystemMetrics;
}

/**
 * Comprehensive Health Check Service
 * 
 * Checks all critical system dependencies and provides detailed status
 * for monitoring and alerting.
 */
class HealthCheckService {
  
  /**
   * Run comprehensive health check on all services
   */
  async checkAll(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    
    // Run all checks in parallel for efficiency
    const [
      databaseStatus,
      redisStatus,
      geminiStatus,
      objectStorageStatus,
      backupStatus,
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkGemini(),
      this.checkObjectStorage(),
      this.checkBackup(),
    ]);
    
    const services = [
      databaseStatus,
      redisStatus,
      geminiStatus,
      objectStorageStatus,
      backupStatus,
    ];
    
    // Determine overall status
    const hasUnhealthy = services.some(s => s.status === 'unhealthy');
    const hasDegraded = services.some(s => s.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    const metrics = this.getSystemMetrics();
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: 'v1',
      uptime: process.uptime(),
      services,
      metrics,
    };
  }
  
  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // Try to query the database
      await db.execute(sql`SELECT 1 as health_check`);
      
      const latency = Date.now() - startTime;
      
      return {
        name: 'database',
        status: latency < 100 ? 'healthy' : 'degraded',
        latency,
        message: latency < 100 ? 'Database responding normally' : 'Database responding slowly',
        details: {
          type: 'PostgreSQL',
          connected: true,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        message: 'Database connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
  
  /**
   * Check Redis cache connectivity
   */
  private async checkRedis(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const isConnected = await redisCache.isConnected();
      const latency = Date.now() - startTime;
      
      if (!isConnected) {
        // Redis not configured - this is OK in development
        return {
          name: 'redis',
          status: 'healthy',
          latency,
          message: 'Redis not configured (using L1 cache only)',
          details: {
            configured: false,
            fallback: 'NodeCache (L1)',
          },
        };
      }
      
      return {
        name: 'redis',
        status: 'healthy',
        latency,
        message: 'Redis connected',
        details: {
          configured: true,
          mode: 'L1 + L2 distributed cache',
        },
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'degraded',
        latency: Date.now() - startTime,
        message: 'Redis connection degraded (using L1 fallback)',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          fallback: 'NodeCache (L1)',
        },
      };
    }
  }
  
  /**
   * Check Gemini API availability
   */
  private async checkGemini(): Promise<ServiceStatus> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return {
        name: 'gemini',
        status: 'unhealthy',
        message: 'Gemini API key not configured',
        details: {
          configured: false,
        },
      };
    }
    
    // Just check if API key exists - don't make actual API call to avoid quota usage
    return {
      name: 'gemini',
      status: 'healthy',
      message: 'Gemini API configured',
      details: {
        configured: true,
        model: 'gemini-2.0-flash-exp',
      },
    };
  }
  
  /**
   * Check object storage (Google Cloud Storage) availability
   */
  private async checkObjectStorage(): Promise<ServiceStatus> {
    const gcpCredentials = process.env.GCP_SERVICE_ACCOUNT_KEY;
    const gcsBucket = process.env.GCS_BUCKET_NAME;
    
    if (!gcpCredentials || !gcsBucket) {
      return {
        name: 'objectStorage',
        status: 'degraded',
        message: 'Object storage not configured',
        details: {
          configured: false,
          provider: 'Google Cloud Storage',
        },
      };
    }
    
    return {
      name: 'objectStorage',
      status: 'healthy',
      message: 'Object storage configured',
      details: {
        configured: true,
        provider: 'Google Cloud Storage',
        bucket: gcsBucket,
      },
    };
  }
  
  /**
   * Check database backup system health
   */
  private async checkBackup(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const backupStatus = await databaseBackupService.getBackupStatus();
      const latency = Date.now() - startTime;
      
      return {
        name: 'backup',
        status: backupStatus.status,
        latency,
        message: backupStatus.message,
        details: {
          pitrEnabled: backupStatus.pitrEnabled,
          retentionDays: backupStatus.retentionDays,
          databaseSize: backupStatus.details?.sizeFormatted,
          tableCount: backupStatus.tableCount,
          connectionPool: {
            active: backupStatus.connectionPoolActive,
            idle: backupStatus.connectionPoolIdle,
            max: backupStatus.connectionPoolMax,
          },
        },
      };
    } catch (error) {
      return {
        name: 'backup',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        message: 'Backup monitoring failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
  
  /**
   * Get system metrics (CPU, memory, etc.)
   */
  private getSystemMetrics(): SystemMetrics {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Calculate CPU usage (approximation based on load average)
    const loadAverage = os.loadavg()[0]; // 1-minute load average
    const cpuUsage = (loadAverage / cpus.length) * 100;
    
    return {
      cpu: {
        usage: Math.min(cpuUsage, 100), // Cap at 100%
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: (usedMem / totalMem) * 100,
      },
      uptime: process.uptime(),
      platform: os.platform(),
      nodeVersion: process.version,
    };
  }
}

export const healthCheckService = new HealthCheckService();
