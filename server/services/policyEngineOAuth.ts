import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from './logger.service';

/**
 * PolicyEngine OAuth 2.0 Token Manager
 * 
 * Manages OAuth 2.0 Client Credentials flow for PolicyEngine Household API
 * - Token endpoint: https://policyengine.uk.auth0.com/oauth/token
 * - Audience: https://household.api.policyengine.org
 * - Token lifetime: ~30 days
 * 
 * IMPORTANT: Testing apps limited to 100 token requests/month
 * This service aggressively caches tokens to prevent hitting rate limits
 */

const TOKEN_ENDPOINT = 'https://policyengine.uk.auth0.com/oauth/token';
const AUDIENCE = 'https://household.api.policyengine.org';
const TOKEN_CACHE_KEY = 'policyengine_access_token';
const EXPIRY_CACHE_KEY = 'policyengine_token_expiry';

// Cache with 30 day TTL (tokens typically last ~30 days)
const tokenCache = new NodeCache({ 
  stdTTL: 30 * 24 * 60 * 60, // 30 days in seconds
  checkperiod: 60 * 60 // Check for expired keys every hour
});

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // Seconds until expiration
}

class PolicyEngineOAuth {
  private requestInProgress: Promise<string> | null = null;

  /**
   * Get access token (from cache or fetch new)
   * Returns cached token if valid, otherwise fetches a new one
   */
  async getAccessToken(): Promise<string> {
    // Check if token is cached and still valid
    const cachedToken = tokenCache.get<string>(TOKEN_CACHE_KEY);
    const expiryTime = tokenCache.get<number>(EXPIRY_CACHE_KEY);

    if (cachedToken && this.isTokenValid()) {
      logger.debug('Using cached token', {
        service: 'PolicyEngineOAuth'
      });
      return cachedToken;
    }

    // If a request is already in progress, wait for it
    if (this.requestInProgress) {
      logger.debug('Token request already in progress, waiting', {
        service: 'PolicyEngineOAuth'
      });
      return this.requestInProgress;
    }

    // Fetch new token
    this.requestInProgress = this.fetchNewToken();
    
    try {
      const token = await this.requestInProgress;
      return token;
    } finally {
      this.requestInProgress = null;
    }
  }

  /**
   * Force refresh token (ignores cache)
   */
  async refreshToken(): Promise<string> {
    logger.info('Force refreshing token', {
      service: 'PolicyEngineOAuth'
    });
    
    // Clear cache
    tokenCache.del(TOKEN_CACHE_KEY);
    tokenCache.del(EXPIRY_CACHE_KEY);
    
    return this.fetchNewToken();
  }

  /**
   * Check if cached token is still valid
   */
  isTokenValid(): boolean {
    const expiryTime = tokenCache.get<number>(EXPIRY_CACHE_KEY);
    
    if (!expiryTime) {
      return false;
    }

    // Check if token expires in the next 5 minutes (buffer time)
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    return now < (expiryTime - bufferMs);
  }

  /**
   * Fetch new token from Auth0
   */
  private async fetchNewToken(): Promise<string> {
    const clientId = process.env.POLICYENGINE_CLIENT_ID;
    const clientSecret = process.env.POLICYENGINE_CLIENT_SECRET;

    // Validate credentials
    if (!clientId || !clientSecret) {
      throw new Error(
        'PolicyEngine OAuth credentials not configured. ' +
        'Set POLICYENGINE_CLIENT_ID and POLICYENGINE_CLIENT_SECRET environment variables.'
      );
    }

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      audience: AUDIENCE,
      grant_type: 'client_credentials'
    };

    try {
      logger.info('Fetching new access token', {
        audience: AUDIENCE,
        service: 'PolicyEngineOAuth'
      });
      
      const response = await axios.post<TokenResponse>(TOKEN_ENDPOINT, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 second timeout
      });

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No access_token in OAuth response');
      }

      // Calculate expiration time
      // Default to 30 days if not provided
      const expiresInMs = (expires_in || 30 * 24 * 60 * 60) * 1000;
      const expiryTime = Date.now() + expiresInMs;

      // Cache token and expiry
      tokenCache.set(TOKEN_CACHE_KEY, access_token);
      tokenCache.set(EXPIRY_CACHE_KEY, expiryTime);

      const expiryDate = new Date(expiryTime).toISOString();
      logger.info('Token acquired successfully', {
        expiryDate,
        service: 'PolicyEngineOAuth'
      });

      return access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        // Handle auth failures
        if (status === 401 || status === 403) {
          throw new Error(
            `PolicyEngine OAuth authentication failed (${status}): Invalid credentials. ` +
            `Please verify POLICYENGINE_CLIENT_ID and POLICYENGINE_CLIENT_SECRET.`
          );
        }

        // Network or server errors - retry logic
        if (!error.response || (status !== undefined && status >= 500)) {
          logger.error('Network/server error, will retry on next request', {
            status,
            error: error.message,
            service: 'PolicyEngineOAuth'
          });
          throw new Error(
            `PolicyEngine OAuth network error: ${error.message}. ` +
            `Token will be retried on next API call.`
          );
        }

        throw new Error(
          `PolicyEngine OAuth failed: ${error.message}` +
          (errorData ? ` - ${JSON.stringify(errorData)}` : '')
        );
      }

      throw error;
    }
  }

  /**
   * Clear cached token (useful for testing)
   */
  clearCache(): void {
    tokenCache.del(TOKEN_CACHE_KEY);
    tokenCache.del(EXPIRY_CACHE_KEY);
    logger.debug('Cache cleared', {
      service: 'PolicyEngineOAuth'
    });
  }

  /**
   * Get token cache stats (for monitoring)
   */
  getCacheStats(): { hasCachedToken: boolean; expiresAt: string | null; isValid: boolean } {
    const hasCachedToken = tokenCache.has(TOKEN_CACHE_KEY);
    const expiryTime = tokenCache.get<number>(EXPIRY_CACHE_KEY);
    
    return {
      hasCachedToken,
      expiresAt: expiryTime ? new Date(expiryTime).toISOString() : null,
      isValid: this.isTokenValid()
    };
  }
}

export const policyEngineOAuth = new PolicyEngineOAuth();
