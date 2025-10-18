/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by tracking failures and temporarily blocking requests
 * when a service is likely down.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, reject all requests immediately
 * - HALF_OPEN: Testing if service recovered, allow limited requests
 */

export enum CircuitState {
  CLOSED = 'closed',       // Normal operation
  OPEN = 'open',           // Too many failures, reject requests
  HALF_OPEN = 'half_open'  // Testing if service recovered
}

export interface CircuitBreakerPolicy {
  failureThreshold: number;     // Default 5 consecutive failures
  resetTimeoutMs: number;       // Default 60000ms (1 minute)
  halfOpenMaxAttempts: number;  // Default 1 (single test request)
}

export const DEFAULT_CIRCUIT_BREAKER_POLICY: CircuitBreakerPolicy = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  halfOpenMaxAttempts: 1
};

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  openedAt: Date | null;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  halfOpenAttempts: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public endpointName: string,
    public openedAt: Date,
    public resetTimeoutMs: number
  ) {
    super(`Circuit breaker OPEN for ${endpointName}. Service temporarily unavailable.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private openedAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private halfOpenAttempts: number = 0;
  private policy: CircuitBreakerPolicy;
  private endpointName: string;
  private onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;

  constructor(
    endpointName: string,
    policy: CircuitBreakerPolicy = DEFAULT_CIRCUIT_BREAKER_POLICY,
    onStateChange?: (oldState: CircuitState, newState: CircuitState) => void
  ) {
    this.endpointName = endpointName;
    this.policy = policy;
    this.onStateChange = onStateChange;
  }

  /**
   * Execute an operation through the circuit breaker
   * 
   * @param operation - The async operation to execute
   * @param fallback - Optional fallback function if circuit is open
   * @returns Promise resolving to operation result
   * @throws CircuitBreakerOpenError if circuit is open and no fallback provided
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check current state and handle accordingly
    switch (this.state) {
      case CircuitState.CLOSED:
        return await this.executeClosed(operation);
      
      case CircuitState.OPEN:
        return await this.executeOpen(operation, fallback);
      
      case CircuitState.HALF_OPEN:
        return await this.executeHalfOpen(operation);
      
      default:
        throw new Error(`Unknown circuit state: ${this.state}`);
    }
  }

  /**
   * Execute operation in CLOSED state
   */
  private async executeClosed<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute operation in OPEN state
   * Check if timeout has passed to transition to HALF_OPEN
   */
  private async executeOpen<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if reset timeout has passed
    if (this.shouldAttemptReset()) {
      console.log(`[CircuitBreaker] ${this.endpointName}: Transitioning to HALF_OPEN for testing`);
      this.transitionTo(CircuitState.HALF_OPEN);
      this.halfOpenAttempts = 0;
      return await this.executeHalfOpen(operation);
    }

    // Circuit still open - use fallback or throw
    if (fallback) {
      console.warn(`[CircuitBreaker] ${this.endpointName}: Circuit OPEN, using fallback`);
      return await fallback();
    }

    throw new CircuitBreakerOpenError(
      this.endpointName,
      this.openedAt!,
      this.policy.resetTimeoutMs
    );
  }

  /**
   * Execute operation in HALF_OPEN state
   * Single test request to check if service recovered
   */
  private async executeHalfOpen<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we've exceeded half-open attempts
    if (this.halfOpenAttempts >= this.policy.halfOpenMaxAttempts) {
      console.warn(`[CircuitBreaker] ${this.endpointName}: Half-open test failed, reopening circuit`);
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = new Date();
      throw new CircuitBreakerOpenError(
        this.endpointName,
        this.openedAt,
        this.policy.resetTimeoutMs
      );
    }

    this.halfOpenAttempts++;

    try {
      const result = await operation();
      
      // Success - close circuit
      console.log(`[CircuitBreaker] ${this.endpointName}: Half-open test succeeded, closing circuit`);
      this.transitionTo(CircuitState.CLOSED);
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
      this.openedAt = null;
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Failure - reopen circuit
      console.warn(`[CircuitBreaker] ${this.endpointName}: Half-open test failed, reopening circuit`);
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = new Date();
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessAt = new Date();
    
    // Reset failure count on success (only in CLOSED state)
    if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureAt = new Date();

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED && this.failureCount >= this.policy.failureThreshold) {
      console.error(
        `[CircuitBreaker] ${this.endpointName}: Failure threshold (${this.policy.failureThreshold}) reached, opening circuit`
      );
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = new Date();
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    
    const now = new Date().getTime();
    const openedAtMs = this.openedAt.getTime();
    const elapsedMs = now - openedAtMs;
    
    return elapsedMs >= this.policy.resetTimeoutMs;
  }

  /**
   * Transition to a new state and emit event
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState !== newState) {
      this.state = newState;
      
      console.log(`[CircuitBreaker] ${this.endpointName}: ${oldState} → ${newState}`);
      
      if (this.onStateChange) {
        this.onStateChange(oldState, newState);
      }
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      openedAt: this.openedAt,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      halfOpenAttempts: this.halfOpenAttempts
    };
  }

  /**
   * Manually reset the circuit breaker (admin operation)
   */
  reset(): void {
    console.log(`[CircuitBreaker] ${this.endpointName}: Manual reset`);
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
    this.halfOpenAttempts = 0;
  }

  /**
   * Get endpoint name
   */
  getEndpointName(): string {
    return this.endpointName;
  }
}
