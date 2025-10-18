/**
 * Combined Resilience Wrapper
 * 
 * Orchestrates retry logic, circuit breaker, and cached fallback for resilient API calls.
 * Provides a unified interface for making external requests with production-grade resilience.
 */

import { CircuitBreaker, CircuitState } from './circuitBreaker';
import { retryWithBackoff, RetryPolicy, RetryResult } from './retryWithBackoff';
import { withCachedFallback, CachePolicy, CachedResult } from './cachedFallback';
import { CircuitBreakerPolicy } from './circuitBreaker';
import { resilienceMetricsService } from './resilienceMetrics';

export interface ResilienceProfile {
  endpointName: string;
  retryPolicy: RetryPolicy;
  circuitBreakerPolicy: CircuitBreakerPolicy;
  cachePolicy?: CachePolicy;
  criticality: 'low' | 'medium' | 'high';
}

export interface ResilientResult<T> {
  data: T;
  fromCache: boolean;
  retries: number;
  circuitState: CircuitState;
  durationMs: number;
}

// Global circuit breaker registry (per-endpoint state)
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Execute a resilient request with retry, circuit breaker, and cache fallback
 * 
 * Resilience layers (applied in order):
 * 1. Circuit Breaker: Fast-fail if service is known to be down
 * 2. Retry with Backoff: Retry transient failures with exponential backoff
 * 3. Cached Fallback: Fall back to stale cache if all retries fail
 * 
 * @param operation - The async operation to execute
 * @param profile - Resilience profile configuration
 * @param fallback - Optional custom fallback function
 * @param cacheKeyParams - Optional parameters for cache key uniqueness
 * @returns Promise resolving to result with metadata
 */
export async function resilientRequest<T>(
  operation: () => Promise<T>,
  profile: ResilienceProfile,
  fallback?: () => Promise<T>,
  cacheKeyParams?: Record<string, any>
): Promise<ResilientResult<T>> {
  const startTime = Date.now();
  let retryCount = 0;
  let fromCache = false;
  let operationError: Error | undefined;

  // 1. Get or create circuit breaker for this endpoint
  const circuitBreaker = getOrCreateCircuitBreaker(profile);

  try {
    // 2. Execute through circuit breaker + retry logic
    const wrappedOperation = async (): Promise<T> => {
      // Apply retry with backoff - it now returns both result and attempt count
      const { result, attempts } = await retryWithBackoff(
        operation,
        profile.retryPolicy,
        profile.endpointName
      );

      // Update retry count from retryWithBackoff
      retryCount = attempts;
      
      return result;
    };

    // 3. Execute through circuit breaker
    let result: T;
    
    if (profile.cachePolicy) {
      // 4a. With cache fallback - provide fallback for circuit OPEN state
      const cacheFallback = async (): Promise<CachedResult<T>> => {
        console.log(`[Resilience] Circuit OPEN for ${profile.endpointName}, attempting cache fallback`);
        
        // Use withCachedFallback with a dummy operation that always fails
        // This forces it to check the cache and return cached data if available
        const cacheResult = await withCachedFallback(
          async () => { throw new Error('Circuit is OPEN'); },
          profile.cachePolicy!,
          cacheKeyParams
        );
        
        if (!cacheResult.fromCache) {
          throw new Error(`No cached data available for ${profile.endpointName} while circuit is OPEN`);
        }
        
        console.log(`[Resilience] Serving cached data for ${profile.endpointName} (circuit OPEN)`);
        
        return cacheResult;
      };

      const cachedResult: CachedResult<T> = await circuitBreaker.execute(
        () => withCachedFallback(wrappedOperation, profile.cachePolicy!, cacheKeyParams),
        cacheFallback
      );
      
      result = cachedResult.data;
      fromCache = cachedResult.fromCache;
    } else {
      // 4b. Without cache fallback - use custom fallback if provided
      result = await circuitBreaker.execute(wrappedOperation, fallback);
    }

    // 5. Record success metrics
    const durationMs = Date.now() - startTime;
    resilienceMetricsService.recordRequest(
      profile.endpointName,
      true, // success
      retryCount,
      fromCache,
      durationMs
    );

    console.log(`[ResilientRequest] ${profile.endpointName}: SUCCESS`, {
      retries: retryCount,
      fromCache,
      durationMs,
      circuitState: circuitBreaker.getState()
    });

    return {
      data: result,
      fromCache,
      retries: retryCount,
      circuitState: circuitBreaker.getState(),
      durationMs
    };

  } catch (error) {
    operationError = error as Error;
    
    // 6. Record failure metrics
    const durationMs = Date.now() - startTime;
    resilienceMetricsService.recordRequest(
      profile.endpointName,
      false, // failure
      retryCount,
      fromCache,
      durationMs
    );

    console.error(`[ResilientRequest] ${profile.endpointName}: FAILED`, {
      error: operationError.message,
      retries: retryCount,
      durationMs,
      circuitState: circuitBreaker.getState()
    });

    // Re-throw the error
    throw operationError;
  }
}

/**
 * Get or create circuit breaker for an endpoint
 * 
 * @param profile - Resilience profile
 * @returns Circuit breaker instance
 */
function getOrCreateCircuitBreaker(profile: ResilienceProfile): CircuitBreaker {
  const { endpointName, circuitBreakerPolicy } = profile;

  if (!circuitBreakers.has(endpointName)) {
    // Create new circuit breaker with state change callback
    const circuitBreaker = new CircuitBreaker(
      endpointName,
      circuitBreakerPolicy,
      (oldState, newState) => {
        // Record state change in metrics
        resilienceMetricsService.recordCircuitStateChange(endpointName, newState);
        
        // Emit WebSocket event (if websocket service is available)
        emitCircuitStateChange(endpointName, newState);
      }
    );

    circuitBreakers.set(endpointName, circuitBreaker);
    console.log(`[ResilientRequest] Created circuit breaker for: ${endpointName}`);
  }

  return circuitBreakers.get(endpointName)!;
}

/**
 * Emit circuit state change event via WebSocket
 * (gracefully handles if WebSocket service is not available)
 * 
 * @param endpointName - Name of the endpoint
 * @param newState - New circuit state
 */
function emitCircuitStateChange(endpointName: string, newState: CircuitState): void {
  try {
    // Dynamically import websocket service to avoid circular dependencies
    // This is a best-effort notification - failures are logged but not thrown
    import('../websocket.service').then(({ webSocketService }) => {
      webSocketService.broadcast('resilience:circuit_state', {
        endpoint: endpointName,
        state: newState,
        timestamp: new Date()
      });
    }).catch(() => {
      // Silently ignore if WebSocket service is not available
      // This allows resilience to work independently of WebSocket infrastructure
    });
  } catch (error) {
    // Silently ignore WebSocket broadcast failures
  }
}

/**
 * Get all circuit breakers (for admin/monitoring)
 * 
 * @returns Map of endpoint names to circuit breakers
 */
export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return circuitBreakers;
}

/**
 * Reset a specific circuit breaker (admin operation)
 * 
 * @param endpointName - Name of the endpoint
 * @returns true if reset, false if not found
 */
export function resetCircuitBreaker(endpointName: string): boolean {
  const circuitBreaker = circuitBreakers.get(endpointName);
  if (circuitBreaker) {
    circuitBreaker.reset();
    console.log(`[ResilientRequest] Reset circuit breaker: ${endpointName}`);
    return true;
  }
  return false;
}

/**
 * Get circuit breaker state for an endpoint
 * 
 * @param endpointName - Name of the endpoint
 * @returns Circuit state or undefined if not found
 */
export function getCircuitState(endpointName: string): CircuitState | undefined {
  return circuitBreakers.get(endpointName)?.getState();
}
