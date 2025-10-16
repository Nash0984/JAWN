import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { db } from "../db";
import { documentChunks, sectionCrossReferences, manualSections, documents } from "../../shared/schema";
import { scrapeManualSections, ScrapedSection } from "./manualScraper";
import { processDocumentsBatch, ProcessedDocument } from "./manualDocumentExtractor";
import { eq } from "drizzle-orm";

// Lazy Gemini initialization
let gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
    }
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

export interface DocumentChunk {
  content: string;
  metadata: any;
  sectionContext: string;
  pageNumber?: number;
  startOffset: number;
  endOffset: number;
}

export interface CrossReference {
  toSectionNumber: string;
  referenceType: 'see_section' | 'defined_in' | 'related_to' | 'superseded_by';
  context: string;
}

/**
 * Splits document text into semantic chunks while preserving section context
 * @param text Full document text
 * @param sectionNumber Section number for context
 * @param sectionTitle Section title for context
 * @returns Array of document chunks
 */
export function chunkDocument(
  text: string,
  sectionNumber: string,
  sectionTitle: string
): DocumentChunk[] {
  const lines = text.split('\n').filter(line => line.trim());
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  let startOffset = 0;
  const maxChunkSize = 800; // tokens (roughly 600 words)
  const minChunkSize = 200; // minimum chunk size
  const overlapSize = 100; // overlap between chunks

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we should start a new chunk
    const shouldSplit = currentChunk.length + line.length > maxChunkSize && currentChunk.length > minChunkSize;
    
    if (shouldSplit) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          sectionNumber,
          sectionTitle,
          hasHeading: /^[A-Z\s]+$/.test(currentChunk.split('\n')[0] || ''),
          lineCount: currentChunk.split('\n').length,
        },
        sectionContext: `Section ${sectionNumber}: ${sectionTitle}`,
        startOffset,
        endOffset: startOffset + currentChunk.length,
      });
      
      // Start new chunk with overlap
      const chunkLines = currentChunk.split('\n');
      const overlapLines = chunkLines.slice(-2);
      const overlap = overlapLines.join('\n');
      startOffset += currentChunk.length - overlap.length;
      currentChunk = overlap + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        sectionNumber,
        sectionTitle,
        hasHeading: /^[A-Z\s]+$/.test(currentChunk.split('\n')[0] || ''),
        lineCount: currentChunk.split('\n').length,
      },
      sectionContext: `Section ${sectionNumber}: ${sectionTitle}`,
      startOffset,
      endOffset: startOffset + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * Extracts cross-references from document text
 * @param text Document text
 * @returns Array of cross-references found
 */
export function extractCrossReferences(text: string): CrossReference[] {
  const references: CrossReference[] = [];
  const seenRefs = new Set<string>(); // Deduplication
  
  // Pattern 1: "See Section XXX" or "see Section XXX"
  const seePattern = /see\s+Section\s+(\d{3})/gi;
  let match;
  while ((match = seePattern.exec(text)) !== null) {
    const sectionNum = match[1];
    const key = `see_section:${sectionNum}`;
    if (!seenRefs.has(key)) {
      seenRefs.add(key);
      // Get context (50 chars before and after)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();
      
      references.push({
        toSectionNumber: sectionNum,
        referenceType: 'see_section',
        context,
      });
    }
  }
  
  // Pattern 2: "as defined in Section XXX"
  const definedPattern = /(?:as )?defined in Section\s+(\d{3})/gi;
  while ((match = definedPattern.exec(text)) !== null) {
    const sectionNum = match[1];
    const key = `defined_in:${sectionNum}`;
    if (!seenRefs.has(key)) {
      seenRefs.add(key);
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();
      
      references.push({
        toSectionNumber: sectionNum,
        referenceType: 'defined_in',
        context,
      });
    }
  }
  
  // Pattern 3: "refer to Section XXX"
  const referPattern = /refer to Section\s+(\d{3})/gi;
  while ((match = referPattern.exec(text)) !== null) {
    const sectionNum = match[1];
    const key = `related_to:${sectionNum}`;
    if (!seenRefs.has(key)) {
      seenRefs.add(key);
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();
      
      references.push({
        toSectionNumber: sectionNum,
        referenceType: 'related_to',
        context,
      });
    }
  }
  
  // Pattern 4: Direct mentions like "Section XXX states" or "Section XXX provides"
  const mentionPattern = /Section\s+(\d{3})\s+(?:states|provides|requires|specifies|describes)/gi;
  while ((match = mentionPattern.exec(text)) !== null) {
    const sectionNum = match[1];
    const key = `related_to:${sectionNum}`;
    if (!seenRefs.has(key)) {
      seenRefs.add(key);
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();
      
      references.push({
        toSectionNumber: sectionNum,
        referenceType: 'related_to',
        context,
      });
    }
  }
  
  return references;
}

/**
 * Generates embeddings for text chunks using Gemini
 * @param chunks Array of text chunks
 * @returns Array of embeddings (as JSON strings)
 */
export async function generateEmbeddings(chunks: string[]): Promise<string[]> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required');
    }

    const embeddings: string[] = [];
    
    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      console.log(`Generating embeddings for chunks ${i + 1}-${Math.min(i + batchSize, chunks.length)}/${chunks.length}...`);
      
      // Generate embeddings for each chunk using direct REST API
      const batchEmbeddings = await Promise.all(
        batch.map(async (chunk) => {
          try {
            // Direct REST API call to avoid SDK routing issues
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  content: {
                    parts: [{ text: chunk }]
                  }
                })
              }
            );

            if (!response.ok) {
              const error = await response.text();
              console.error('Embedding API error:', error);
              return JSON.stringify([]);
            }

            const data = await response.json();
            return JSON.stringify(data.embedding?.values || []);
          } catch (error) {
            console.error('Error generating embedding for chunk:', error);
            return JSON.stringify([]);
          }
        })
      );
      
      embeddings.push(...batchEmbeddings);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Complete ingestion pipeline for the Maryland SNAP manual
 * @returns Ingestion results
 */
export async function ingestCompleteManual(): Promise<{
  sectionsProcessed: number;
  chunksCreated: number;
  crossReferencesExtracted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalChunks = 0;
  let totalCrossRefs = 0;
  
  try {
    console.log('=== Starting Complete Manual Ingestion Pipeline ===');
    
    // Step 1: Scrape the website for all sections
    console.log('\nStep 1: Scraping Maryland DHS website for manual sections...');
    const scrapedSections = await scrapeManualSections();
    console.log(`✓ Found ${scrapedSections.length} sections`);
    
    // Step 2: Download and extract text from all documents
    console.log('\nStep 2: Downloading and extracting text from documents...');
    const { successful: processedDocs, failed } = await processDocumentsBatch(scrapedSections);
    console.log(`✓ Successfully processed ${processedDocs.length} documents`);
    if (failed.length > 0) {
      console.log(`✗ Failed to process ${failed.length} documents`);
      failed.forEach(f => errors.push(`${f.section.sectionNumber}: ${f.error}`));
    }
    
    // Step 3: Store documents and create/update manual sections
    console.log('\nStep 3: Storing documents in database...');
    for (const doc of processedDocs) {
      try {
        const scrapedSection = scrapedSections.find(s => s.sectionNumber === doc.sectionNumber);
        if (!scrapedSection) continue;
        
        // Check if section already exists
        const [existingSection] = await db
          .select()
          .from(manualSections)
          .where(eq(manualSections.sectionNumber, doc.sectionNumber));
        
        let sectionId: string;
        
        if (existingSection) {
          // Update existing section
          await db
            .update(manualSections)
            .set({
              hasContent: true,
              lastModified: doc.metadata.lastModified,
              effectiveDate: doc.metadata.effectiveDate,
              fileSize: doc.fileSize,
              updatedAt: new Date(),
            })
            .where(eq(manualSections.id, existingSection.id));
          sectionId = existingSection.id;
        } else {
          // Create new section
          const [newSection] = await db
            .insert(manualSections)
            .values({
              sectionNumber: doc.sectionNumber,
              sectionTitle: scrapedSection.sectionTitle,
              category: scrapedSection.category,
              sortOrder: scrapedSection.sortOrder,
              sourceUrl: scrapedSection.sourceUrl,
              fileType: scrapedSection.fileType,
              fileSize: doc.fileSize,
              lastModified: doc.metadata.lastModified,
              effectiveDate: doc.metadata.effectiveDate,
              hasContent: true,
              isActive: true,
            })
            .returning();
          sectionId = newSection.id;
        }
        
        // Create or update document record for this section
        const [existingDoc] = await db
          .select()
          .from(documents)
          .where(eq(documents.sectionNumber, doc.sectionNumber));
        
        let documentId: string;
        
        if (existingDoc) {
          documentId = existingDoc.id;
          await db
            .update(documents)
            .set({
              lastModifiedAt: doc.metadata.lastModified,
              fileSize: doc.fileSize,
              status: 'processing',
              updatedAt: new Date(),
            })
            .where(eq(documents.id, documentId));
        } else {
          const [newDoc] = await db
            .insert(documents)
            .values({
              filename: `${doc.sectionNumber}-${scrapedSection.sectionTitle}.${scrapedSection.fileType}`,
              originalName: `${scrapedSection.sectionTitle}.${scrapedSection.fileType}`,
              fileSize: doc.fileSize,
              mimeType: scrapedSection.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              status: 'processing',
              isGoldenSource: true,
              sectionNumber: doc.sectionNumber,
              sourceUrl: scrapedSection.sourceUrl,
              lastModifiedAt: doc.metadata.lastModified,
              documentHash: doc.documentHash,
            })
            .returning();
          documentId = newDoc.id;
        }
        
        // Step 4: Chunk the document
        const chunks = chunkDocument(doc.rawText, doc.sectionNumber, scrapedSection.sectionTitle);
        console.log(`  Section ${doc.sectionNumber}: ${chunks.length} chunks`);
        
        // Step 5: Generate embeddings
        const chunkTexts = chunks.map(c => c.content);
        const embeddings = await generateEmbeddings(chunkTexts);
        
        // Step 6: Store chunks with embeddings
        for (let i = 0; i < chunks.length; i++) {
          await db.insert(documentChunks).values({
            documentId: documentId, // Using document ID from documents table
            chunkIndex: i,
            content: chunks[i].content,
            embeddings: embeddings[i],
            metadata: chunks[i].metadata,
            pageNumber: chunks[i].pageNumber,
            startOffset: chunks[i].startOffset,
            endOffset: chunks[i].endOffset,
          });
        }
        
        totalChunks += chunks.length;
        
        // Step 7: Extract and store cross-references
        const crossRefs = extractCrossReferences(doc.rawText);
        console.log(`  Section ${doc.sectionNumber}: ${crossRefs.length} cross-references`);
        
        for (const ref of crossRefs) {
          await db.insert(sectionCrossReferences).values({
            fromSectionId: sectionId,
            toSectionNumber: ref.toSectionNumber,
            referenceType: ref.referenceType,
            context: ref.context,
          });
        }
        
        totalCrossRefs += crossRefs.length;
        
      } catch (error) {
        console.error(`Error storing section ${doc.sectionNumber}:`, error);
        errors.push(`${doc.sectionNumber}: Database storage error`);
      }
    }
    
    console.log('\n=== Ingestion Complete ===');
    console.log(`Sections processed: ${processedDocs.length}`);
    console.log(`Total chunks created: ${totalChunks}`);
    console.log(`Cross-references extracted: ${totalCrossRefs}`);
    console.log(`Errors: ${errors.length}`);
    
    return {
      sectionsProcessed: processedDocs.length,
      chunksCreated: totalChunks,
      crossReferencesExtracted: totalCrossRefs,
      errors,
    };
    
  } catch (error) {
    console.error('Fatal error during ingestion:', error);
    throw error;
  }
}
