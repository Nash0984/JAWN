/**
 * Disability Verification Document Fixtures
 * 
 * Test data for disability verification documents including:
 * - SSI award letters
 * - SSDI award letters
 * - Medical certification forms
 */

export const ssiAwardLetters = {
  standard: {
    documentType: 'SSIAwardLetter',
    recipientName: 'William Taylor',
    recipientSSN: '***-**-5678',
    monthlyBenefit: 943.00,
    disabilityDetermination: 'Approved',
    effectiveDate: '2024-01-01',
    reviewDate: '2027-01-01',
    paymentSchedule: 'First of each month',
    letterDate: '2024-01-15',
    contactPhone: '1-800-772-1213',
    eligibilityReason: 'Disability',
    issuingOffice: 'Social Security Administration - Baltimore Office'
  },

  ssdi: {
    documentType: 'SSDIAwardLetter',
    recipientName: 'Barbara Scott',
    recipientSSN: '***-**-1234',
    monthlyBenefit: 1542.00,
    disabilityDetermination: 'Approved',
    effectiveDate: '2023-06-01',
    reviewDate: '2026-06-01',
    paymentSchedule: 'Third Wednesday of each month',
    letterDate: '2023-06-15',
    contactPhone: '1-800-772-1213',
    eligibilityReason: 'Long-term Disability',
    workCredits: 40,
    issuingOffice: 'Social Security Administration - Silver Spring Office',
    medicareEligibleDate: '2025-06-01'
  },

  medicalCertification: {
    documentType: 'MedicalCertification',
    patientName: 'Charles Moore',
    patientDOB: '1968-08-20',
    providerName: 'Dr. Elizabeth Martinez, MD',
    providerLicense: 'MD-MED-98765',
    providerAddress: '1500 Medical Plaza, Baltimore, MD 21201',
    certificationDate: '2025-09-15',
    disabilityType: 'Chronic Back Pain with Mobility Limitation',
    diagnosis: 'Degenerative Disc Disease L4-L5',
    expectedDuration: 'Permanent',
    functionalLimitations: [
      'Cannot lift more than 10 pounds',
      'Cannot stand for more than 30 minutes',
      'Cannot sit for more than 2 hours continuously'
    ],
    workRestrictions: 'Unable to perform substantial gainful activity',
    treatmentPlan: 'Physical therapy, pain management',
    nextReviewDate: '2026-09-15'
  }
};
