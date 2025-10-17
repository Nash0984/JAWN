import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import { storage as dbStorage } from "../storage";
import type { InsertTaxDocument } from "@shared/schema";

let gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
    }
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

const gcs = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || "";

export interface W2Data {
  taxYear: number;
  employerName: string;
  employerEIN: string;
  employerAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  employeeName: string;
  employeeSSN: string;
  employeeAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  box1_wages: number; // Wages, tips, other compensation
  box2_federalTaxWithheld: number;
  box3_socialSecurityWages: number;
  box4_socialSecurityTaxWithheld: number;
  box5_medicareWages: number;
  box6_medicareTaxWithheld: number;
  box7_socialSecurityTips: number;
  box8_allocatedTips: number;
  box10_dependentCareBenefits: number;
  box11_nonqualifiedPlans: number;
  box12_codes: Array<{ code: string; amount: number }>; // e.g., D (401k), DD (employer health)
  box13_statutoryEmployee: boolean;
  box13_retirementPlan: boolean;
  box13_thirdPartySickPay: boolean;
  box14_other: Array<{ description: string; amount: number }>;
  box15_stateEmployerNumber: string;
  box16_stateWages: number;
  box17_stateIncomeTax: number;
  box18_localWages: number;
  box19_localIncomeTax: number;
  box20_localityName: string;
}

export interface Form1099MISCData {
  taxYear: number;
  payerName: string;
  payerTIN: string;
  recipientName: string;
  recipientTIN: string;
  box1_rents: number;
  box2_royalties: number;
  box3_otherIncome: number;
  box4_federalTaxWithheld: number;
  box5_fishingBoatProceeds: number;
  box6_medicalHealthPayments: number;
  box7_nonemployeeCompensation: number; // Pre-2020
  box8_substitutePayments: number;
  box9_cropInsurance: number;
  box10_grossProceeds: number;
  box14_excessGoldenParachute: number;
  box16_stateTaxWithheld: number;
  box17_stateIncome: number;
  stateInfo: string;
}

export interface Form1099NECData {
  taxYear: number;
  payerName: string;
  payerTIN: string;
  recipientName: string;
  recipientTIN: string;
  box1_nonemployeeCompensation: number;
  box4_federalTaxWithheld: number;
  box5_stateTaxWithheld: number;
  box6_stateIncome: number;
  stateInfo: string;
}

export interface Form1095AData {
  taxYear: number;
  marketplaceName: string;
  marketplaceIdentifier: string;
  policyNumber: string;
  policyStartDate: string;
  policyEndDate: string;
  enrolledIndividuals: Array<{
    name: string;
    ssn: string;
    dateOfBirth: string;
    coverageStartDate: string;
    coverageEndDate: string;
  }>;
  monthlyPremiums: Array<{
    month: number;
    slcspPremium: number; // Second Lowest Cost Silver Plan
    enrolledPremium: number;
    advancePremiumTaxCredit: number;
  }>;
  annualTotals: {
    slcspTotal: number;
    enrolledTotal: number;
    aptcTotal: number;
  };
}

export interface Form1099INTData {
  taxYear: number;
  payerName: string;
  payerTIN: string;
  recipientName: string;
  recipientTIN: string;
  box1_interestIncome: number;
  box2_earlyWithdrawalPenalty: number;
  box3_interestOnUSBonds: number;
  box4_federalTaxWithheld: number;
  box5_investmentExpenses: number;
  box8_taxExemptInterest: number;
  box13_stateTaxWithheld: number;
  box14_stateIncome: number;
}

export interface Form1099DIVData {
  taxYear: number;
  payerName: string;
  payerTIN: string;
  recipientName: string;
  recipientTIN: string;
  box1a_ordinaryDividends: number;
  box1b_qualifiedDividends: number;
  box2a_capitalGainDistributions: number;
  box2b_unrecaptured1250Gain: number;
  box2c_section1202Gain: number;
  box2d_collectiblesGain: number;
  box3_nondividendDistributions: number;
  box4_federalTaxWithheld: number;
  box13_stateTaxWithheld: number;
  box14_stateIncome: number;
}

export interface Form1099RData {
  taxYear: number;
  payerName: string;
  payerTIN: string;
  recipientName: string;
  recipientTIN: string;
  box1_grossDistribution: number;
  box2a_taxableAmount: number;
  box2b_taxableAmountNotDetermined: boolean;
  box2b_totalDistribution: boolean;
  box3_capitalGain: number;
  box4_federalTaxWithheld: number;
  box5_employeeContributions: number;
  box7_distributionCode: string;
  box9a_yourPercentageOfTotal: number;
  box12_stateTaxWithheld: number;
  box13_stateIncome: number;
}

export class TaxDocumentExtractionService {
  /**
   * Extract W-2 form data from an uploaded document
   */
  async extractW2(documentId: string): Promise<{ data: W2Data; confidence: number }> {
    // Get document from database
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Download from GCS
    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();

    // Prepare image for Gemini Vision
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `You are a tax document extraction expert. Extract all data from this IRS Form W-2 (Wage and Tax Statement).

Return a JSON object with the following structure:
{
  "taxYear": number,
  "employerName": string,
  "employerEIN": string,
  "employerAddress": {
    "street": string,
    "city": string,
    "state": string,
    "zip": string
  },
  "employeeName": string,
  "employeeSSN": string (format: "XXX-XX-XXXX"),
  "employeeAddress": {
    "street": string,
    "city": string,
    "state": string,
    "zip": string
  },
  "box1_wages": number,
  "box2_federalTaxWithheld": number,
  "box3_socialSecurityWages": number,
  "box4_socialSecurityTaxWithheld": number,
  "box5_medicareWages": number,
  "box6_medicareTaxWithheld": number,
  "box7_socialSecurityTips": number,
  "box8_allocatedTips": number,
  "box10_dependentCareBenefits": number,
  "box11_nonqualifiedPlans": number,
  "box12_codes": [{ "code": string, "amount": number }],
  "box13_statutoryEmployee": boolean,
  "box13_retirementPlan": boolean,
  "box13_thirdPartySickPay": boolean,
  "box14_other": [{ "description": string, "amount": number }],
  "box15_stateEmployerNumber": string,
  "box16_stateWages": number,
  "box17_stateIncomeTax": number,
  "box18_localWages": number,
  "box19_localIncomeTax": number,
  "box20_localityName": string,
  "confidence": number (0-1, your confidence in the extraction accuracy)
}

Extract all fields precisely as they appear on the form. For empty boxes, use 0 for numbers, empty string for text, false for booleans, and empty array for arrays.`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    
    // Parse JSON response (Gemini often wraps in ```json```)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    // Validate we have content to parse
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract W-2 data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as W2Data, confidence };
  }

  /**
   * Extract 1099-MISC form data
   */
  async extract1099MISC(documentId: string): Promise<{ data: Form1099MISCData; confidence: number }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `Extract all data from this IRS Form 1099-MISC (Miscellaneous Information).

Return JSON with:
{
  "taxYear": number,
  "payerName": string,
  "payerTIN": string,
  "recipientName": string,
  "recipientTIN": string,
  "box1_rents": number,
  "box2_royalties": number,
  "box3_otherIncome": number,
  "box4_federalTaxWithheld": number,
  "box5_fishingBoatProceeds": number,
  "box6_medicalHealthPayments": number,
  "box7_nonemployeeCompensation": number,
  "box8_substitutePayments": number,
  "box9_cropInsurance": number,
  "box10_grossProceeds": number,
  "box14_excessGoldenParachute": number,
  "box16_stateTaxWithheld": number,
  "box17_stateIncome": number,
  "stateInfo": string,
  "confidence": number (0-1)
}`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    }

    // Validate we have content to parse
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract tax document data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as Form1099MISCData, confidence };
  }

  /**
   * Extract 1099-NEC form data (for non-employee compensation, post-2020)
   */
  async extract1099NEC(documentId: string): Promise<{ data: Form1099NECData; confidence: number }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `Extract all data from this IRS Form 1099-NEC (Nonemployee Compensation).

Return JSON with:
{
  "taxYear": number,
  "payerName": string,
  "payerTIN": string,
  "recipientName": string,
  "recipientTIN": string,
  "box1_nonemployeeCompensation": number,
  "box4_federalTaxWithheld": number,
  "box5_stateTaxWithheld": number,
  "box6_stateIncome": number,
  "stateInfo": string,
  "confidence": number (0-1)
}`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    }

    // Validate we have content to parse
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract tax document data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as Form1099NECData, confidence };
  }

  /**
   * Extract Form 1095-A (Health Insurance Marketplace Statement) for Premium Tax Credit
   */
  async extract1095A(documentId: string): Promise<{ data: Form1095AData; confidence: number }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `Extract all data from this IRS Form 1095-A (Health Insurance Marketplace Statement).

This form is used to calculate the Premium Tax Credit. Return JSON with:
{
  "taxYear": number,
  "marketplaceName": string,
  "marketplaceIdentifier": string,
  "policyNumber": string,
  "policyStartDate": string (YYYY-MM-DD),
  "policyEndDate": string (YYYY-MM-DD),
  "enrolledIndividuals": [{
    "name": string,
    "ssn": string,
    "dateOfBirth": string (YYYY-MM-DD),
    "coverageStartDate": string,
    "coverageEndDate": string
  }],
  "monthlyPremiums": [{
    "month": number (1-12),
    "slcspPremium": number,
    "enrolledPremium": number,
    "advancePremiumTaxCredit": number
  }],
  "annualTotals": {
    "slcspTotal": number,
    "enrolledTotal": number,
    "aptcTotal": number
  },
  "confidence": number (0-1)
}

SLCSP = Second Lowest Cost Silver Plan. Part III contains monthly amounts.`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    }

    // Validate we have content to parse
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract tax document data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as Form1095AData, confidence };
  }

  /**
   * Extract 1099-INT form data (Interest Income)
   */
  async extract1099INT(documentId: string): Promise<{ data: Form1099INTData; confidence: number }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `Extract all data from this IRS Form 1099-INT (Interest Income).

Return JSON with:
{
  "taxYear": number,
  "payerName": string,
  "payerTIN": string,
  "recipientName": string,
  "recipientTIN": string,
  "box1_interestIncome": number,
  "box2_earlyWithdrawalPenalty": number,
  "box3_interestOnUSBonds": number,
  "box4_federalTaxWithheld": number,
  "box5_investmentExpenses": number,
  "box8_taxExemptInterest": number,
  "box13_stateTaxWithheld": number,
  "box14_stateIncome": number,
  "confidence": number (0-1)
}`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract 1099-INT data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as Form1099INTData, confidence };
  }

  /**
   * Extract 1099-DIV form data (Dividends and Distributions)
   */
  async extract1099DIV(documentId: string): Promise<{ data: Form1099DIVData; confidence: number }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `Extract all data from this IRS Form 1099-DIV (Dividends and Distributions).

Return JSON with:
{
  "taxYear": number,
  "payerName": string,
  "payerTIN": string,
  "recipientName": string,
  "recipientTIN": string,
  "box1a_ordinaryDividends": number,
  "box1b_qualifiedDividends": number,
  "box2a_capitalGainDistributions": number,
  "box2b_unrecaptured1250Gain": number,
  "box2c_section1202Gain": number,
  "box2d_collectiblesGain": number,
  "box3_nondividendDistributions": number,
  "box4_federalTaxWithheld": number,
  "box13_stateTaxWithheld": number,
  "box14_stateIncome": number,
  "confidence": number (0-1)
}`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract 1099-DIV data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as Form1099DIVData, confidence };
  }

  /**
   * Extract 1099-R form data (Distributions From Pensions, Annuities, Retirement, etc.)
   */
  async extract1099R(documentId: string): Promise<{ data: Form1099RData; confidence: number }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const prompt = `Extract all data from this IRS Form 1099-R (Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc.).

Return JSON with:
{
  "taxYear": number,
  "payerName": string,
  "payerTIN": string,
  "recipientName": string,
  "recipientTIN": string,
  "box1_grossDistribution": number,
  "box2a_taxableAmount": number,
  "box2b_taxableAmountNotDetermined": boolean,
  "box2b_totalDistribution": boolean,
  "box3_capitalGain": number,
  "box4_federalTaxWithheld": number,
  "box5_employeeContributions": number,
  "box7_distributionCode": string,
  "box9a_yourPercentageOfTotal": number,
  "box12_stateTaxWithheld": number,
  "box13_stateIncome": number,
  "confidence": number (0-1)
}`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Gemini returned empty response - unable to extract 1099-R data');
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as Form1099RData, confidence };
  }

  /**
   * Auto-detect document type and extract appropriate data
   */
  async detectAndExtract(documentId: string): Promise<{
    documentType: string;
    data: W2Data | Form1099MISCData | Form1099NECData | Form1095AData | Form1099INTData | Form1099DIVData | Form1099RData;
    confidence: number;
  }> {
    const document = await dbStorage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // First, detect what type of tax form this is
    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const detectPrompt = `What type of IRS tax form is this? 
    
Possible types:
- w2 (Form W-2, Wage and Tax Statement)
- 1099-misc (Form 1099-MISC, Miscellaneous Information)
- 1099-nec (Form 1099-NEC, Nonemployee Compensation)
- 1099-int (Form 1099-INT, Interest Income)
- 1099-div (Form 1099-DIV, Dividends and Distributions)
- 1099-r (Form 1099-R, Distributions From Pensions, Annuities, Retirement)
- 1095-a (Form 1095-A, Health Insurance Marketplace Statement)
- other

Return ONLY the form type identifier (lowercase, e.g., "w2" or "1099-int").`;

    const ai = getGemini();
    const detectResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: detectPrompt },
        { inlineData: { mimeType, data: base64Image } },
      ],
    });

    const detectedType = (detectResult.text || "").trim().toLowerCase();

    // Extract based on detected type
    let result: { data: any; confidence: number };
    let documentType: string;

    if (detectedType.includes('w2') || detectedType.includes('w-2')) {
      result = await this.extractW2(documentId);
      documentType = 'w2';
    } else if (detectedType.includes('1099-nec') || detectedType.includes('1099nec')) {
      result = await this.extract1099NEC(documentId);
      documentType = '1099-nec';
    } else if (detectedType.includes('1099-misc') || detectedType.includes('1099misc')) {
      result = await this.extract1099MISC(documentId);
      documentType = '1099-misc';
    } else if (detectedType.includes('1099-int') || detectedType.includes('1099int')) {
      result = await this.extract1099INT(documentId);
      documentType = '1099-int';
    } else if (detectedType.includes('1099-div') || detectedType.includes('1099div')) {
      result = await this.extract1099DIV(documentId);
      documentType = '1099-div';
    } else if (detectedType.includes('1099-r') || detectedType.includes('1099r')) {
      result = await this.extract1099R(documentId);
      documentType = '1099-r';
    } else if (detectedType.includes('1095-a') || detectedType.includes('1095a')) {
      result = await this.extract1095A(documentId);
      documentType = '1095-a';
    } else {
      throw new Error(`Unknown or unsupported tax form type: ${detectedType}`);
    }

    return {
      documentType,
      data: result.data,
      confidence: result.confidence,
    };
  }

  /**
   * Create a tax document record with extracted data
   */
  async processAndStoreTaxDocument(
    documentId: string,
    scenarioId?: string,
    federalReturnId?: string
  ): Promise<{ 
    taxDocument: any; 
    extractedData: any; 
    requiresManualReview: boolean 
  }> {
    // Auto-detect and extract
    const extraction = await this.detectAndExtract(documentId);

    // Determine if manual review is needed
    const requiresManualReview = extraction.confidence < 0.85;

    // Quality flags
    const qualityFlags: string[] = [];
    if (extraction.confidence < 0.7) {
      qualityFlags.push('low_confidence');
    }
    if (extraction.documentType === 'w2') {
      const w2Data = extraction.data as W2Data;
      // Normalize EIN/SSN to digits only before validation
      const einDigits = w2Data.employerEIN?.replace(/\D/g, '') || '';
      const ssnDigits = w2Data.employeeSSN?.replace(/\D/g, '') || '';
      
      if (!einDigits || einDigits.length !== 9) {
        qualityFlags.push('invalid_ein');
      }
      if (!ssnDigits || ssnDigits.length !== 9) {
        qualityFlags.push('invalid_ssn');
      }
    }

    // Store in database
    const taxDocData: InsertTaxDocument = {
      scenarioId: scenarioId || null,
      federalReturnId: federalReturnId || null,
      documentType: extraction.documentType,
      documentId,
      extractedData: extraction.data,
      geminiConfidence: extraction.confidence,
      verificationStatus: requiresManualReview ? 'pending' : 'verified',
      requiresManualReview,
      qualityFlags: qualityFlags.length > 0 ? qualityFlags : null,
      taxYear: (extraction.data as any).taxYear || new Date().getFullYear(),
    };

    const taxDocument = await dbStorage.createTaxDocument(taxDocData);

    return {
      taxDocument,
      extractedData: extraction.data,
      requiresManualReview,
    };
  }

  /**
   * Map extracted 1099 data to VITA intake form fields
   * Auto-populate income, withholding, and other tax data from extracted 1099 forms
   */
  mapExtractedDataToVitaIntake(
    extractedData: Form1099INTData | Form1099DIVData | Form1099RData | Form1099MISCData | Form1099NECData | W2Data,
    documentType: string
  ): Partial<any> {
    const vitaData: any = {};

    switch (documentType.toLowerCase()) {
      case '1099-int':
        const intData = extractedData as Form1099INTData;
        vitaData.hasInterestIncome = true;
        vitaData.interestIncome = intData.box1_interestIncome;
        vitaData.taxExemptInterest = intData.box8_taxExemptInterest;
        vitaData.earlyWithdrawalPenalty = intData.box2_earlyWithdrawalPenalty;
        vitaData.federalTaxWithheld = (vitaData.federalTaxWithheld || 0) + intData.box4_federalTaxWithheld;
        vitaData.stateTaxWithheld = (vitaData.stateTaxWithheld || 0) + intData.box13_stateTaxWithheld;
        vitaData.otherIncome = (vitaData.otherIncome || 0) + intData.box1_interestIncome;
        break;

      case '1099-div':
        const divData = extractedData as Form1099DIVData;
        vitaData.hasDividendIncome = true;
        vitaData.ordinaryDividends = divData.box1a_ordinaryDividends;
        vitaData.qualifiedDividends = divData.box1b_qualifiedDividends;
        vitaData.capitalGainDistributions = divData.box2a_capitalGainDistributions;
        vitaData.federalTaxWithheld = (vitaData.federalTaxWithheld || 0) + divData.box4_federalTaxWithheld;
        vitaData.stateTaxWithheld = (vitaData.stateTaxWithheld || 0) + divData.box13_stateTaxWithheld;
        vitaData.otherIncome = (vitaData.otherIncome || 0) + divData.box1a_ordinaryDividends;
        break;

      case '1099-r':
        const rData = extractedData as Form1099RData;
        vitaData.hasRetirementIncome = true;
        vitaData.retirementGrossDistribution = rData.box1_grossDistribution;
        vitaData.retirementTaxableAmount = rData.box2a_taxableAmount;
        vitaData.retirementDistributionCode = rData.box7_distributionCode;
        vitaData.capitalGainIncome = (vitaData.capitalGainIncome || 0) + rData.box3_capitalGain;
        vitaData.federalTaxWithheld = (vitaData.federalTaxWithheld || 0) + rData.box4_federalTaxWithheld;
        vitaData.stateTaxWithheld = (vitaData.stateTaxWithheld || 0) + rData.box12_stateTaxWithheld;
        vitaData.otherIncome = (vitaData.otherIncome || 0) + (rData.box2a_taxableAmount || rData.box1_grossDistribution);
        break;

      case '1099-misc':
        const miscData = extractedData as Form1099MISCData;
        vitaData.has1099Income = true;
        vitaData.rentsIncome = miscData.box1_rents;
        vitaData.royaltiesIncome = miscData.box2_royalties;
        vitaData.otherIncome = (vitaData.otherIncome || 0) + 
          (miscData.box1_rents + miscData.box2_royalties + miscData.box3_otherIncome);
        vitaData.federalTaxWithheld = (vitaData.federalTaxWithheld || 0) + miscData.box4_federalTaxWithheld;
        vitaData.stateTaxWithheld = (vitaData.stateTaxWithheld || 0) + miscData.box16_stateTaxWithheld;
        break;

      case '1099-nec':
        const necData = extractedData as Form1099NECData;
        vitaData.hasSelfEmploymentIncome = true;
        vitaData.selfEmploymentIncome = necData.box1_nonemployeeCompensation;
        vitaData.federalTaxWithheld = (vitaData.federalTaxWithheld || 0) + necData.box4_federalTaxWithheld;
        vitaData.stateTaxWithheld = (vitaData.stateTaxWithheld || 0) + necData.box5_stateTaxWithheld;
        vitaData.otherIncome = (vitaData.otherIncome || 0) + necData.box1_nonemployeeCompensation;
        break;

      case 'w2':
      case 'w-2':
        const w2Data = extractedData as W2Data;
        vitaData.hasW2Income = true;
        vitaData.w2Wages = w2Data.box1_wages;
        vitaData.federalTaxWithheld = (vitaData.federalTaxWithheld || 0) + w2Data.box2_federalTaxWithheld;
        vitaData.stateTaxWithheld = (vitaData.stateTaxWithheld || 0) + w2Data.box17_stateIncomeTax;
        vitaData.socialSecurityWages = w2Data.box3_socialSecurityWages;
        vitaData.medicareWages = w2Data.box5_medicareWages;
        vitaData.dependentCareBenefits = w2Data.box10_dependentCareBenefits;
        break;

      default:
        break;
    }

    return vitaData;
  }
}

export const taxDocExtractor = new TaxDocumentExtractionService();
