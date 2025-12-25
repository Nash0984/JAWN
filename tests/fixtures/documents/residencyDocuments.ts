/**
 * Residency Verification Document Fixtures
 * 
 * Test data for residency verification documents including:
 * - Lease agreements
 * - Voter registration cards
 * - Utility bills (for residency proof)
 */

export const leaseAgreements = {
  standardLease: {
    documentType: 'LeaseAgreement',
    tenantName: 'Rebecca Harris',
    landlordName: 'Greenwood Property Management LLC',
    landlordAddress: '200 Management Way, Bethesda, MD 20814',
    propertyAddress: '789 Apartment Circle, Unit 5C, Rockville, MD 20850',
    leaseStartDate: '2025-01-01',
    leaseEndDate: '2025-12-31',
    monthlyRent: 1400.00,
    securityDeposit: 1400.00,
    leaseType: 'Fixed Term',
    signatureDate: '2024-12-15',
    utilities: 'Tenant responsible for electric and gas'
  },

  monthToMonthLease: {
    documentType: 'LeaseAgreement',
    tenantName: 'Steven King',
    landlordName: 'Patricia Homeowner',
    landlordAddress: '555 Owner Street, Columbia, MD 21044',
    propertyAddress: '321 Rental Road, Ellicott City, MD 21043',
    leaseStartDate: '2024-06-01',
    leaseEndDate: null,
    monthlyRent: 950.00,
    securityDeposit: 950.00,
    leaseType: 'Month-to-Month',
    signatureDate: '2024-05-20',
    utilities: 'Water included'
  },

  voterRegistration: {
    documentType: 'VoterRegistration',
    voterName: 'Andrew Mitchell',
    registeredAddress: '654 Democracy Lane, Annapolis, MD 21401',
    dateOfBirth: '1978-11-30',
    registrationDate: '2020-09-15',
    precinctNumber: 'MD-21401-05',
    countyName: 'Anne Arundel',
    partyAffiliation: 'Democrat',
    voterID: 'MD-VOTER-123456789'
  }
};
