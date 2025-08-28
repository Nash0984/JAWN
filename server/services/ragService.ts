import OpenAI from "openai";
import { storage } from "../storage";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

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
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `You are a Maryland benefits policy expert. Analyze the user query and extract:
            1. Intent (eligibility, application, requirements, etc.)
            2. Relevant entities (income, age, household size, etc.)
            3. Likely Maryland benefit program if mentioned
            
            Focus on Maryland state programs available through marylandbenefits.gov and VITA services.
            
            Respond with JSON in this format:
            {
              "intent": "string",
              "entities": ["entity1", "entity2"],
              "benefitProgram": "MD_SNAP|MD_MEDICAID|MD_TANF|MD_ENERGY|MD_VITA|etc or null"
            }`
          },
          { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
      });

      return JSON.parse(response.choices[0].message.content || "{}");
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
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });
      
      return response.data[0].embedding;
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
    // In a real implementation, this would:
    // 1. Query the vector database (Pinecone, Chroma, etc.)
    // 2. Apply metadata filters for benefit program
    // 3. Perform hybrid search (vector + BM25)
    // 4. Use reranking models for better relevance
    
    // For now, return mock relevant chunks
    const documents = await storage.getDocuments({ 
      benefitProgramId,
      status: "processed",
      limit: 10 
    });

    return documents.slice(0, 3).map(doc => ({
      documentId: doc.id,
      filename: doc.filename,
      content: `Sample relevant content from ${doc.filename} related to the query...`,
      relevanceScore: Math.random() * 0.3 + 0.7, // Mock score between 0.7-1.0
      pageNumber: Math.floor(Math.random() * 50) + 1,
    }));
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

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `You are a Maryland benefits navigation assistant. Use the provided context to answer questions about Maryland state benefit programs available through marylandbenefits.gov and VITA services.

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
            
            Always base your response on the provided context and clearly cite sources.`
          },
          {
            role: "user",
            content: `Question: ${query}\n\nContext:\n${context}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for factual accuracy
      });

      const answer = response.choices[0].message.content || "I'm unable to provide an answer based on the available information.";

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
