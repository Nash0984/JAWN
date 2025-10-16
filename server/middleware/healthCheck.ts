/**
 * Health Check and Readiness Endpoints
 * 
 * Provides health monitoring for load balancers and orchestration systems
 * - /health: Liveness probe (is the service running?)
 * - /ready: Readiness probe (is the service ready to accept traffic?)
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      message?: string;
      responseTime?: number;
    };
  };
}

/**
 * Simple liveness check
 * Returns 200 if the service is running
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  // Basic process check
  health.checks.process = {
    status: 'pass',
    message: `Uptime: ${Math.floor(process.uptime())}s`
  };

  res.status(200).json(health);
}

/**
 * Comprehensive readiness check
 * Returns 200 only if all dependencies are available
 */
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  let overallHealthy = true;

  // 1. Database check
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    health.checks.database = {
      status: 'pass',
      responseTime: Date.now() - dbStart,
      message: 'Database connection successful'
    };
  } catch (error) {
    overallHealthy = false;
    health.checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
  }

  // 2. Memory check (warn if > 90% used)
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (heapUsedPercent > 90) {
    health.checks.memory = {
      status: 'fail',
      message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`
    };
    overallHealthy = false;
  } else {
    health.checks.memory = {
      status: 'pass',
      message: `Memory usage: ${heapUsedPercent.toFixed(1)}%`
    };
  }

  // 3. AI Service check (optional but warn if missing) - prefer GOOGLE_API_KEY
  const hasAIKey = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  health.checks.ai_service = {
    status: hasAIKey ? 'pass' : 'fail',
    message: hasAIKey ? 'AI service configured' : 'GOOGLE_API_KEY not configured'
  };
  
  if (!hasAIKey) {
    health.status = 'degraded';
  }

  // 4. Object Storage check (optional)
  const hasStorage = !!process.env.GCS_BUCKET_NAME;
  health.checks.object_storage = {
    status: hasStorage ? 'pass' : 'fail',
    message: hasStorage ? 'Object storage configured' : 'GCS bucket not configured'
  };

  if (!hasStorage) {
    health.status = 'degraded';
  }

  // Determine overall status
  if (!overallHealthy) {
    health.status = 'unhealthy';
    res.status(503).json(health);
  } else if (health.status === 'degraded') {
    res.status(200).json(health);
  } else {
    res.status(200).json(health);
  }
}

/**
 * Startup probe check
 * Used by orchestration systems to know when service is fully started
 */
export async function startupCheck(req: Request, res: Response): Promise<void> {
  // Check if all critical startup tasks completed
  const checks: Record<string, boolean> = {
    database: true, // We'll check DB connection
    environment: true, // Environment validated on startup
  };

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    checks.database = false;
  }

  const allReady = Object.values(checks).every(v => v);

  res.status(allReady ? 200 : 503).json({
    ready: allReady,
    checks,
    timestamp: new Date().toISOString()
  });
}
