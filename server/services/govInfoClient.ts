import axios, { AxiosInstance } from 'axios';

/**
 * GovInfo API Client
 * 
 * Authenticated HTTP client for accessing GovInfo.gov bulk data API
 * Handles rate limiting, retries, and authentication with DATA_GOV_API_KEY
 * 
 * API Documentation: https://api.data.gov/docs/gpo/
 * Base URL: https://api.govinfo.gov
 */

interface GovInfoCollectionItem {
  packageId: string;
  title: string;
  dateIssued: string;
  lastModified: string;
  packageLink: string;
  docClass?: string;
  branch?: string;
}

interface GovInfoCollectionResponse {
  count: number;
  offset: number;
  pageSize: number;
  nextPage?: string;
  previousPage?: string;
  packages: GovInfoCollectionItem[];
}

interface GovInfoPackageMetadata {
  packageId: string;
  title: string;
  congress?: string;
  session?: string;
  dateIssued: string;
  lastModified: string;
  governmentAuthor1?: string;
  governmentAuthor2?: string;
  download: {
    txtLink?: string;
    xmlLink?: string;
    pdfLink?: string;
    modsLink?: string;
    premisLink?: string;
  };
}

interface DownloadOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class GovInfoClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.govinfo.gov';
  private readonly client: AxiosInstance;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 100; // 100ms between requests (10 req/sec max)

  constructor() {
    const apiKey = process.env.DATA_GOV_API_KEY;
    if (!apiKey) {
      throw new Error(
        'DATA_GOV_API_KEY environment variable is required for GovInfo API access. ' +
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
   * Get collection list for a specific collection (e.g., BILLSTATUS, PLAW)
   * 
   * @param collection - Collection name (e.g., "BILLSTATUS", "PLAW")
   * @param congress - Congress number (e.g., "119" for 119th Congress)
   * @param offset - Pagination offset (default: 0)
   * @param pageSize - Results per page (default: 100, max: 1000)
   */
  async getCollectionList(
    collection: string,
    congress: string,
    offset = 0,
    pageSize = 100
  ): Promise<GovInfoCollectionResponse> {
    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const response = await this.client.get(`/collections/${collection}/${congress}`, {
        params: {
          offset,
          pageSize,
          api_key: this.apiKey,
        },
      });
      
      return response.data;
    });
  }

  /**
   * Get all packages from a collection (handles pagination automatically)
   */
  async getAllPackages(
    collection: string,
    congress: string,
    pageSize = 100
  ): Promise<GovInfoCollectionItem[]> {
    const allPackages: GovInfoCollectionItem[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.getCollectionList(collection, congress, offset, pageSize);
      allPackages.push(...response.packages);
      
      offset += pageSize;
      hasMore = response.nextPage !== undefined;
      
      if (hasMore) {
        console.log(`📥 Fetched ${allPackages.length} packages, continuing...`);
      }
    }
    
    return allPackages;
  }

  /**
   * Get metadata for a specific package
   * 
   * @param packageId - Package ID (e.g., "BILLS-119hr5376ih")
   */
  async getPackageMetadata(packageId: string): Promise<GovInfoPackageMetadata> {
    await this.rateLimit();
    
    return this.retryRequest(async () => {
      const response = await this.client.get(`/packages/${packageId}/summary`, {
        params: {
          api_key: this.apiKey,
        },
      });
      
      return response.data;
    });
  }

  /**
   * Download XML content from a URL
   * 
   * @param url - Full URL to XML file
   * @param options - Download options (timeout, retries)
   */
  async downloadXML(url: string, options: DownloadOptions = {}): Promise<string> {
    await this.rateLimit();
    
    const { timeout = 60000, retries = 3, retryDelay = 1000 } = options;
    
    return this.retryRequest(async () => {
      const response = await axios.get(url, {
        timeout,
        responseType: 'text',
        params: {
          api_key: this.apiKey,
        },
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0',
        },
      });
      
      return response.data;
    }, retries, retryDelay);
  }

  /**
   * Download binary content (PDF, etc.) from a URL
   * 
   * @param url - Full URL to file
   * @param options - Download options
   */
  async downloadBinary(url: string, options: DownloadOptions = {}): Promise<Buffer> {
    await this.rateLimit();
    
    const { timeout = 60000, retries = 3, retryDelay = 1000 } = options;
    
    return this.retryRequest(async () => {
      const response = await axios.get(url, {
        timeout,
        responseType: 'arraybuffer',
        params: {
          api_key: this.apiKey,
        },
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0',
        },
      });
      
      return Buffer.from(response.data);
    }, retries, retryDelay);
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
export const govInfoClient = new GovInfoClient();
