/**
 * Endpoint-Specific Resilience Profiles
 * 
 * Defines resilience configurations for each external API:
 * - PolicyEngine: High criticality, aggressive retry, 1h cache
 * - Gemini: Medium criticality, moderate retry, 30min cache
 * - IRS/Maryland E-File: High criticality, conservative circuit breaker, no cache
 * - Document Extraction: Medium criticality, moderate retry, 1h cache
 */

import { ResilienceProfile } from './resilientRequest';

/**
 * PolicyEngine API Profile
 * 
 * High criticality - benefit calculations are core functionality
 * - 5 retry attempts with exponential backoff
 * - 1 hour cache (benefit calculations stable for household state)
 * - Cache invalidated on household updates
 */
export const POLICYENGINE_PROFILE: ResilienceProfile = {
  endpointName: 'PolicyEngine',
  retryPolicy: {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 16000,
    jitterFactor: 0.3,
    retryableStatusCodes: [429, 500, 502, 503, 504]
  },
  circuitBreakerPolicy: {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 1
  },
  cachePolicy: {
    ttl: 3600, // 1 hour
    key: 'policyengine',
    invalidateOn: ['household_update', 'income_change']
  },
  criticality: 'high'
};

/**
 * Gemini API Profile
 * 
 * Medium criticality - document analysis can degrade gracefully
 * - 3 retry attempts with exponential backoff
 * - 30 minute cache (document analysis semi-stable)
 * - Cache invalidated on document updates
 */
export const GEMINI_PROFILE: ResilienceProfile = {
  endpointName: 'Gemini',
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    jitterFactor: 0.3,
    retryableStatusCodes: [429, 500, 503]
  },
  circuitBreakerPolicy: {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 1
  },
  cachePolicy: {
    ttl: 1800, // 30 minutes
    key: 'gemini',
    invalidateOn: ['document_update']
  },
  criticality: 'medium'
};

/**
 * IRS/Maryland E-File API Profile
 * 
 * High criticality - tax filing must be reliable
 * - 5 retry attempts with longer delays for government APIs
 * - Conservative circuit breaker (3 failures, 5 min reset)
 * - NO CACHE (e-filing requires fresh state, cannot use stale data)
 * - Higher jitter to avoid thundering herd on government infrastructure
 */
export const EFILE_PROFILE: ResilienceProfile = {
  endpointName: 'IRS-EFILE',
  retryPolicy: {
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 32000,
    jitterFactor: 0.5, // Higher jitter for government APIs
    retryableStatusCodes: [500, 502, 503, 504] // Don't retry 429 - government APIs may ban
  },
  circuitBreakerPolicy: {
    failureThreshold: 3, // More conservative
    resetTimeoutMs: 300000, // 5 minutes
    halfOpenMaxAttempts: 1
  },
  cachePolicy: undefined, // No caching for e-filing
  criticality: 'high'
};

/**
 * Document Extraction API Profile
 * 
 * Medium criticality - document extraction can retry safely
 * - 3 retry attempts with exponential backoff
 * - 1 hour cache (extracted data stable for same document)
 * - Cache invalidated on document re-upload
 */
export const DOCUMENT_EXTRACTION_PROFILE: ResilienceProfile = {
  endpointName: 'DocumentExtraction',
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    jitterFactor: 0.3,
    retryableStatusCodes: [429, 500, 502, 503, 504]
  },
  circuitBreakerPolicy: {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 1
  },
  cachePolicy: {
    ttl: 3600, // 1 hour
    key: 'document_extraction',
    invalidateOn: ['document_reupload']
  },
  criticality: 'medium'
};

/**
 * Congress.gov API Profile
 * 
 * Low criticality - policy tracking is not real-time critical
 * - 3 retry attempts
 * - Longer cache (6 hours - legislation changes slowly)
 * - Relaxed circuit breaker
 */
export const CONGRESS_GOV_PROFILE: ResilienceProfile = {
  endpointName: 'CongressGov',
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 16000,
    jitterFactor: 0.4,
    retryableStatusCodes: [429, 500, 502, 503, 504]
  },
  circuitBreakerPolicy: {
    failureThreshold: 10, // More relaxed
    resetTimeoutMs: 120000, // 2 minutes
    halfOpenMaxAttempts: 1
  },
  cachePolicy: {
    ttl: 21600, // 6 hours
    key: 'congress_gov',
    invalidateOn: ['manual_refresh']
  },
  criticality: 'low'
};

/**
 * GovInfo API Profile
 * 
 * Low criticality - public law tracking is background process
 * - 3 retry attempts
 * - Very long cache (24 hours - public laws published infrequently)
 * - Relaxed circuit breaker
 */
export const GOVINFO_PROFILE: ResilienceProfile = {
  endpointName: 'GovInfo',
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 16000,
    jitterFactor: 0.4,
    retryableStatusCodes: [429, 500, 502, 503, 504]
  },
  circuitBreakerPolicy: {
    failureThreshold: 10, // More relaxed
    resetTimeoutMs: 120000, // 2 minutes
    halfOpenMaxAttempts: 1
  },
  cachePolicy: {
    ttl: 86400, // 24 hours
    key: 'govinfo',
    invalidateOn: ['manual_refresh']
  },
  criticality: 'low'
};

/**
 * OpenAI API Profile (if used)
 * 
 * Medium criticality - AI features can degrade gracefully
 * - 3 retry attempts
 * - 15 minute cache (AI responses semi-stable for same input)
 */
export const OPENAI_PROFILE: ResilienceProfile = {
  endpointName: 'OpenAI',
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    jitterFactor: 0.3,
    retryableStatusCodes: [429, 500, 503]
  },
  circuitBreakerPolicy: {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 1
  },
  cachePolicy: {
    ttl: 900, // 15 minutes
    key: 'openai',
    invalidateOn: ['input_change']
  },
  criticality: 'medium'
};
