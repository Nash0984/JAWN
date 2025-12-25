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
export { form1099Samples } from './documents/1099Forms';
export { payStubSamples } from './documents/payStubs';
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

// All verification document type fixtures (for comprehensive testing)
export { 
  bankStatements,
  utilityBills,
  driversLicenses,
  leaseAgreements,
  ssiAwardLetters,
  birthCertificates,
  employmentVerifications
} from './documents/index';

// Re-export types from services for convenience
export type { HouseholdInput } from '../../server/services/rulesEngine';
export type { TaxHouseholdInput } from '../../server/services/policyEngineTaxCalculation';
export type { 
  W2Data, 
  Form1099MISCData, 
  Form1099NECData 
} from '../../server/services/taxDocumentExtraction';
