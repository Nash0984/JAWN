import axios from 'axios';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { generateTextWithGemini, getGeminiClient } from './gemini.service';
import type { IStorage } from '../storage';
import type { InsertDocument, InsertDocumentChunk } from '@shared/schema';

const VITA_PDF_URL = 'https://www.irs.gov/pub/irs-pdf/p4012.pdf';
const DOCUMENTS_DIR = path.join(process.cwd(), 'documents');
const VITA_DIR = path.join(DOCUMENTS_DIR, 'vita');

export class VitaIngestionService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Download IRS Publication 4012 PDF
   */
  async downloadPub4012(): Promise<string> {
    console.log('Downloading IRS Publication 4012 from:', VITA_PDF_URL);

    // Ensure VITA directory exists
    if (!existsSync(VITA_DIR)) {
      await mkdir(VITA_DIR, { recursive: true });
    }

    const localPath = path.join(VITA_DIR, 'p4012.pdf');

    // Download if not already present
    if (existsSync(localPath)) {
      console.log('PDF already exists at:', localPath);
      return localPath;
    }

    const response = await axios.get(VITA_PDF_URL, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
    });

    await writeFile(localPath, response.data);
    console.log('✓ PDF downloaded successfully to:', localPath);

    return localPath;
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  async extractTextFromPdf(pdfPath: string): Promise<{
    text: string;
    numPages: number;
    info: any;
  }> {
    console.log('Extracting text from PDF:', pdfPath);

    const dataBuffer = await readFile(pdfPath);
    const data = await pdfParse(dataBuffer);

    console.log(`✓ Extracted ${data.text.length} characters from ${data.numpages} pages`);

    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  }

  /**
   * Split text into semantic chunks for RAG
   */
  splitIntoChunks(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      const chunk = text.slice(startIndex, endIndex);
      chunks.push(chunk.trim());

      // Move forward with overlap
      startIndex += chunkSize - overlap;
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  /**
   * Extract tax rules from a text chunk using Gemini
   */
  async extractTaxRules(chunkText: string, chunkIndex: number): Promise<{
    rules: any[];
    topics: string[];
    summary: string;
  }> {
    const prompt = `
You are analyzing IRS Publication 4012 (VITA/TCE Resource Guide) to extract structured tax rules.

Text chunk ${chunkIndex + 1}:
${chunkText}

Extract the following information in JSON format:
1. "rules": Array of tax rules found in this chunk. Each rule should have:
   - "ruleType": "eligibility" | "calculation" | "requirement" | "exception" | "procedure"
   - "topic": Main topic (e.g., "EITC", "Filing Status", "Standard Deduction", "CTC")
   - "condition": The condition or criteria (if applicable)
   - "action": What happens when the condition is met
   - "value": Any specific values, limits, or amounts mentioned
   - "reference": The section or page reference in Pub 4012
   
2. "topics": Array of tax topics discussed in this chunk (e.g., ["EITC", "Filing Requirements"])

3. "summary": A 1-2 sentence summary of what this chunk covers

Examples of good rules:
- EITC: {"ruleType": "eligibility", "topic": "EITC", "condition": "Taxpayer has qualifying child under age 19", "action": "May claim EITC", "value": "Age limit: 19 (24 if student)", "reference": "Chapter 15"}
- Filing Status: {"ruleType": "requirement", "topic": "Filing Status", "condition": "Married couple living together on Dec 31", "action": "Must file as Married Filing Jointly or Married Filing Separately", "reference": "Chapter 3"}

Return ONLY valid JSON with these three fields: rules, topics, summary.
`;

    try {
      const result = await generateTextWithGemini(prompt);
      
      // Clean the result to extract JSON
      let jsonText = result.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(jsonText);
      
      return {
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : ''
      };
    } catch (error) {
      console.error(`Error extracting rules from chunk ${chunkIndex}:`, error);
      return {
        rules: [],
        topics: [],
        summary: chunkText.slice(0, 100) + '...'
      };
    }
  }

  /**
   * Generate embeddings for a text chunk using Gemini
   */
  async generateEmbeddingVector(text: string): Promise<number[]> {
    try {
      const genai = getGeminiClient();
      const model = genai.getGenerativeModel({ model: "text-embedding-004" });
      
      // Properly format the embedding request
      const result = await model.embedContent({
        content: { parts: [{ text }] }
      });
      
      return result.embedding.values || [];
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return zero vector on failure
      return new Array(768).fill(0);
    }
  }

  /**
   * Complete ingestion pipeline for IRS Pub 4012
   */
  async ingestPub4012(vitaProgramId: string): Promise<{
    documentId: string;
    chunksCreated: number;
    rulesExtracted: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      console.log('Starting IRS Publication 4012 ingestion...');
      
      // Step 1: Download PDF
      const pdfPath = await this.downloadPub4012();
      
      // Step 2: Extract text
      const { text, numPages, info } = await this.extractTextFromPdf(pdfPath);
      
      // Step 3: Create document record
      const document: InsertDocument = {
        benefitProgramId: vitaProgramId,
        filename: 'p4012.pdf',
        originalName: 'IRS Publication 4012 - VITA/TCE Resource Guide',
        objectPath: pdfPath,
        sourceUrl: VITA_PDF_URL,
        documentTypeId: null, // Will be set if document types exist
        fileSize: null,
        mimeType: 'application/pdf',
        status: 'processing',
        isGoldenSource: true, // Official IRS publication
        downloadedAt: new Date(),
        metadata: {
          title: 'IRS Publication 4012 - VITA/TCE Resource Guide',
          description: `VITA/TCE training resource guide (${numPages} pages)`,
          numPages,
          pdfInfo: info,
          source: 'IRS',
          publicationNumber: '4012',
          publicationType: 'Training Guide'
        }
      };
      
      const createdDoc = await this.storage.createDocument(document);
      console.log('✓ Created document record:', createdDoc.id);
      
      // Step 4: Split into chunks
      const textChunks = this.splitIntoChunks(text, 2000, 200);
      console.log(`✓ Split into ${textChunks.length} chunks`);
      
      // Step 5: Process chunks (extract rules + generate embeddings)
      let totalRules = 0;
      const chunkPromises = textChunks.map(async (chunkText, index) => {
        try {
          // Extract tax rules from chunk
          const { rules, topics, summary } = await this.extractTaxRules(chunkText, index);
          totalRules += rules.length;
          
          // Generate embedding
          const embedding = await this.generateEmbeddingVector(chunkText);
          
          // Create chunk record
          const chunk: InsertDocumentChunk = {
            documentId: createdDoc.id,
            chunkIndex: index,
            content: chunkText,
            embeddings: JSON.stringify(embedding), // Store as JSON string
            metadata: {
              extractedRules: rules,
              topics,
              summary,
              characterCount: chunkText.length
            }
          };
          
          await this.storage.createDocumentChunk(chunk);
          
          if ((index + 1) % 10 === 0) {
            console.log(`  Processed ${index + 1}/${textChunks.length} chunks...`);
          }
        } catch (error) {
          const errMsg = `Error processing chunk ${index}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errMsg);
          errors.push(errMsg);
        }
      });
      
      await Promise.all(chunkPromises);
      
      // Step 6: Update document status
      await this.storage.updateDocument(createdDoc.id, {
        status: 'processed'
      });
      
      console.log('✓ IRS Publication 4012 ingestion complete!');
      console.log(`  - Document ID: ${createdDoc.id}`);
      console.log(`  - Chunks created: ${textChunks.length}`);
      console.log(`  - Rules extracted: ${totalRules}`);
      console.log(`  - Errors: ${errors.length}`);
      
      return {
        documentId: createdDoc.id,
        chunksCreated: textChunks.length,
        rulesExtracted: totalRules,
        errors
      };
    } catch (error) {
      const errMsg = `Fatal error in Pub 4012 ingestion: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errMsg);
      errors.push(errMsg);
      throw error;
    }
  }
}
