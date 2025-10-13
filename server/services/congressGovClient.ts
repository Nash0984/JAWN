import axios, { AxiosInstance } from 'axios';

/**
 * Congress.gov API Client
 * 
 * REST API client for accessing Congress.gov v3 API
 * Provides real-time keyword search across federal bills
 * 
 * API Documentation: https://api.congress.gov/
 * Base URL: https://api.congress.gov/v3
 * API Docs: https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/BillEndpoint.md
 * 
 * **CORE STRENGTH: KEYWORD SEARCH**
 * 
 * Congress.gov excels at real-time keyword search across all federal legislation.
 * Use this API to discover bills related to specific topics like SNAP, Medicaid, TANF, etc.
 * 
 * **API CAPABILITIES:**
 * 
 * ✅ **Keyword Search** (searchBills):
 *    - Real-time search across all bills by keywords
 *    - Fast discovery of policy-relevant legislation
 *    - Supports congress number, bill type, and date range filtering
 * 
 * ✅ **Individual Bill Details** (getBillDetails):
 *    - Complete bill information including sponsors, committees, actions
 *    - Authoritative `laws[]` array for enacted bills
 *    - Useful for verifying specific bills you already know about
 * 
 * ✅ **Bill Actions, Cosponsors, Committees**:
 *    - Detailed legislative history for individual bills
 *    - Sponsor and cosponsor information
 *    - Committee assignments and activities
 * 
 * **FOR AUTHORITATIVE BILL STATUS: USE GOVINFO**
 * 
 * ❌ Congress.gov search endpoint does NOT provide reliable status filtering
 * ✅ Use GovInfo Bill Status XML API for authoritative status tracking
 * 
 * **RECOMMENDED WORKFLOW:**
 * 
 * 1. **Discover Bills** - Use Congress.gov keyword search to find relevant bills
 * 2. **Track Status** - Use GovInfo Bill Status XML for authoritative status
 * 3. **Verify Individual Bills** - Use getBillDetails() to check laws[] array
 * 
 * **USAGE EXAMPLES:**
 * 
 * ```typescript
 * // Discover SNAP-related bills (fast, reliable)
 * const results = await congressGovClient.searchBills({
 *   keywords: ['SNAP', 'food assistance'],
 *   congress: 119,
 *   limit: 50
 * });
 * 
 * // Get details for a specific bill (includes laws[] array)
 * const details = await congressGovClient.getBillDetails(119, 'hr', '5376');
 * if (details.bill.laws && details.bill.laws.length > 0) {
 *   console.log('Bill is enacted:', details.bill.laws);
 * }
 * ```
 * 
 * See: https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/BillEndpoint.md
 */

// API Response Interfaces
export interface CongressBill {
  congress: number;
  type: string;
  number: string;
  title: string;
  originChamber?: string;
  originChamberCode?: string;
  updateDate?: string;
  updateDateIncludingText?: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
  url?: string;
  laws?: Array<{
    type: string;
    number: string;
  }>;
}

export interface BillSearchResponse {
  bills: CongressBill[];
  pagination: {
    count: number;
    next?: string;
  };
}

export interface BillDetailsResponse {
  bill: {
    congress: number;
    type: string;
    number: string;
    title: string;
    introducedDate?: string;
    constitutionalAuthorityStatementText?: string;
    policyArea?: {
      name: string;
    };
    subjects?: {
      legislativeSubjects?: Array<{
        name: string;
      }>;
    };
    summaries?: {
      summaries?: Array<{
        versionCode: string;
        actionDate: string;
        actionDesc: string;
        text: string;
        updateDate: string;
      }>;
    };
    textVersions?: {
      url?: string;
    };
    sponsors?: Array<{
      bioguideId: string;
      fullName: string;
      firstName: string;
      lastName: string;
      party: string;
      state: string;
      district?: number;
      url?: string;
    }>;
    cosponsors?: {
      url?: string;
      countIncludingWithdrawnCosponsors?: number;
      count?: number;
    };
    actions?: {
      url?: string;
      count?: number;
    };
    committees?: {
      url?: string;
      count?: number;
    };
    relatedBills?: {
      url?: string;
      count?: number;
    };
    latestAction?: {
      actionDate: string;
      text: string;
    };
    laws?: Array<{
      type: string;
      number: string;
    }>;
    updateDate: string;
    updateDateIncludingText: string;
  };
}

export interface BillAction {
  actionDate: string;
  text: string;
  type?: string;
  actionCode?: string;
  sourceSystem?: {
    code: number;
    name: string;
  };
  committees?: Array<{
    systemCode: string;
    name: string;
    url?: string;
  }>;
}

export interface BillActionsResponse {
  actions: BillAction[];
  pagination: {
    count: number;
    next?: string;
  };
}

export interface BillCosponsor {
  bioguideId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  party: string;
  state: string;
  district?: number;
  sponsorshipDate: string;
  isOriginalCosponsor: boolean;
  url?: string;
}

export interface BillCosponsorsResponse {
  cosponsors: BillCosponsor[];
  pagination: {
    count: number;
    next?: string;
  };
}

export interface BillCommittee {
  systemCode: string;
  name: string;
  chamber: string;
  type: string;
  url?: string;
  activities?: Array<{
    name: string;
    date: string;
  }>;
}

export interface BillCommitteesResponse {
  committees: BillCommittee[];
  pagination: {
    count: number;
    next?: string;
  };
}

export interface BillSearchParams {
  keywords?: string[];
  query?: string;
  congress?: number;
  billType?: string;
  fromDateTime?: string;
  toDateTime?: string;
  limit?: number;
  offset?: number;
  sort?: 'updateDate+asc' | 'updateDate+desc';
}

export class CongressGovClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.congress.gov/v3';
  private readonly client: AxiosInstance;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 100; // 100ms between requests (10 req/sec max)

  constructor() {
    const apiKey = process.env.DATA_GOV_API_KEY;
    if (!apiKey) {
      throw new Error(
        'DATA_GOV_API_KEY environment variable is required for Congress.gov API access. ' +
        'Get your key at https://api.data.gov/signup/'
      );
    }
    
    this.apiKey = apiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      params: {
        api_key: this.apiKey,
      },
      headers: {
        'User-Agent': 'Maryland Benefits Navigator System/1.0',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Rate limiting - ensures we don't exceed API limits
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries = 3,
    retryDelay = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ Retry attempt ${attempt}/${retries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          
          // Don't retry client errors (except 429 Too Many Requests)
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
        }
        
        if (attempt === retries) {
          break;
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }


  /**
   * Search bills by keywords
   * 
   * Searches Congress.gov for bills matching the provided keywords or query string.
   * This is optimized for keyword-based discovery of policy-relevant legislation.
   * 
   * **For authoritative bill status, use GovInfo Bill Status XML API.**
   * 
   * @param params - Search parameters
   * @param params.keywords - Array of keywords to search (OR-ed together)
   * @param params.query - Custom query string (alternative to keywords)
   * @param params.congress - Congress number (e.g., 119 for 119th Congress)
   * @param params.billType - Bill type filter (hr, s, hjres, sjres, etc.)
   * @param params.fromDateTime - Start date filter (ISO 8601 format)
   * @param params.toDateTime - End date filter (ISO 8601 format)
   * @param params.limit - Maximum number of results to return (default: 20)
   * @param params.offset - Pagination offset (default: 0)
   * @param params.sort - Sort order (default: 'updateDate+desc')
   * 
   * @returns BillSearchResponse with matching bills
   */
  async searchBills(params: BillSearchParams = {}): Promise<BillSearchResponse> {
    const {
      keywords,
      query,
      congress = 119,
      billType,
      fromDateTime,
      toDateTime,
      limit = 20,
      offset = 0,
      sort = 'updateDate+desc'
    } = params;

    // Build query string from keywords (OR-ed together) or use provided query
    let queryString = query || '';
    
    if (keywords && keywords.length > 0) {
      queryString = keywords.join(' OR ');
    }

    // Construct endpoint based on filters
    let endpoint = `/bill/${congress}`;
    if (billType) {
      endpoint += `/${billType.toLowerCase()}`;
    }

    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const searchParams: any = {
        api_key: this.apiKey,
        format: 'json',
        limit,
        offset,
        sort,
      };

      if (queryString) {
        searchParams.query = queryString;
      }
      if (fromDateTime) {
        searchParams.fromDateTime = fromDateTime;
      }
      if (toDateTime) {
        searchParams.toDateTime = toDateTime;
      }

      const response = await this.client.get(endpoint, { params: searchParams });
      const bills = response.data.bills || [];
      
      return {
        bills,
        pagination: {
          count: bills.length,
          next: response.data.pagination?.next,
        },
      };
    });
  }

  /**
   * Get detailed information about a specific bill
   * 
   * @param congress - Congress number (e.g., 119)
   * @param billType - Bill type (hr, s, hjres, sjres, etc.)
   * @param billNumber - Bill number (e.g., 5376)
   */
  async getBillDetails(
    congress: number,
    billType: string,
    billNumber: string | number
  ): Promise<BillDetailsResponse> {
    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const response = await this.client.get(
        `/bill/${congress}/${billType.toLowerCase()}/${billNumber}`,
        {
          params: {
            api_key: this.apiKey,
            format: 'json',
          },
        }
      );
      
      return response.data;
    });
  }

  /**
   * Get all actions for a bill
   * 
   * @param congress - Congress number
   * @param billType - Bill type
   * @param billNumber - Bill number
   * @param limit - Number of results (default 20, max 250)
   * @param offset - Pagination offset
   */
  async getBillActions(
    congress: number,
    billType: string,
    billNumber: string | number,
    limit = 20,
    offset = 0
  ): Promise<BillActionsResponse> {
    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const response = await this.client.get(
        `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/actions`,
        {
          params: {
            api_key: this.apiKey,
            format: 'json',
            limit,
            offset,
          },
        }
      );
      
      return {
        actions: response.data.actions || [],
        pagination: response.data.pagination || { count: 0 },
      };
    });
  }

  /**
   * Get all cosponsors for a bill
   * 
   * @param congress - Congress number
   * @param billType - Bill type
   * @param billNumber - Bill number
   * @param limit - Number of results (default 20, max 250)
   * @param offset - Pagination offset
   */
  async getBillCosponsors(
    congress: number,
    billType: string,
    billNumber: string | number,
    limit = 20,
    offset = 0
  ): Promise<BillCosponsorsResponse> {
    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const response = await this.client.get(
        `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/cosponsors`,
        {
          params: {
            api_key: this.apiKey,
            format: 'json',
            limit,
            offset,
          },
        }
      );
      
      return {
        cosponsors: response.data.cosponsors || [],
        pagination: response.data.pagination || { count: 0 },
      };
    });
  }

  /**
   * Get committee assignments for a bill
   * 
   * @param congress - Congress number
   * @param billType - Bill type
   * @param billNumber - Bill number
   */
  async getBillCommittees(
    congress: number,
    billType: string,
    billNumber: string | number
  ): Promise<BillCommitteesResponse> {
    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const response = await this.client.get(
        `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/committees`,
        {
          params: {
            api_key: this.apiKey,
            format: 'json',
          },
        }
      );
      
      return {
        committees: response.data.committees || [],
        pagination: response.data.pagination || { count: 0 },
      };
    });
  }

  /**
   * Get all actions for a bill (handles pagination automatically)
   */
  async getAllBillActions(
    congress: number,
    billType: string,
    billNumber: string | number
  ): Promise<BillAction[]> {
    const allActions: BillAction[] = [];
    let offset = 0;
    const limit = 250; // Max allowed
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.getBillActions(congress, billType, billNumber, limit, offset);
      allActions.push(...response.actions);
      
      offset += limit;
      hasMore = response.pagination.next !== undefined;
    }
    
    return allActions;
  }

  /**
   * Get all cosponsors for a bill (handles pagination automatically)
   */
  async getAllBillCosponsors(
    congress: number,
    billType: string,
    billNumber: string | number
  ): Promise<BillCosponsor[]> {
    const allCosponsors: BillCosponsor[] = [];
    let offset = 0;
    const limit = 250; // Max allowed
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.getBillCosponsors(congress, billType, billNumber, limit, offset);
      allCosponsors.push(...response.cosponsors);
      
      offset += limit;
      hasMore = response.pagination.next !== undefined;
    }
    
    return allCosponsors;
  }


  /**
   * Get request statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      lastRequestTime: this.lastRequestTime,
    };
  }
}

// Export singleton instance
export const congressGovClient = new CongressGovClient();
