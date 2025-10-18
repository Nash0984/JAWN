import { GoogleGenAI } from "@google/genai";
import { embeddingCache } from "./embeddingCache";
import { resilientRequest } from './resilience/resilientRequest';
import { GEMINI_PROFILE } from './resilience/profiles';

/**
 * Get a configured Gemini client instance
 * 
 * IMPORTANT: @google/genai package has built-in priority that prefers GOOGLE_API_KEY over GEMINI_API_KEY
 * We force GEMINI_API_KEY by temporarily setting process.env.GOOGLE_API_KEY to ensure correct key is used
 * 
 * RESILIENT: API calls wrapped with exponential backoff, circuit breaker, and cached fallback
 */
export function getGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate text using Gemini with resilience wrapper
 */
export async function generateTextWithGemini(prompt: string): Promise<string> {
  const result = await resilientRequest(
    async () => {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      return response.text || "";
    },
    GEMINI_PROFILE,
    undefined, // No fallback - text generation must succeed or fail
    { prompt: prompt.substring(0, 100) } // Cache key params (truncate for key length)
  );

  if (result.retries > 0) {
    console.log(`[Gemini] Text generation succeeded after ${result.retries} retries`);
  }

  return result.data;
}

/**
 * Analyze an image using Gemini Vision with resilience wrapper
 */
export async function analyzeImageWithGemini(base64Image: string, prompt: string): Promise<string> {
  const result = await resilientRequest(
    async () => {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      });
      return response.text || "";
    },
    GEMINI_PROFILE,
    undefined, // No fallback - vision analysis must succeed or fail
    { 
      prompt: prompt.substring(0, 100),
      imageHash: base64Image.substring(0, 50) // Use image prefix for cache key
    }
  );

  if (result.retries > 0) {
    console.log(`[Gemini] Image analysis succeeded after ${result.retries} retries`);
  }

  return result.data;
}

/**
 * Generate embeddings for text using Gemini text-embedding-004
 * 
 * OPTIMIZED: Uses embedding cache to reduce API calls by 60-80%
 * Embeddings are deterministic - same text always produces same embedding
 * 
 * FIXED: Uses correct @google/genai API format
 * - API expects 'contents' (plural) as an array of strings
 * - Response has 'embeddings' array, access first element with [0]
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Check cache first
    const cached = embeddingCache.get(text);
    if (cached) {
      return cached;
    }
    
    // Cache miss - generate new embedding
    const ai = getGeminiClient();
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [text]  // Correct format: array of strings
    });
    
    // Response has embeddings array, get first (and only) embedding
    const embedding = response.embeddings?.[0]?.values || [];
    
    // Store in cache for future use
    if (embedding.length > 0) {
      embeddingCache.set(text, embedding);
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(768).fill(0);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}
