/**
 * Circuit Breaker Monitoring API Routes
 * 
 * Provides endpoints for monitoring circuit breaker health and metrics
 */

import type { Express, Request, Response } from 'express';
import { circuitBreakerRegistry, policyEngineCircuitBreaker, googleCalendarCircuitBreaker } from '../services/circuitBreaker.service';
import { policyEngineWithCircuitBreaker } from '../services/policyEngineWithCircuitBreaker';
import { googleCalendarWithCircuitBreaker } from '../services/googleCalendarWithCircuitBreaker';
import { requireAdmin, requireStaff } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../services/logger.service';

const logger = createLogger('CircuitBreakerRoutes');

export function registerCircuitBreakerRoutes(app: Express): void {
  /**
   * GET /api/circuit-breakers/metrics
   * Get metrics for all circuit breakers
   * Requires: STAFF or ADMIN role
   */
  app.get(
    '/api/circuit-breakers/metrics',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const metrics = circuitBreakerRegistry.getAllMetrics();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics
      });
    })
  );
  
  /**
   * GET /api/circuit-breakers/:name/metrics
   * Get metrics for a specific circuit breaker
   * Requires: STAFF or ADMIN role
   */
  app.get(
    '/api/circuit-breakers/:name/metrics',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const { name } = req.params;
      const breaker = circuitBreakerRegistry.getAll().get(name);
      
      if (!breaker) {
        return res.status(404).json({
          success: false,
          error: `Circuit breaker '${name}' not found`
        });
      }
      
      const metrics = breaker.getMetrics();
      
      res.json({
        success: true,
        name,
        timestamp: new Date().toISOString(),
        metrics
      });
    })
  );
  
  /**
   * POST /api/circuit-breakers/:name/reset
   * Manually reset a circuit breaker
   * Requires: ADMIN role
   */
  app.post(
    '/api/circuit-breakers/:name/reset',
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { name } = req.params;
      
      // Get circuit breaker and reset it
      if (name === 'policyengine') {
        policyEngineWithCircuitBreaker.resetCircuitBreaker();
      } else if (name === 'google-calendar') {
        googleCalendarWithCircuitBreaker.resetCircuitBreaker();
      } else {
        const breaker = circuitBreakerRegistry.getAll().get(name);
        if (!breaker) {
          return res.status(404).json({
            success: false,
            error: `Circuit breaker '${name}' not found`
          });
        }
        breaker.reset();
      }
      
      logger.info(`Circuit breaker '${name}' reset by admin`, {
        userId: req.user?.id,
        service: 'CircuitBreakerRoutes'
      });
      
      res.json({
        success: true,
        message: `Circuit breaker '${name}' has been reset`,
        timestamp: new Date().toISOString()
      });
    })
  );
  
  /**
   * POST /api/circuit-breakers/:name/open
   * Manually open a circuit breaker (for maintenance)
   * Requires: ADMIN role
   */
  app.post(
    '/api/circuit-breakers/:name/open',
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { name } = req.params;
      const breaker = circuitBreakerRegistry.getAll().get(name);
      
      if (!breaker) {
        return res.status(404).json({
          success: false,
          error: `Circuit breaker '${name}' not found`
        });
      }
      
      breaker.open();
      
      logger.info(`Circuit breaker '${name}' manually opened by admin`, {
        userId: req.user?.id,
        service: 'CircuitBreakerRoutes'
      });
      
      res.json({
        success: true,
        message: `Circuit breaker '${name}' has been opened`,
        timestamp: new Date().toISOString()
      });
    })
  );
  
  /**
   * GET /api/circuit-breakers/health
   * Get overall health status of circuit breakers
   * Requires: STAFF role (security: prevents reconnaissance of outage windows)
   */
  app.get(
    '/api/circuit-breakers/health',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const metrics = circuitBreakerRegistry.getAllMetrics();
      
      // Check if any circuit breakers are OPEN
      const openCircuits = Object.entries(metrics)
        .filter(([_, m]) => m.state === 'OPEN')
        .map(([name, m]) => ({
          name,
          state: m.state,
          lastFailureTime: m.lastFailureTime,
          failureCount: m.failureCount
        }));
      
      const halfOpenCircuits = Object.entries(metrics)
        .filter(([_, m]) => m.state === 'HALF_OPEN')
        .map(([name, _]) => name);
      
      const overallHealth = openCircuits.length === 0 ? 'healthy' : 'degraded';
      
      res.json({
        status: overallHealth,
        timestamp: new Date().toISOString(),
        circuitBreakers: {
          total: Object.keys(metrics).length,
          healthy: Object.values(metrics).filter(m => m.state === 'CLOSED').length,
          degraded: halfOpenCircuits.length,
          failing: openCircuits.length
        },
        openCircuits: openCircuits.length > 0 ? openCircuits : undefined,
        halfOpenCircuits: halfOpenCircuits.length > 0 ? halfOpenCircuits : undefined
      });
    })
  );
  
  logger.info('Circuit breaker routes registered');
}
