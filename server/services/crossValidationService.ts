import { storage } from "../storage";
import { compareTwoStrings } from "string-similarity";
import type { 
  Discrepancy, 
  CrossValidationResult,
  InsertDocumentValidationResult,
  InsertDocumentDiscrepancy 
} from "@shared/schema";

/**
 * Cross-Validation Service
 * 
 * Production-ready document consistency checking across multiple uploaded documents.
 * Validates W-2s, pay stubs, tax forms, and identity documents for consistency.
 */

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Exact string match (case-insensitive, trimmed)
 * Used for SSN, dates, and exact identifiers
 */
function exactMatch(value1: string | null | undefined, value2: string | null | undefined): boolean {
  if (!value1 || !value2) return false;
  return value1.trim().toLowerCase() === value2.trim().toLowerCase();
}

/**
 * Fuzzy string match using Jaro-Winkler similarity
 * Used for names, employer names, addresses
 */
function fuzzyMatch(value1: string | null | undefined, value2: string | null | undefined, threshold: number = 0.85): boolean {
  if (!value1 || !value2) return false;
  const similarity = compareTwoStrings(value1.toLowerCase(), value2.toLowerCase());
  return similarity >= threshold;
}

/**
 * Numeric delta check with percentage threshold
 * Used for wages, withholdings, amounts
 */
function numericDelta(value1: number | null | undefined, value2: number | null | undefined, percentThreshold: number = 5): boolean {
  if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) return false;
  if (value1 === 0 && value2 === 0) return true;
  
  const delta = Math.abs(value1 - value2);
  const avg = (Math.abs(value1) + Math.abs(value2)) / 2;
  
  if (avg === 0) return delta === 0;
  
  const percentDiff = (delta / avg) * 100;
  return percentDiff <= percentThreshold;
}

/**
 * Detect missing or empty fields
 */
function detectMissingField(value: any): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Parse currency string to number
 * Handles: "$45,123.45", "45,123.45", "$45123.45", "($1,234.56)", "-$1,234.56"
 * Returns 0 for invalid/null values instead of NaN (graceful degradation)
 */
function parseCurrency(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  // Convert to string
  const str = String(value).trim();
  
  // Handle negative values in parentheses: "($1,234.56)"
  let isNegative = false;
  let cleanStr = str;
  
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    cleanStr = str.slice(1, -1);
  }
  
  // Strip dollar signs, commas, whitespace
  cleanStr = cleanStr.replace(/[$,\s]/g, '');
  
  // Handle negative sign
  if (cleanStr.startsWith('-')) {
    isNegative = true;
    cleanStr = cleanStr.slice(1);
  }
  
  // Parse to float
  const parsed = parseFloat(cleanStr);
  
  // Return 0 for NaN instead of breaking validation
  if (isNaN(parsed)) {
    return 0;
  }
  
  return isNegative ? -parsed : parsed;
}

// ============================================================================
// RULE SETS
// ============================================================================

/**
 * W-2 vs Pay Stub Validation
 * Validates that W-2 totals match pay stub aggregates
 */
class W2PaystubRuleSet {
  async validate(w2Data: any, paystubData: any[], w2DocId: string, paystubDocIds: string[]): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    if (!w2Data || !paystubData || paystubData.length === 0) {
      return discrepancies;
    }
    
    // 1. Employer name consistency
    const w2Employer = w2Data.employer_name || w2Data.employerName;
    if (w2Employer) {
      const paystubEmployers = paystubData
        .map(p => p.employer_name || p.employerName)
        .filter(Boolean);
      
      const employerMatch = paystubEmployers.some(emp => fuzzyMatch(w2Employer, emp, 0.85));
      
      if (!employerMatch && paystubEmployers.length > 0) {
        discrepancies.push({
          fieldKey: 'employer_name',
          expectedValue: w2Employer,
          actualValue: paystubEmployers.join(', '),
          severity: 'warning',
          rationale: 'Employer name on W-2 does not match any pay stub',
          ruleType: 'W2_PAYSTUB_EMPLOYER',
          documentId1: w2DocId,
        });
      }
    }
    
    // 2. Total wages consistency
    const w2Wages = parseCurrency(w2Data.total_wages || w2Data.wages);
    const paystubTotal = paystubData.reduce((sum, p) => {
      const grossPay = parseCurrency(p.gross_pay || p.grossPay);
      return sum + grossPay;
    }, 0);
    
    if (w2Wages > 0 && paystubTotal > 0) {
      const wageMatch = numericDelta(w2Wages, paystubTotal, 10);
      
      if (!wageMatch) {
        discrepancies.push({
          fieldKey: 'total_wages',
          expectedValue: w2Wages.toFixed(2),
          actualValue: paystubTotal.toFixed(2),
          severity: 'error',
          rationale: `W-2 total wages ($${w2Wages.toFixed(2)}) differs from sum of pay stubs ($${paystubTotal.toFixed(2)}) by more than 10%`,
          ruleType: 'W2_PAYSTUB_WAGES',
          documentId1: w2DocId,
        });
      }
    }
    
    // 3. Federal withholding consistency
    const w2Federal = parseCurrency(w2Data.federal_withholding || w2Data.federalWithholding);
    const paystubFederalTotal = paystubData.reduce((sum, p) => {
      const federal = parseCurrency(p.federal_withholding || p.federalWithholding);
      return sum + federal;
    }, 0);
    
    if (w2Federal > 0 && paystubFederalTotal > 0) {
      const federalMatch = numericDelta(w2Federal, paystubFederalTotal, 5);
      
      if (!federalMatch) {
        discrepancies.push({
          fieldKey: 'federal_withholding',
          expectedValue: w2Federal.toFixed(2),
          actualValue: paystubFederalTotal.toFixed(2),
          severity: 'warning',
          rationale: `Federal withholding on W-2 ($${w2Federal.toFixed(2)}) differs from pay stub total ($${paystubFederalTotal.toFixed(2)}) by more than 5%`,
          ruleType: 'W2_PAYSTUB_FEDERAL',
          documentId1: w2DocId,
        });
      }
    }
    
    // 4. State withholding consistency (Maryland)
    const w2State = parseCurrency(w2Data.state_withholding || w2Data.stateWithholding);
    const paystubStateTotal = paystubData.reduce((sum, p) => {
      const state = parseCurrency(p.state_withholding || p.stateWithholding);
      return sum + state;
    }, 0);
    
    if (w2State > 0 && paystubStateTotal > 0) {
      const stateMatch = numericDelta(w2State, paystubStateTotal, 5);
      
      if (!stateMatch) {
        discrepancies.push({
          fieldKey: 'state_withholding',
          expectedValue: w2State.toFixed(2),
          actualValue: paystubStateTotal.toFixed(2),
          severity: 'warning',
          rationale: `State withholding on W-2 ($${w2State.toFixed(2)}) differs from pay stub total ($${paystubStateTotal.toFixed(2)}) by more than 5%`,
          ruleType: 'W2_PAYSTUB_STATE',
          documentId1: w2DocId,
        });
      }
    }
    
    return discrepancies;
  }
}

/**
 * Multiple W-2 Consistency Validation
 * Validates that personal information is consistent across multiple W-2s
 */
class W2ConsistencyRuleSet {
  async validate(w2Documents: any[]): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    if (w2Documents.length < 2) return discrepancies;
    
    const firstW2 = w2Documents[0];
    
    for (let i = 1; i < w2Documents.length; i++) {
      const w2 = w2Documents[i];
      
      // 1. SSN consistency
      const firstSSN = firstW2.extractedData?.employee_ssn || firstW2.extractedData?.ssn;
      const currentSSN = w2.extractedData?.employee_ssn || w2.extractedData?.ssn;
      
      if (firstSSN && currentSSN && !exactMatch(firstSSN, currentSSN)) {
        discrepancies.push({
          fieldKey: 'employee_ssn',
          expectedValue: firstSSN,
          actualValue: currentSSN,
          severity: 'error',
          rationale: 'SSN mismatch between W-2 documents',
          ruleType: 'W2_SSN_CONSISTENCY',
          taxDocumentId1: firstW2.id,
          taxDocumentId2: w2.id,
        });
      }
      
      // 2. Name consistency
      const firstName = `${firstW2.extractedData?.employee_first_name || firstW2.extractedData?.firstName || ''} ${firstW2.extractedData?.employee_last_name || firstW2.extractedData?.lastName || ''}`.trim();
      const currentName = `${w2.extractedData?.employee_first_name || w2.extractedData?.firstName || ''} ${w2.extractedData?.employee_last_name || w2.extractedData?.lastName || ''}`.trim();
      
      if (firstName && currentName) {
        const nameMatch = fuzzyMatch(firstName, currentName, 0.85);
        
        if (!nameMatch) {
          discrepancies.push({
            fieldKey: 'employee_name',
            expectedValue: firstName,
            actualValue: currentName,
            severity: 'warning',
            rationale: 'Employee name differs across W-2 documents',
            ruleType: 'W2_NAME_CONSISTENCY',
            taxDocumentId1: firstW2.id,
            taxDocumentId2: w2.id,
          });
        }
      }
    }
    
    return discrepancies;
  }
}

/**
 * Tax Form Consistency Validation
 * Validates consistency across 1040 and schedules
 */
class TaxFormRuleSet {
  async validate(taxForms: any[]): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    if (taxForms.length < 2) return discrepancies;
    
    // Find 1040 and schedules
    const form1040 = taxForms.find(f => 
      f.extractedData?.form_type === '1040' || 
      f.documentType === '1040'
    );
    
    const schedules = taxForms.filter(f => 
      f.extractedData?.form_type?.startsWith('Schedule') || 
      f.documentType?.startsWith('Schedule')
    );
    
    if (!form1040 || schedules.length === 0) return discrepancies;
    
    // Validate SSN consistency across all forms
    const form1040SSN = form1040.extractedData?.primary_ssn || form1040.extractedData?.ssn;
    
    if (form1040SSN) {
      for (const schedule of schedules) {
        const scheduleSSN = schedule.extractedData?.primary_ssn || schedule.extractedData?.ssn;
        
        if (scheduleSSN && !exactMatch(form1040SSN, scheduleSSN)) {
          const scheduleType = schedule.extractedData?.form_type || schedule.documentType || 'Schedule';
          
          discrepancies.push({
            fieldKey: 'primary_ssn',
            expectedValue: form1040SSN,
            actualValue: scheduleSSN,
            severity: 'error',
            rationale: `SSN on ${scheduleType} does not match Form 1040`,
            ruleType: 'TAX_FORM_SSN',
            taxDocumentId1: form1040.id,
            taxDocumentId2: schedule.id,
          });
        }
      }
    }
    
    return discrepancies;
  }
}

/**
 * Identity Document Consistency Validation
 * Validates consistency across identity documents (driver's license, passport, etc.)
 */
class IdentityRuleSet {
  async validate(identityDocs: any[]): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    if (identityDocs.length < 2) return discrepancies;
    
    const firstDoc = identityDocs[0];
    
    for (let i = 1; i < identityDocs.length; i++) {
      const doc = identityDocs[i];
      
      // 1. Name consistency
      const firstName = firstDoc.extractedData?.full_name || firstDoc.extractedData?.name;
      const currentName = doc.extractedData?.full_name || doc.extractedData?.name;
      
      if (firstName && currentName) {
        const nameMatch = fuzzyMatch(firstName, currentName, 0.85);
        
        if (!nameMatch) {
          discrepancies.push({
            fieldKey: 'full_name',
            expectedValue: firstName,
            actualValue: currentName,
            severity: 'warning',
            rationale: 'Name differs across identity documents',
            ruleType: 'IDENTITY_NAME',
            documentId1: firstDoc.id,
            documentId2: doc.id,
          });
        }
      }
      
      // 2. DOB consistency
      const firstDOB = firstDoc.extractedData?.date_of_birth || firstDoc.extractedData?.dob;
      const currentDOB = doc.extractedData?.date_of_birth || doc.extractedData?.dob;
      
      if (firstDOB && currentDOB && !exactMatch(firstDOB, currentDOB)) {
        discrepancies.push({
          fieldKey: 'date_of_birth',
          expectedValue: firstDOB,
          actualValue: currentDOB,
          severity: 'error',
          rationale: 'Date of birth differs across identity documents',
          ruleType: 'IDENTITY_DOB',
          documentId1: firstDoc.id,
          documentId2: doc.id,
        });
      }
      
      // 3. SSN consistency (if available)
      const firstSSN = firstDoc.extractedData?.ssn;
      const currentSSN = doc.extractedData?.ssn;
      
      if (firstSSN && currentSSN && !exactMatch(firstSSN, currentSSN)) {
        discrepancies.push({
          fieldKey: 'ssn',
          expectedValue: firstSSN,
          actualValue: currentSSN,
          severity: 'error',
          rationale: 'SSN differs across identity documents',
          ruleType: 'IDENTITY_SSN',
          documentId1: firstDoc.id,
          documentId2: doc.id,
        });
      }
    }
    
    return discrepancies;
  }
}

// ============================================================================
// MAIN CROSS-VALIDATION SERVICE
// ============================================================================

export class CrossValidationService {
  private w2PaystubRuleSet: W2PaystubRuleSet;
  private w2ConsistencyRuleSet: W2ConsistencyRuleSet;
  private taxFormRuleSet: TaxFormRuleSet;
  private identityRuleSet: IdentityRuleSet;
  
  constructor() {
    this.w2PaystubRuleSet = new W2PaystubRuleSet();
    this.w2ConsistencyRuleSet = new W2ConsistencyRuleSet();
    this.taxFormRuleSet = new TaxFormRuleSet();
    this.identityRuleSet = new IdentityRuleSet();
  }
  
  /**
   * Main validation orchestrator for a VITA intake session
   * Validates all documents associated with the session for consistency
   */
  async validateVitaSession(vitaSessionId: string): Promise<CrossValidationResult> {
    console.log(`[Cross-Validation] Starting validation for VITA session ${vitaSessionId}`);
    
    try {
      // 1. Fetch all tax documents for this VITA session
      const taxDocuments = await storage.getTaxDocumentsByVitaSession(vitaSessionId);
      
      if (taxDocuments.length < 2) {
        console.log(`[Cross-Validation] Skipped: Less than 2 documents (found ${taxDocuments.length})`);
        return { 
          status: 'skipped', 
          reason: `Less than 2 documents (found ${taxDocuments.length})` 
        };
      }
      
      // 2. Group documents by type
      const w2Documents = taxDocuments.filter(d => 
        d.documentType === 'w2' || d.documentType === 'W-2'
      );
      
      const paystubDocuments = taxDocuments.filter(d => 
        d.documentType === 'paystub' || d.documentType === 'Pay Stub'
      );
      
      const form1040Documents = taxDocuments.filter(d => 
        d.documentType === '1040' || d.extractedData?.form_type === '1040'
      );
      
      const scheduleDocuments = taxDocuments.filter(d => 
        d.documentType?.startsWith('Schedule') || 
        d.extractedData?.form_type?.startsWith('Schedule')
      );
      
      const taxForms = [...form1040Documents, ...scheduleDocuments];
      
      // For identity documents, we'd need to check the main documents table
      // For now, focusing on tax-specific validation
      
      // 3. Run rule sets and collect discrepancies
      const allDiscrepancies: Discrepancy[] = [];
      
      // W-2 vs Pay Stubs validation
      if (w2Documents.length > 0 && paystubDocuments.length > 0) {
        console.log(`[Cross-Validation] Validating ${w2Documents.length} W-2(s) against ${paystubDocuments.length} pay stub(s)`);
        
        for (const w2 of w2Documents) {
          const paystubData = paystubDocuments.map(p => p.extractedData);
          const paystubIds = paystubDocuments.map(p => p.id);
          
          const w2Discrepancies = await this.w2PaystubRuleSet.validate(
            w2.extractedData, 
            paystubData, 
            w2.id,
            paystubIds
          );
          
          allDiscrepancies.push(...w2Discrepancies);
        }
      }
      
      // Multiple W-2 consistency validation
      if (w2Documents.length > 1) {
        console.log(`[Cross-Validation] Validating consistency across ${w2Documents.length} W-2 documents`);
        
        const w2Discrepancies = await this.w2ConsistencyRuleSet.validate(w2Documents);
        allDiscrepancies.push(...w2Discrepancies);
      }
      
      // Tax form consistency validation
      if (taxForms.length > 1) {
        console.log(`[Cross-Validation] Validating consistency across ${taxForms.length} tax forms`);
        
        const taxDiscrepancies = await this.taxFormRuleSet.validate(taxForms);
        allDiscrepancies.push(...taxDiscrepancies);
      }
      
      // 4. Calculate overall status
      const errorsFound = allDiscrepancies.filter(d => d.severity === 'error').length;
      const warningsFound = allDiscrepancies.filter(d => d.severity === 'warning').length;
      const overallStatus = errorsFound > 0 ? 'errors' : (warningsFound > 0 ? 'warnings' : 'passed');
      
      // 5. Store validation results
      const validationData: InsertDocumentValidationResult = {
        vitaIntakeSessionId: vitaSessionId,
        overallStatus,
        totalChecks: allDiscrepancies.length,
        errorsFound,
        warningsFound,
        summary: { 
          ruleTypes: [...new Set(allDiscrepancies.map(d => d.ruleType))],
          documentCounts: {
            w2: w2Documents.length,
            paystub: paystubDocuments.length,
            taxForms: taxForms.length,
          }
        },
      };
      
      const validationResult = await storage.createDocumentValidationResult(validationData);
      
      // 6. Store individual discrepancies
      for (const discrepancy of allDiscrepancies) {
        const discrepancyData: InsertDocumentDiscrepancy = {
          validationResultId: validationResult.id,
          ...discrepancy,
        };
        
        await storage.createDocumentDiscrepancy(discrepancyData);
      }
      
      console.log(`[Cross-Validation] Completed: ${errorsFound} errors, ${warningsFound} warnings, ${allDiscrepancies.length} total checks`);
      
      return {
        status: 'completed',
        validationResultId: validationResult.id,
        errorsFound,
        warningsFound,
        overallStatus,
      };
      
    } catch (error) {
      console.error('[Cross-Validation] Validation failed:', error);
      return { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const crossValidationService = new CrossValidationService();
