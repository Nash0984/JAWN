import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TaxslayerReturn } from '@shared/schema';
import { storage } from '../storage';

/**
 * TaxSlayer Export Service
 * 
 * Provides PDF and CSV export functionality for TaxSlayer return data.
 * Used for record-keeping and comparison auditing.
 */

export interface ExportMetadata {
  taxYear: number;
  filingStatus: string;
  preparerName?: string;
  importDate: Date;
  vitaSessionId: string;
}

/**
 * Export TaxSlayer return to PDF
 */
export async function exportToPDF(returnId: string): Promise<Buffer> {
  const taxReturn = await storage.getTaxslayerReturn(returnId);
  if (!taxReturn) {
    throw new Error('TaxSlayer return not found');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Add watermark
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('TaxSlayer Data Entry - For Navigator Review Only', pageWidth / 2, 10, { align: 'center' });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('TaxSlayer Return Summary', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Metadata section
  doc.setFontSize(11);
  doc.text(`Tax Year: ${taxReturn.taxYear}`, 20, yPos);
  doc.text(`Filing Status: ${formatFilingStatus(taxReturn.filingStatus)}`, 120, yPos);
  yPos += 7;
  doc.text(`Prepared Date: ${taxReturn.preparedDate ? new Date(taxReturn.preparedDate).toLocaleDateString() : 'N/A'}`, 20, yPos);
  doc.text(`Imported: ${new Date(taxReturn.importedAt).toLocaleDateString()}`, 120, yPos);
  yPos += 12;

  // Federal Return Section
  doc.setFontSize(14);
  doc.text('Federal Return', 20, yPos);
  yPos += 8;

  const federalData = [
    ['Adjusted Gross Income (AGI)', formatCurrency(taxReturn.federalAGI)],
    ['Taxable Income', formatCurrency(taxReturn.federalTaxableIncome)],
    ['Total Tax', formatCurrency(taxReturn.federalTax)],
    ['Federal Withholding', formatCurrency(taxReturn.federalWithheld)],
    ['Federal Refund/Owed', formatCurrency(taxReturn.federalRefund), taxReturn.federalRefund >= 0 ? 'Refund' : 'Owed'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Line Item', 'Amount', '']],
    body: federalData,
    theme: 'striped',
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Tax Credits Section
  doc.setFontSize(14);
  doc.text('Tax Credits', 20, yPos);
  yPos += 8;

  const creditsData = [
    ['Earned Income Tax Credit (EITC)', formatCurrency(taxReturn.eitcAmount)],
    ['Child Tax Credit (CTC)', formatCurrency(taxReturn.ctcAmount)],
    ['Additional Child Tax Credit', formatCurrency(taxReturn.additionalChildTaxCredit)],
    ['American Opportunity Credit', formatCurrency(taxReturn.americanOpportunityCredit)],
    ['Lifetime Learning Credit', formatCurrency(taxReturn.lifetimeLearningCredit)],
    ['Other Credits', formatCurrency(taxReturn.otherCredits)],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Credit Type', 'Amount']],
    body: creditsData,
    theme: 'striped',
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // State Return Section
  doc.setFontSize(14);
  doc.text('Maryland State Return', 20, yPos);
  yPos += 8;

  const stateData = [
    ['Maryland AGI', formatCurrency(taxReturn.stateAGI)],
    ['State Tax', formatCurrency(taxReturn.stateTax)],
    ['State Withholding', formatCurrency(taxReturn.stateWithheld)],
    ['State Refund/Owed', formatCurrency(taxReturn.stateRefund), taxReturn.stateRefund >= 0 ? 'Refund' : 'Owed'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Line Item', 'Amount', '']],
    body: stateData,
    theme: 'striped',
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // W-2 Forms
  if (Array.isArray(taxReturn.w2Forms) && taxReturn.w2Forms.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('W-2 Income', 20, yPos);
    yPos += 8;

    const w2Data = (taxReturn.w2Forms as any[]).map((w2: any) => [
      w2.employer || 'Unknown',
      formatCurrency(w2.wages || 0),
      formatCurrency(w2.federalWithheld || 0),
      formatCurrency(w2.stateWithheld || 0),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Employer', 'Wages', 'Fed Withheld', 'State Withheld']],
      body: w2Data,
      theme: 'striped',
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // 1099 Forms
  if (Array.isArray(taxReturn.form1099s) && taxReturn.form1099s.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('1099 Income', 20, yPos);
    yPos += 8;

    const form1099Data = (taxReturn.form1099s as any[]).map((form1099: any) => [
      form1099.type || 'Unknown',
      form1099.payer || 'Unknown',
      formatCurrency(form1099.amount || 0),
      formatCurrency(form1099.federalWithheld || 0),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Type', 'Payer', 'Amount', 'Fed Withheld']],
      body: form1099Data,
      theme: 'striped',
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Schedule C
  if (taxReturn.scheduleC) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Schedule C - Self-Employment', 20, yPos);
    yPos += 8;

    const schedC = taxReturn.scheduleC as any;
    const schedCData = [
      ['Business Name', schedC.businessName || 'N/A'],
      ['EIN', schedC.ein || 'N/A'],
      ['Gross Receipts', formatCurrency(schedC.grossReceipts || 0)],
      ['Expenses', formatCurrency(schedC.expenses || 0)],
      ['Net Profit', formatCurrency(schedC.netProfit || 0)],
    ];

    autoTable(doc, {
      startY: yPos,
      body: schedCData,
      theme: 'striped',
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Notes section
  if (taxReturn.notes) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text('Notes:', 20, yPos);
    yPos += 7;
    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(taxReturn.notes, pageWidth - 40);
    doc.text(splitNotes, 20, yPos);
  }

  // Return as buffer
  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Export TaxSlayer return to CSV with comparison data
 */
export async function exportToCSV(
  returnId: string,
  ourCalculation?: {
    federalAGI: number;
    federalTax: number;
    federalRefund: number;
    eitcAmount: number;
    ctcAmount: number;
  }
): Promise<string> {
  const taxReturn = await storage.getTaxslayerReturn(returnId);
  if (!taxReturn) {
    throw new Error('TaxSlayer return not found');
  }

  const rows: string[][] = [];

  // Header
  rows.push(['Field', 'TaxSlayer Value', 'Our Value', 'Difference', 'Variance %']);

  // Helper to add comparison row
  const addRow = (field: string, taxslayerValue: number, ourValue?: number) => {
    const diff = ourValue !== undefined ? ourValue - taxslayerValue : 0;
    const variance = taxslayerValue !== 0 && ourValue !== undefined 
      ? ((diff / taxslayerValue) * 100).toFixed(2) 
      : '0.00';
    
    rows.push([
      field,
      formatCurrency(taxslayerValue),
      ourValue !== undefined ? formatCurrency(ourValue) : 'N/A',
      ourValue !== undefined ? formatCurrency(diff) : 'N/A',
      ourValue !== undefined ? `${variance}%` : 'N/A',
    ]);
  };

  // Metadata rows
  rows.push(['Tax Year', taxReturn.taxYear.toString(), '', '', '']);
  rows.push(['Filing Status', formatFilingStatus(taxReturn.filingStatus), '', '', '']);
  rows.push(['Import Date', new Date(taxReturn.importedAt).toLocaleDateString(), '', '', '']);
  rows.push(['']); // Empty row

  // Federal return comparison
  rows.push(['FEDERAL RETURN', '', '', '', '']);
  addRow('Adjusted Gross Income', taxReturn.federalAGI, ourCalculation?.federalAGI);
  addRow('Taxable Income', taxReturn.federalTaxableIncome);
  addRow('Total Tax', taxReturn.federalTax, ourCalculation?.federalTax);
  addRow('Federal Withholding', taxReturn.federalWithheld);
  addRow('Federal Refund', taxReturn.federalRefund, ourCalculation?.federalRefund);
  rows.push(['']); // Empty row

  // Credits comparison
  rows.push(['TAX CREDITS', '', '', '', '']);
  addRow('EITC', taxReturn.eitcAmount, ourCalculation?.eitcAmount);
  addRow('CTC', taxReturn.ctcAmount, ourCalculation?.ctcAmount);
  addRow('Additional CTC', taxReturn.additionalChildTaxCredit);
  addRow('American Opportunity Credit', taxReturn.americanOpportunityCredit);
  addRow('Lifetime Learning Credit', taxReturn.lifetimeLearningCredit);
  addRow('Other Credits', taxReturn.otherCredits);
  rows.push(['']); // Empty row

  // State return
  rows.push(['MARYLAND STATE RETURN', '', '', '', '']);
  addRow('Maryland AGI', taxReturn.stateAGI);
  addRow('State Tax', taxReturn.stateTax);
  addRow('State Withholding', taxReturn.stateWithheld);
  addRow('State Refund', taxReturn.stateRefund);
  rows.push(['']); // Empty row

  // Other income
  rows.push(['OTHER INCOME', '', '', '', '']);
  addRow('Retirement Income', taxReturn.retirementIncome);
  addRow('Social Security Income', taxReturn.socialSecurityIncome);
  rows.push(['']); // Empty row

  // Deductions
  rows.push(['DEDUCTIONS', '', '', '', '']);
  addRow('Student Loan Interest', taxReturn.studentLoanInterestPaid);
  addRow('Mortgage Interest', taxReturn.mortgageInterestPaid);
  addRow('Charitable Contributions', taxReturn.charitableContributions);

  // Convert to CSV string
  return rows.map(row => row.map(escapeCSV).join(',')).join('\n');
}

/**
 * Helper functions
 */

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  const absValue = Math.abs(value);
  const formatted = `$${absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value < 0 ? `(${formatted})` : formatted;
}

function formatFilingStatus(status: string): string {
  const statusMap: Record<string, string> = {
    single: 'Single',
    married_joint: 'Married Filing Jointly',
    married_separate: 'Married Filing Separately',
    head_of_household: 'Head of Household',
    qualifying_widow: 'Qualifying Widow(er)',
  };
  return statusMap[status] || status;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
