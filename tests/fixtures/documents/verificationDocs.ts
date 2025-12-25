/**
 * Verification Document Test Fixtures
 * 
 * Sample data for all document types used in benefits verification
 * Covers identity, income, assets, expenses, and residency verification
 */

export interface BankStatementData {
  documentType: 'bank_statement';
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  statementDate: string;
  accountBalance: number;
  accountType: 'checking' | 'savings' | 'money_market';
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;
    balance: number;
  }>;
}

export interface RentReceiptData {
  documentType: 'rent_receipt';
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  monthlyRent: number;
  paymentDate: string;
  receiptNumber: string;
  paymentMethod?: string;
}

export interface BirthCertificateData {
  documentType: 'birth_certificate';
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  certificateNumber: string;
  issuedDate: string;
  parentNames?: {
    mother: string;
    father: string;
  };
}

export interface UtilityBillData {
  documentType: 'utility_bill';
  accountHolder: string;
  serviceAddress: string;
  billingPeriod: string;
  dueDate: string;
  totalAmount: number;
  utilityType: 'electric' | 'gas' | 'water' | 'internet' | 'phone';
  accountNumber: string;
}

export interface PayStubData {
  documentType: 'pay_stub';
  employeeName: string;
  employerName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: number;
  netPay: number;
  deductions: {
    federalTax: number;
    stateTax: number;
    socialSecurity: number;
    medicare: number;
    other?: Array<{ name: string; amount: number }>;
  };
  yearToDateGross: number;
}

export interface SocialSecurityAwardLetterData {
  documentType: 'social_security_award_letter';
  recipientName: string;
  recipientSSN: string;
  benefitType: 'retirement' | 'disability' | 'SSI' | 'survivor';
  monthlyBenefit: number;
  effectiveDate: string;
  nextReviewDate?: string;
}

export interface DriverLicenseData {
  documentType: 'drivers_license';
  fullName: string;
  licenseNumber: string;
  dateOfBirth: string;
  address: string;
  issuedDate: string;
  expirationDate: string;
  state: string;
}

export interface LeaseAgreementData {
  documentType: 'lease_agreement';
  tenantNames: string[];
  landlordName: string;
  propertyAddress: string;
  monthlyRent: number;
  securityDeposit: number;
  leaseStartDate: string;
  leaseEndDate: string;
  utilitiesIncluded: string[];
}

export interface MedicalBillData {
  documentType: 'medical_bill';
  patientName: string;
  providerName: string;
  serviceDate: string;
  totalCharges: number;
  insurancePayment: number;
  patientResponsibility: number;
  dueDate: string;
  accountNumber: string;
}

export interface ChildcareBillData {
  documentType: 'childcare_bill';
  parentName: string;
  childName: string;
  providerName: string;
  billingPeriod: string;
  totalAmount: number;
  servicesProvided: string;
  dueDate: string;
}

export const verificationDocuments = {
  // Asset verification - bank statement
  bankStatement: {
    documentType: 'bank_statement' as const,
    accountHolder: 'Jane Doe',
    bankName: 'Maryland State Bank',
    accountNumber: '****1234',
    statementDate: '2024-09-30',
    accountBalance: 2500.00,
    accountType: 'checking' as const,
    transactions: [
      { date: '2024-09-01', description: 'Payroll Deposit', amount: 1500.00, balance: 2100.00 },
      { date: '2024-09-05', description: 'Rent Payment', amount: -800.00, balance: 1300.00 },
      { date: '2024-09-15', description: 'Payroll Deposit', amount: 1500.00, balance: 2800.00 },
      { date: '2024-09-20', description: 'Grocery Store', amount: -150.00, balance: 2650.00 },
      { date: '2024-09-25', description: 'Utilities', amount: -150.00, balance: 2500.00 },
    ],
  } as BankStatementData,
  
  // Expense verification - rent receipt
  rentReceipt: {
    documentType: 'rent_receipt' as const,
    tenantName: 'John Smith',
    landlordName: 'ABC Property Management',
    propertyAddress: '123 Main St, Baltimore, MD 21201',
    monthlyRent: 1200.00,
    paymentDate: '2024-10-01',
    receiptNumber: 'R-2024-10-001',
    paymentMethod: 'Check',
  } as RentReceiptData,
  
  // Identity verification - birth certificate
  birthCertificate: {
    documentType: 'birth_certificate' as const,
    fullName: 'Sarah Marie Johnson',
    dateOfBirth: '2015-03-15',
    placeOfBirth: 'Baltimore, Maryland',
    certificateNumber: 'MD-2015-012345',
    issuedDate: '2015-03-20',
    parentNames: {
      mother: 'Jennifer Anne Johnson',
      father: 'Michael Robert Johnson',
    },
  } as BirthCertificateData,

  // Residency verification - utility bill
  electricBill: {
    documentType: 'utility_bill' as const,
    accountHolder: 'Robert Williams',
    serviceAddress: '456 Park Ave, Baltimore, MD 21218',
    billingPeriod: '09/01/2024 - 09/30/2024',
    dueDate: '2024-10-15',
    totalAmount: 125.50,
    utilityType: 'electric' as const,
    accountNumber: '1234567890',
  } as UtilityBillData,

  // Income verification - pay stub
  payStub: {
    documentType: 'pay_stub' as const,
    employeeName: 'Emily Martinez',
    employerName: 'Johns Hopkins Hospital',
    payPeriodStart: '2024-09-16',
    payPeriodEnd: '2024-09-30',
    grossPay: 1750.00,
    netPay: 1285.50,
    deductions: {
      federalTax: 262.50,
      stateTax: 96.25,
      socialSecurity: 108.50,
      medicare: 25.38,
      other: [
        { name: '401k', amount: 87.50 },
        { name: 'Health Insurance', amount: 75.00 },
      ],
    },
    yearToDateGross: 31500.00,
  } as PayStubData,

  // Disability/elderly verification - SSA award letter
  ssaAwardLetter: {
    documentType: 'social_security_award_letter' as const,
    recipientName: 'Margaret Thompson',
    recipientSSN: '***-**-4567',
    benefitType: 'SSI' as const,
    monthlyBenefit: 914.00,
    effectiveDate: '2024-01-01',
    nextReviewDate: '2025-12-31',
  } as SocialSecurityAwardLetterData,

  // Identity verification - driver's license
  driversLicense: {
    documentType: 'drivers_license' as const,
    fullName: 'David Lee Anderson',
    licenseNumber: 'M-123-456-789-012',
    dateOfBirth: '1985-07-22',
    address: '789 Oak Street, Baltimore, MD 21224',
    issuedDate: '2020-08-15',
    expirationDate: '2028-07-22',
    state: 'MD',
  } as DriverLicenseData,

  // Housing verification - lease agreement
  leaseAgreement: {
    documentType: 'lease_agreement' as const,
    tenantNames: ['Carlos Rodriguez', 'Maria Rodriguez'],
    landlordName: 'Green Valley Properties LLC',
    propertyAddress: '234 Elm Street, Baltimore, MD 21201',
    monthlyRent: 1400.00,
    securityDeposit: 1400.00,
    leaseStartDate: '2024-01-01',
    leaseEndDate: '2024-12-31',
    utilitiesIncluded: ['Water', 'Trash'],
  } as LeaseAgreementData,

  // Medical expense verification
  medicalBill: {
    documentType: 'medical_bill' as const,
    patientName: 'Helen Carter',
    providerName: 'University of Maryland Medical Center',
    serviceDate: '2024-08-15',
    totalCharges: 850.00,
    insurancePayment: 650.00,
    patientResponsibility: 200.00,
    dueDate: '2024-10-15',
    accountNumber: 'PT-2024-8901',
  } as MedicalBillData,

  // Childcare expense verification
  childcareBill: {
    documentType: 'childcare_bill' as const,
    parentName: 'Lisa Brown',
    childName: 'Emma Brown',
    providerName: 'Little Stars Daycare Center',
    billingPeriod: 'October 2024',
    totalAmount: 800.00,
    servicesProvided: 'Full-time daycare (Mon-Fri, 7am-6pm)',
    dueDate: '2024-10-05',
  } as ChildcareBillData,

  // Low balance checking account
  lowBalanceBankStatement: {
    documentType: 'bank_statement' as const,
    accountHolder: 'Thomas Wilson',
    bankName: 'PNC Bank',
    accountNumber: '****5678',
    statementDate: '2024-09-30',
    accountBalance: 150.00,
    accountType: 'checking' as const,
  } as BankStatementData,

  // Savings account (asset test)
  savingsAccount: {
    documentType: 'bank_statement' as const,
    accountHolder: 'Patricia Green',
    bankName: 'Bank of America',
    accountNumber: '****9012',
    statementDate: '2024-09-30',
    accountBalance: 3500.00,
    accountType: 'savings' as const,
  } as BankStatementData,

  // High utility bill (shelter deduction)
  highUtilityBill: {
    documentType: 'utility_bill' as const,
    accountHolder: 'James Peterson',
    serviceAddress: '567 Cherry Lane, Baltimore, MD 21229',
    billingPeriod: '09/01/2024 - 09/30/2024',
    dueDate: '2024-10-20',
    totalAmount: 275.00,
    utilityType: 'electric' as const,
    accountNumber: '9876543210',
  } as UtilityBillData,

  // Self-employment income verification
  selfEmploymentPayStub: {
    documentType: 'pay_stub' as const,
    employeeName: 'Rachel Kim',
    employerName: 'Self-Employed (Freelance Designer)',
    payPeriodStart: '2024-09-01',
    payPeriodEnd: '2024-09-30',
    grossPay: 2200.00,
    netPay: 1650.00,
    deductions: {
      federalTax: 330.00,
      stateTax: 121.00,
      socialSecurity: 136.40,
      medicare: 31.90,
    },
    yearToDateGross: 19800.00,
  } as PayStubData,

  // SSDI award letter
  ssdiAwardLetter: {
    documentType: 'social_security_award_letter' as const,
    recipientName: 'Michael Harris',
    recipientSSN: '***-**-7890',
    benefitType: 'disability' as const,
    monthlyBenefit: 1300.00,
    effectiveDate: '2023-06-01',
  } as SocialSecurityAwardLetterData,
};

export type VerificationDocumentType = 
  | BankStatementData
  | RentReceiptData
  | BirthCertificateData
  | UtilityBillData
  | PayStubData
  | SocialSecurityAwardLetterData
  | DriverLicenseData
  | LeaseAgreementData
  | MedicalBillData
  | ChildcareBillData;
