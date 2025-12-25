/**
 * Work Requirements and Employment Document Fixtures
 * 
 * Test data for work requirement documents including:
 * - Employment verification letters
 * - Unemployment benefit letters
 * - Training program enrollment
 */

export const employmentVerifications = {
  standard: {
    documentType: 'EmploymentVerification',
    employeeName: 'Brandon Cooper',
    employeeSSN: '***-**-7890',
    employerName: 'TechCorp Solutions Inc.',
    employerAddress: '3000 Corporate Drive, Baltimore, MD 21244',
    employerEIN: '**-***5678',
    positionTitle: 'Customer Service Representative',
    employmentStartDate: '2024-03-15',
    employmentStatus: 'Active',
    hoursPerWeek: 40,
    hourlyWage: 18.50,
    payFrequency: 'Bi-weekly',
    supervisorName: 'Linda Martinez',
    supervisorTitle: 'Customer Service Manager',
    supervisorPhone: '(410) 555-0123',
    letterDate: '2025-09-20',
    hrContactEmail: 'hr@techcorp.com'
  },

  partTime: {
    documentType: 'EmploymentVerification',
    employeeName: 'Nicole Peterson',
    employeeSSN: '***-**-2345',
    employerName: 'Riverside Retail Store',
    employerAddress: '750 Shopping Center Way, Columbia, MD 21044',
    employerEIN: '**-***9012',
    positionTitle: 'Sales Associate',
    employmentStartDate: '2025-06-01',
    employmentStatus: 'Active',
    hoursPerWeek: 25,
    hourlyWage: 16.00,
    payFrequency: 'Weekly',
    supervisorName: 'Mark Johnson',
    supervisorTitle: 'Store Manager',
    supervisorPhone: '(410) 555-0456',
    letterDate: '2025-09-22',
    hrContactEmail: 'hr@riversideretail.com'
  },

  unemployment: {
    documentType: 'UnemploymentBenefits',
    claimantName: 'Gregory Phillips',
    claimantSSN: '***-**-3456',
    claimNumber: 'MD-UI-2025-123456',
    weeklyBenefit: 430.00,
    eligibilityStartDate: '2025-07-01',
    eligibilityEndDate: '2026-01-01',
    claimStatus: 'Active',
    lastEmployer: 'Manufacturing Solutions LLC',
    separationReason: 'Layoff - Lack of Work',
    letterDate: '2025-07-15',
    issuingOffice: 'Maryland Department of Labor',
    contactPhone: '1-800-827-4839',
    workSearchRequirement: 'Must apply to 3 jobs per week'
  },

  trainingProgram: {
    documentType: 'TrainingProgram',
    participantName: 'Samantha Hayes',
    participantSSN: '***-**-4567',
    programName: 'Certified Nursing Assistant (CNA) Training',
    programProvider: 'Maryland Healthcare Training Institute',
    providerAddress: '1200 Education Boulevard, Rockville, MD 20850',
    enrollmentDate: '2025-08-01',
    expectedCompletionDate: '2025-12-15',
    programStatus: 'Active - In Good Standing',
    hoursPerWeek: 20,
    totalProgramHours: 360,
    hoursCompleted: 120,
    attendanceRate: '98%',
    instructorName: 'Janet Wilson, RN',
    certificationExpected: 'Maryland State CNA License',
    letterDate: '2025-09-18',
    contactPhone: '(301) 555-0789'
  }
};
