import { GoogleGenAI } from "@google/genai";
import { embeddingCache } from "./embeddingCache";
import { db } from "../db";
import { monitoringMetrics } from "@shared/schema";
import { PiiMaskingUtils } from "../utils/piiMasking";
import { sql, and, gte, lte } from "drizzle-orm";
import { createLogger } from './logger.service';

const logger = createLogger('AIOrchestrator');

/**
 * Unified AI Orchestration Layer
 * 
 * Consolidates all Gemini API operations into a single, efficient service with:
 * - Singleton pattern for client management
 * - Unified rate limiting and request queueing
 * - Cost tracking across all features
 * - Smart model routing based on task type
 * - Exponential backoff retry logic
 * - PII-masked error logging
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface GenerateTextOptions {
  feature?: string;
  priority?: 'critical' | 'normal' | 'background';
  maxRetries?: number;
}

export interface AnalyzeImageOptions {
  feature?: string;
  priority?: 'critical' | 'normal' | 'background';
}

export interface ExecuteCodeOptions {
  feature?: string;
  priority?: 'critical' | 'normal' | 'background';
}

export interface CodeExecutionResult {
  code: string;
  result: any;
  explanation?: string;
}

export interface MetricsReport {
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  callsByFeature: Record<string, {
    calls: number;
    tokens: number;
    cost: number;
  }>;
  callsByModel: Record<string, {
    calls: number;
    tokens: number;
    cost: number;
  }>;
}

interface QueuedRequest {
  id: string;
  priority: number; // Higher = more urgent
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  feature: string;
  model: string;
}

// ============================================================================
// Model Pricing (per 1K tokens)
// ============================================================================

const MODEL_PRICING = {
  'gemini-2.0-flash': { input: 0.000075, output: 0.0003 },
  'gemini-2.0-flash-thinking': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'text-embedding-004': { input: 0.00001, output: 0 },
} as const;

// ============================================================================
// AI Orchestrator Service
// ============================================================================

class AIOrchestrator {
  private static instance: AIOrchestrator;
  private geminiClient: GoogleGenAI | null = null;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  
  // Rate limiting configuration
  private readonly MAX_CONCURRENT_REQUESTS = 5;
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 50; // Gemini free tier limit
  private requestTimestamps: number[] = [];
  private activeRequests = 0;
  
  // Priority weights
  private readonly PRIORITY_WEIGHTS = {
    critical: 100, // Tax filing, time-sensitive
    normal: 50,    // Standard operations
    background: 10 // Non-urgent batch processing
  };

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AIOrchestrator {
    if (!AIOrchestrator.instance) {
      AIOrchestrator.instance = new AIOrchestrator();
    }
    return AIOrchestrator.instance;
  }

  /**
   * Initialize Gemini client (singleton)
   */
  private getGeminiClient(): GoogleGenAI {
    if (!this.geminiClient) {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }
      this.geminiClient = new GoogleGenAI({ apiKey });
    }
    return this.geminiClient;
  }

  /**
   * Smart model routing based on task type
   */
  private selectModel(taskType: 'text' | 'vision' | 'code' | 'embedding'): string {
    switch (taskType) {
      case 'vision':
        return 'gemini-2.0-flash'; // Fast vision analysis
      case 'code':
        return 'gemini-2.0-flash-thinking'; // Code execution with reasoning
      case 'text':
        return 'gemini-2.0-flash'; // General chat/RAG
      case 'embedding':
        return 'text-embedding-004'; // Embeddings
      default:
        return 'gemini-2.0-flash';
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Track AI usage in monitoring_metrics table
   */
  private async trackAIUsage(feature: string, model: string, tokens: number): Promise<void> {
    try {
      const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gemini-2.0-flash'];
      const estimatedCost = (tokens / 1000) * (pricing.input + pricing.output) / 2; // Average of input/output

      await db.insert(monitoringMetrics).values({
        metricType: 'ai_api_call',
        metricValue: tokens,
        metadata: {
          feature,
          model,
          tokens,
          estimatedCost,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error tracking AI usage', {
        error: PiiMaskingUtils.redactPII(String(error)),
        feature,
        model,
        service: 'AIOrchestrator'
      });
    }
  }

  /**
   * Check rate limits and return true if we can proceed
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    
    // Remove timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < this.RATE_LIMIT_WINDOW_MS
    );
    
    // Check if we're under concurrent and rate limits
    return (
      this.activeRequests < this.MAX_CONCURRENT_REQUESTS &&
      this.requestTimestamps.length < this.MAX_REQUESTS_PER_WINDOW
    );
  }

  /**
   * Add request to queue with priority
   */
  private async queueRequest<T>(
    feature: string,
    model: string,
    priority: 'critical' | 'normal' | 'background',
    execute: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest = {
        id: Math.random().toString(36).substring(7),
        priority: this.PRIORITY_WEIGHTS[priority],
        execute,
        resolve,
        reject,
        retryCount: 0,
        feature,
        model,
      };

      this.requestQueue.push(request);
      this.requestQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
      
      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
      if (!this.canMakeRequest()) {
        // Wait before checking again
        setTimeout(() => {
          this.isProcessingQueue = false;
          this.processQueue();
        }, 1000);
        return;
      }

      const request = this.requestQueue.shift();
      if (!request) continue;

      this.activeRequests++;
      this.requestTimestamps.push(Date.now());

      // Start execution WITHOUT awaiting (enables parallelism)
      this.executeWithRetry(request)
        .then(result => request.resolve(result))
        .catch(error => request.reject(error))
        .finally(() => {
          this.activeRequests--;
          this.processQueue(); // Re-enter scheduler after completion
        });
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private async executeWithRetry(request: QueuedRequest): Promise<any> {
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000; // 1 second

    try {
      return await request.execute();
    } catch (error: any) {
      // Check if we should retry
      const isRetryable = 
        error?.message?.includes('429') || // Rate limit
        error?.message?.includes('503') || // Service unavailable
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRetryable && request.retryCount < MAX_RETRIES) {
        request.retryCount++;
        const delay = BASE_DELAY * Math.pow(2, request.retryCount - 1);
        
        logger.info('Retrying request', {
          attempt: request.retryCount,
          maxRetries: MAX_RETRIES,
          delayMs: delay,
          feature: request.feature,
          service: 'AIOrchestrator'
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(request);
      }

      // Log error with PII masking
      logger.error('AI request failed', {
        feature: request.feature,
        model: request.model,
        error: PiiMaskingUtils.redactPII(String(error)),
        service: 'AIOrchestrator'
      });
      
      throw error;
    }
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Generate text using Gemini
   */
  async generateText(
    prompt: string,
    options: GenerateTextOptions = {}
  ): Promise<string> {
    const { 
      feature = 'general', 
      priority = 'normal',
    } = options;

    const model = this.selectModel('text');
    const estimatedTokens = this.estimateTokens(prompt);

    const execute = async () => {
      const ai = this.getGeminiClient();
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      const result = response.text || "";
      
      // Track usage
      const totalTokens = estimatedTokens + this.estimateTokens(result);
      await this.trackAIUsage(feature, model, totalTokens);
      
      return result;
    };

    return this.queueRequest(feature, model, priority, execute);
  }

  /**
   * Analyze image using Gemini Vision
   */
  async analyzeImage(
    base64Image: string,
    prompt: string,
    options: AnalyzeImageOptions = {}
  ): Promise<string> {
    const { 
      feature = 'vision_analysis', 
      priority = 'normal',
    } = options;

    const model = this.selectModel('vision');
    const estimatedTokens = this.estimateTokens(prompt) + 258; // Image tokens (approx)

    const execute = async () => {
      const ai = this.getGeminiClient();
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      });
      
      const result = response.text || "";
      
      // Track usage
      const totalTokens = estimatedTokens + this.estimateTokens(result);
      await this.trackAIUsage(feature, model, totalTokens);
      
      return result;
    };

    return this.queueRequest(feature, model, priority, execute);
  }

  /**
   * Execute code with reasoning (new capability!)
   */
  async executeCode(
    prompt: string,
    options: ExecuteCodeOptions = {}
  ): Promise<CodeExecutionResult> {
    const { 
      feature = 'code_execution', 
      priority = 'normal',
    } = options;

    const model = this.selectModel('code');
    const estimatedTokens = this.estimateTokens(prompt);

    const execute = async () => {
      const ai = this.getGeminiClient();
      
      const enhancedPrompt = `${prompt}\n\nProvide your response in JSON format:
{
  "code": "the code to execute",
  "result": the execution result,
  "explanation": "brief explanation of the calculation"
}`;

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }]
      });
      
      let responseText = response.text || "{}";
      
      // Parse JSON response (handle markdown code blocks)
      if (responseText.includes('```json')) {
        responseText = responseText.split('```json')[1].split('```')[0].trim();
      } else if (responseText.includes('```')) {
        responseText = responseText.split('```')[1].split('```')[0].trim();
      }
      
      const result = JSON.parse(responseText) as CodeExecutionResult;
      
      // Track usage
      const totalTokens = estimatedTokens + this.estimateTokens(responseText);
      await this.trackAIUsage(feature, model, totalTokens);
      
      return result;
    };

    return this.queueRequest(feature, model, priority, execute);
  }

  /**
   * Generate embeddings (with cache optimization)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first (60-80% hit rate!)
    const cached = embeddingCache.get(text);
    if (cached) {
      return cached;
    }

    const feature = 'embeddings';
    const model = this.selectModel('embedding');
    const estimatedTokens = this.estimateTokens(text);

    const execute = async () => {
      const ai = this.getGeminiClient();
      const response = await ai.models.embedContent({
        model,
        contents: [text]
      });
      
      const embedding = response.embeddings?.[0]?.values || [];
      
      // Store in cache
      if (embedding.length > 0) {
        embeddingCache.set(text, embedding);
      }
      
      // Track usage
      await this.trackAIUsage(feature, model, estimatedTokens);
      
      return embedding;
    };

    return this.queueRequest(feature, model, 'background', execute);
  }

  /**
   * Get cost metrics for a time range
   */
  async getCostMetrics(timeRange?: { start: Date; end: Date }): Promise<MetricsReport> {
    try {
      const conditions = [sql`${monitoringMetrics.metricType} = 'ai_api_call'`];
      
      if (timeRange) {
        conditions.push(
          gte(monitoringMetrics.timestamp, timeRange.start),
          lte(monitoringMetrics.timestamp, timeRange.end)
        );
      }

      const metrics = await db
        .select()
        .from(monitoringMetrics)
        .where(and(...conditions));

      const report: MetricsReport = {
        totalCalls: metrics.length,
        totalTokens: 0,
        estimatedCost: 0,
        callsByFeature: {},
        callsByModel: {},
      };

      for (const metric of metrics) {
        const metadata = metric.metadata as any;
        const feature = metadata.feature || 'unknown';
        const model = metadata.model || 'unknown';
        const tokens = metadata.tokens || 0;
        const cost = metadata.estimatedCost || 0;

        report.totalTokens += tokens;
        report.estimatedCost += cost;

        // By feature
        if (!report.callsByFeature[feature]) {
          report.callsByFeature[feature] = { calls: 0, tokens: 0, cost: 0 };
        }
        report.callsByFeature[feature].calls++;
        report.callsByFeature[feature].tokens += tokens;
        report.callsByFeature[feature].cost += cost;

        // By model
        if (!report.callsByModel[model]) {
          report.callsByModel[model] = { calls: 0, tokens: 0, cost: 0 };
        }
        report.callsByModel[model].calls++;
        report.callsByModel[model].tokens += tokens;
        report.callsByModel[model].cost += cost;
      }

      return report;
    } catch (error) {
      logger.error('Error getting cost metrics', {
        error: PiiMaskingUtils.redactPII(String(error)),
        service: 'AIOrchestrator'
      });
      return {
        totalCalls: 0,
        totalTokens: 0,
        estimatedCost: 0,
        callsByFeature: {},
        callsByModel: {},
      };
    }
  }

  /**
   * Get current queue status (for monitoring)
   */
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      requestsInWindow: this.requestTimestamps.length,
      maxRequestsPerWindow: this.MAX_REQUESTS_PER_WINDOW,
      canMakeRequest: this.canMakeRequest(),
    };
  }

  /**
   * Get embedding cache statistics
   */
  getEmbeddingCacheStats() {
    return embeddingCache.getStats();
  }

  /**
   * Analyze document for field extraction (from aiService)
   */
  async analyzeDocumentForFieldExtraction(
    text: string,
    documentType: string,
    options: GenerateTextOptions = {}
  ) {
    const { feature = 'document_field_extraction', priority = 'normal' } = options;
    const model = this.selectModel('text');

    const prompt = `You are an AI assistant specialized in extracting structured information from government publications, with an emphasis on public benefit programs and federal and state EITC and CTC
      
For the document type "${documentType}", extract relevant fields such as:
- Eligibility requirements
- Income limits
- Asset limits
- Application deadlines
- Contact information
- Effective dates
- Program codes
- Geographic restrictions

Respond with JSON containing the extracted fields and their values.
Use null for fields that cannot be determined.

Format: {
  "eligibilityRequirements": ["req1", "req2"],
  "incomeLimits": {"1person": "amount", "2person": "amount"},
  "assetLimits": "amount",
  "applicationDeadline": "date or null",
  "effectiveDate": "date or null",
  "contactInfo": {"phone": "number", "website": "url"},
  "programCodes": ["code1", "code2"],
  "geographicScope": "federal|state|local|specific location",
  "confidence": number
}

Document text: ${text}`;

    const execute = async () => {
      const ai = this.getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const result = response.text || "{}";
      const totalTokens = this.estimateTokens(prompt) + this.estimateTokens(result);
      await this.trackAIUsage(feature, "gemini-1.5-pro", totalTokens);

      try {
        return JSON.parse(result);
      } catch {
        return { error: "Failed to parse extraction result", confidence: 0 };
      }
    };

    return this.queueRequest(feature, model, priority, execute);
  }

  /**
   * Generate document summary (from aiService)
   */
  async generateDocumentSummary(
    text: string,
    maxLength: number = 200,
    options: GenerateTextOptions = {}
  ): Promise<string> {
    const { feature = 'document_summarization', priority = 'normal' } = options;
    const model = this.selectModel('text');

    const prompt = `Summarize the following government benefits document in ${maxLength} words or less.
Focus on:
- Main purpose of the document
- Key eligibility requirements
- Important dates or deadlines
- Primary benefit amounts or limits
- Application process overview

Make the summary clear and actionable for benefits administrators.

Document text: ${text}`;

    const execute = async () => {
      const ai = this.getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const result = response.text || "Summary generation failed";
      const totalTokens = this.estimateTokens(prompt) + this.estimateTokens(result);
      await this.trackAIUsage(feature, "gemini-1.5-pro", totalTokens);

      return result;
    };

    return this.queueRequest(feature, model, priority, execute);
  }

  /**
   * Detect document changes (from aiService)
   */
  async detectDocumentChanges(
    oldText: string,
    newText: string,
    options: GenerateTextOptions = {}
  ) {
    const { feature = 'document_change_detection', priority = 'background' } = options;
    const model = this.selectModel('text');

    const prompt = `You are comparing two versions of a government benefits document to identify changes.

Analyze the differences and categorize them as:
- POLICY_CHANGE: Changes to eligibility, benefits amounts, or requirements
- PROCEDURAL_CHANGE: Changes to application or administrative processes
- DATE_CHANGE: Updates to effective dates or deadlines  
- CONTACT_CHANGE: Updates to contact information
- FORMATTING_CHANGE: Minor formatting or structural changes
- OTHER: Any other type of change

Respond with JSON:
{
  "hasChanges": boolean,
  "changesSummary": "brief description of main changes",
  "changes": [
    {
      "type": "POLICY_CHANGE|PROCEDURAL_CHANGE|etc",
      "description": "specific change description",
      "severity": "HIGH|MEDIUM|LOW",
      "oldValue": "previous value if applicable",
      "newValue": "new value if applicable"
    }
  ],
  "confidence": number
}

Old version: ${oldText}

New version: ${newText}`;

    const execute = async () => {
      const ai = this.getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const result = response.text || "{}";
      const totalTokens = this.estimateTokens(prompt) + this.estimateTokens(result);
      await this.trackAIUsage(feature, "gemini-1.5-pro", totalTokens);

      try {
        return JSON.parse(result);
      } catch {
        return { hasChanges: false, changesSummary: "Failed to detect changes", changes: [], confidence: 0 };
      }
    };

    return this.queueRequest(feature, model, priority, execute);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const aiOrchestrator = AIOrchestrator.getInstance();
