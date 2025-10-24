/**
 * Circuit Breaker Pattern for External APIs
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * when external services (PolicyEngine third-party verification, Google Calendar) are down.
 * 
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing fast, requests immediately rejected
 * - HALF_OPEN: Testing if service recovered, allowing limited requests
 * 
 * Based on Release It! (Michael Nygard) and Netflix Hystrix patterns.
 */

import { createLogger } from './logger.service';
import * as Sentry from '@sentry/node';

const logger = createLogger('CircuitBreaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening circuit
   * Default: 5
   */
  failureThreshold: number;
  
  /**
   * Time in milliseconds to wait before attempting to close circuit
   * Default: 60000 (1 minute)
   */
  resetTimeout: number;
  
  /**
   * Number of successful requests in HALF_OPEN state before closing circuit
   * Default: 2
   */
  successThreshold: number;
  
  /**
   * Request timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout: number;
  
  /**
   * Optional fallback function when circuit is OPEN
   */
  fallback?: <T>() => Promise<T> | T;
  
  /**
   * Name for logging and monitoring
   */
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  totalTimeouts: number;
  totalRejections: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  lastStateChangeTime: Date | null;
  uptime: number; // Percentage
  averageResponseTime: number; // milliseconds
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public circuitName: string,
    public state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt: number = Date.now();
  
  // Metrics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalTimeouts = 0;
  private totalRejections = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private lastStateChangeTime: Date | null = null;
  private responseTimes: number[] = [];
  
  private readonly config: Required<CircuitBreakerConfig>;
  
  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 30000,
      fallback: config.fallback ?? (() => {
        throw new CircuitBreakerError(
          `Circuit breaker is ${this.state} for ${this.config.name}`,
          this.config.name,
          this.state
        );
      }),
      name: config.name
    };
    
    logger.info(`Circuit breaker initialized`, {
      name: this.config.name,
      config: {
        failureThreshold: this.config.failureThreshold,
        resetTimeout: this.config.resetTimeout,
        successThreshold: this.config.successThreshold,
        timeout: this.config.timeout
      }
    });
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.totalRejections++;
        logger.warn(`Circuit breaker OPEN, rejecting request`, {
          name: this.config.name,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          failureCount: this.failureCount
        });
        
        // Call fallback if provided
        return this.config.fallback<T>();
      } else {
        // Transition to HALF_OPEN to test if service recovered
        this.transitionTo('HALF_OPEN');
      }
    }
    
    // Execute request with timeout
    try {
      const startTime = Date.now();
      const result = await this.executeWithTimeout(fn, this.config.timeout);
      const responseTime = Date.now() - startTime;
      
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // Rethrow original error
      throw error;
    }
  }
  
  /**
   * Execute function with timeout protection
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.totalTimeouts++;
        reject(new Error(`Request timeout after ${timeoutMs}ms for ${this.config.name}`));
      }, timeoutMs);
      
      try {
        const result = await fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
  
  /**
   * Handle successful request
   */
  private onSuccess(responseTime: number): void {
    this.lastSuccessTime = new Date();
    this.totalSuccesses++;
    
    // Track response time (keep last 100 requests)
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      logger.info(`Circuit breaker HALF_OPEN success`, {
        name: this.config.name,
        successCount: this.successCount,
        successThreshold: this.config.successThreshold
      });
      
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }
  
  /**
   * Handle failed request
   */
  private onFailure(error: any): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failureCount++;
    
    logger.error(`Circuit breaker request failed`, {
      name: this.config.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.config.failureThreshold,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Capture error in Sentry
    Sentry.captureException(error, {
      tags: {
        component: 'circuit_breaker',
        circuit_name: this.config.name,
        circuit_state: this.state
      },
      extra: {
        failureCount: this.failureCount,
        failureThreshold: this.config.failureThreshold
      }
    });
    
    if (this.state === 'HALF_OPEN') {
      // Single failure in HALF_OPEN reopens circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }
  
  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTime = new Date();
    
    if (newState === 'OPEN') {
      this.nextAttempt = Date.now() + this.config.resetTimeout;
      this.successCount = 0;
      
      logger.warn(`Circuit breaker OPENED`, {
        name: this.config.name,
        failureCount: this.failureCount,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
      
      // Alert via Sentry
      Sentry.captureMessage(`Circuit breaker OPENED: ${this.config.name}`, {
        level: 'warning',
        tags: {
          component: 'circuit_breaker',
          circuit_name: this.config.name
        },
        extra: {
          failureCount: this.failureCount,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        }
      });
    } else if (newState === 'HALF_OPEN') {
      this.failureCount = 0;
      this.successCount = 0;
      
      logger.info(`Circuit breaker transitioning to HALF_OPEN`, {
        name: this.config.name
      });
    } else if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
      
      logger.info(`Circuit breaker CLOSED`, {
        name: this.config.name
      });
      
      // Success recovery alert
      Sentry.captureMessage(`Circuit breaker CLOSED (recovered): ${this.config.name}`, {
        level: 'info',
        tags: {
          component: 'circuit_breaker',
          circuit_name: this.config.name
        }
      });
    }
  }
  
  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const uptime = this.totalRequests > 0
      ? ((this.totalSuccesses / this.totalRequests) * 100)
      : 100;
    
    const averageResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalTimeouts: this.totalTimeouts,
      totalRejections: this.totalRejections,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChangeTime: this.lastStateChangeTime,
      uptime: Math.round(uptime * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime)
    };
  }
  
  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    logger.info(`Circuit breaker manually reset`, {
      name: this.config.name,
      previousState: this.state
    });
    
    this.transitionTo('CLOSED');
    this.failureCount = 0;
    this.successCount = 0;
  }
  
  /**
   * Manually open circuit breaker (e.g., for maintenance)
   */
  open(): void {
    logger.info(`Circuit breaker manually opened`, {
      name: this.config.name,
      previousState: this.state
    });
    
    this.transitionTo('OPEN');
  }
}

// ===========================
// Circuit Breaker Registry
// ===========================

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  
  /**
   * Get or create circuit breaker
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        name,
        ...config
      });
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name)!;
  }
  
  /**
   * Get all registered circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }
  
  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    return metrics;
  }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// ===========================
// Pre-configured Circuit Breakers
// ===========================

/**
 * Circuit breaker for PolicyEngine third-party verification API
 */
export const policyEngineCircuitBreaker = circuitBreakerRegistry.get('policyengine', {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
  timeout: 15000, // 15 seconds (reduced from 30s per architect recommendation)
  fallback: () => {
    logger.warn('PolicyEngine third-party verification circuit breaker OPEN, using fallback', {
      service: 'CircuitBreaker',
      message: 'JAWN rules engine continues without third-party verification'
    });
    
    // Return null to indicate third-party verification unavailable
    // JAWN's rules engine is primary, so we can continue without verification
    // NOTE: Calling code should log this condition for audit purposes
    return null;
  }
});

/**
 * Circuit breaker for Google Calendar API
 */
export const googleCalendarCircuitBreaker = circuitBreakerRegistry.get('google-calendar', {
  failureThreshold: 3,
  resetTimeout: 120000, // 2 minutes (Google APIs can have longer outages)
  successThreshold: 2,
  timeout: 10000, // 10 seconds (reduced from 15s per architect recommendation)
  fallback: () => {
    logger.warn('Google Calendar circuit breaker OPEN, using fallback', {
      service: 'CircuitBreaker'
    });
    
    throw new CircuitBreakerError(
      'Google Calendar is temporarily unavailable. Please try again later.',
      'google-calendar',
      'OPEN'
    );
  }
});
