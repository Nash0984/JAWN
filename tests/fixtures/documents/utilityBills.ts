/**
 * Utility Bills and Expense Verification Document Fixtures
 * 
 * Test data for expense verification documents including:
 * - Utility bills (electric, gas, water)
 * - Rent receipts
 * - Mortgage statements
 * - Medical bills
 * - Childcare invoices
 */

export const utilityBills = {
  electricBill: {
    documentType: 'UtilityBill',
    accountHolder: 'Jennifer Martinez',
    serviceAddress: '321 Pine Street, Baltimore, MD 21218',
    utilityType: 'Electric',
    provider: 'Baltimore Gas & Electric (BGE)',
    accountNumber: 'BGE-987654',
    billingPeriod: '09/01/2025 - 09/30/2025',
    servicePeriodStart: '2025-09-01',
    servicePeriodEnd: '2025-09-30',
    amountDue: 125.50,
    dueDate: '2025-10-15',
    usageKWh: 850,
    previousBalance: 0.00
  },

  gasBill: {
    documentType: 'UtilityBill',
    accountHolder: 'Thomas Anderson',
    serviceAddress: '555 Cedar Lane, Annapolis, MD 21401',
    utilityType: 'Gas',
    provider: 'Washington Gas',
    accountNumber: 'WG-456789',
    billingPeriod: '09/01/2025 - 09/30/2025',
    servicePeriodStart: '2025-09-01',
    servicePeriodEnd: '2025-09-30',
    amountDue: 45.00,
    dueDate: '2025-10-18',
    usageTherms: 15,
    previousBalance: 0.00
  },

  waterBill: {
    documentType: 'UtilityBill',
    accountHolder: 'Patricia Thompson',
    serviceAddress: '777 Maple Drive, Frederick, MD 21701',
    utilityType: 'Water',
    provider: 'Frederick Water Department',
    accountNumber: 'FWD-123456',
    billingPeriod: '09/01/2025 - 09/30/2025',
    servicePeriodStart: '2025-09-01',
    servicePeriodEnd: '2025-09-30',
    amountDue: 65.00,
    dueDate: '2025-10-20',
    usageGallons: 5000,
    sewerCharge: 35.00
  },

  rentReceipt: {
    documentType: 'RentReceipt',
    landlordName: 'James Property Management',
    landlordAddress: '100 Business Blvd, Bethesda, MD 20814',
    tenantName: 'Lisa Garcia',
    propertyAddress: '234 Oak Street, Apt 2B, Silver Spring, MD 20901',
    rentAmount: 1200.00,
    period: 'Monthly',
    paymentDate: '2025-09-01',
    paymentMethod: 'Check',
    receiptNumber: 'RENT-2025-09-001',
    monthCovered: 'September 2025'
  },

  mortgageStatement: {
    documentType: 'MortgageStatement',
    lender: 'Wells Fargo Home Mortgage',
    lenderAddress: '1000 Bank Plaza, Baltimore, MD 21202',
    borrower: 'Christopher Lee',
    propertyAddress: '888 Willow Court, Columbia, MD 21044',
    loanNumber: 'WF-MORT-789012',
    statementDate: '2025-09-30',
    monthlyPayment: 1850.00,
    principalBalance: 285000.00,
    interestRate: 3.75,
    escrowBalance: 4500.00,
    breakdown: {
      principal: 650.00,
      interest: 891.00,
      escrow: 309.00
    },
    nextDueDate: '2025-11-01'
  },

  medicalBill: {
    documentType: 'MedicalBill',
    patientName: 'Dorothy Miller',
    patientDOB: '1955-04-12',
    patientAccountNumber: 'PT-456789',
    providerName: 'Johns Hopkins Hospital',
    providerAddress: '1800 Orleans Street, Baltimore, MD 21287',
    serviceDate: '2025-08-15',
    dateOfBill: '2025-09-01',
    diagnosis: 'Annual Physical Exam',
    totalCharges: 450.00,
    insurancePayment: 360.00,
    patientResponsibility: 90.00,
    amountOwed: 90.00,
    dueDate: '2025-10-01'
  },

  childcareInvoice: {
    documentType: 'ChildcareInvoice',
    providerName: 'Little Stars Daycare',
    providerAddress: '500 Kids Way, Rockville, MD 20852',
    providerLicense: 'MD-CDC-12345',
    childName: 'Emma Rodriguez',
    parentName: 'Maria Rodriguez',
    billingPeriodStart: '2025-09-01',
    billingPeriodEnd: '2025-09-30',
    daysAttended: 20,
    dailyRate: 50.00,
    totalCost: 1000.00,
    invoiceNumber: 'LSC-2025-09-123',
    invoiceDate: '2025-09-30',
    dueDate: '2025-10-05'
  }
};
