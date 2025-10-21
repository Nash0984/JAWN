import axios from 'axios';
import mammoth from 'mammoth';
import crypto from 'crypto';
import { ScrapedSection } from './manualScraper';
import { logger } from './logger.service';

export interface ProcessedDocument {
  sectionNumber: string;
  rawText: string;
  documentHash: string;
  fileSize: number;
  pageCount?: number;
  metadata: {
    effectiveDate?: Date;
    lastModified: Date;
    fileType: string;
    processingDate: Date;
  };
}

/**
 * Downloads a document from a URL
 * @param url URL to download from
 * @param timeout Timeout in milliseconds
 * @returns Buffer containing the downloaded file
 */
export async function downloadDocument(url: string, timeout: number = 60000): Promise<Buffer> {
  try {
    logger.info('Downloading document', {
      service: 'ManualDocumentExtractor',
      method: 'downloadDocument',
      url
    });
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: {
        'User-Agent': 'Maryland-SNAP-Policy-System/1.0 (Educational/Government Tool)',
      },
      maxContentLength: 50 * 1024 * 1024, // 50 MB max
    });

    return Buffer.from(response.data);
  } catch (error) {
    logger.error('Error downloading document', {
      service: 'ManualDocumentExtractor',
      method: 'downloadDocument',
      url,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from a PDF buffer
 * @param buffer PDF file buffer
 * @returns Extracted text and metadata
 */
export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    // Dynamic import for ESM module
    const { pdf } = await import('pdf-parse');
    const data = await pdf(new Uint8Array(buffer));
    return {
      text: data.text,
      pageCount: (data as any).numpages,
    };
  } catch (error) {
    logger.error('Error extracting PDF text', {
      service: 'ManualDocumentExtractor',
      method: 'extractPdfText',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from a DOCX buffer
 * @param buffer DOCX file buffer
 * @returns Extracted text
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    logger.error('Error extracting DOCX text', {
      service: 'ManualDocumentExtractor',
      method: 'extractDocxText',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to extract DOCX text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates SHA-256 hash of a buffer
 * @param buffer File buffer
 * @returns Hex-encoded hash
 */
export function generateDocumentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Extracts effective date from document text
 * Looks for patterns like "Effective: July 2023" or "Revised: JULY 2023"
 * @param text Document text
 * @returns Effective date if found
 */
export function extractEffectiveDate(text: string): Date | undefined {
  // Look for common patterns
  const patterns = [
    /Effective[:\s]+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i,
    /Revised[:\s]+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i,
    /Effective[:\s]+([A-Z][a-z]+)\s+(\d{4})/i,
    /Revised[:\s]+([A-Z][a-z]+)\s+(\d{4})/i,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        if (match[3] && match[1].match(/[A-Z]/i)) {
          // Month name format
          const day = match[2] ? match[2] : '1';
          return new Date(`${match[1]} ${day}, ${match[3]}`);
        } else if (match[3] && match[1].match(/\d/)) {
          // MM/DD/YYYY format
          return new Date(`${match[1]}/${match[2]}/${match[3]}`);
        } else if (match[2]) {
          // Month YYYY format
          return new Date(`${match[1]} 1, ${match[2]}`);
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return undefined;
}

/**
 * Processes a document (downloads and extracts text)
 * @param section Scraped section metadata
 * @returns Processed document with extracted text
 */
export async function processDocument(section: ScrapedSection): Promise<ProcessedDocument> {
  try {
    logger.info('Processing document section', {
      service: 'ManualDocumentExtractor',
      method: 'processDocument',
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle
    });
    
    // Download the document
    const buffer = await downloadDocument(section.sourceUrl);
    
    // Generate hash
    const documentHash = generateDocumentHash(buffer);
    
    // Extract text based on file type
    let rawText = '';
    let pageCount: number | undefined;
    
    if (section.fileType.toLowerCase() === 'pdf') {
      const pdfData = await extractPdfText(buffer);
      rawText = pdfData.text;
      pageCount = pdfData.pageCount;
    } else if (section.fileType.toLowerCase().includes('doc')) {
      rawText = await extractDocxText(buffer);
    } else {
      throw new Error(`Unsupported file type: ${section.fileType}`);
    }
    
    // Extract effective date from text
    const effectiveDate = extractEffectiveDate(rawText);
    
    return {
      sectionNumber: section.sectionNumber,
      rawText,
      documentHash,
      fileSize: buffer.length,
      pageCount,
      metadata: {
        effectiveDate,
        lastModified: section.lastModified,
        fileType: section.fileType,
        processingDate: new Date(),
      },
    };
  } catch (error) {
    logger.error('Error processing section', {
      service: 'ManualDocumentExtractor',
      method: 'processDocument',
      sectionNumber: section.sectionNumber,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Processes multiple documents with retry logic
 * @param sections Array of scraped sections
 * @param maxRetries Maximum number of retries per document
 * @param delayMs Delay between retries in milliseconds
 * @returns Array of processed documents and errors
 */
export async function processDocumentsBatch(
  sections: ScrapedSection[],
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<{
  successful: ProcessedDocument[];
  failed: Array<{ section: ScrapedSection; error: string }>;
}> {
  const successful: ProcessedDocument[] = [];
  const failed: Array<{ section: ScrapedSection; error: string }> = [];
  
  for (const section of sections) {
    let lastError: Error | null = null;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const processed = await processDocument(section);
        successful.push(processed);
        logger.info('Successfully processed section', {
          service: 'ManualDocumentExtractor',
          method: 'processDocumentsBatch',
          sectionNumber: section.sectionNumber
        });
        break;
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries < maxRetries) {
          logger.warn('Failed to process section, retrying', {
            service: 'ManualDocumentExtractor',
            method: 'processDocumentsBatch',
            sectionNumber: section.sectionNumber,
            retries,
            maxRetries
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    if (lastError && retries === maxRetries) {
      logger.error('Failed to process section after max retries', {
        service: 'ManualDocumentExtractor',
        method: 'processDocumentsBatch',
        sectionNumber: section.sectionNumber,
        maxRetries
      });
      failed.push({
        section,
        error: lastError.message,
      });
    }
    
    // Small delay between documents to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { successful, failed };
}
