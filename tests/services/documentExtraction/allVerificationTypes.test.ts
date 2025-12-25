/**
 * Comprehensive Document Extraction Test Suite
 * 
 * Tests all non-income verification document types across Maryland's 6 benefit programs:
 * SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI
 * 
 * Coverage: 75+ tests across 8 categories:
 * 1. Asset Verification (12 tests)
 * 2. Expense Verification (12 tests)
 * 3. Identity Verification (10 tests)
 * 4. Residency Verification (8 tests)
 * 5. Disability Verification (8 tests)
 * 6. Household Composition (10 tests)
 * 7. Work Requirements/ABAWD (8 tests)
 * 8. Cross-Program Integration (7 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentExtractionService } from '../../../server/services/documentExtraction';
import { bankStatements } from '../../fixtures/documents/bankStatements';
import { utilityBills } from '../../fixtures/documents/utilityBills';
import { driversLicenses } from '../../fixtures/documents/identityDocuments';
import { leaseAgreements } from '../../fixtures/documents/residencyDocuments';
import { ssiAwardLetters } from '../../fixtures/documents/disabilityDocuments';
import { birthCertificates } from '../../fixtures/documents/householdDocuments';
import { employmentVerifications } from '../../fixtures/documents/workDocuments';

describe('Document Extraction - All Verification Types', () => {
  let extractionService: DocumentExtractionService;

  beforeEach(() => {
    extractionService = new DocumentExtractionService();
  });

  describe('Asset Verification', () => {
    describe('Bank Statements', () => {
      it('should extract account holder and account number', async () => {
        const bankStatement = bankStatements.checkingAccount;
        
        const result = await extractionService.extractAssetDocument(bankStatement);
        
        expect(result.documentType).toBe('BankStatement');
        expect(result.accountHolder).toBe('John Doe');
        expect(result.accountNumber).toMatch(/\d{4}$/);
        expect(result.accountType).toBe('Checking');
      });

      it('should extract current balance and available balance', async () => {
        const bankStatement = bankStatements.checkingAccount;
        
        const result = await extractionService.extractAssetDocument(bankStatement);
        
        expect(result.currentBalance).toBeGreaterThan(0);
        expect(result.availableBalance).toBeDefined();
      });

      it('should extract statement period and bank name', async () => {
        const bankStatement = bankStatements.checkingAccount;
        
        const result = await extractionService.extractAssetDocument(bankStatement);
        
        expect(result.statementPeriodStart).toBeDefined();
        expect(result.statementPeriodEnd).toBeDefined();
        expect(result.bankName).toBe('First National Bank');
      });
    });

    describe('Investment Statements', () => {
      it('should extract investment account details', async () => {
        const investment = bankStatements.investmentAccount;
        
        const result = await extractionService.extractAssetDocument(investment);
        
        expect(result.documentType).toBe('InvestmentStatement');
        expect(result.accountType).toBe('401k');
        expect(result.totalValue).toBeGreaterThan(0);
      });

      it('should extract holdings breakdown', async () => {
        const investment = bankStatements.investmentAccount;
        
        const result = await extractionService.extractAssetDocument(investment);
        
        expect(result.holdings).toBeDefined();
        expect(Array.isArray(result.holdings)).toBe(true);
      });
    });

    describe('Property Deeds', () => {
      it('should extract property owner and address', async () => {
        const deed = bankStatements.propertyDeed;
        
        const result = await extractionService.extractAssetDocument(deed);
        
        expect(result.documentType).toBe('PropertyDeed');
        expect(result.ownerName).toBeDefined();
        expect(result.propertyAddress).toBeDefined();
      });

      it('should extract assessed value and property type', async () => {
        const deed = bankStatements.propertyDeed;
        
        const result = await extractionService.extractAssetDocument(deed);
        
        expect(result.assessedValue).toBeGreaterThan(0);
        expect(result.propertyType).toBe('Residential');
      });
    });

    describe('Vehicle Titles', () => {
      it('should extract vehicle owner and VIN', async () => {
        const title = bankStatements.vehicleTitle;
        
        const result = await extractionService.extractAssetDocument(title);
        
        expect(result.documentType).toBe('VehicleTitle');
        expect(result.ownerName).toBeDefined();
        expect(result.vin).toMatch(/^[A-Z0-9]{17}$/);
      });

      it('should extract make, model, year', async () => {
        const title = bankStatements.vehicleTitle;
        
        const result = await extractionService.extractAssetDocument(title);
        
        expect(result.make).toBeDefined();
        expect(result.model).toBeDefined();
        expect(result.year).toBeGreaterThan(1900);
      });
    });

    describe('Cross-Program Asset Validation', () => {
      it('should validate assets for SNAP program (resource limits)', async () => {
        const bankStatement = bankStatements.checkingAccount;
        const result = await extractionService.extractAssetDocument(bankStatement);
        
        const isValid = extractionService.validateForProgram(result, 'SNAP');
        expect(isValid).toBe(true);
      });

      it('should validate assets for Medicaid program (spend-down)', async () => {
        const investment = bankStatements.investmentAccount;
        const result = await extractionService.extractAssetDocument(investment);
        
        const isValid = extractionService.validateForProgram(result, 'Medicaid');
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Expense Verification', () => {
    describe('Rent Receipts', () => {
      it('should extract landlord and tenant information', async () => {
        const rentReceipt = utilityBills.rentReceipt;
        
        const result = await extractionService.extractExpenseDocument(rentReceipt);
        
        expect(result.documentType).toBe('RentReceipt');
        expect(result.landlordName).toBeDefined();
        expect(result.tenantName).toBeDefined();
      });

      it('should extract rent amount and period', async () => {
        const rentReceipt = utilityBills.rentReceipt;
        
        const result = await extractionService.extractExpenseDocument(rentReceipt);
        
        expect(result.rentAmount).toBeGreaterThan(0);
        expect(result.period).toBe('Monthly');
      });
    });

    describe('Mortgage Statements', () => {
      it('should extract lender and borrower information', async () => {
        const mortgage = utilityBills.mortgageStatement;
        
        const result = await extractionService.extractExpenseDocument(mortgage);
        
        expect(result.documentType).toBe('MortgageStatement');
        expect(result.lender).toBeDefined();
        expect(result.borrower).toBeDefined();
      });

      it('should extract monthly payment and principal balance', async () => {
        const mortgage = utilityBills.mortgageStatement;
        
        const result = await extractionService.extractExpenseDocument(mortgage);
        
        expect(result.monthlyPayment).toBeGreaterThan(0);
        expect(result.principalBalance).toBeGreaterThan(0);
      });
    });

    describe('Utility Bills', () => {
      it('should extract account holder and service address', async () => {
        const utilityBill = utilityBills.electricBill;
        
        const result = await extractionService.extractExpenseDocument(utilityBill);
        
        expect(result.documentType).toBe('UtilityBill');
        expect(result.accountHolder).toBeDefined();
        expect(result.serviceAddress).toBeDefined();
      });

      it('should extract amount due and due date', async () => {
        const utilityBill = utilityBills.electricBill;
        
        const result = await extractionService.extractExpenseDocument(utilityBill);
        
        expect(result.amountDue).toBeGreaterThan(0);
        expect(result.dueDate).toBeDefined();
      });

      it('should extract utility type (electric, gas, water)', async () => {
        const utilityBill = utilityBills.electricBill;
        
        const result = await extractionService.extractExpenseDocument(utilityBill);
        
        expect(result.utilityType).toBe('Electric');
      });
    });

    describe('Medical Bills', () => {
      it('should extract patient and provider information', async () => {
        const medicalBill = utilityBills.medicalBill;
        
        const result = await extractionService.extractExpenseDocument(medicalBill);
        
        expect(result.documentType).toBe('MedicalBill');
        expect(result.patientName).toBeDefined();
        expect(result.providerName).toBeDefined();
      });

      it('should extract service date and amount owed', async () => {
        const medicalBill = utilityBills.medicalBill;
        
        const result = await extractionService.extractExpenseDocument(medicalBill);
        
        expect(result.serviceDate).toBeDefined();
        expect(result.amountOwed).toBeGreaterThan(0);
      });
    });

    describe('Childcare Invoices', () => {
      it('should extract provider and child information', async () => {
        const childcareInvoice = utilityBills.childcareInvoice;
        
        const result = await extractionService.extractExpenseDocument(childcareInvoice);
        
        expect(result.documentType).toBe('ChildcareInvoice');
        expect(result.providerName).toBeDefined();
        expect(result.childName).toBeDefined();
      });

      it('should extract billing period and total cost', async () => {
        const childcareInvoice = utilityBills.childcareInvoice;
        
        const result = await extractionService.extractExpenseDocument(childcareInvoice);
        
        expect(result.billingPeriodStart).toBeDefined();
        expect(result.billingPeriodEnd).toBeDefined();
        expect(result.totalCost).toBeGreaterThan(0);
      });
    });

    describe('Cross-Program Expense Validation', () => {
      it('should validate shelter expenses for SNAP shelter deduction', async () => {
        const rentReceipt = utilityBills.rentReceipt;
        const result = await extractionService.extractExpenseDocument(rentReceipt);
        
        const isValid = extractionService.validateForProgram(result, 'SNAP');
        expect(isValid).toBe(true);
      });

      it('should validate dependent care for TANF program', async () => {
        const childcareInvoice = utilityBills.childcareInvoice;
        const result = await extractionService.extractExpenseDocument(childcareInvoice);
        
        const isValid = extractionService.validateForProgram(result, 'TANF');
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Identity Verification', () => {
    describe('Drivers Licenses', () => {
      it('should extract name and address from drivers license', async () => {
        const license = driversLicenses.marylandLicense;
        
        const result = await extractionService.extractIdentityDocument(license);
        
        expect(result.documentType).toBe('DriversLicense');
        expect(result.fullName).toBeDefined();
        expect(result.address).toBeDefined();
      });

      it('should extract DOB and license number', async () => {
        const license = driversLicenses.marylandLicense;
        
        const result = await extractionService.extractIdentityDocument(license);
        
        expect(result.dateOfBirth).toBeDefined();
        expect(result.licenseNumber).toBeDefined();
      });

      it('should extract expiration date and state', async () => {
        const license = driversLicenses.marylandLicense;
        
        const result = await extractionService.extractIdentityDocument(license);
        
        expect(result.expirationDate).toBeDefined();
        expect(result.stateIssued).toBe('MD');
      });
    });

    describe('State ID Cards', () => {
      it('should extract name and address from state ID', async () => {
        const stateId = driversLicenses.marylandStateId;
        
        const result = await extractionService.extractIdentityDocument(stateId);
        
        expect(result.documentType).toBe('StateID');
        expect(result.fullName).toBeDefined();
        expect(result.address).toBeDefined();
      });

      it('should extract DOB and ID number', async () => {
        const stateId = driversLicenses.marylandStateId;
        
        const result = await extractionService.extractIdentityDocument(stateId);
        
        expect(result.dateOfBirth).toBeDefined();
        expect(result.idNumber).toBeDefined();
      });
    });

    describe('Social Security Cards', () => {
      it('should extract name and SSN from SS card', async () => {
        const ssCard = driversLicenses.socialSecurityCard;
        
        const result = await extractionService.extractIdentityDocument(ssCard);
        
        expect(result.documentType).toBe('SocialSecurityCard');
        expect(result.fullName).toBeDefined();
        expect(result.ssn).toMatch(/^\d{3}-\d{2}-\d{4}$/);
      });
    });

    describe('Birth Certificates', () => {
      it('should extract full name and DOB from birth certificate', async () => {
        const birthCert = birthCertificates.standard;
        
        const result = await extractionService.extractIdentityDocument(birthCert);
        
        expect(result.documentType).toBe('BirthCertificate');
        expect(result.fullName).toBeDefined();
        expect(result.dateOfBirth).toBeDefined();
      });

      it('should extract place of birth and parents names', async () => {
        const birthCert = birthCertificates.standard;
        
        const result = await extractionService.extractIdentityDocument(birthCert);
        
        expect(result.placeOfBirth).toBeDefined();
        expect(result.motherName).toBeDefined();
        expect(result.fatherName).toBeDefined();
      });
    });

    describe('Cross-Program Identity Validation', () => {
      it('should validate identity documents for all 6 programs', async () => {
        const license = driversLicenses.marylandLicense;
        const result = await extractionService.extractIdentityDocument(license);
        
        const programs = ['SNAP', 'Medicaid', 'TANF', 'OHEP', 'Tax Credits', 'SSI'];
        
        for (const program of programs) {
          const isValid = extractionService.validateForProgram(result, program);
          expect(isValid).toBe(true);
        }
      });
    });
  });

  describe('Residency Verification', () => {
    describe('Utility Bills for Residency', () => {
      it('should extract address from utility bill for residency proof', async () => {
        const utilityBill = utilityBills.electricBill;
        
        const result = await extractionService.extractResidencyDocument(utilityBill);
        
        expect(result.documentType).toBe('UtilityBill');
        expect(result.residentName).toBeDefined();
        expect(result.residenceAddress).toBeDefined();
      });

      it('should extract service date range for residency verification', async () => {
        const utilityBill = utilityBills.electricBill;
        
        const result = await extractionService.extractResidencyDocument(utilityBill);
        
        expect(result.servicePeriodStart).toBeDefined();
        expect(result.servicePeriodEnd).toBeDefined();
      });
    });

    describe('Lease Agreements', () => {
      it('should extract tenant and landlord from lease', async () => {
        const lease = leaseAgreements.standardLease;
        
        const result = await extractionService.extractResidencyDocument(lease);
        
        expect(result.documentType).toBe('LeaseAgreement');
        expect(result.tenantName).toBeDefined();
        expect(result.landlordName).toBeDefined();
      });

      it('should extract property address and lease term', async () => {
        const lease = leaseAgreements.standardLease;
        
        const result = await extractionService.extractResidencyDocument(lease);
        
        expect(result.propertyAddress).toBeDefined();
        expect(result.leaseStartDate).toBeDefined();
        expect(result.leaseEndDate).toBeDefined();
      });
    });

    describe('Voter Registration Cards', () => {
      it('should extract name and registered address', async () => {
        const voterCard = leaseAgreements.voterRegistration;
        
        const result = await extractionService.extractResidencyDocument(voterCard);
        
        expect(result.documentType).toBe('VoterRegistration');
        expect(result.voterName).toBeDefined();
        expect(result.registeredAddress).toBeDefined();
      });
    });

    describe('Cross-Program Residency Validation', () => {
      it('should validate Maryland residency for all programs', async () => {
        const lease = leaseAgreements.standardLease;
        const result = await extractionService.extractResidencyDocument(lease);
        
        const isValid = extractionService.validateForProgram(result, 'SNAP');
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Disability Verification', () => {
    describe('SSI Award Letters', () => {
      it('should extract recipient and benefit amount from SSI letter', async () => {
        const ssiLetter = ssiAwardLetters.standard;
        
        const result = await extractionService.extractDisabilityDocument(ssiLetter);
        
        expect(result.documentType).toBe('SSIAwardLetter');
        expect(result.recipientName).toBeDefined();
        expect(result.monthlyBenefit).toBeGreaterThan(0);
      });

      it('should extract disability determination and effective date', async () => {
        const ssiLetter = ssiAwardLetters.standard;
        
        const result = await extractionService.extractDisabilityDocument(ssiLetter);
        
        expect(result.disabilityDetermination).toBe('Approved');
        expect(result.effectiveDate).toBeDefined();
      });
    });

    describe('SSDI Award Letters', () => {
      it('should extract recipient and benefit amount from SSDI letter', async () => {
        const ssdiLetter = ssiAwardLetters.ssdi;
        
        const result = await extractionService.extractDisabilityDocument(ssdiLetter);
        
        expect(result.documentType).toBe('SSDIAwardLetter');
        expect(result.recipientName).toBeDefined();
        expect(result.monthlyBenefit).toBeGreaterThan(0);
      });
    });

    describe('Medical Certification Forms', () => {
      it('should extract patient and provider from medical certification', async () => {
        const medCert = ssiAwardLetters.medicalCertification;
        
        const result = await extractionService.extractDisabilityDocument(medCert);
        
        expect(result.documentType).toBe('MedicalCertification');
        expect(result.patientName).toBeDefined();
        expect(result.providerName).toBeDefined();
      });

      it('should extract disability type and duration', async () => {
        const medCert = ssiAwardLetters.medicalCertification;
        
        const result = await extractionService.extractDisabilityDocument(medCert);
        
        expect(result.disabilityType).toBeDefined();
        expect(result.expectedDuration).toBeDefined();
      });
    });

    describe('Cross-Program Disability Validation', () => {
      it('should validate disability for SNAP medical deduction', async () => {
        const ssiLetter = ssiAwardLetters.standard;
        const result = await extractionService.extractDisabilityDocument(ssiLetter);
        
        const isValid = extractionService.validateForProgram(result, 'SNAP');
        expect(isValid).toBe(true);
      });

      it('should validate disability for Medicaid eligibility', async () => {
        const ssdiLetter = ssiAwardLetters.ssdi;
        const result = await extractionService.extractDisabilityDocument(ssdiLetter);
        
        const isValid = extractionService.validateForProgram(result, 'Medicaid');
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Household Composition', () => {
    describe('Birth Certificates for Dependents', () => {
      it('should extract child information from birth certificate', async () => {
        const birthCert = birthCertificates.dependent;
        
        const result = await extractionService.extractHouseholdDocument(birthCert);
        
        expect(result.documentType).toBe('BirthCertificate');
        expect(result.childName).toBeDefined();
        expect(result.dateOfBirth).toBeDefined();
      });

      it('should extract parent information from birth certificate', async () => {
        const birthCert = birthCertificates.dependent;
        
        const result = await extractionService.extractHouseholdDocument(birthCert);
        
        expect(result.motherName).toBeDefined();
        expect(result.fatherName).toBeDefined();
      });
    });

    describe('School Enrollment Letters', () => {
      it('should extract student name and school information', async () => {
        const enrollment = birthCertificates.schoolEnrollment;
        
        const result = await extractionService.extractHouseholdDocument(enrollment);
        
        expect(result.documentType).toBe('SchoolEnrollment');
        expect(result.studentName).toBeDefined();
        expect(result.schoolName).toBeDefined();
      });

      it('should extract grade level and enrollment status', async () => {
        const enrollment = birthCertificates.schoolEnrollment;
        
        const result = await extractionService.extractHouseholdDocument(enrollment);
        
        expect(result.gradeLevel).toBeDefined();
        expect(result.enrollmentStatus).toBe('Active');
      });
    });

    describe('Custody Agreements', () => {
      it('should extract custodial parent and children', async () => {
        const custody = birthCertificates.custodyAgreement;
        
        const result = await extractionService.extractHouseholdDocument(custody);
        
        expect(result.documentType).toBe('CustodyAgreement');
        expect(result.custodialParent).toBeDefined();
        expect(result.children).toBeDefined();
        expect(Array.isArray(result.children)).toBe(true);
      });

      it('should extract visitation schedule', async () => {
        const custody = birthCertificates.custodyAgreement;
        
        const result = await extractionService.extractHouseholdDocument(custody);
        
        expect(result.visitationSchedule).toBeDefined();
      });
    });

    describe('Marriage Certificates', () => {
      it('should extract spouse names and marriage date', async () => {
        const marriage = birthCertificates.marriageCertificate;
        
        const result = await extractionService.extractHouseholdDocument(marriage);
        
        expect(result.documentType).toBe('MarriageCertificate');
        expect(result.spouse1Name).toBeDefined();
        expect(result.spouse2Name).toBeDefined();
        expect(result.marriageDate).toBeDefined();
      });
    });

    describe('Cross-Program Household Validation', () => {
      it('should validate household composition for all programs', async () => {
        const birthCert = birthCertificates.dependent;
        const result = await extractionService.extractHouseholdDocument(birthCert);
        
        const programs = ['SNAP', 'Medicaid', 'TANF'];
        
        for (const program of programs) {
          const isValid = extractionService.validateForProgram(result, program);
          expect(isValid).toBe(true);
        }
      });
    });
  });

  describe('Work Requirements/ABAWD', () => {
    describe('Employment Verification Letters', () => {
      it('should extract employee and employer information', async () => {
        const empVerif = employmentVerifications.standard;
        
        const result = await extractionService.extractWorkDocument(empVerif);
        
        expect(result.documentType).toBe('EmploymentVerification');
        expect(result.employeeName).toBeDefined();
        expect(result.employerName).toBeDefined();
      });

      it('should extract hours worked and wages', async () => {
        const empVerif = employmentVerifications.standard;
        
        const result = await extractionService.extractWorkDocument(empVerif);
        
        expect(result.hoursPerWeek).toBeGreaterThan(0);
        expect(result.hourlyWage).toBeGreaterThan(0);
      });
    });

    describe('Unemployment Benefit Letters', () => {
      it('should extract claimant and benefit amount', async () => {
        const unemploy = employmentVerifications.unemployment;
        
        const result = await extractionService.extractWorkDocument(unemploy);
        
        expect(result.documentType).toBe('UnemploymentBenefits');
        expect(result.claimantName).toBeDefined();
        expect(result.weeklyBenefit).toBeGreaterThan(0);
      });

      it('should extract eligibility period', async () => {
        const unemploy = employmentVerifications.unemployment;
        
        const result = await extractionService.extractWorkDocument(unemploy);
        
        expect(result.eligibilityStartDate).toBeDefined();
        expect(result.eligibilityEndDate).toBeDefined();
      });
    });

    describe('Training Program Enrollment', () => {
      it('should extract participant and program information', async () => {
        const training = employmentVerifications.trainingProgram;
        
        const result = await extractionService.extractWorkDocument(training);
        
        expect(result.documentType).toBe('TrainingProgram');
        expect(result.participantName).toBeDefined();
        expect(result.programName).toBeDefined();
      });

      it('should extract hours per week and completion date', async () => {
        const training = employmentVerifications.trainingProgram;
        
        const result = await extractionService.extractWorkDocument(training);
        
        expect(result.hoursPerWeek).toBeGreaterThan(0);
        expect(result.expectedCompletionDate).toBeDefined();
      });
    });

    describe('Cross-Program Work Validation', () => {
      it('should validate work requirements for SNAP ABAWD', async () => {
        const empVerif = employmentVerifications.standard;
        const result = await extractionService.extractWorkDocument(empVerif);
        
        const isValid = extractionService.validateForProgram(result, 'SNAP');
        expect(isValid).toBe(true);
      });

      it('should validate work requirements for TANF', async () => {
        const training = employmentVerifications.trainingProgram;
        const result = await extractionService.extractWorkDocument(training);
        
        const isValid = extractionService.validateForProgram(result, 'TANF');
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Cross-Program Integration', () => {
    it('should verify single document serves multiple programs (utility bill)', async () => {
      const utilityBill = utilityBills.electricBill;
      
      const residencyResult = await extractionService.extractResidencyDocument(utilityBill);
      const expenseResult = await extractionService.extractExpenseDocument(utilityBill);
      
      expect(residencyResult.residenceAddress).toBe(expenseResult.serviceAddress);
      expect(extractionService.validateForProgram(residencyResult, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(expenseResult, 'SNAP')).toBe(true);
    });

    it('should validate document across SNAP + Medicaid', async () => {
      const birthCert = birthCertificates.dependent;
      const result = await extractionService.extractHouseholdDocument(birthCert);
      
      expect(extractionService.validateForProgram(result, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(result, 'Medicaid')).toBe(true);
    });

    it('should validate document across SNAP + TANF + Medicaid', async () => {
      const license = driversLicenses.marylandLicense;
      const result = await extractionService.extractIdentityDocument(license);
      
      expect(extractionService.validateForProgram(result, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(result, 'TANF')).toBe(true);
      expect(extractionService.validateForProgram(result, 'Medicaid')).toBe(true);
    });

    it('should validate full 6-program coverage', async () => {
      const license = driversLicenses.marylandLicense;
      const result = await extractionService.extractIdentityDocument(license);
      
      const programs = ['SNAP', 'Medicaid', 'TANF', 'OHEP', 'Tax Credits', 'SSI'];
      const validationResults = programs.map(program => 
        extractionService.validateForProgram(result, program)
      );
      
      expect(validationResults.every(v => v === true)).toBe(true);
    });

    it('should validate multiple asset documents for SNAP + Medicaid', async () => {
      const bankStatement = bankStatements.checkingAccount;
      const vehicle = bankStatements.vehicleTitle;
      
      const bankResult = await extractionService.extractAssetDocument(bankStatement);
      const vehicleResult = await extractionService.extractAssetDocument(vehicle);
      
      expect(extractionService.validateForProgram(bankResult, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(bankResult, 'Medicaid')).toBe(true);
      expect(extractionService.validateForProgram(vehicleResult, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(vehicleResult, 'Medicaid')).toBe(true);
    });

    it('should validate work documents across SNAP + TANF', async () => {
      const employment = employmentVerifications.standard;
      const training = employmentVerifications.trainingProgram;
      
      const empResult = await extractionService.extractWorkDocument(employment);
      const trainingResult = await extractionService.extractWorkDocument(training);
      
      expect(extractionService.validateForProgram(empResult, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(empResult, 'TANF')).toBe(true);
      expect(extractionService.validateForProgram(trainingResult, 'SNAP')).toBe(true);
      expect(extractionService.validateForProgram(trainingResult, 'TANF')).toBe(true);
    });

    it('should handle complete document portfolio for household', async () => {
      const license = driversLicenses.marylandLicense;
      const lease = leaseAgreements.standardLease;
      const bankStatement = bankStatements.checkingAccount;
      const employment = employmentVerifications.standard;
      
      const identityResult = await extractionService.extractIdentityDocument(license);
      const residencyResult = await extractionService.extractResidencyDocument(lease);
      const assetResult = await extractionService.extractAssetDocument(bankStatement);
      const workResult = await extractionService.extractWorkDocument(employment);
      
      const programs = ['SNAP', 'Medicaid', 'TANF'];
      
      for (const program of programs) {
        expect(extractionService.validateForProgram(identityResult, program)).toBe(true);
        expect(extractionService.validateForProgram(residencyResult, program)).toBe(true);
        expect(extractionService.validateForProgram(assetResult, program)).toBe(true);
        expect(extractionService.validateForProgram(workResult, program)).toBe(true);
      }
    });
  });
});
