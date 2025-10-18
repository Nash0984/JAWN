/**
 * Retry with Exponential Backoff
 * 
 * Implements exponential backoff with jitter to prevent thundering herd problem.
 * Formula: delay = min(maxDelay, initialDelay * 2^attempt * (1 + random jitter))
 */

export interface RetryPolicy {
  maxAttempts: number; // Default 3, up to 5 for mission-critical
  initialDelayMs: number; // Default 1000ms
  maxDelayMs: number; // Default 16000ms
  jitterFactor: number; // Default 0.3 (30% jitter)
  retryableStatusCodes?: number[]; // e.g., [429, 500, 502, 503, 504]
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  jitterFactor: 0.3,
  retryableStatusCodes: [429, 500, 502, 503, 504]
};

interface RetryError extends Error {
  statusCode?: number;
  isRetryable?: boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;  // Number of retries (0 = success on first try, 1 = success on first retry, etc.)
}

/**
 * Retry an operation with exponential backoff
 * 
 * @param operation - The async operation to retry
 * @param policy - Retry policy configuration
 * @param operationName - Name for logging purposes
 * @returns Promise resolving to result with retry count
 * @throws Error after all retry attempts exhausted
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  operationName: string = 'Operation'
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < policy.maxAttempts) {
    try {
      // Log attempt (skip log for first attempt to reduce noise)
      if (attempt > 0) {
        console.log(`[RetryBackoff] ${operationName}: Attempt ${attempt + 1}/${policy.maxAttempts}`);
      }

      // Execute operation
      const result = await operation();
      
      // Success - log retry recovery if this wasn't first attempt
      if (attempt > 0) {
        console.log(`[RetryBackoff] ${operationName}: Succeeded after ${attempt} retries`);
      }
      
      return { result, attempts: attempt };

    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error as RetryError, policy);
      
      if (!isRetryable) {
        console.warn(`[RetryBackoff] ${operationName}: Non-retryable error encountered`, {
          error: lastError.message,
          statusCode: (error as RetryError).statusCode
        });
        throw lastError;
      }

      // If this was the last attempt, throw
      if (attempt >= policy.maxAttempts - 1) {
        console.error(`[RetryBackoff] ${operationName}: All ${policy.maxAttempts} attempts exhausted`, {
          error: lastError.message,
          attempts: attempt + 1
        });
        throw new Error(`${operationName} failed after ${policy.maxAttempts} attempts: ${lastError.message}`);
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoffDelay(attempt, policy);
      
      console.warn(`[RetryBackoff] ${operationName}: Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        nextAttempt: attempt + 2,
        maxAttempts: policy.maxAttempts
      });

      // Wait before next attempt
      await sleep(delay);
      
      // Increment attempt counter after delay
      attempt++;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error(`${operationName} failed after retries`);
}

/**
 * Calculate exponential backoff delay with jitter
 * 
 * @param attempt - Current retry attempt number (0 = first retry, 1 = second retry, etc.)
 * @param policy - Retry policy
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, policy: RetryPolicy): number {
  // Base delay: initialDelay * 2^attempt
  // For attempt 0 (first retry): initialDelay * 2^0 = initialDelay
  // For attempt 1 (second retry): initialDelay * 2^1 = 2 * initialDelay
  // For attempt 2 (third retry): initialDelay * 2^2 = 4 * initialDelay
  const exponentialDelay = policy.initialDelayMs * Math.pow(2, attempt);
  
  // Add jitter: random value between 0 and jitterFactor
  // Example: if jitterFactor = 0.3, jitter ranges from 0% to 30%
  const jitter = Math.random() * policy.jitterFactor;
  const delayWithJitter = exponentialDelay * (1 + jitter);
  
  // Cap at maxDelay
  return Math.min(delayWithJitter, policy.maxDelayMs);
}

/**
 * Check if an error is retryable based on policy
 * 
 * @param error - Error object
 * @param policy - Retry policy
 * @returns true if error is retryable
 */
function isRetryableError(error: RetryError, policy: RetryPolicy): boolean {
  // If error explicitly marked as not retryable
  if (error.isRetryable === false) {
    return false;
  }

  // If error explicitly marked as retryable
  if (error.isRetryable === true) {
    return true;
  }

  // Check status code if available
  if (error.statusCode && policy.retryableStatusCodes) {
    return policy.retryableStatusCodes.includes(error.statusCode);
  }

  // Check for common network errors (ECONNREFUSED, ETIMEDOUT, etc.)
  const networkErrors = [
    'ECONNREFUSED',
    'ETIMEDOUT', 
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN'
  ];
  
  if (error.message && networkErrors.some(code => error.message.includes(code))) {
    return true;
  }

  // Default: retry for unknown errors (conservative approach)
  return true;
}

/**
 * Sleep utility
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
