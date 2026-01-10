import axios from "axios";
import { logger } from "../logger.service";
import { cacheService } from "../cacheService";

export interface LlmsTxtConfig {
  url: string;
  cacheTtlSeconds: number;
}

export interface PolicySource {
  name: string;
  url: string;
  type: "sitemap" | "search" | "direct" | "unknown";
  priority: number;
}

export interface LlmsTxtContent {
  canonicalUrl: string;
  sitemap?: string;
  searchPattern?: string;
  contactEmail?: string;
  lastUpdated?: string;
  contentGuidelines?: string[];
  emergencyGuidelines?: string[];
  policySources: PolicySource[];
  rawContent: string;
}

const STATE_LLMS_TXT_URLS: Record<string, string> = {
  MD: "https://www.maryland.gov/llms.txt",
  PA: "https://www.pa.gov/llms.txt",
  VA: "https://www.virginia.gov/llms.txt",
  MI: "https://www.michigan.gov/llms.txt"
};

const KNOWN_POLICY_PATHS: Record<string, string[]> = {
  MD: [
    "/dhs/snap",
    "/dhs/benefits",
    "/dhs/tca",
    "/health/medicaid",
    "/dhs/ohep"
  ],
  PA: [
    "/dhs/snap",
    "/dhs/benefits",
    "/compass"
  ],
  VA: [
    "/dss/benefit-programs",
    "/dss/snap"
  ],
  MI: [
    "/mdhhs/assistance-programs",
    "/mdhhs/food-assistance"
  ]
};

export class LlmsTxtAdapter {
  private cachePrefix = "llms_txt";

  async fetchAndParse(stateCode: string): Promise<LlmsTxtContent | null> {
    const url = STATE_LLMS_TXT_URLS[stateCode];
    if (!url) {
      logger.warn(`No llms.txt URL configured for state: ${stateCode}`);
      return null;
    }

    const cacheKey = `${this.cachePrefix}:${stateCode}`;
    const cached = cacheService.get<LlmsTxtContent>(cacheKey);
    if (cached) {
      logger.debug(`Using cached llms.txt for ${stateCode}`);
      return cached;
    }

    try {
      logger.info(`Fetching llms.txt from ${url}`);
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "JAWN-PolicyEngine/1.0 (Benefits Navigation System)"
        }
      });

      const content = this.parseContent(response.data, stateCode);
      cacheService.set(cacheKey, content, 3600);
      return content;
    } catch (error) {
      logger.warn(`Failed to fetch llms.txt for ${stateCode}`, { error: String(error), url });
      return this.getFallbackContent(stateCode);
    }
  }

  private parseContent(rawContent: string, stateCode: string): LlmsTxtContent {
    const lines = rawContent.split("\n").map(l => l.trim());
    
    const result: LlmsTxtContent = {
      canonicalUrl: "",
      policySources: [],
      rawContent,
      contentGuidelines: [],
      emergencyGuidelines: []
    };

    let currentSection = "";

    for (const line of lines) {
      if (line.startsWith("## ")) {
        currentSection = line.replace("## ", "").toLowerCase();
        continue;
      }

      if (line.includes("Canonical URL")) {
        const match = line.match(/https?:\/\/[^\s]+/);
        if (match) result.canonicalUrl = match[0];
      }

      if (line.includes("Sitemap")) {
        const match = line.match(/https?:\/\/[^\s]+/);
        if (match) result.sitemap = match[0];
      }

      if (line.includes("Search URL pattern")) {
        const nextLine = lines[lines.indexOf(line) + 1];
        if (nextLine) {
          const match = nextLine.match(/https?:\/\/[^\s]+/);
          if (match) result.searchPattern = match[0];
        }
      }

      if (line.includes("email:")) {
        result.contactEmail = line.replace("email:", "").trim();
      }

      if (line.includes("last updated:")) {
        result.lastUpdated = line.replace(/.*last updated:\s*/i, "").trim();
      }

      if (currentSection === "content usage guidance for ai systems" && line.startsWith("- ")) {
        result.contentGuidelines?.push(line.replace("- ", ""));
      }

      if (currentSection.includes("emergency") && line.startsWith("- ")) {
        result.emergencyGuidelines?.push(line.replace("- ", ""));
      }
    }

    result.policySources = this.discoverPolicySources(result, stateCode);

    return result;
  }

  private discoverPolicySources(content: LlmsTxtContent, stateCode: string): PolicySource[] {
    const sources: PolicySource[] = [];
    const baseUrl = content.canonicalUrl || `https://www.${stateCode.toLowerCase()}.gov`;

    if (content.sitemap) {
      sources.push({
        name: `${stateCode} Official Sitemap`,
        url: content.sitemap,
        type: "sitemap",
        priority: 1
      });
    }

    if (content.searchPattern) {
      sources.push({
        name: `${stateCode} Site Search`,
        url: content.searchPattern,
        type: "search",
        priority: 2
      });
    }

    const knownPaths = KNOWN_POLICY_PATHS[stateCode] || [];
    for (const path of knownPaths) {
      sources.push({
        name: `${stateCode} Policy: ${path}`,
        url: `${baseUrl}${path}`,
        type: "direct",
        priority: 3
      });
    }

    return sources;
  }

  private getFallbackContent(stateCode: string): LlmsTxtContent {
    const baseUrls: Record<string, string> = {
      MD: "https://www.maryland.gov",
      PA: "https://www.pa.gov",
      VA: "https://www.virginia.gov",
      MI: "https://www.michigan.gov"
    };

    const baseUrl = baseUrls[stateCode] || "";
    const knownPaths = KNOWN_POLICY_PATHS[stateCode] || [];

    return {
      canonicalUrl: baseUrl,
      policySources: knownPaths.map((path, idx) => ({
        name: `${stateCode} Fallback Policy: ${path}`,
        url: `${baseUrl}${path}`,
        type: "direct" as const,
        priority: idx + 1
      })),
      rawContent: "",
      contentGuidelines: [
        "Fallback mode - llms.txt not available",
        "Using known policy paths"
      ]
    };
  }

  async discoverPolicyManuals(stateCode: string): Promise<PolicySource[]> {
    const content = await this.fetchAndParse(stateCode);
    if (!content) return [];
    
    return content.policySources.filter(s => 
      s.url.includes("dhs") || 
      s.url.includes("benefit") || 
      s.url.includes("snap") ||
      s.url.includes("medicaid") ||
      s.url.includes("tanf") ||
      s.url.includes("ohep") ||
      s.url.includes("assistance")
    );
  }

  async getSearchUrl(stateCode: string, query: string): Promise<string | null> {
    const content = await this.fetchAndParse(stateCode);
    if (!content?.searchPattern) return null;

    return content.searchPattern.replace("{query}", encodeURIComponent(query));
  }

  async checkForPolicyUpdates(stateCode: string): Promise<{
    hasUpdates: boolean;
    lastUpdated?: string;
    newSources: PolicySource[];
  }> {
    const cacheKey = `${this.cachePrefix}:last_check:${stateCode}`;
    const lastCheck = cacheService.get<string>(cacheKey);

    const content = await this.fetchAndParse(stateCode);
    if (!content) {
      return { hasUpdates: false, newSources: [] };
    }

    const hasUpdates = content.lastUpdated !== lastCheck;

    if (hasUpdates && content.lastUpdated) {
      cacheService.set(cacheKey, content.lastUpdated, 86400);
    }

    return {
      hasUpdates,
      lastUpdated: content.lastUpdated,
      newSources: hasUpdates ? content.policySources : []
    };
  }

  getSupportedStates(): string[] {
    return Object.keys(STATE_LLMS_TXT_URLS);
  }
}

export const llmsTxtAdapter = new LlmsTxtAdapter();
