import { eq, and, sql } from 'drizzle-orm';
import { generateEmbedding, cosineSimilarity, generateTextWithGemini } from './gemini.service';
import { logger } from './logger.service';
import type { IStorage } from '../storage';

export interface VitaSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  relevanceScore: number;
  extractedRules: any[];
  topics: string[];
  summary: string;
  citation: string;
}

export interface VitaSearchOptions {
  topK?: number;
  minScore?: number;
  topics?: string[];
  ruleTypes?: string[];
}

export class VitaSearchService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Search VITA knowledge base using semantic similarity
   */
  async searchVitaKnowledge(
    query: string,
    options: VitaSearchOptions = {}
  ): Promise<VitaSearchResult[]> {
    const {
      topK = 5,
      minScore = 0.7,
      topics,
      ruleTypes
    } = options;

    logger.debug('Searching VITA knowledge', {
      service: 'VitaSearchService',
      query
    });

    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Get VITA program ID
    const vitaProgram = await this.storage.getBenefitProgramByCode('VITA');
    if (!vitaProgram) {
      throw new Error('VITA program not found');
    }

    // 3. Get all VITA documents
    const documents = await this.storage.getDocuments({ 
      benefitProgramId: vitaProgram.id,
      status: 'processed'
    });

    if (documents.length === 0) {
      logger.warn('No VITA documents found. Has IRS Pub 4012 been ingested?', {
        service: 'VitaSearchService',
        method: 'searchVitaKnowledge'
      });
      return [];
    }

    // 4. Get all chunks from VITA documents
    const allChunks: any[] = [];
    for (const doc of documents) {
      const docChunks = await this.storage.getDocumentChunks(doc.id);
      allChunks.push(...docChunks);
    }

    if (allChunks.length === 0) {
      logger.warn('No VITA chunks found. Has IRS Pub 4012 been processed with embeddings?', {
        service: 'VitaSearchService',
        method: 'searchVitaKnowledge'
      });
      return [];
    }

    // 5. Calculate similarity scores
    const scoredChunks = allChunks
      .filter((chunk: any) => chunk.embeddings) // Only chunks with embeddings
      .map((chunk: any) => {
        let chunkEmbedding: number[] = [];
        
        try {
          chunkEmbedding = JSON.parse(chunk.embeddings as string);
        } catch (error) {
          logger.error('Error parsing embeddings for chunk', {
            service: 'VitaSearchService',
            method: 'searchVitaKnowledge',
            chunkId: chunk.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return null;
        }

        const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
        
        // Extract metadata
        const metadata = chunk.metadata as any || {};
        const rules = metadata.rules || [];
        const chunkTopics = metadata.topics || [];
        const summary = metadata.summary || '';

        // Filter by topics if specified
        if (topics && topics.length > 0) {
          const hasMatchingTopic = chunkTopics.some((t: string) => 
            topics.some(filter => t.toLowerCase().includes(filter.toLowerCase()))
          );
          if (!hasMatchingTopic) {
            return null;
          }
        }

        // Filter by rule types if specified
        if (ruleTypes && ruleTypes.length > 0) {
          const hasMatchingRuleType = rules.some((r: any) =>
            ruleTypes.includes(r.ruleType)
          );
          if (!hasMatchingRuleType) {
            return null;
          }
        }

        return {
          chunk,
          score,
          rules,
          topics: chunkTopics,
          summary
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // 6. Get document details and format results
    const results: VitaSearchResult[] = [];
    
    for (const item of scoredChunks) {
      const document = await this.storage.getDocument(item.chunk.documentId);
      if (!document) continue;

      results.push({
        chunkId: item.chunk.id,
        documentId: document.id,
        documentName: document.originalName,
        content: item.chunk.content,
        relevanceScore: item.score,
        extractedRules: item.rules,
        topics: item.topics,
        summary: item.summary,
        citation: this.formatCitation(document, item.chunk)
      });
    }

    logger.debug('Found relevant chunks', {
      service: 'VitaSearchService',
      method: 'searchVitaKnowledge',
      resultCount: results.length,
      scores: results.map(r => r.relevanceScore.toFixed(2))
    });

    return results;
  }

  /**
   * Generate AI answer with citations from search results
   */
  async answerWithCitations(
    query: string,
    searchResults: VitaSearchResult[]
  ): Promise<{
    answer: string;
    sources: VitaSearchResult[];
  }> {
    if (searchResults.length === 0) {
      return {
        answer: "I couldn't find relevant information in the VITA knowledge base to answer your question. Please try rephrasing or ask a more specific question about federal tax rules.",
        sources: []
      };
    }

    // Build context from search results
    const context = searchResults
      .map((result, idx) => `
[Source ${idx + 1}: ${result.citation}]
${result.content}

Extracted Rules:
${result.extractedRules.map(r => `- ${r.topic}: ${r.condition || ''} → ${r.action || ''} ${r.value ? `(${r.value})` : ''}`).join('\n')}
`)
      .join('\n\n---\n\n');

    const prompt = `You are a VITA (Volunteer Income Tax Assistance) tax expert helping Maryland residents with federal tax questions.

User Question: ${query}

Relevant IRS Publication 4012 excerpts:
${context}

Instructions:
1. Answer the question using ONLY the information from the provided IRS Pub 4012 excerpts
2. Be specific and cite the source numbers in your answer (e.g., "According to [Source 1]...")
3. If the excerpts mention specific dollar amounts, ages, or limits, include them
4. If the question cannot be fully answered with the provided information, say so
5. Use plain language suitable for Maryland residents applying for tax assistance
6. Focus on federal tax rules (VITA is a federal program)

Answer:`;

    const answer = await generateTextWithGemini(prompt);

    return {
      answer,
      sources: searchResults
    };
  }

  /**
   * Get all unique topics from VITA knowledge base
   */
  async getAvailableTopics(): Promise<string[]> {
    const vitaProgram = await this.storage.getBenefitProgramByCode('VITA');
    if (!vitaProgram) {
      return [];
    }

    const documents = await this.storage.getDocuments({ 
      benefitProgramId: vitaProgram.id,
      status: 'processed'
    });
    
    const topicsSet = new Set<string>();
    
    for (const doc of documents) {
      const chunks = await this.storage.getDocumentChunks(doc.id);
      chunks.forEach((chunk: any) => {
        const metadata = chunk.metadata as any || {};
        const topics = metadata.topics || [];
        topics.forEach((topic: string) => topicsSet.add(topic));
      });
    }

    return Array.from(topicsSet).sort();
  }

  /**
   * Format a citation for a document chunk
   */
  private formatCitation(document: any, chunk: any): string {
    const docName = document.originalName || document.filename;
    const pageNum = chunk.pageNumber ? `, p. ${chunk.pageNumber}` : '';
    return `IRS ${docName}${pageNum}`;
  }
}
