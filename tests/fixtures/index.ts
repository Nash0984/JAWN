/**
 * Test Fixtures Index
 * 
 * Centralized exports for all test fixtures and test data
 * Makes it easy to import fixtures in test files
 */

// Household fixtures
export { marylandHouseholds } from './households/marylandHouseholds';
export { taxHouseholds2024 } from './households/taxHouseholds';

// Document fixtures
export { w2Samples } from './documents/w2Samples';
export { verificationDocuments } from './documents/verificationDocs';
export type {
  BankStatementData,
  RentReceiptData,
  BirthCertificateData,
  UtilityBillData,
  PayStubData,
  SocialSecurityAwardLetterData,
  DriverLicenseData,
  LeaseAgreementData,
  MedicalBillData,
  ChildcareBillData,
  VerificationDocumentType,
} from './documents/verificationDocs';

// Re-export types from services for convenience
export type { HouseholdInput } from '../../server/services/rulesEngine';
export type { TaxHouseholdInput } from '../../server/services/policyEngineTaxCalculation';
export type { W2Data } from '../../server/services/taxDocumentExtraction';
