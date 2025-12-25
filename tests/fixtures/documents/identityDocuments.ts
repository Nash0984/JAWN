/**
 * Identity Verification Document Fixtures
 * 
 * Test data for identity verification documents including:
 * - Driver's licenses
 * - State ID cards
 * - Social Security cards
 * - Birth certificates
 */

export const driversLicenses = {
  marylandLicense: {
    documentType: 'DriversLicense',
    fullName: 'Kevin Anderson',
    address: '123 Liberty Street, Baltimore, MD 21201',
    dateOfBirth: '1985-06-15',
    licenseNumber: 'M-500-123-456-789',
    expirationDate: '2027-06-15',
    issueDate: '2019-06-15',
    stateIssued: 'MD',
    licenseClass: 'C',
    restrictions: 'None',
    height: '5\'10"',
    eyeColor: 'Brown',
    sex: 'M'
  },

  marylandStateId: {
    documentType: 'StateID',
    fullName: 'Amanda Clark',
    address: '456 Freedom Avenue, Silver Spring, MD 20910',
    dateOfBirth: '1992-03-22',
    idNumber: 'MD-ID-789-012-345',
    expirationDate: '2026-03-22',
    issueDate: '2018-03-22',
    stateIssued: 'MD',
    height: '5\'6"',
    eyeColor: 'Blue',
    sex: 'F'
  },

  socialSecurityCard: {
    documentType: 'SocialSecurityCard',
    fullName: 'Daniel Wright',
    ssn: '123-45-6789',
    issueDate: '1990-01-01'
  },

  socialSecurityCard2: {
    documentType: 'SocialSecurityCard',
    fullName: 'Michelle Green',
    ssn: '987-65-4321',
    issueDate: '1988-05-15'
  }
};
