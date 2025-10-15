/**
 * Bank Statement and Asset Verification Document Fixtures
 * 
 * Test data for asset verification documents including:
 * - Bank statements (checking, savings)
 * - Investment statements (401k, IRA, brokerage)
 * - Property deeds
 * - Vehicle titles
 */

export const bankStatements = {
  checkingAccount: {
    documentType: 'BankStatement',
    accountHolder: 'John Doe',
    accountNumber: '****1234',
    accountType: 'Checking',
    currentBalance: 2500.00,
    availableBalance: 2450.00,
    statementPeriodStart: '2025-09-01',
    statementPeriodEnd: '2025-09-30',
    bankName: 'First National Bank',
    address: '123 Main St, Baltimore, MD 21201',
    transactions: [
      { date: '2025-09-15', description: 'Payroll Deposit', amount: 2400.00 },
      { date: '2025-09-20', description: 'Grocery Store', amount: -150.00 },
      { date: '2025-09-25', description: 'Rent Payment', amount: -1200.00 }
    ]
  },

  savingsAccount: {
    documentType: 'BankStatement',
    accountHolder: 'Jane Smith',
    accountNumber: '****5678',
    accountType: 'Savings',
    currentBalance: 5000.00,
    availableBalance: 5000.00,
    statementPeriodStart: '2025-09-01',
    statementPeriodEnd: '2025-09-30',
    bankName: 'Maryland Community Bank',
    address: '456 Oak Ave, Silver Spring, MD 20910',
    interestEarned: 12.50
  },

  investmentAccount: {
    documentType: 'InvestmentStatement',
    accountHolder: 'Robert Johnson',
    accountNumber: '****9012',
    accountType: '401k',
    totalValue: 75000.00,
    statementDate: '2025-09-30',
    firmName: 'Fidelity Investments',
    holdings: [
      { description: 'S&P 500 Index Fund', value: 50000.00, shares: 125.5 },
      { description: 'Bond Fund', value: 20000.00, shares: 2000 },
      { description: 'International Stock Fund', value: 5000.00, shares: 250 }
    ],
    contributions: {
      employeeYTD: 6000.00,
      employerYTD: 3000.00
    }
  },

  iraAccount: {
    documentType: 'InvestmentStatement',
    accountHolder: 'Mary Williams',
    accountNumber: '****3456',
    accountType: 'Traditional IRA',
    totalValue: 45000.00,
    statementDate: '2025-09-30',
    firmName: 'Vanguard',
    holdings: [
      { description: 'Total Stock Market Index', value: 35000.00, shares: 87.5 },
      { description: 'Total Bond Market Index', value: 10000.00, shares: 1000 }
    ]
  },

  propertyDeed: {
    documentType: 'PropertyDeed',
    ownerName: 'Michael Brown',
    propertyAddress: '789 Elm Street, Rockville, MD 20850',
    assessedValue: 350000.00,
    propertyType: 'Residential',
    landArea: '0.25 acres',
    deedDate: '2020-06-15',
    county: 'Montgomery',
    parcelNumber: 'MD-MONT-12345',
    taxYear: 2025
  },

  vehicleTitle: {
    documentType: 'VehicleTitle',
    ownerName: 'Sarah Davis',
    vin: '1HGBH41JXMN109186',
    make: 'Honda',
    model: 'Accord',
    year: 2020,
    titleNumber: 'MD-VEH-789012',
    issueDate: '2020-03-10',
    fairMarketValue: 18000.00,
    lienHolder: null,
    state: 'MD'
  },

  vehicleWithLien: {
    documentType: 'VehicleTitle',
    ownerName: 'David Wilson',
    vin: '2T1BURHE5FC123456',
    make: 'Toyota',
    model: 'Corolla',
    year: 2023,
    titleNumber: 'MD-VEH-345678',
    issueDate: '2023-01-15',
    fairMarketValue: 25000.00,
    lienHolder: 'Capital One Auto Finance',
    outstandingLoan: 15000.00,
    state: 'MD'
  }
};
