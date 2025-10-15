/**
 * Synthetic Pay Stub Test Data
 * 
 * Realistic pay stub test data for document extraction testing
 * Based on 2024 Maryland employees with various pay frequencies
 */

export interface PayStubData {
  documentType: 'PayStub';
  employerName: string;
  employerEIN: string;
  employeeName: string;
  employeeSSN: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  payFrequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  
  // Current period earnings
  grossPay: number;
  netPay: number;
  
  // Year-to-date totals
  yearToDateGross: number;
  yearToDateNet: number;
  
  // Tax withholdings (current period)
  federalWithholding: number;
  stateWithholding: number;
  localWithholding?: number;
  socialSecurityWithholding: number;
  medicareWithholding: number;
  
  // Deductions (current period)
  healthInsurance?: number;
  dentalInsurance?: number;
  retirement401k?: number;
  otherDeductions?: number;
  
  // Year-to-date tax withholdings
  ytdFederalWithholding: number;
  ytdStateWithholding: number;
  ytdLocalWithholding?: number;
  ytdSocialSecurityWithholding: number;
  ytdMedicareWithholding: number;
  
  // Year-to-date deductions
  ytdHealthInsurance?: number;
  ytdDentalInsurance?: number;
  ytdRetirement401k?: number;
  ytdOtherDeductions?: number;
}

export const payStubSamples: Record<string, PayStubData> = {
  biweekly_2024: {
    documentType: 'PayStub',
    employerName: 'Maryland Tech Solutions Inc',
    employerEIN: '52-1234567',
    employeeName: 'John A. Smith',
    employeeSSN: '123-45-6789',
    payPeriodStart: '2024-01-01',
    payPeriodEnd: '2024-01-15',
    payDate: '2024-01-19',
    payFrequency: 'biweekly',
    
    grossPay: 3461.54, // $90,000/year ÷ 26 periods
    netPay: 2261.12,
    
    yearToDateGross: 3461.54,
    yearToDateNet: 2261.12,
    
    federalWithholding: 415.38,
    stateWithholding: 155.77,
    localWithholding: 110.77,
    socialSecurityWithholding: 214.62, // 6.2%
    medicareWithholding: 50.19, // 1.45%
    
    healthInsurance: 150.00,
    dentalInsurance: 25.00,
    retirement401k: 207.69, // 6% contribution
    otherDeductions: 36.00,
    
    ytdFederalWithholding: 415.38,
    ytdStateWithholding: 155.77,
    ytdLocalWithholding: 110.77,
    ytdSocialSecurityWithholding: 214.62,
    ytdMedicareWithholding: 50.19,
    
    ytdHealthInsurance: 150.00,
    ytdDentalInsurance: 25.00,
    ytdRetirement401k: 207.69,
    ytdOtherDeductions: 36.00,
  },

  weekly_hourly_2024: {
    documentType: 'PayStub',
    employerName: 'Amazon Fulfillment Services Inc',
    employerEIN: '91-1646860',
    employeeName: 'Robert K. Williams',
    employeeSSN: '333-44-5555',
    payPeriodStart: '2024-01-08',
    payPeriodEnd: '2024-01-14',
    payDate: '2024-01-19',
    payFrequency: 'weekly',
    
    grossPay: 800.00, // $20/hour × 40 hours
    netPay: 598.40,
    
    yearToDateGross: 1600.00, // 2 weeks
    yearToDateNet: 1196.80,
    
    federalWithholding: 96.00,
    stateWithholding: 36.00,
    localWithholding: 24.00,
    socialSecurityWithholding: 49.60,
    medicareWithholding: 11.60,
    
    healthInsurance: 20.00,
    retirement401k: 0,
    
    ytdFederalWithholding: 192.00,
    ytdStateWithholding: 72.00,
    ytdLocalWithholding: 48.00,
    ytdSocialSecurityWithholding: 99.20,
    ytdMedicareWithholding: 23.20,
    
    ytdHealthInsurance: 40.00,
  },

  semimonthly_2024: {
    documentType: 'PayStub',
    employerName: 'Johns Hopkins University',
    employerEIN: '52-0595110',
    employeeName: 'Emily R. Johnson',
    employeeSSN: '987-65-4321',
    payPeriodStart: '2024-01-01',
    payPeriodEnd: '2024-01-15',
    payDate: '2024-01-20',
    payFrequency: 'semimonthly',
    
    grossPay: 5208.33, // $125,000/year ÷ 24 periods
    netPay: 3250.45,
    
    yearToDateGross: 5208.33,
    yearToDateNet: 3250.45,
    
    federalWithholding: 1250.00,
    stateWithholding: 286.46,
    localWithholding: 52.08,
    socialSecurityWithholding: 322.92,
    medicareWithholding: 75.52,
    
    healthInsurance: 200.00,
    dentalInsurance: 35.00,
    retirement401k: 781.25, // 15% contribution
    otherDeductions: 154.65, // Life insurance, etc.
    
    ytdFederalWithholding: 1250.00,
    ytdStateWithholding: 286.46,
    ytdLocalWithholding: 52.08,
    ytdSocialSecurityWithholding: 322.92,
    ytdMedicareWithholding: 75.52,
    
    ytdHealthInsurance: 200.00,
    ytdDentalInsurance: 35.00,
    ytdRetirement401k: 781.25,
    ytdOtherDeductions: 154.65,
  },

  monthly_stateWorker_2024: {
    documentType: 'PayStub',
    employerName: 'State of Maryland',
    employerEIN: '52-6001130',
    employeeName: 'Jennifer A. Brown',
    employeeSSN: '666-77-8888',
    payPeriodStart: '2024-01-01',
    payPeriodEnd: '2024-01-31',
    payDate: '2024-02-01',
    payFrequency: 'monthly',
    
    grossPay: 5166.67, // $62,000/year ÷ 12 months
    netPay: 3425.32,
    
    yearToDateGross: 5166.67,
    yearToDateNet: 3425.32,
    
    federalWithholding: 620.00,
    stateWithholding: 284.17,
    localWithholding: 51.67,
    socialSecurityWithholding: 320.33,
    medicareWithholding: 74.92,
    
    healthInsurance: 250.00,
    dentalInsurance: 40.00,
    retirement401k: 775.00, // State pension (15%)
    otherDeductions: 125.26,
    
    ytdFederalWithholding: 620.00,
    ytdStateWithholding: 284.17,
    ytdLocalWithholding: 51.67,
    ytdSocialSecurityWithholding: 320.33,
    ytdMedicareWithholding: 74.92,
    
    ytdHealthInsurance: 250.00,
    ytdDentalInsurance: 40.00,
    ytdRetirement401k: 775.00,
    ytdOtherDeductions: 125.26,
  },

  withDeductions_2024: {
    documentType: 'PayStub',
    employerName: 'Maryland Tech Solutions Inc',
    employerEIN: '52-1234567',
    employeeName: 'Michael T. Davis',
    employeeSSN: '555-12-3456',
    payPeriodStart: '2024-06-01',
    payPeriodEnd: '2024-06-15',
    payDate: '2024-06-19',
    payFrequency: 'biweekly',
    
    grossPay: 3461.54,
    netPay: 2106.85,
    
    yearToDateGross: 41538.48, // 12 pay periods YTD
    yearToDateNet: 25282.20,
    
    federalWithholding: 415.38,
    stateWithholding: 155.77,
    localWithholding: 110.77,
    socialSecurityWithholding: 214.62,
    medicareWithholding: 50.19,
    
    healthInsurance: 150.00,
    dentalInsurance: 25.00,
    retirement401k: 207.69,
    otherDeductions: 125.27, // HSA, life insurance, etc.
    
    ytdFederalWithholding: 4984.56,
    ytdStateWithholding: 1869.24,
    ytdLocalWithholding: 1329.24,
    ytdSocialSecurityWithholding: 2575.44,
    ytdMedicareWithholding: 602.28,
    
    ytdHealthInsurance: 1800.00,
    ytdDentalInsurance: 300.00,
    ytdRetirement401k: 2492.28,
    ytdOtherDeductions: 1503.24,
  },

  partTime_2024: {
    documentType: 'PayStub',
    employerName: 'University of Maryland Medical System',
    employerEIN: '52-1452474',
    employeeName: 'Sarah L. Martinez',
    employeeSSN: '222-33-4444',
    payPeriodStart: '2024-01-01',
    payPeriodEnd: '2024-01-15',
    payDate: '2024-01-19',
    payFrequency: 'biweekly',
    
    grossPay: 692.31, // $18,000/year ÷ 26 periods (part-time)
    netPay: 567.23,
    
    yearToDateGross: 692.31,
    yearToDateNet: 567.23,
    
    federalWithholding: 41.54,
    stateWithholding: 31.15,
    localWithholding: 6.92,
    socialSecurityWithholding: 42.92,
    medicareWithholding: 10.04,
    
    healthInsurance: 0, // No benefits
    retirement401k: 0,
    
    ytdFederalWithholding: 41.54,
    ytdStateWithholding: 31.15,
    ytdLocalWithholding: 6.92,
    ytdSocialSecurityWithholding: 42.92,
    ytdMedicareWithholding: 10.04,
  },

  lowQuality: {
    documentType: 'PayStub',
    employerName: 'Unknown Employer',
    employerEIN: 'XX-XXXXXXX',
    employeeName: 'Unknown Employee',
    employeeSSN: 'XXX-XX-XXXX',
    payPeriodStart: '2024-01-01',
    payPeriodEnd: '2024-01-15',
    payDate: '2024-01-19',
    payFrequency: 'biweekly',
    
    grossPay: 0,
    netPay: 0,
    
    yearToDateGross: 0,
    yearToDateNet: 0,
    
    federalWithholding: 0,
    stateWithholding: 0,
    socialSecurityWithholding: 0,
    medicareWithholding: 0,
    
    ytdFederalWithholding: 0,
    ytdStateWithholding: 0,
    ytdSocialSecurityWithholding: 0,
    ytdMedicareWithholding: 0,
  },

  restaurantTipped_2024: {
    documentType: 'PayStub',
    employerName: 'Harbor East Restaurant Group LLC',
    employerEIN: '52-9876543',
    employeeName: 'Alex P. Taylor',
    employeeSSN: '444-55-6666',
    payPeriodStart: '2024-01-01',
    payPeriodEnd: '2024-01-15',
    payDate: '2024-01-19',
    payFrequency: 'biweekly',
    
    grossPay: 1096.15, // $600 wages + $496.15 reported tips
    netPay: 835.42,
    
    yearToDateGross: 1096.15,
    yearToDateNet: 835.42,
    
    federalWithholding: 131.54,
    stateWithholding: 49.32,
    localWithholding: 10.96,
    socialSecurityWithholding: 67.96,
    medicareWithholding: 15.89,
    
    healthInsurance: 25.00,
    retirement401k: 0,
    otherDeductions: 5.06,
    
    ytdFederalWithholding: 131.54,
    ytdStateWithholding: 49.32,
    ytdLocalWithholding: 10.96,
    ytdSocialSecurityWithholding: 67.96,
    ytdMedicareWithholding: 15.89,
    
    ytdHealthInsurance: 25.00,
    ytdOtherDeductions: 5.06,
  },
};

export type PayStubSamples = typeof payStubSamples;
