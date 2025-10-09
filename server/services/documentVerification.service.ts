import { analyzeImageWithGemini } from "./gemini.service";

// Type definitions for extracted data based on document type
export interface RentReceiptData {
  amount: number | null;
  date: string | null;
  landlordName: string | null;
  landlordAddress: string | null;
  tenantName: string | null;
  propertyAddress: string | null;
  receiptNumber: string | null;
}

export interface UtilityBillData {
  utilityType: string | null; // electric, gas, water, etc.
  amount: number | null;
  dueDate: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  accountNumber: string | null;
  serviceAddress: string | null;
  providerName: string | null;
}

export interface PayStubData {
  employerName: string | null;
  employeeNumber: string | null;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  payDate: string | null;
  grossPay: number | null;
  netPay: number | null;
  yearToDateGross: number | null;
  deductions: Array<{ type: string; amount: number }>;
}

export interface BankStatementData {
  bankName: string | null;
  accountNumber: string | null;
  statementDate: string | null;
  beginningBalance: number | null;
  endingBalance: number | null;
  accountHolder: string | null;
}

export interface VerificationResult {
  extractedData: any;
  confidenceScore: number;
  warnings: string[];
  errors: string[];
  rawResponse: string;
}

/**
 * Analyze a rent receipt and extract structured data
 */
export async function analyzeRentReceipt(base64Image: string): Promise<VerificationResult> {
  const prompt = `Analyze this rent receipt and extract the following information in JSON format:
{
  "amount": <number or null>,
  "date": "<YYYY-MM-DD format or null>",
  "landlordName": "<string or null>",
  "landlordAddress": "<string or null>",
  "tenantName": "<string or null>",
  "propertyAddress": "<string or null>",
  "receiptNumber": "<string or null>"
}

Important:
- Extract only what is clearly visible in the document
- Use null for any missing or unclear information
- For amount, extract only the numeric value (no currency symbols)
- For dates, convert to YYYY-MM-DD format
- Be conservative - if unsure, use null

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await analyzeImageWithGemini(base64Image, prompt);
    const extractedData = JSON.parse(response);
    
    const { warnings, errors, confidenceScore } = validateRentReceipt(extractedData);
    
    return {
      extractedData,
      confidenceScore,
      warnings,
      errors,
      rawResponse: response
    };
  } catch (error) {
    return {
      extractedData: null,
      confidenceScore: 0,
      warnings: [],
      errors: [`Failed to analyze receipt: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rawResponse: ''
    };
  }
}

/**
 * Analyze a utility bill and extract structured data
 */
export async function analyzeUtilityBill(base64Image: string): Promise<VerificationResult> {
  const prompt = `Analyze this utility bill and extract the following information in JSON format:
{
  "utilityType": "<electric|gas|water|internet|phone or null>",
  "amount": <number or null>,
  "dueDate": "<YYYY-MM-DD format or null>",
  "billingPeriodStart": "<YYYY-MM-DD format or null>",
  "billingPeriodEnd": "<YYYY-MM-DD format or null>",
  "accountNumber": "<string or null>",
  "serviceAddress": "<string or null>",
  "providerName": "<string or null>"
}

Important:
- Extract only what is clearly visible
- Use null for missing/unclear information
- For amount, extract the total amount due (numeric value only)
- For dates, convert to YYYY-MM-DD format
- Identify the utility type based on provider name and bill content

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await analyzeImageWithGemini(base64Image, prompt);
    const extractedData = JSON.parse(response);
    
    const { warnings, errors, confidenceScore } = validateUtilityBill(extractedData);
    
    return {
      extractedData,
      confidenceScore,
      warnings,
      errors,
      rawResponse: response
    };
  } catch (error) {
    return {
      extractedData: null,
      confidenceScore: 0,
      warnings: [],
      errors: [`Failed to analyze utility bill: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rawResponse: ''
    };
  }
}

/**
 * Analyze a pay stub and extract structured data
 */
export async function analyzePayStub(base64Image: string): Promise<VerificationResult> {
  const prompt = `Analyze this pay stub and extract the following information in JSON format:
{
  "employerName": "<string or null>",
  "employeeNumber": "<string or null>",
  "payPeriodStart": "<YYYY-MM-DD format or null>",
  "payPeriodEnd": "<YYYY-MM-DD format or null>",
  "payDate": "<YYYY-MM-DD format or null>",
  "grossPay": <number or null>,
  "netPay": <number or null>,
  "yearToDateGross": <number or null>,
  "deductions": [
    { "type": "<deduction name>", "amount": <number> }
  ]
}

Important:
- Extract only clearly visible information
- Use null for missing/unclear data
- For amounts, extract numeric values only (no currency symbols)
- For dates, convert to YYYY-MM-DD format
- Include all deductions shown (taxes, insurance, retirement, etc.)

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await analyzeImageWithGemini(base64Image, prompt);
    const extractedData = JSON.parse(response);
    
    const { warnings, errors, confidenceScore } = validatePayStub(extractedData);
    
    return {
      extractedData,
      confidenceScore,
      warnings,
      errors,
      rawResponse: response
    };
  } catch (error) {
    return {
      extractedData: null,
      confidenceScore: 0,
      warnings: [],
      errors: [`Failed to analyze pay stub: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rawResponse: ''
    };
  }
}

/**
 * Analyze a bank statement and extract structured data
 */
export async function analyzeBankStatement(base64Image: string): Promise<VerificationResult> {
  const prompt = `Analyze this bank statement and extract the following information in JSON format:
{
  "bankName": "<string or null>",
  "accountNumber": "<last 4 digits only, string or null>",
  "statementDate": "<YYYY-MM-DD format or null>",
  "beginningBalance": <number or null>,
  "endingBalance": <number or null>,
  "accountHolder": "<string or null>"
}

Important:
- Extract only clearly visible information
- For account number, extract only the last 4 digits for security
- Use null for missing/unclear data
- For amounts, extract numeric values only
- For dates, convert to YYYY-MM-DD format

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await analyzeImageWithGemini(base64Image, prompt);
    const extractedData = JSON.parse(response);
    
    const { warnings, errors, confidenceScore } = validateBankStatement(extractedData);
    
    return {
      extractedData,
      confidenceScore,
      warnings,
      errors,
      rawResponse: response
    };
  } catch (error) {
    return {
      extractedData: null,
      confidenceScore: 0,
      warnings: [],
      errors: [`Failed to analyze bank statement: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rawResponse: ''
    };
  }
}

// Validation functions
function validateRentReceipt(data: RentReceiptData): { warnings: string[]; errors: string[]; confidenceScore: number } {
  const warnings: string[] = [];
  const errors: string[] = [];
  let score = 1.0;

  // Critical fields
  if (!data.amount) {
    errors.push("Amount is missing - this is required for verification");
    score -= 0.3;
  } else if (data.amount < 0) {
    errors.push("Amount cannot be negative");
    score -= 0.2;
  }

  if (!data.date) {
    warnings.push("Date is missing - navigator should verify the rent period");
    score -= 0.15;
  }

  // Important fields
  if (!data.landlordName && !data.propertyAddress) {
    warnings.push("Neither landlord name nor property address found - manual verification recommended");
    score -= 0.15;
  }

  if (!data.tenantName) {
    warnings.push("Tenant name not found - verify this matches the client");
    score -= 0.1;
  }

  return { warnings, errors, confidenceScore: Math.max(0, score) };
}

function validateUtilityBill(data: UtilityBillData): { warnings: string[]; errors: string[]; confidenceScore: number } {
  const warnings: string[] = [];
  const errors: string[] = [];
  let score = 1.0;

  if (!data.amount) {
    errors.push("Bill amount is missing");
    score -= 0.3;
  }

  if (!data.serviceAddress) {
    warnings.push("Service address not found - verify this matches client's residence");
    score -= 0.2;
  }

  if (!data.utilityType) {
    warnings.push("Utility type could not be determined");
    score -= 0.1;
  }

  if (!data.dueDate && !data.billingPeriodEnd) {
    warnings.push("No date information found - verify bill is current");
    score -= 0.15;
  }

  return { warnings, errors, confidenceScore: Math.max(0, score) };
}

function validatePayStub(data: PayStubData): { warnings: string[]; errors: string[]; confidenceScore: number } {
  const warnings: string[] = [];
  const errors: string[] = [];
  let score = 1.0;

  if (!data.grossPay) {
    errors.push("Gross pay is missing");
    score -= 0.3;
  }

  if (!data.employerName) {
    warnings.push("Employer name not found");
    score -= 0.2;
  }

  if (!data.payDate && !data.payPeriodEnd) {
    warnings.push("No pay date information found");
    score -= 0.15;
  }

  if (data.grossPay && data.netPay && data.netPay > data.grossPay) {
    errors.push("Net pay cannot exceed gross pay - possible extraction error");
    score -= 0.3;
  }

  return { warnings, errors, confidenceScore: Math.max(0, score) };
}

function validateBankStatement(data: BankStatementData): { warnings: string[]; errors: string[]; confidenceScore: number } {
  const warnings: string[] = [];
  const errors: string[] = [];
  let score = 1.0;

  if (!data.endingBalance) {
    errors.push("Ending balance is missing");
    score -= 0.3;
  }

  if (!data.accountHolder) {
    warnings.push("Account holder name not found - verify this matches the client");
    score -= 0.2;
  }

  if (!data.statementDate) {
    warnings.push("Statement date not found - verify document is current");
    score -= 0.15;
  }

  return { warnings, errors, confidenceScore: Math.max(0, score) };
}

/**
 * Main entry point for document verification
 * Determines document type and calls appropriate analyzer
 */
export async function verifyDocument(
  base64Image: string,
  documentType: string
): Promise<VerificationResult> {
  switch (documentType) {
    case 'rent_receipt':
      return analyzeRentReceipt(base64Image);
    case 'utility_bill':
      return analyzeUtilityBill(base64Image);
    case 'pay_stub':
      return analyzePayStub(base64Image);
    case 'bank_statement':
      return analyzeBankStatement(base64Image);
    default:
      return {
        extractedData: null,
        confidenceScore: 0,
        warnings: [],
        errors: [`Unsupported document type: ${documentType}`],
        rawResponse: ''
      };
  }
}
