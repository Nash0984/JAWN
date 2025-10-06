import { GoogleGenAI } from '@google/genai';
import { storage } from '../storage';
import type { Document, DocumentRequirementRule } from '../../shared/schema';
import { ragService } from './ragService';
import { ObjectStorageService } from '../objectStorage';

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!geminiApiKey) {
  console.warn('⚠️ Gemini API key not found - document verification will be limited');
}

const genAI = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

export interface DocumentAnalysis {
  documentType: string;
  confidence: number;
  extractedData: {
    dates?: string[];
    amounts?: string[];
    names?: string[];
    addresses?: string[];
    identifiers?: string[];
    issuer?: string;
    recipientName?: string;
    documentDate?: string;
    expirationDate?: string;
    [key: string]: any;
  };
  quality: {
    readability: 'high' | 'medium' | 'low';
    completeness: 'complete' | 'partial' | 'incomplete';
    authenticity: 'likely_authentic' | 'uncertain' | 'concerns';
    issues: string[];
  };
  rawText?: string;
}

export interface VerificationResult {
  isValid: boolean;
  satisfiesRequirements: string[]; // IDs of requirements this document satisfies
  rejectionReasons: string[];
  warnings: string[];
  validUntil?: Date;
  extractedInfo: Record<string, any>;
  confidenceScore: number;
  analysis: DocumentAnalysis;
  policyCitations: Array<{
    section: string;
    regulation: string;
    text: string;
    sourceUrl?: string;
  }>;
}

export interface VerificationRequest {
  documentId: string;
  requirementType: string; // 'income', 'identity', 'residency', 'work_exemption', etc.
  clientCaseId?: string;
  contextInfo?: Record<string, any>; // Additional context for verification
}

export class DocumentVerificationService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }
  
  /**
   * Analyze a document using Gemini Vision API
   */
  async analyzeDocument(
    imageData: Buffer | string,
    mimeType: string,
    analysisPrompt?: string
  ): Promise<DocumentAnalysis> {
    if (!genAI) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.');
    }

    try {
      let base64Image: string;
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string') {
        if (imageData.startsWith('data:')) {
          base64Image = imageData.split(',')[1];
        } else {
          base64Image = imageData;
        }
      } else {
        throw new Error('Invalid imageData format. Expected Buffer or base64 string.');
      }

      const defaultPrompt = `You are analyzing a document for Maryland SNAP (Supplemental Nutrition Assistance Program) benefit verification.

Please analyze this document image and extract the following information in a structured JSON format:

1. Document Type: Identify what type of document this is (pay_stub, medical_document, utility_bill, bank_statement, id_card, lease_agreement, tax_return, social_security_statement, unemployment_statement, etc.)

2. Extracted Data:
   - dates: Array of all dates found (in any format)
   - amounts: Array of all monetary amounts found (include currency symbols)
   - names: Array of all person names found
   - addresses: Array of all addresses found
   - identifiers: Array of account numbers, ID numbers, case numbers, etc.
   - issuer: The organization or entity that issued the document
   - recipientName: The primary person this document is for/about
   - documentDate: The primary/issue date of the document
   - expirationDate: If applicable, when this document expires

3. Quality Assessment:
   - readability: Rate as "high", "medium", or "low" based on image clarity and text legibility
   - completeness: Rate as "complete", "partial", or "incomplete" based on whether all document sections are visible
   - authenticity: Rate as "likely_authentic", "uncertain", or "concerns" based on presence of official elements (letterhead, signatures, seals, formatting)
   - issues: List any quality problems (blurry, cut off, poor lighting, missing sections, etc.)

4. Raw Text: Extract ALL visible text from the document verbatim

Respond ONLY with a valid JSON object matching this structure:
{
  "documentType": "string",
  "confidence": 0.0-1.0,
  "extractedData": {
    "dates": ["string"],
    "amounts": ["string"],
    "names": ["string"],
    "addresses": ["string"],
    "identifiers": ["string"],
    "issuer": "string",
    "recipientName": "string",
    "documentDate": "string",
    "expirationDate": "string"
  },
  "quality": {
    "readability": "high|medium|low",
    "completeness": "complete|partial|incomplete",
    "authenticity": "likely_authentic|uncertain|concerns",
    "issues": ["string"]
  },
  "rawText": "string"
}`;

      const prompt = analysisPrompt || defaultPrompt;

      const result = await genAI.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType
                }
              },
              {
                text: prompt
              }
            ]
          }
        ]
      });

      const text = result.text || '';

      let analysis: DocumentAnalysis;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        analysis = {
          documentType: parsed.documentType || 'unknown',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
          extractedData: {
            dates: parsed.extractedData?.dates || [],
            amounts: parsed.extractedData?.amounts || [],
            names: parsed.extractedData?.names || [],
            addresses: parsed.extractedData?.addresses || [],
            identifiers: parsed.extractedData?.identifiers || [],
            issuer: parsed.extractedData?.issuer || '',
            recipientName: parsed.extractedData?.recipientName || '',
            documentDate: parsed.extractedData?.documentDate || '',
            expirationDate: parsed.extractedData?.expirationDate || ''
          },
          quality: {
            readability: parsed.quality?.readability || 'medium',
            completeness: parsed.quality?.completeness || 'partial',
            authenticity: parsed.quality?.authenticity || 'uncertain',
            issues: parsed.quality?.issues || []
          },
          rawText: parsed.rawText || text
        };
      } catch (parseError) {
        console.warn('Failed to parse Gemini response as JSON, using fallback extraction:', parseError);
        
        analysis = {
          documentType: this.extractDocumentTypeFromText(text),
          confidence: 0.6,
          extractedData: this.extractDataFromText(text),
          quality: {
            readability: 'medium',
            completeness: 'partial',
            authenticity: 'uncertain',
            issues: ['Could not parse structured response']
          },
          rawText: text
        };
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing document with Gemini Vision API:', error);
      throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractDocumentTypeFromText(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('pay stub') || lowerText.includes('paystub') || lowerText.includes('earnings statement')) {
      return 'pay_stub';
    }
    if (lowerText.includes('medical') || lowerText.includes('doctor') || lowerText.includes('physician')) {
      return 'medical_document';
    }
    if (lowerText.includes('utility') || lowerText.includes('electric') || lowerText.includes('gas bill') || lowerText.includes('water bill')) {
      return 'utility_bill';
    }
    if (lowerText.includes('bank statement') || lowerText.includes('account statement')) {
      return 'bank_statement';
    }
    if (lowerText.includes('driver') || lowerText.includes('license') || lowerText.includes('identification')) {
      return 'id_card';
    }
    if (lowerText.includes('lease') || lowerText.includes('rental agreement')) {
      return 'lease_agreement';
    }
    
    return 'unknown';
  }

  private extractDataFromText(text: string): DocumentAnalysis['extractedData'] {
    const dateRegex = /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
    const amountRegex = /\$\s*[\d,]+\.?\d{0,2}|\b\d+\.\d{2}\s*(?:USD|dollars?)\b/gi;
    const dates = text.match(dateRegex) || [];
    const amounts = text.match(amountRegex) || [];
    
    const uniqueDates = Array.from(new Set(dates)).slice(0, 10);
    const uniqueAmounts = Array.from(new Set(amounts)).slice(0, 10);
    
    return {
      dates: uniqueDates,
      amounts: uniqueAmounts,
      names: [],
      addresses: [],
      identifiers: []
    };
  }

  /**
   * Verify a pay stub for income verification
   */
  private async verifyPayStub(
    analysis: DocumentAnalysis,
    requirements: DocumentRequirementRule[]
  ): Promise<Partial<VerificationResult>> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const extractedInfo: Record<string, any> = {};

    // Check for required fields
    if (!analysis.extractedData.amounts || analysis.extractedData.amounts.length === 0) {
      issues.push('No income amounts found on pay stub');
    } else {
      extractedInfo.grossPay = analysis.extractedData.amounts[0];
    }

    if (!analysis.extractedData.dates || analysis.extractedData.dates.length === 0) {
      issues.push('No pay period dates found');
    } else {
      extractedInfo.payDate = analysis.extractedData.dates[0];
      
      // Check if pay stub is recent (within 60 days)
      const payDate = new Date(analysis.extractedData.dates[0]);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      if (payDate < sixtyDaysAgo) {
        warnings.push('Pay stub is older than 60 days - may need more recent verification');
      }
    }

    if (!analysis.extractedData.names || analysis.extractedData.names.length === 0) {
      issues.push('No employee name found on pay stub');
    } else {
      extractedInfo.employeeName = analysis.extractedData.names[0];
    }

    if (!analysis.extractedData.issuer) {
      warnings.push('Employer information not clearly identified');
    } else {
      extractedInfo.employer = analysis.extractedData.issuer;
    }

    // Quality checks
    if (analysis.quality.readability === 'low') {
      warnings.push('Document image quality is poor - may be difficult to verify');
    }

    if (analysis.quality.completeness === 'incomplete') {
      issues.push('Pay stub appears to be cut off or incomplete');
    }

    return {
      isValid: issues.length === 0,
      rejectionReasons: issues,
      warnings,
      extractedInfo,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Valid for 60 days
    };
  }

  /**
   * Verify a medical document for disability/work exemption
   */
  private async verifyMedicalDocument(
    analysis: DocumentAnalysis,
    requirements: DocumentRequirementRule[]
  ): Promise<Partial<VerificationResult>> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const extractedInfo: Record<string, any> = {};

    // Check for medical provider information
    if (!analysis.extractedData.issuer) {
      issues.push('No medical provider or healthcare facility identified');
    } else {
      extractedInfo.provider = analysis.extractedData.issuer;
      
      // Check for credentials (MD, DO, NP, etc.)
      const hasCredentials = /\b(M\.?D\.?|D\.?O\.?|N\.?P\.?|P\.?A\.?)\b/i.test(analysis.rawText || '');
      if (!hasCredentials) {
        warnings.push('Medical professional credentials not clearly visible');
      }
    }

    // Check for patient name
    if (!analysis.extractedData.recipientName && !analysis.extractedData.names?.length) {
      warnings.push('Patient name not clearly identified');
    } else {
      extractedInfo.patientName = analysis.extractedData.recipientName || analysis.extractedData.names?.[0];
    }

    // Check for dates
    if (!analysis.extractedData.documentDate && !analysis.extractedData.dates?.length) {
      issues.push('No date found on medical document');
    } else {
      const docDate = new Date(analysis.extractedData.documentDate || analysis.extractedData.dates![0]);
      extractedInfo.documentDate = docDate;
      
      // Medical documentation should typically be recent
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      if (docDate < ninetyDaysAgo) {
        warnings.push('Medical documentation is older than 90 days - may need updated verification for ongoing condition');
      }
    }

    // Check for disability/limitation statement
    const hasLimitationStatement = /\b(unable|disability|disabled|impairment|limitation|restricted|cannot)\b/i.test(analysis.rawText || '');
    if (!hasLimitationStatement) {
      issues.push('No clear statement of disability or work limitation found');
    }

    // Check for duration/timeframe
    const hasDuration = /\b(\d+\s*(month|week|day|year)|permanent|temporary|indefinite|until)\b/i.test(analysis.rawText || '');
    if (hasDuration) {
      extractedInfo.hasDurationStatement = true;
    } else {
      warnings.push('No clear timeframe or duration specified for the medical condition');
    }

    // Quality and authenticity checks
    if (analysis.quality.authenticity !== 'likely_authentic') {
      warnings.push('Document authenticity could not be fully verified - ensure it includes official letterhead and signature');
    }

    return {
      isValid: issues.length === 0,
      rejectionReasons: issues,
      warnings,
      extractedInfo,
      validUntil: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000) // Valid for 12 months typically
    };
  }

  /**
   * Verify a utility bill for residency verification
   */
  private async verifyUtilityBill(
    analysis: DocumentAnalysis,
    requirements: DocumentRequirementRule[]
  ): Promise<Partial<VerificationResult>> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const extractedInfo: Record<string, any> = {};

    // Check for utility company
    if (!analysis.extractedData.issuer) {
      issues.push('Utility company not clearly identified');
    } else {
      extractedInfo.utilityCompany = analysis.extractedData.issuer;
    }

    // Check for address
    if (!analysis.extractedData.addresses || analysis.extractedData.addresses.length === 0) {
      issues.push('No service address found on utility bill');
    } else {
      extractedInfo.serviceAddress = analysis.extractedData.addresses[0];
    }

    // Check for account holder name
    if (!analysis.extractedData.names || analysis.extractedData.names.length === 0) {
      issues.push('No account holder name found');
    } else {
      extractedInfo.accountHolder = analysis.extractedData.names[0];
    }

    // Check for billing date
    if (!analysis.extractedData.dates || analysis.extractedData.dates.length === 0) {
      issues.push('No billing date found');
    } else {
      const billDate = new Date(analysis.extractedData.dates[0]);
      extractedInfo.billDate = billDate;
      
      // Utility bill should be recent (within 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      if (billDate < sixtyDaysAgo) {
        issues.push('Utility bill is older than 60 days - need more recent verification of residency');
      }
    }

    // Check for account number or bill amount
    if (!analysis.extractedData.identifiers?.length && !analysis.extractedData.amounts?.length) {
      warnings.push('No account number or charges visible - verify this is a complete utility bill');
    }

    return {
      isValid: issues.length === 0,
      rejectionReasons: issues,
      warnings,
      extractedInfo,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Valid for 60 days
    };
  }

  /**
   * Main verification method - analyzes document and checks against requirements
   */
  async verifyDocument(request: VerificationRequest): Promise<VerificationResult> {
    try {
      // Get document from storage
      const document = await storage.getDocument(request.documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Get verification requirements for this type
      const allRequirements = await storage.getDocumentRequirementRules(
        request.clientCaseId || 'default'
      );
      
      const relevantRequirements = allRequirements.filter(
        req => req.documentType === request.requirementType && req.isActive
      );

      if (relevantRequirements.length === 0) {
        console.warn(`No active requirements found for type: ${request.requirementType}`);
      }

      // Analyze document with Gemini Vision API
      let analysis: DocumentAnalysis;
      
      try {
        // Fetch the actual document image from object storage
        if (!document.objectPath) {
          throw new Error('Document has no object storage path - cannot analyze');
        }

        if (!document.mimeType) {
          throw new Error('Document has no MIME type - cannot analyze');
        }

        // Normalize the object path - converts full GCS URLs to /objects/{uuid} format
        // This handles both formats: 
        // - Full URLs: https://storage.googleapis.com/replit-objstore-{id}/.private/uploads/{uuid}?X-Goog-Algorithm=...
        // - Already normalized: /objects/{uuid}
        let normalizedPath: string;
        try {
          normalizedPath = this.objectStorageService.normalizeObjectEntityPath(document.objectPath);
          
          if (!normalizedPath || normalizedPath.trim() === '') {
            throw new Error(`Path normalization resulted in empty path. Original path: ${document.objectPath}`);
          }
          
          console.log(`📄 Normalized object path from "${document.objectPath.substring(0, 100)}..." to "${normalizedPath}"`);
        } catch (pathError) {
          throw new Error(`Failed to normalize object storage path "${document.objectPath}": ${pathError instanceof Error ? pathError.message : 'Unknown error'}`);
        }

        // Get the file from object storage using the normalized path
        const objectFile = await this.objectStorageService.getObjectEntityFile(normalizedPath);
        
        // Download the file contents as a buffer
        const [fileBuffer] = await objectFile.download();
        
        // Call the analyzeDocument method with the actual image data
        analysis = await this.analyzeDocument(
          fileBuffer,
          document.mimeType
        );
        
        console.log(`✓ Successfully analyzed document ${document.id} using Gemini Vision API`);
      } catch (error) {
        console.error('Error fetching or analyzing document from object storage:', error);
        
        // Provide helpful error messages based on the type of error
        if (error instanceof Error) {
          if (error.message.includes('normalize') || error.message.includes('path')) {
            throw new Error(`Object storage path error for document ${document.id}: ${error.message}. The stored path may be malformed or invalid.`);
          }
          if (error.message.includes('Object not found')) {
            throw new Error(`Document file not found in object storage for document ${document.id}. The file may have been deleted or the path is incorrect.`);
          }
          if (error.message.includes('object storage')) {
            throw new Error(`Cannot verify document ${document.id}: ${error.message}. Please ensure the document is properly uploaded to object storage.`);
          }
        }
        
        // For other errors, re-throw with context
        throw new Error(`Document analysis failed for document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Route to specific verification logic based on document type
      let verificationResult: Partial<VerificationResult>;
      
      switch (request.requirementType) {
        case 'income':
          verificationResult = await this.verifyPayStub(analysis, relevantRequirements);
          break;
        case 'work_exemption':
        case 'disability':
          verificationResult = await this.verifyMedicalDocument(analysis, relevantRequirements);
          break;
        case 'residency':
          verificationResult = await this.verifyUtilityBill(analysis, relevantRequirements);
          break;
        default:
          verificationResult = {
            isValid: false,
            rejectionReasons: ['Document type verification not yet implemented'],
            warnings: [],
            extractedInfo: {}
          };
      }

      // Determine which requirements this document satisfies
      const satisfiesRequirements: string[] = [];
      if (verificationResult.isValid) {
        relevantRequirements.forEach(req => {
          // Check if document meets the requirement conditions
          const meetsConditions = true; // TODO: Implement condition checking
          if (meetsConditions) {
            satisfiesRequirements.push(req.id);
          }
        });
      }

      // Generate policy citations (always, regardless of validation status)
      const policyCitations = await this.generatePolicyCitations(
        request.requirementType,
        relevantRequirements
      );

      return {
        isValid: verificationResult.isValid || false,
        satisfiesRequirements,
        rejectionReasons: verificationResult.rejectionReasons || [],
        warnings: verificationResult.warnings || [],
        validUntil: verificationResult.validUntil,
        extractedInfo: verificationResult.extractedInfo || {},
        confidenceScore: analysis.confidence,
        analysis,
        policyCitations
      };
    } catch (error) {
      console.error('Error verifying document:', error);
      throw error;
    }
  }

  /**
   * Generate policy citations for document verification requirements
   */
  async generatePolicyCitations(
    requirementType: string,
    requirements: DocumentRequirementRule[]
  ): Promise<Array<{ section: string; regulation: string; text: string; sourceUrl?: string }>> {
    const citations: Array<{ section: string; regulation: string; text: string; sourceUrl?: string }> = [];
    
    // Map document types to Maryland SNAP manual sections
    const policyMapping: Record<string, Array<{ section: string; regulation: string; text: string }>> = {
      'income': [
        {
          section: '409',
          regulation: 'Maryland SNAP Manual',
          text: 'Income verification requirements for SNAP eligibility. Acceptable documents include pay stubs, employer statements, tax returns, and self-employment records showing gross monthly income.'
        },
        {
          section: '7 CFR 273.2(f)(1)(vii)',
          regulation: 'Federal Regulations',
          text: 'Verification of income must be obtained from documentary evidence or collateral contacts. Pay stubs or employer statements are acceptable if they show current gross monthly income.'
        }
      ],
      'residency': [
        {
          section: '409.2',
          regulation: 'Maryland SNAP Manual',
          text: 'Residency verification for SNAP applicants. Acceptable documents include utility bills, lease agreements, or mail showing current Maryland address within the last 60 days.'
        },
        {
          section: 'COMAR 10.02.04.06',
          regulation: 'Maryland Code of Regulations',
          text: 'Maryland residents must provide proof of residency. Utility bills dated within 60 days are acceptable verification.'
        }
      ],
      'work_exemption': [
        {
          section: '115',
          regulation: 'Maryland SNAP Manual',
          text: 'Work requirement exemptions for individuals who are unable to work due to physical or mental limitations. Medical documentation from a licensed professional is required.'
        },
        {
          section: '7 CFR 273.7(b)(1)',
          regulation: 'Federal Regulations',
          text: 'Individuals who are physically or mentally unfit for employment are exempt from ABAWD work requirements. Verification through medical documentation is required.'
        }
      ],
      'disability': [
        {
          section: '115.3',
          regulation: 'Maryland SNAP Manual',
          text: 'Disability verification for SNAP categorical eligibility and exemptions. Acceptable documents include SSI award letters, disability determination letters, or medical certification.'
        }
      ],
      'identity': [
        {
          section: '409.1',
          regulation: 'Maryland SNAP Manual',
          text: 'Identity verification for SNAP applicants. Acceptable documents include driver\'s license, state ID, passport, birth certificate, or other official documents with photo or identifying information.'
        }
      ],
      'expenses': [
        {
          section: '212-214',
          regulation: 'Maryland SNAP Manual',
          text: 'Expense verification for allowable deductions including shelter costs, dependent care, and medical expenses. Documentation must show amount and frequency of expenses.'
        }
      ],
      'childcare': [
        {
          section: '213',
          regulation: 'Maryland SNAP Manual',
          text: 'Dependent care expense verification. Acceptable documents include receipts, provider statements, or billing statements showing amounts paid for care of dependents.'
        }
      ],
      'medical': [
        {
          section: '214',
          regulation: 'Maryland SNAP Manual',
          text: 'Medical expense deduction verification for elderly or disabled household members. Acceptable documents include medical bills, receipts, or provider statements.'
        }
      ]
    };
    
    // Add standard citations for the document type
    const standardCitations = policyMapping[requirementType] || [];
    citations.push(...standardCitations);
    
    // Add citations from requirement rules
    for (const req of requirements) {
      if (req.notes) {
        citations.push({
          section: req.requirementName,
          regulation: 'Document Requirement',
          text: req.notes
        });
      }
    }
    
    // Query RAG service for additional context-specific citations
    try {
      const ragQuery = `What are the Maryland SNAP policy requirements for ${requirementType} verification documents?`;
      const ragResult = await ragService.search(ragQuery);
      
      // Extract citations from RAG result if available
      if (ragResult.citations && ragResult.citations.length > 0) {
        ragResult.citations.slice(0, 2).forEach(citation => {
          citations.push({
            section: citation.sectionNumber || '',
            regulation: citation.sectionTitle || 'Maryland SNAP Policy',
            text: '', // RAG citations don't have excerpt field
            sourceUrl: citation.sourceUrl
          });
        });
      }
    } catch (error) {
      console.warn('Could not fetch RAG citations:', error);
    }
    
    return citations;
  }

  /**
   * Get plain-language explanation of verification result
   */
  getVerificationExplanation(result: VerificationResult): string {
    if (result.isValid) {
      let explanation = '✅ This document is accepted as valid verification';
      
      if (result.satisfiesRequirements.length > 0) {
        explanation += ` and satisfies ${result.satisfiesRequirements.length} requirement(s)`;
      }
      
      if (result.validUntil) {
        const daysValid = Math.floor((result.validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        explanation += `. Valid for ${daysValid} more days`;
      }
      
      if (result.warnings.length > 0) {
        explanation += '\n\n⚠️ Notes:\n' + result.warnings.map(w => `• ${w}`).join('\n');
      }
      
      return explanation;
    } else {
      let explanation = '❌ This document cannot be accepted because:\n';
      explanation += result.rejectionReasons.map(r => `• ${r}`).join('\n');
      
      explanation += '\n\nTo fix this, please submit a document that includes all required information.';
      
      return explanation;
    }
  }
}

export const documentVerificationService = new DocumentVerificationService();
