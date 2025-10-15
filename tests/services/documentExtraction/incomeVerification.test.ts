/**
 * Income Verification Document Extraction Tests
 * 
 * Comprehensive test suite for extracting income verification documents
 * Tests W-2, 1099-MISC, 1099-NEC, and pay stubs for SNAP/Medicaid/TANF programs
 * 
 * Total Tests: 27
 * - W-2 Form Extraction: 6 tests
 * - 1099-MISC Form Extraction: 4 tests
 * - 1099-NEC Form Extraction: 3 tests
 * - Pay Stub Extraction: 6 tests
 * - Cross-Program Verification: 5 tests
 * - Error Handling: 3 tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentExtractionService } from '../../../server/services/documentExtraction';
import { w2Samples, form1099Samples, payStubSamples } from '../../fixtures';

describe('Document Extraction - Income Verification', () => {
  let extractionService: DocumentExtractionService;

  beforeEach(() => {
    vi.clearAllMocks();
    extractionService = new DocumentExtractionService();
  });

  // ============================================================================
  // W-2 Form Extraction Tests (6 tests)
  // ============================================================================

  describe('W-2 Form Extraction', () => {
    it('should extract taxpayer name and SSN from W-2', async () => {
      const w2Document = w2Samples.standard2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.employeeName).toBe('John A. Smith');
      expect(result.data.employeeSSN).toBe('123-45-6789');
      expect(result.data.taxYear).toBe(2024);
    });

    it('should extract employer name and EIN from W-2', async () => {
      const w2Document = w2Samples.highEarner2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.employerName).toBe('Johns Hopkins University');
      expect(result.data.employerEIN).toBe('52-0595110');
    });

    it('should extract wages and federal withholding from W-2', async () => {
      const w2Document = w2Samples.standard2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.box1_wages).toBe(45000); // Box 1
      expect(result.data.box2_federalTaxWithheld).toBe(5400); // Box 2
    });

    it('should extract Social Security wages and withholding', async () => {
      const w2Document = w2Samples.highEarner2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.box3_socialSecurityWages).toBe(160200); // Box 3 - 2024 SS wage base
      expect(result.data.box4_socialSecurityTaxWithheld).toBe(9932.40); // Box 4
    });

    it('should extract Medicare wages and withholding', async () => {
      const w2Document = w2Samples.standard2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.box5_medicareWages).toBe(45000); // Box 5
      expect(result.data.box6_medicareTaxWithheld).toBe(652.50); // Box 6
    });

    it('should extract Maryland state wages and withholding', async () => {
      const w2Document = w2Samples.stateFederalWorker2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.box16_stateWages).toBe(62000);
      expect(result.data.box17_stateIncomeTax).toBe(3410);
      expect(result.data.box20_localityName).toBe('Baltimore City');
    });
  });

  // ============================================================================
  // 1099-MISC Form Extraction Tests (4 tests)
  // ============================================================================

  describe('1099-MISC Form Extraction', () => {
    it('should extract payer name and TIN from 1099-MISC', async () => {
      const form1099 = form1099Samples.misc_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099);
      
      expect(result.documentType).toBe('1099-MISC');
      expect(result.data.payerName).toBe('Baltimore Consulting Group LLC');
      expect(result.data.payerTIN).toBe('52-9876543');
    });

    it('should extract recipient name and SSN from 1099-MISC', async () => {
      const form1099 = form1099Samples.misc_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099);
      
      expect(result.documentType).toBe('1099-MISC');
      expect(result.data.recipientName).toBe('Jane M. Smith');
      expect(result.data.recipientTIN).toBe('987-65-4321');
    });

    it('should extract miscellaneous income amount', async () => {
      const form1099 = form1099Samples.misc_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099);
      
      expect(result.documentType).toBe('1099-MISC');
      expect(result.data.box3_otherIncome).toBe(12500); // Box 3
    });

    it('should extract other income types (rent, royalties, medical)', async () => {
      const rentalForm = form1099Samples.misc_rental_2024;
      const royaltiesForm = form1099Samples.misc_royalties_2024;
      const medicalForm = form1099Samples.misc_medical_2024;
      
      const rentalResult = await extractionService.extractIncomeDocument(rentalForm);
      const royaltiesResult = await extractionService.extractIncomeDocument(royaltiesForm);
      const medicalResult = await extractionService.extractIncomeDocument(medicalForm);
      
      // Rental income
      expect(rentalResult.data.box1_rents).toBe(24000); // Box 1
      expect(rentalResult.data.box3_otherIncome).toBe(500); // Late fees
      
      // Royalties
      expect(royaltiesResult.data.box2_royalties).toBe(8500); // Box 2
      expect(royaltiesResult.data.box4_federalTaxWithheld).toBe(850); // Backup withholding
      
      // Medical/healthcare payments
      expect(medicalResult.data.box6_medicalHealthPayments).toBe(45000); // Box 6
    });
  });

  // ============================================================================
  // 1099-NEC Form Extraction Tests (3 tests)
  // ============================================================================

  describe('1099-NEC Form Extraction', () => {
    it('should extract payer and recipient information from 1099-NEC', async () => {
      const form1099NEC = form1099Samples.nec_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099NEC);
      
      expect(result.documentType).toBe('1099-NEC');
      expect(result.data.payerName).toBe('Digital Marketing Solutions LLC');
      expect(result.data.payerTIN).toBe('52-3456789');
      expect(result.data.recipientName).toBe('Bob T. Johnson');
      expect(result.data.recipientTIN).toBe('111-22-3333');
    });

    it('should extract nonemployee compensation amount', async () => {
      const form1099NEC = form1099Samples.nec_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099NEC);
      
      expect(result.documentType).toBe('1099-NEC');
      expect(result.data.box1_nonemployeeCompensation).toBe(35000); // Box 1
    });

    it('should extract federal and state tax withholding if present', async () => {
      const form1099NEC = form1099Samples.nec_withholding_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099NEC);
      
      expect(result.documentType).toBe('1099-NEC');
      expect(result.data.box4_federalTaxWithheld).toBe(3500); // Box 4 - backup withholding
      expect(result.data.box5_stateTaxWithheld).toBe(1750); // Box 5
    });
  });

  // ============================================================================
  // Pay Stub Extraction Tests (6 tests)
  // ============================================================================

  describe('Pay Stub Extraction', () => {
    it('should extract employer name and pay period from pay stub', async () => {
      const payStub = payStubSamples.biweekly_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      
      expect(result.documentType).toBe('PayStub');
      expect(result.data.employerName).toBe('Maryland Tech Solutions Inc');
      expect(result.data.payPeriodStart).toBe('2024-01-01');
      expect(result.data.payPeriodEnd).toBe('2024-01-15');
    });

    it('should extract gross pay and year-to-date earnings', async () => {
      const payStub = payStubSamples.semimonthly_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      
      expect(result.documentType).toBe('PayStub');
      expect(result.data.grossPay).toBe(5208.33);
      expect(result.data.yearToDateGross).toBe(5208.33);
    });

    it('should extract federal, state, local tax withholdings', async () => {
      const payStub = payStubSamples.biweekly_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      
      expect(result.documentType).toBe('PayStub');
      expect(result.data.federalWithholding).toBe(415.38);
      expect(result.data.stateWithholding).toBe(155.77);
      expect(result.data.localWithholding).toBe(110.77);
    });

    it('should extract FICA (Social Security + Medicare) withholdings', async () => {
      const payStub = payStubSamples.biweekly_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      
      expect(result.documentType).toBe('PayStub');
      expect(result.data.socialSecurityWithholding).toBe(214.62); // 6.2% of gross
      expect(result.data.medicareWithholding).toBe(50.19); // 1.45% of gross
    });

    it('should extract deductions (health insurance, 401k, etc.)', async () => {
      const payStub = payStubSamples.withDeductions_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      
      expect(result.documentType).toBe('PayStub');
      expect(result.data.healthInsurance).toBe(150.00);
      expect(result.data.retirement401k).toBe(207.69);
      expect(result.data.dentalInsurance).toBe(25.00);
      expect(result.data.otherDeductions).toBe(125.27);
    });

    it('should extract net pay amount', async () => {
      const payStub = payStubSamples.monthly_stateWorker_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      
      expect(result.documentType).toBe('PayStub');
      expect(result.data.netPay).toBe(3425.32);
      expect(result.data.grossPay).toBe(5166.67);
      
      // Verify net pay is reasonable
      expect(result.data.netPay).toBeGreaterThan(0);
      expect(result.data.netPay).toBeLessThan(result.data.grossPay);
      
      // Verify net pay is at least 50% of gross (reasonable after all deductions)
      expect(result.data.netPay).toBeGreaterThan(result.data.grossPay * 0.5);
    });
  });

  // ============================================================================
  // Cross-Program Verification Tests (5 tests)
  // ============================================================================

  describe('Cross-Program Verification', () => {
    it('should verify W-2 meets SNAP income verification requirements', async () => {
      const w2Document = w2Samples.standard2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      const isValid = extractionService.validateForProgram(result, 'SNAP');
      
      expect(isValid).toBe(true);
      expect(result.data.box1_wages).toBeGreaterThan(0);
      expect(result.data.employerName).toBeTruthy();
      expect(result.data.employeeName).toBeTruthy();
    });

    it('should verify pay stubs meet Medicaid income verification requirements', async () => {
      const payStub = payStubSamples.biweekly_2024;
      
      const result = await extractionService.extractIncomeDocument(payStub);
      const isValid = extractionService.validateForProgram(result, 'Medicaid');
      
      expect(isValid).toBe(true);
      expect(result.data.grossPay).toBeGreaterThan(0);
      expect(result.data.payPeriodStart).toBeTruthy();
      expect(result.data.payPeriodEnd).toBeTruthy();
    });

    it('should verify 1099-NEC forms meet TANF income verification requirements', async () => {
      const form1099 = form1099Samples.nec_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099);
      const isValid = extractionService.validateForProgram(result, 'TANF');
      
      expect(isValid).toBe(true);
      expect(result.data.box1_nonemployeeCompensation).toBeGreaterThan(0);
      expect(result.data.recipientName).toBeTruthy();
    });

    it('should verify 1099-MISC rental income meets SNAP requirements', async () => {
      const form1099 = form1099Samples.misc_rental_2024;
      
      const result = await extractionService.extractIncomeDocument(form1099);
      const isValid = extractionService.validateForProgram(result, 'SNAP');
      
      expect(isValid).toBe(true);
      expect(result.data.box1_rents).toBeGreaterThan(0);
      expect(result.data.recipientName).toBeTruthy();
    });

    it('should verify low-income W-2 meets all program requirements', async () => {
      const w2Document = w2Samples.lowIncomeEitcEligible2024;
      
      const result = await extractionService.extractIncomeDocument(w2Document);
      
      // Should be valid for all programs
      expect(extractionService.validateForProgram(result, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(result, 'Medicaid')).toBe(true);
      expect(extractionService.validateForProgram(result, 'TANF')).toBe(true);
      
      // Verify it's a low-income earner (EITC eligible)
      expect(result.data.box1_wages).toBe(24000);
      expect(result.data.box1_wages).toBeLessThan(30000);
    });
  });

  // ============================================================================
  // Error Handling Tests (3 tests)
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing required fields gracefully', async () => {
      const incompleteDoc = {
        box1_wages: 0, // Missing wages
        employerName: '', // Missing employer
        // Missing employee name
      };
      
      const result = await extractionService.extractIncomeDocument(incompleteDoc);
      
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle illegible/poor quality documents', async () => {
      const poorQualityDoc = payStubSamples.lowQuality;
      
      const result = await extractionService.extractIncomeDocument(poorQualityDoc);
      
      // Low quality document should still be processed, but with low confidence
      expect(result.documentType).toBe('PayStub');
      expect(result.data.employerName).toBe('Unknown Employer');
      expect(result.data.grossPay).toBe(0);
    });

    it('should handle incorrect document types', async () => {
      const wrongDoc = { 
        type: 'utility_bill',
        amount: 150.00,
        date: '2024-01-15'
      };
      
      const result = await extractionService.extractIncomeDocument(wrongDoc);
      
      expect(result.documentType).toBe('Unknown');
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Additional Edge Case Tests (2 bonus tests)
  // ============================================================================

  describe('Edge Cases and Special Scenarios', () => {
    it('should handle restaurant worker W-2 with tips correctly', async () => {
      const w2WithTips = w2Samples.restaurantWorkerWithTips2024;
      
      const result = await extractionService.extractIncomeDocument(w2WithTips);
      
      expect(result.documentType).toBe('W-2');
      expect(result.data.box1_wages).toBe(28500); // Base + tips
      expect(result.data.box7_socialSecurityTips).toBe(12000); // Reported tips
      expect(result.data.box1_wages).toBeGreaterThan(result.data.box7_socialSecurityTips);
    });

    it('should handle dual job scenarios with multiple W-2s', async () => {
      const job1 = w2Samples.dualJobs2024_First;
      const job2 = w2Samples.dualJobs2024_Second;
      
      const result1 = await extractionService.extractIncomeDocument(job1);
      const result2 = await extractionService.extractIncomeDocument(job2);
      
      // Both should be valid W-2s for the same person
      expect(result1.documentType).toBe('W-2');
      expect(result2.documentType).toBe('W-2');
      expect(result1.data.employeeSSN).toBe(result2.data.employeeSSN);
      expect(result1.data.employeeName).toBe(result2.data.employeeName);
      
      // Different employers
      expect(result1.data.employerName).not.toBe(result2.data.employerName);
      
      // Combined income should be sum of both jobs
      const totalIncome = result1.data.box1_wages + result2.data.box1_wages;
      expect(totalIncome).toBe(50000); // 35000 + 15000
    });

    it('should handle high earner exceeding Social Security wage base', async () => {
      const highEarnerW2 = w2Samples.highEarner2024;
      
      const result = await extractionService.extractIncomeDocument(highEarnerW2);
      
      expect(result.documentType).toBe('W-2');
      
      // Wages exceed SS wage base, so SS wages should be capped
      expect(result.data.box1_wages).toBe(125000);
      expect(result.data.box3_socialSecurityWages).toBe(160200); // 2024 wage base
      
      // Medicare wages should match all wages (no cap)
      expect(result.data.box5_medicareWages).toBe(125000);
    });
  });
});
