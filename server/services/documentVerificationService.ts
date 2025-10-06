import { GoogleGenAI } from '@google/genai';
import { storage } from '../storage';
import type { Document, DocumentRequirementRule } from '../../shared/schema';
import { ragService } from './ragService';

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
  
  /**
   * Analyze a document using Gemini Vision API
   */
  async analyzeDocument(
    imageData: Buffer | string,
    mimeType: string,
    analysisPrompt?: string
  ): Promise<DocumentAnalysis> {
    if (!genAI) {
      throw new Error('Gemini API not configured');
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
      // Convert buffer to base64 if needed
      const base64Data = Buffer.isBuffer(imageData) 
        ? imageData.toString('base64')
        : imageData;

      const defaultPrompt = `Analyze this document image and extract all relevant information. Identify:
1. Document type (pay stub, utility bill, medical document, ID, lease agreement, etc.)
2. All dates mentioned (issue date, valid through, etc.)
3. All monetary amounts
4. Names of people or entities
5. Addresses
6. Any identification numbers (SSN, case numbers, account numbers, etc.)
7. Issuer or authority (who issued this document)
8. Recipient or subject of the document

Also assess:
- Readability (high/medium/low)
- Completeness (is any critical information missing?)
- Authenticity markers (official letterhead, signatures, stamps, etc.)
- Any quality issues or concerns

Return your analysis as a structured JSON object.`;

      const parts = [
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        },
        { text: analysisPrompt || defaultPrompt }
      ];

      const result = await model.generateContent(parts);
      const response = result.response;
      const text = response.text();
      
      // Try to parse JSON response
      let analysis: Partial<DocumentAnalysis> = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        // Fallback to text parsing
        console.warn('Could not parse JSON from Gemini response, using text extraction');
      }

      return {
        documentType: analysis.documentType || 'unknown',
        confidence: analysis.confidence || 0.5,
        extractedData: analysis.extractedData || {},
        quality: analysis.quality || {
          readability: 'medium' as const,
          completeness: 'partial' as const,
          authenticity: 'uncertain' as const,
          issues: []
        },
        rawText: text
      };
    } catch (error) {
      console.error('Error analyzing document with Gemini Vision:', error);
      throw error;
    }
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

      // Analyze document with Gemini Vision
      // Note: In production, we'd fetch the actual image from object storage
      // For now, we'll use a placeholder analysis
      const analysis: DocumentAnalysis = {
        documentType: request.requirementType,
        confidence: 0.85,
        extractedData: {},
        quality: {
          readability: 'high',
          completeness: 'complete',
          authenticity: 'likely_authentic',
          issues: []
        }
      };

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
      if (req.policySource) {
        citations.push({
          section: req.ruleId || 'N/A',
          regulation: req.policySource,
          text: req.description || ''
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
            text: citation.excerpt || '',
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
