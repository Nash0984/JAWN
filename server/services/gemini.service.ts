import { GoogleGenAI } from "@google/genai";

/**
 * Get a configured Gemini client instance
 */
export function getGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate text using Gemini
 */
export async function generateTextWithGemini(prompt: string): Promise<string> {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt
  });
  return response.text || "";
}

/**
 * Analyze an image using Gemini Vision
 */
export async function analyzeImageWithGemini(base64Image: string, prompt: string): Promise<string> {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }
    ]
  });
  return response.text || "";
}
