import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";

// Lazy Gemini initialization to prevent server crash at import-time
let gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

export interface SearchResult {
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    content: string;
    relevanceScore: number;
    pageNumber?: number;
  }>;
  relevanceScore?: number;
  queryAnalysis?: {
    intent: string;
    entities: string[];
    benefitProgram?: string;
  };
}

class RAGService {
  async search(query: string, benefitProgramId?: string): Promise<SearchResult> {
    try {
      // Step 1: Analyze query intent and extract entities
      const queryAnalysis = await this.analyzeQuery(query);
      
      // Step 2: Generate embeddings for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Step 3: Retrieve relevant document chunks (mock implementation)
      const relevantChunks = await this.retrieveRelevantChunks(
        queryEmbedding,
        benefitProgramId,
        queryAnalysis
      );
      
      // Step 4: Generate response using RAG
      const response = await this.generateResponse(query, relevantChunks, queryAnalysis);
      
      return response;
    } catch (error) {
      console.error("RAG search error:", error);
      throw new Error("Failed to process search query");
    }
  }

  private async analyzeQuery(query: string) {
    try {
      const prompt = `You are a Maryland benefits policy expert. Analyze the user query and extract:
      1. Intent (eligibility, application, requirements, etc.)
      2. Relevant entities (income, age, household size, etc.)
      3. Likely Maryland benefit program if mentioned
      
      Focus on Maryland state programs available through marylandbenefits.gov and VITA services.
      
      Respond with JSON in this format:
      {
        "intent": "string",
        "entities": ["entity1", "entity2"],
        "benefitProgram": "MD_SNAP|MD_MEDICAID|MD_TANF|MD_ENERGY|MD_VITA|etc or null"
      }
      
      Query: ${query}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Query analysis error:", error);
      return {
        intent: "general_inquiry",
        entities: [],
        benefitProgram: null,
      };
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const ai = getGemini();
      const result = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text
      });
      
      return result.embeddings[0].values;
    } catch (error) {
      console.error("Embedding generation error:", error);
      throw new Error("Failed to generate embeddings");
    }
  }

  private async retrieveRelevantChunks(
    queryEmbedding: number[],
    benefitProgramId?: string,
    queryAnalysis?: any
  ) {
    try {
      // Get processed documents
      const documents = await storage.getDocuments({ 
        benefitProgramId,
        status: "processed"
      });

      if (documents.length === 0) {
        return [];
      }

      const allResults: Array<{
        documentId: string;
        filename: string;
        content: string;
        relevanceScore: number;
        pageNumber?: number;
        chunkMetadata?: any;
      }> = [];

      // Get chunks for all relevant documents
      for (const doc of documents) {
        const chunks = await storage.getDocumentChunks(doc.id);
        
        for (const chunk of chunks) {
          if (!chunk.embeddings) {
            continue; // Skip chunks without embeddings
          }

          try {
            // Parse stored embeddings
            const chunkEmbedding = JSON.parse(chunk.embeddings) as number[];
            
            // Calculate cosine similarity
            const similarity = this.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
            
            // Only include chunks with reasonable similarity
            if (similarity > 0.6) {
              allResults.push({
                documentId: doc.id,
                filename: doc.filename,
                content: chunk.content,
                relevanceScore: similarity,
                pageNumber: chunk.pageNumber || undefined,
                chunkMetadata: chunk.metadata
              });
            }
          } catch (error) {
            console.error(`Error processing chunk ${chunk.id}:`, error);
            continue;
          }
        }
      }

      // Sort by relevance score and return top results
      const topResults = allResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5); // Return top 5 most relevant chunks

      console.log(`Found ${topResults.length} relevant chunks for query`);
      return topResults;
      
    } catch (error) {
      console.error("Error retrieving relevant chunks:", error);
      // Fallback to simple document-based search
      const documents = await storage.getDocuments({ 
        benefitProgramId,
        status: "processed",
        limit: 3 
      });

      return documents.map(doc => ({
        documentId: doc.id,
        filename: doc.filename,
        content: `Content from ${doc.filename} (embedding search failed, showing document summary)`,
        relevanceScore: 0.7,
        pageNumber: 1,
      }));
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  private async generateResponse(
    query: string,
    relevantChunks: any[],
    queryAnalysis: any
  ): Promise<SearchResult> {
    try {
      const context = relevantChunks
        .map(chunk => `Source: ${chunk.filename}\nContent: ${chunk.content}`)
        .join("\n\n");

      const prompt = `You are a Maryland benefits navigation assistant. Use the provided context to answer questions about Maryland state benefit programs available through marylandbenefits.gov and VITA services.

      Guidelines:
      - Focus specifically on Maryland state programs and their requirements
      - Provide accurate, specific information based on the context
      - If information is not in the context, clearly state limitations
      - Direct users to marylandbenefits.gov for applications
      - Mention VITA locations for free tax assistance (income under $67,000)
      - Use clear, accessible language appropriate for Maryland residents
      - Highlight important deadlines, requirements, or procedures
      - If asked about eligibility, provide specific Maryland criteria and thresholds
      - Include contact information: 1-855-642-8572 for phone applications
      
      Always base your response on the provided context and clearly cite sources.
      
      Question: ${query}
      
      Context:
      ${context}`;

      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });
      const answer = response.text || "I'm unable to provide an answer based on the available information.";

      // Calculate overall relevance score
      const avgRelevanceScore = relevantChunks.length > 0 
        ? relevantChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / relevantChunks.length
        : 0;

      return {
        answer,
        sources: relevantChunks,
        relevanceScore: avgRelevanceScore,
        queryAnalysis,
      };
    } catch (error) {
      console.error("Response generation error:", error);
      throw new Error("Failed to generate response");
    }
  }

  async addDocumentToIndex(documentId: string): Promise<void> {
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      const chunks = await storage.getDocumentChunks(documentId);
      
      // Process each chunk
      for (const chunk of chunks) {
        if (!chunk.embeddings) {
          // Generate embeddings for the chunk
          const embedding = await this.generateEmbedding(chunk.content);
          
          // In a real implementation, this would:
          // 1. Store embeddings in vector database (Pinecone, Chroma, etc.)
          // 2. Include metadata for filtering
          
          // Update chunk with embedding
          await storage.updateDocumentChunk(chunk.id, {
            embeddings: JSON.stringify(embedding),
            vectorId: `vec_${chunk.id}`, // Mock vector ID
          });
        }
      }
      
      console.log(`Document ${documentId} indexed successfully`);
    } catch (error) {
      console.error(`Error indexing document ${documentId}:`, error);
      throw error;
    }
  }

  async removeDocumentFromIndex(documentId: string): Promise<void> {
    try {
      const chunks = await storage.getDocumentChunks(documentId);
      
      // In a real implementation, this would remove vectors from the vector database
      for (const chunk of chunks) {
        if (chunk.vectorId) {
          // Remove from vector database
          console.log(`Removing vector ${chunk.vectorId} from index`);
        }
      }
      
      console.log(`Document ${documentId} removed from index successfully`);
    } catch (error) {
      console.error(`Error removing document ${documentId} from index:`, error);
      throw error;
    }
  }
}

export const ragService = new RAGService();
