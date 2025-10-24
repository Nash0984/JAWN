/**
 * PolicyEngine Third-Party Verification Service with Circuit Breaker
 * 
 * Wraps PolicyEngine API calls with circuit breaker pattern for resilience.
 * This ensures JAWN can continue operating even when PolicyEngine is down,
 * as JAWN's Rules Engine is the primary decision system.
 */

import { policyEngineCircuitBreaker } from './circuitBreaker.service';
import { PolicyEngineHttpClient, type PolicyEngineHouseholdInput, type BenefitCalculationResult } from './policyEngineHttpClient';
import { createLogger } from './logger.service';

const logger = createLogger('PolicyEngineWithCircuitBreaker');

class PolicyEngineWithCircuitBreaker {
  private client: PolicyEngineHttpClient;
  
  constructor() {
    this.client = new PolicyEngineHttpClient();
  }
  
  /**
   * Calculate benefits with circuit breaker protection
   * Returns null if circuit is OPEN (PolicyEngine unavailable)
   * This allows JAWN to continue with its primary rules engine
   * 
   * IMPORTANT: Calling code MUST log/alert when null is returned to ensure
   * staff are aware third-party verification is unavailable (architect recommendation)
   */
  async calculateBenefits(
    household: PolicyEngineHouseholdInput
  ): Promise<BenefitCalculationResult | null> {
    try {
      return await policyEngineCircuitBreaker.execute(async () => {
        return await this.client.calculateBenefits(household);
      });
    } catch (error) {
      // Circuit breaker fallback returns null
      // Log warning and continue without third-party verification
      logger.warn('PolicyEngine third-party verification unavailable - JAWN rules engine continues', {
        reason: error instanceof Error ? error.message : String(error),
        circuitState: policyEngineCircuitBreaker.getState(),
        service: 'PolicyEngineWithCircuitBreaker',
        // NOTE: Calling code should create user-visible warning or audit log entry
        recommendation: 'Alert staff that third-party verification is offline'
      });
      
      return null;
    }
  }
  
  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    return policyEngineCircuitBreaker.getMetrics();
  }
  
  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    return policyEngineCircuitBreaker.getState();
  }
  
  /**
   * Manually reset circuit breaker
   */
  resetCircuitBreaker() {
    policyEngineCircuitBreaker.reset();
    logger.info('PolicyEngine circuit breaker manually reset', {
      service: 'PolicyEngineWithCircuitBreaker'
    });
  }
}

// Export singleton instance
export const policyEngineWithCircuitBreaker = new PolicyEngineWithCircuitBreaker();
