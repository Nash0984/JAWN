/**
 * Household Composition Document Fixtures
 * 
 * Test data for household composition documents including:
 * - Birth certificates (for dependents)
 * - School enrollment letters
 * - Custody agreements
 * - Marriage certificates
 */

export const birthCertificates = {
  standard: {
    documentType: 'BirthCertificate',
    fullName: 'Jessica Marie Thompson',
    dateOfBirth: '1990-07-15',
    placeOfBirth: 'Baltimore, Maryland',
    county: 'Baltimore City',
    motherName: 'Susan Elizabeth Thompson',
    motherMaidenName: 'Susan Elizabeth Roberts',
    fatherName: 'James Michael Thompson',
    certificateNumber: 'MD-BC-1990-123456',
    registrationDate: '1990-07-18',
    issuedDate: '2025-01-10',
    fileNumber: '90-123456'
  },

  dependent: {
    documentType: 'BirthCertificate',
    childName: 'Emily Rose Jackson',
    fullName: 'Emily Rose Jackson',
    dateOfBirth: '2018-03-22',
    placeOfBirth: 'Silver Spring, Maryland',
    county: 'Montgomery',
    motherName: 'Rachel Anne Jackson',
    motherMaidenName: 'Rachel Anne Williams',
    fatherName: 'Marcus Lee Jackson',
    certificateNumber: 'MD-BC-2018-789012',
    registrationDate: '2018-03-25',
    issuedDate: '2025-02-15',
    fileNumber: '18-789012'
  },

  schoolEnrollment: {
    documentType: 'SchoolEnrollment',
    studentName: 'Tyler James Rodriguez',
    dateOfBirth: '2012-09-10',
    schoolName: 'Montgomery Blair High School',
    schoolAddress: '51 University Blvd E, Silver Spring, MD 20901',
    gradeLevel: '7th Grade',
    enrollmentDate: '2025-08-28',
    enrollmentStatus: 'Active',
    academicYear: '2025-2026',
    parentGuardian: 'Carmen Rodriguez',
    principalName: 'Dr. Michael Johnson',
    letterDate: '2025-09-05',
    schoolPhone: '(240) 740-5500'
  },

  custodyAgreement: {
    documentType: 'CustodyAgreement',
    caseNumber: 'FAM-2023-00456',
    courtName: 'Circuit Court for Baltimore County',
    custodialParent: 'Angela Foster',
    noncustodialParent: 'Brian Foster',
    children: [
      {
        name: 'Sophia Grace Foster',
        dateOfBirth: '2015-05-12',
        age: 10
      },
      {
        name: 'Noah Alexander Foster',
        dateOfBirth: '2017-11-08',
        age: 7
      }
    ],
    custodyType: 'Primary Physical Custody',
    visitationSchedule: 'Alternate weekends, Wednesday evenings, alternating holidays',
    effectiveDate: '2023-06-15',
    judgeName: 'Hon. Patricia Williams',
    orderDate: '2023-06-10',
    childSupport: 800.00,
    childSupportFrequency: 'Monthly'
  },

  marriageCertificate: {
    documentType: 'MarriageCertificate',
    spouse1Name: 'Alexander Benjamin Chen',
    spouse1DOB: '1988-02-14',
    spouse2Name: 'Olivia Grace Miller',
    spouse2DOB: '1990-06-30',
    marriageDate: '2015-10-17',
    marriageLocation: 'Annapolis, Maryland',
    county: 'Anne Arundel',
    officiant: 'Rev. Thomas Anderson',
    certificateNumber: 'MD-MC-2015-345678',
    issuedDate: '2015-10-20',
    registeredDate: '2015-10-19'
  }
};
