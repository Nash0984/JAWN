import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TaxslayerReturn } from '@shared/schema';
import { storage } from '../storage';

/**
 * TaxSlayer Export Service
 * 
 * Provides professional PDF export functionality for TaxSlayer return data.
 * Includes worksheets, checklists, variance reports, and field mapping guides
 * for efficient manual data entry and supervisor review.
 */

export interface ExportMetadata {
  taxYear: number;
  filingStatus: string;
  preparerName?: string;
  importDate: Date;
  vitaSessionId: string;
}

// PDF Formatting Constants
const MARGINS = { top: 54, bottom: 54, left: 54, right: 54 }; // 0.75" at 72 DPI
const FONTS = {
  title: { size: 16, family: 'helvetica', style: 'bold' },
  sectionHeader: { size: 12, family: 'helvetica', style: 'bold' },
  body: { size: 10, family: 'helvetica', style: 'normal' },
  data: { size: 10, family: 'courier', style: 'normal' },
  footer: { size: 8, family: 'helvetica', style: 'normal' },
};

const COLORS = {
  primary: [41, 98, 255] as [number, number, number], // Blue
  secondary: [100, 116, 139] as [number, number, number], // Slate gray
  success: [34, 197, 94] as [number, number, number], // Green
  warning: [234, 179, 8] as [number, number, number], // Yellow
  danger: [239, 68, 68] as [number, number, number], // Red
  gray: [148, 163, 184] as [number, number, number], // Light gray
  black: [0, 0, 0] as [number, number, number],
};

/**
 * Enhanced PDF Worksheet - Matches TaxSlayer Pro screen layout
 */
export async function exportToPDF(returnId: string): Promise<Buffer> {
  const taxReturn = await storage.getTaxslayerReturn(returnId);
  if (!taxReturn) {
    throw new Error('TaxSlayer return not found');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentPage = 1;

  // Helper function to add header to each page
  const addPageHeader = (pageTitle: string = 'Data Entry Worksheet') => {
    // Logo placeholder
    doc.setFontSize(12);
    doc.setFont(FONTS.title.family, FONTS.title.style);
    doc.setTextColor(...COLORS.primary);
    doc.text('TaxSlayer Pro Data Entry', MARGINS.left, 20);
    
    // Main title
    doc.setFontSize(FONTS.title.size);
    doc.setTextColor(...COLORS.black);
    doc.text(`${pageTitle} - Tax Year ${taxReturn.taxYear}`, MARGINS.left, 35);
    
    // Taxpayer info (if available)
    doc.setFontSize(FONTS.body.size);
    doc.setTextColor(...COLORS.secondary);
    const taxpayerName = getTaxpayerName(taxReturn);
    if (taxpayerName) {
      doc.text(`Taxpayer: ${taxpayerName}`, MARGINS.left, 45);
    }
    doc.text(`Filing Status: ${formatFilingStatus(taxReturn.filingStatus)}`, pageWidth - MARGINS.right, 45, { align: 'right' });
  };

  // Helper function to add footer to each page
  const addPageFooter = () => {
    const y = pageHeight - 25;
    
    // Page number
    doc.setFontSize(FONTS.footer.size);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Page ${currentPage}`, pageWidth / 2, y, { align: 'center' });
    
    // Signature lines
    doc.setFontSize(FONTS.footer.size);
    doc.text('Navigator: ____________________', MARGINS.left, y + 10);
    doc.text('Date: ____________________', pageWidth - MARGINS.right, y + 10, { align: 'right' });
    
    currentPage++;
  };

  // Validation Warnings Section (if any)
  let yPos = MARGINS.top;
  addPageHeader();
  
  if (taxReturn.hasValidationWarnings && Array.isArray(taxReturn.validationWarnings) && taxReturn.validationWarnings.length > 0) {
    doc.setFillColor(254, 243, 199); // Yellow-100
    doc.rect(MARGINS.left, yPos, pageWidth - MARGINS.left - MARGINS.right, 35, 'F');
    
    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setTextColor(...COLORS.danger);
    doc.text('⚠️ VALIDATION WARNINGS - REVIEW REQUIRED', MARGINS.left + 5, yPos + 10);
    
    doc.setFontSize(FONTS.body.size);
    doc.setTextColor(...COLORS.black);
    const warnings = (taxReturn.validationWarnings as string[]).slice(0, 2);
    warnings.forEach((warning, idx) => {
      doc.text(`• ${warning}`, MARGINS.left + 5, yPos + 20 + (idx * 7));
    });
    
    yPos += 45;
  }

  // Checkbox helper
  const addCheckbox = (x: number, y: number) => {
    doc.setDrawColor(...COLORS.gray);
    doc.rect(x, y - 3, 3, 3);
  };

  // Field row helper
  const addFieldRow = (label: string, value: string, y: number, withCheckbox: boolean = true) => {
    if (withCheckbox) {
      addCheckbox(MARGINS.left, y);
    }
    
    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, FONTS.body.style);
    doc.setTextColor(...COLORS.black);
    doc.text(label, MARGINS.left + (withCheckbox ? 8 : 0), y);
    
    doc.setFont(FONTS.data.family, FONTS.data.style);
    doc.setTextColor(...COLORS.primary);
    doc.text(value, pageWidth - MARGINS.right, y, { align: 'right' });
  };

  // Section 1: Personal Information
  if (yPos > pageHeight - 100) {
    addPageFooter();
    doc.addPage();
    addPageHeader('Personal Information');
    yPos = MARGINS.top;
  }

  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('1. PERSONAL INFORMATION', MARGINS.left, yPos);
  yPos += 10;

  addFieldRow('Tax Year:', taxReturn.taxYear.toString(), yPos, true);
  yPos += 8;
  addFieldRow('Filing Status:', formatFilingStatus(taxReturn.filingStatus), yPos, true);
  yPos += 8;
  addFieldRow('Prepared Date:', taxReturn.preparedDate ? new Date(taxReturn.preparedDate).toLocaleDateString() : 'N/A', yPos, true);
  yPos += 15;

  // Section 2: Federal Return
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('2. FEDERAL RETURN (Form 1040)', MARGINS.left, yPos);
  yPos += 10;

  addFieldRow('Adjusted Gross Income (AGI) → Line 11:', formatCurrency(taxReturn.federalAGI), yPos, true);
  yPos += 8;
  addFieldRow('Taxable Income → Line 15:', formatCurrency(taxReturn.federalTaxableIncome), yPos, true);
  yPos += 8;
  addFieldRow('Total Tax → Line 24:', formatCurrency(taxReturn.federalTax), yPos, true);
  yPos += 8;
  addFieldRow('Federal Withholding → Line 25a:', formatCurrency(taxReturn.federalWithheld), yPos, true);
  yPos += 8;
  addFieldRow('Refund/Amount Owed → Line 34/37:', formatCurrency(taxReturn.federalRefund), yPos, true);
  yPos += 15;

  // Section 3: Tax Credits
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('3. TAX CREDITS', MARGINS.left, yPos);
  yPos += 10;

  addFieldRow('Earned Income Tax Credit (EITC) → Schedule EIC:', formatCurrency(taxReturn.eitcAmount), yPos, true);
  yPos += 8;
  addFieldRow('Child Tax Credit (CTC) → Line 19:', formatCurrency(taxReturn.ctcAmount), yPos, true);
  yPos += 8;
  addFieldRow('Additional Child Tax Credit → Schedule 8812:', formatCurrency(taxReturn.additionalChildTaxCredit), yPos, true);
  yPos += 8;
  addFieldRow('American Opportunity Credit → Form 8863:', formatCurrency(taxReturn.americanOpportunityCredit), yPos, true);
  yPos += 8;
  addFieldRow('Lifetime Learning Credit → Form 8863:', formatCurrency(taxReturn.lifetimeLearningCredit), yPos, true);
  yPos += 8;
  addFieldRow('Other Credits:', formatCurrency(taxReturn.otherCredits), yPos, true);
  yPos += 15;

  // Check if we need a new page
  if (yPos > pageHeight - 100) {
    addPageFooter();
    doc.addPage();
    addPageHeader('State Return & Income');
    yPos = MARGINS.top;
  }

  // Section 4: Maryland State Return
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('4. MARYLAND STATE RETURN (Form 502)', MARGINS.left, yPos);
  yPos += 10;

  addFieldRow('Maryland AGI → Line 1:', formatCurrency(taxReturn.stateAGI), yPos, true);
  yPos += 8;
  addFieldRow('State Tax → Line 22:', formatCurrency(taxReturn.stateTax), yPos, true);
  yPos += 8;
  addFieldRow('State Withholding → Line 26:', formatCurrency(taxReturn.stateWithheld), yPos, true);
  yPos += 8;
  addFieldRow('State Refund/Amount Owed → Line 31/32:', formatCurrency(taxReturn.stateRefund), yPos, true);
  yPos += 15;

  // Section 5: Income Documents
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('5. INCOME DOCUMENTS', MARGINS.left, yPos);
  yPos += 10;

  // W-2 Forms
  if (Array.isArray(taxReturn.w2Forms) && taxReturn.w2Forms.length > 0) {
    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, 'bold');
    doc.text(`W-2 Forms (${taxReturn.w2Forms.length} total):`, MARGINS.left, yPos);
    yPos += 8;

    (taxReturn.w2Forms as any[]).forEach((w2, idx) => {
      if (yPos > pageHeight - 80) {
        addPageFooter();
        doc.addPage();
        addPageHeader('Income Documents (continued)');
        yPos = MARGINS.top;
      }

      doc.setFont(FONTS.body.family, 'normal');
      addCheckbox(MARGINS.left, yPos);
      doc.text(`W-2 #${idx + 1}: ${w2.employer || 'Unknown'}`, MARGINS.left + 8, yPos);
      yPos += 6;
      doc.setFont(FONTS.data.family, FONTS.data.style);
      doc.text(`    Wages: ${formatCurrency(w2.wages || 0)}`, MARGINS.left + 8, yPos);
      doc.text(`Fed Withheld: ${formatCurrency(w2.federalWithheld || 0)}`, MARGINS.left + 80, yPos);
      doc.text(`State Withheld: ${formatCurrency(w2.stateWithheld || 0)}`, MARGINS.left + 140, yPos);
      yPos += 8;
    });
    yPos += 5;
  }

  // 1099 Forms
  if (Array.isArray(taxReturn.form1099s) && taxReturn.form1099s.length > 0) {
    if (yPos > pageHeight - 80) {
      addPageFooter();
      doc.addPage();
      addPageHeader('Income Documents (continued)');
      yPos = MARGINS.top;
    }

    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, 'bold');
    doc.text(`1099 Forms (${taxReturn.form1099s.length} total):`, MARGINS.left, yPos);
    yPos += 8;

    (taxReturn.form1099s as any[]).forEach((form1099, idx) => {
      if (yPos > pageHeight - 60) {
        addPageFooter();
        doc.addPage();
        addPageHeader('Income Documents (continued)');
        yPos = MARGINS.top;
      }

      doc.setFont(FONTS.body.family, 'normal');
      addCheckbox(MARGINS.left, yPos);
      doc.text(`1099-${form1099.type || 'MISC'} #${idx + 1}: ${form1099.payer || 'Unknown'}`, MARGINS.left + 8, yPos);
      yPos += 6;
      doc.setFont(FONTS.data.family, FONTS.data.style);
      doc.text(`    Amount: ${formatCurrency(form1099.amount || 0)}`, MARGINS.left + 8, yPos);
      if (form1099.federalWithheld > 0) {
        doc.text(`Fed Withheld: ${formatCurrency(form1099.federalWithheld || 0)}`, MARGINS.left + 80, yPos);
      }
      yPos += 8;
    });
    yPos += 5;
  }

  // Other Income
  if (taxReturn.retirementIncome || taxReturn.socialSecurityIncome) {
    if (yPos > pageHeight - 60) {
      addPageFooter();
      doc.addPage();
      addPageHeader('Other Income');
      yPos = MARGINS.top;
    }

    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, 'bold');
    doc.text('Other Income:', MARGINS.left, yPos);
    yPos += 8;

    if (taxReturn.retirementIncome) {
      addFieldRow('Retirement Income → 1099-R:', formatCurrency(taxReturn.retirementIncome), yPos, true);
      yPos += 8;
    }
    if (taxReturn.socialSecurityIncome) {
      addFieldRow('Social Security Income → SSA-1099:', formatCurrency(taxReturn.socialSecurityIncome), yPos, true);
      yPos += 8;
    }
    yPos += 5;
  }

  // Schedule C
  if (taxReturn.scheduleC) {
    if (yPos > pageHeight - 80) {
      addPageFooter();
      doc.addPage();
      addPageHeader('Self-Employment Income');
      yPos = MARGINS.top;
    }

    const schedC = taxReturn.scheduleC as any;
    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.primary);
    doc.text('6. SCHEDULE C - SELF-EMPLOYMENT', MARGINS.left, yPos);
    yPos += 10;

    addFieldRow('Business Name:', schedC.businessName || 'N/A', yPos, true);
    yPos += 8;
    if (schedC.ein) {
      addFieldRow('EIN:', schedC.ein, yPos, true);
      yPos += 8;
    }
    addFieldRow('Gross Receipts → Line 1:', formatCurrency(schedC.grossReceipts || 0), yPos, true);
    yPos += 8;
    addFieldRow('Total Expenses → Line 28:', formatCurrency(schedC.expenses || 0), yPos, true);
    yPos += 8;
    addFieldRow('Net Profit → Line 31:', formatCurrency(schedC.netProfit || 0), yPos, true);
    yPos += 10;
  }

  // Deductions section
  if (taxReturn.studentLoanInterestPaid || taxReturn.mortgageInterestPaid || taxReturn.charitableContributions) {
    if (yPos > pageHeight - 80) {
      addPageFooter();
      doc.addPage();
      addPageHeader('Deductions');
      yPos = MARGINS.top;
    }

    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.primary);
    doc.text('7. DEDUCTIONS', MARGINS.left, yPos);
    yPos += 10;

    if (taxReturn.studentLoanInterestPaid) {
      addFieldRow('Student Loan Interest → Form 1098-E:', formatCurrency(taxReturn.studentLoanInterestPaid), yPos, true);
      yPos += 8;
    }
    if (taxReturn.mortgageInterestPaid) {
      addFieldRow('Mortgage Interest → Form 1098:', formatCurrency(taxReturn.mortgageInterestPaid), yPos, true);
      yPos += 8;
    }
    if (taxReturn.charitableContributions) {
      addFieldRow('Charitable Contributions → Schedule A:', formatCurrency(taxReturn.charitableContributions), yPos, true);
      yPos += 8;
    }
  }

  // Notes section
  if (taxReturn.notes) {
    if (yPos > pageHeight - 60) {
      addPageFooter();
      doc.addPage();
      addPageHeader('Notes');
      yPos = MARGINS.top;
    }

    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.primary);
    doc.text('NOTES:', MARGINS.left, yPos);
    yPos += 10;

    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, FONTS.body.style);
    doc.setTextColor(...COLORS.black);
    const splitNotes = doc.splitTextToSize(taxReturn.notes, pageWidth - MARGINS.left - MARGINS.right);
    doc.text(splitNotes, MARGINS.left, yPos);
  }

  // Add final footer
  addPageFooter();

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Line-by-Line Checklist Export
 */
export async function exportChecklist(returnId: string): Promise<Buffer> {
  const taxReturn = await storage.getTaxslayerReturn(returnId);
  if (!taxReturn) {
    throw new Error('TaxSlayer return not found');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title
  doc.setFontSize(FONTS.title.size);
  doc.setFont(FONTS.title.family, FONTS.title.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('TaxSlayer Data Entry Checklist', pageWidth / 2, 20, { align: 'center' });

  // Subtitle
  doc.setFontSize(FONTS.body.size);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Tax Year ${taxReturn.taxYear} - ${formatFilingStatus(taxReturn.filingStatus)}`, pageWidth / 2, 30, { align: 'center' });

  let yPos = 45;

  // Count total fields
  const totalFields = calculateTotalFields(taxReturn);
  
  // Progress tracker
  doc.setFillColor(240, 240, 245);
  doc.rect(MARGINS.left, yPos, pageWidth - MARGINS.left - MARGINS.right, 20, 'F');
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.black);
  doc.text(`Progress Tracker: Complete _____ / ${totalFields} fields entered`, MARGINS.left + 5, yPos + 12);
  yPos += 30;

  // Personal Information (10 items)
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('PERSONAL INFORMATION (3 items)', MARGINS.left, yPos);
  yPos += 8;

  yPos = addChecklistItem(doc, '[ ] Tax Year:', taxReturn.taxYear.toString(), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Filing Status:', formatFilingStatus(taxReturn.filingStatus), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Prepared Date:', taxReturn.preparedDate ? new Date(taxReturn.preparedDate).toLocaleDateString() : 'N/A', yPos, pageHeight);
  yPos += 5;

  // Federal Return (5 items)
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('FEDERAL RETURN (5 items)', MARGINS.left, yPos);
  yPos += 8;

  yPos = addChecklistItem(doc, '[ ] AGI:', formatCurrency(taxReturn.federalAGI), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Taxable Income:', formatCurrency(taxReturn.federalTaxableIncome), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Total Tax:', formatCurrency(taxReturn.federalTax), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Federal Withholding:', formatCurrency(taxReturn.federalWithheld), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Refund/Owed:', formatCurrency(taxReturn.federalRefund), yPos, pageHeight);
  yPos += 5;

  // Credits (6 items)
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('TAX CREDITS (6 items)', MARGINS.left, yPos);
  yPos += 8;

  yPos = addChecklistItem(doc, '[ ] EITC:', formatCurrency(taxReturn.eitcAmount), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] CTC:', formatCurrency(taxReturn.ctcAmount), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Additional CTC:', formatCurrency(taxReturn.additionalChildTaxCredit), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] AOTC:', formatCurrency(taxReturn.americanOpportunityCredit), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] LLC:', formatCurrency(taxReturn.lifetimeLearningCredit), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] Other Credits:', formatCurrency(taxReturn.otherCredits), yPos, pageHeight);
  yPos += 5;

  // State Return (4 items)
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('MARYLAND STATE RETURN (4 items)', MARGINS.left, yPos);
  yPos += 8;

  yPos = addChecklistItem(doc, '[ ] MD AGI:', formatCurrency(taxReturn.stateAGI), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] State Tax:', formatCurrency(taxReturn.stateTax), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] State Withholding:', formatCurrency(taxReturn.stateWithheld), yPos, pageHeight);
  yPos = addChecklistItem(doc, '[ ] State Refund/Owed:', formatCurrency(taxReturn.stateRefund), yPos, pageHeight);
  yPos += 5;

  // Income Documents
  if (Array.isArray(taxReturn.w2Forms) && taxReturn.w2Forms.length > 0) {
    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.primary);
    doc.text(`W-2 FORMS (${taxReturn.w2Forms.length} items)`, MARGINS.left, yPos);
    yPos += 8;

    (taxReturn.w2Forms as any[]).forEach((w2, idx) => {
      yPos = addChecklistItem(doc, `[ ] W-2 #${idx + 1} - ${w2.employer}:`, formatCurrency(w2.wages || 0), yPos, pageHeight);
    });
    yPos += 5;
  }

  if (Array.isArray(taxReturn.form1099s) && taxReturn.form1099s.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 30;
    }

    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.primary);
    doc.text(`1099 FORMS (${taxReturn.form1099s.length} items)`, MARGINS.left, yPos);
    yPos += 8;

    (taxReturn.form1099s as any[]).forEach((form1099, idx) => {
      yPos = addChecklistItem(doc, `[ ] 1099-${form1099.type} #${idx + 1} - ${form1099.payer}:`, formatCurrency(form1099.amount || 0), yPos, pageHeight);
    });
    yPos += 5;
  }

  // Quick Reference Section
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('QUICK REFERENCE', MARGINS.left, yPos);
  yPos += 10;

  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, FONTS.body.style);
  doc.setTextColor(...COLORS.black);
  
  const quickRef = [
    'Filing Status Codes: 1=Single, 2=Married Filing Jointly, 3=Married Filing Separately,',
    '                     4=Head of Household, 5=Qualifying Widow(er)',
    '',
    'State Code: MD (Maryland)',
    '',
    'Common Form Locations:',
    '  • W-2: Employer wage and tax statement',
    '  • 1099-INT: Interest income',
    '  • 1099-DIV: Dividend income',
    '  • 1099-MISC/NEC: Self-employment income',
  ];

  quickRef.forEach(line => {
    doc.text(line, MARGINS.left, yPos);
    yPos += 6;
  });

  // Footer
  const footerY = pageHeight - 20;
  doc.setFontSize(FONTS.footer.size);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Navigator: ___________________ Date: ___________', MARGINS.left, footerY);

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Variance Report for Supervisor Review
 */
export async function exportVarianceReport(
  returnId: string,
  ourCalculation?: {
    federalAGI: number;
    federalTax: number;
    federalRefund: number;
    eitcAmount: number;
    ctcAmount: number;
  }
): Promise<Buffer> {
  const taxReturn = await storage.getTaxslayerReturn(returnId);
  if (!taxReturn) {
    throw new Error('TaxSlayer return not found');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(FONTS.title.size);
  doc.setFont(FONTS.title.family, FONTS.title.style);
  doc.setTextColor(...COLORS.danger);
  doc.text('Supervisor Review Required - Variance Report', pageWidth / 2, 20, { align: 'center' });

  // Subtitle
  doc.setFontSize(FONTS.body.size);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Tax Year ${taxReturn.taxYear} - ${formatFilingStatus(taxReturn.filingStatus)}`, pageWidth / 2, 30, { align: 'center' });

  let yPos = 45;

  // Calculate variances
  const variances = calculateVariances(taxReturn, ourCalculation);
  const majorVariances = variances.filter(v => v.status === 'major');
  const minorVariances = variances.filter(v => v.status === 'minor');

  // Supervisor Review Required Section
  if (majorVariances.length > 0) {
    doc.setFillColor(254, 226, 226); // Red-100
    doc.rect(MARGINS.left, yPos, pageWidth - MARGINS.left - MARGINS.right, 15 + (majorVariances.length * 7), 'F');
    
    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.danger);
    doc.text('⚠️ CRITICAL VARIANCES (>$50) - IMMEDIATE REVIEW REQUIRED', MARGINS.left + 5, yPos + 10);
    yPos += 15;

    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, FONTS.body.style);
    majorVariances.forEach(variance => {
      doc.text(`• ${variance.field}: ${formatCurrency(Math.abs(variance.difference || 0))} difference`, MARGINS.left + 5, yPos);
      yPos += 7;
    });
    yPos += 10;
  }

  // Variance Table
  const tableData = variances.map(v => [
    v.field,
    formatCurrency(v.taxslayerValue),
    v.ourValue !== undefined ? formatCurrency(v.ourValue) : 'N/A',
    v.difference !== undefined ? formatCurrency(Math.abs(v.difference)) : 'N/A',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Field', 'TaxSlayer Value', 'Our Value', 'Variance']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 98, 255], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 3) {
        const variance = variances[data.row.index];
        if (variance.status === 'major') {
          data.cell.styles.fillColor = [254, 226, 226]; // Red
          data.cell.styles.textColor = [220, 38, 38];
        } else if (variance.status === 'minor') {
          data.cell.styles.fillColor = [254, 243, 199]; // Yellow
        } else if (variance.status === 'match') {
          data.cell.styles.fillColor = [220, 252, 231]; // Green
        }
      }
    },
    margin: { left: MARGINS.left, right: MARGINS.right },
  });

  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Legend
  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, 'bold');
  doc.text('Color Legend:', MARGINS.left, yPos);
  yPos += 8;

  // Green
  doc.setFillColor(220, 252, 231);
  doc.rect(MARGINS.left, yPos - 4, 10, 6, 'F');
  doc.setFont(FONTS.body.family, 'normal');
  doc.text('Match (no variance)', MARGINS.left + 15, yPos);
  yPos += 8;

  // Yellow
  doc.setFillColor(254, 243, 199);
  doc.rect(MARGINS.left, yPos - 4, 10, 6, 'F');
  doc.text('Minor variance (<$50)', MARGINS.left + 15, yPos);
  yPos += 8;

  // Red
  doc.setFillColor(254, 226, 226);
  doc.rect(MARGINS.left, yPos - 4, 10, 6, 'F');
  doc.text('Major variance (>$50) - Review Required', MARGINS.left + 15, yPos);
  yPos += 15;

  // Signature Section
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.text('REVIEW AND APPROVAL', MARGINS.left, yPos);
  yPos += 15;

  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, FONTS.body.style);
  doc.text('Navigator: ________________________________  Date: __________', MARGINS.left, yPos);
  yPos += 15;
  doc.text('Supervisor: ________________________________  Date: __________', MARGINS.left, yPos);
  yPos += 20;

  // Notes Section
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.text('SUPERVISOR NOTES:', MARGINS.left, yPos);
  yPos += 10;

  doc.setDrawColor(...COLORS.gray);
  for (let i = 0; i < 5; i++) {
    doc.line(MARGINS.left, yPos, pageWidth - MARGINS.right, yPos);
    yPos += 10;
  }

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Field Mapping Guide with Validation Warnings
 */
export async function exportFieldGuide(returnId: string): Promise<Buffer> {
  const taxReturn = await storage.getTaxslayerReturn(returnId);
  if (!taxReturn) {
    throw new Error('TaxSlayer return not found');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(FONTS.title.size);
  doc.setFont(FONTS.title.family, FONTS.title.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('TaxSlayer Field Mapping Guide', pageWidth / 2, 20, { align: 'center' });

  // Subtitle
  doc.setFontSize(FONTS.body.size);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Quick Reference for Data Entry', pageWidth / 2, 30, { align: 'center' });

  let yPos = 45;

  // Validation Warnings (if any)
  if (taxReturn.hasValidationWarnings && Array.isArray(taxReturn.validationWarnings) && taxReturn.validationWarnings.length > 0) {
    doc.setFillColor(254, 243, 199); // Yellow-100
    doc.rect(MARGINS.left, yPos, pageWidth - MARGINS.left - MARGINS.right, 20 + (taxReturn.validationWarnings.length * 7), 'F');
    
    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.danger);
    doc.text('⚠️ VALIDATION WARNINGS', MARGINS.left + 5, yPos + 10);
    yPos += 15;

    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, FONTS.body.style);
    doc.setTextColor(...COLORS.black);
    (taxReturn.validationWarnings as string[]).forEach((warning) => {
      const lines = doc.splitTextToSize(`• ${warning}`, pageWidth - MARGINS.left - MARGINS.right - 10);
      doc.text(lines, MARGINS.left + 5, yPos);
      yPos += lines.length * 6;
    });
    yPos += 10;
  }

  // Field Mapping Section
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('FIELD LOCATIONS IN TAXSLAYER PRO', MARGINS.left, yPos);
  yPos += 12;

  const fieldMappings = [
    { category: 'Personal Information Tab', fields: [
      'Filing Status → Personal Info Tab → Filing Status dropdown',
      'Taxpayer SSN → Personal Info Tab → Social Security Number',
      'Spouse SSN → Personal Info Tab → Spouse Social Security Number (if MFJ)',
    ]},
    { category: 'Federal Return Tab - Income Section', fields: [
      'W-2 Wages → Federal Return Tab → Income → Wages, Salaries, Tips (Form W-2)',
      'AGI → Federal Return Tab → Adjusted Gross Income (Line 11 - Auto-calculated)',
      'Taxable Income → Federal Return Tab → Taxable Income (Line 15 - Auto-calculated)',
    ]},
    { category: 'Federal Return Tab - Credits Section', fields: [
      'EITC → Federal Return Tab → Credits → Earned Income Credit (Schedule EIC)',
      'CTC → Federal Return Tab → Credits → Child Tax Credit (Line 19)',
      'AOTC → Federal Return Tab → Credits → American Opportunity Credit (Form 8863)',
      'Additional CTC → Federal Return Tab → Credits → Additional Child Tax Credit (Schedule 8812)',
    ]},
    { category: 'Federal Return Tab - Tax & Payments', fields: [
      'Total Tax → Federal Return Tab → Tax (Line 24 - Auto-calculated)',
      'Federal Withholding → Federal Return Tab → Payments → Federal Withholding (Line 25a)',
      'Refund/Owed → Federal Return Tab → Refund or Amount Owed (Lines 34/37)',
    ]},
    { category: 'State Return Tab (Maryland Form 502)', fields: [
      'MD AGI → State Return Tab → Maryland AGI (Line 1)',
      'State Tax → State Return Tab → Maryland Tax (Line 22)',
      'State Withholding → State Return Tab → Maryland Withholding (Line 26)',
      'State Refund/Owed → State Return Tab → Refund or Amount Owed (Lines 31/32)',
    ]},
    { category: 'Income Documents', fields: [
      '1099-INT → Federal Return Tab → Income → Interest Income (Schedule B if >$1,500)',
      '1099-DIV → Federal Return Tab → Income → Dividend Income',
      '1099-MISC/NEC → Federal Return Tab → Income → Other Income or Schedule C',
      'Schedule C → Federal Return Tab → Income → Business Income (Schedule C)',
    ]},
  ];

  fieldMappings.forEach(mapping => {
    if (yPos > 240) {
      doc.addPage();
      yPos = 30;
    }

    doc.setFontSize(FONTS.sectionHeader.size);
    doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
    doc.setTextColor(...COLORS.primary);
    doc.text(mapping.category, MARGINS.left, yPos);
    yPos += 8;

    doc.setFontSize(FONTS.body.size);
    doc.setFont(FONTS.body.family, FONTS.body.style);
    doc.setTextColor(...COLORS.black);
    mapping.fields.forEach(field => {
      const lines = doc.splitTextToSize(`  • ${field}`, pageWidth - MARGINS.left - MARGINS.right);
      doc.text(lines, MARGINS.left, yPos);
      yPos += lines.length * 6;
    });
    yPos += 8;
  });

  // Screen Placeholders
  if (yPos > 200) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('TAXSLAYER SCREEN REFERENCE', MARGINS.left, yPos);
  yPos += 12;

  const screenRefs = [
    '[TaxSlayer Screen: Personal Info Tab - Main taxpayer information]',
    '[TaxSlayer Screen: Federal Return Tab - Income Section]',
    '[TaxSlayer Screen: Federal Return Tab - Credits Section]',
    '[TaxSlayer Screen: State Return Tab - Maryland Form 502]',
  ];

  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, 'italic');
  doc.setTextColor(...COLORS.secondary);
  screenRefs.forEach(ref => {
    doc.text(ref, MARGINS.left, yPos);
    yPos += 8;
  });
  yPos += 10;

  // Quick Tips Section
  if (yPos > 200) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.primary);
  doc.text('QUICK TIPS & TIME-SAVERS', MARGINS.left, yPos);
  yPos += 12;

  const tips = [
    '✓ Use Tab key to navigate between fields quickly',
    '✓ TaxSlayer auto-calculates AGI and Total Tax - verify calculations match',
    '✓ Double-check SSN entry - common source of errors',
    '✓ Filing status must be entered before credits calculate correctly',
    '✓ W-2 Box 1 (Wages) goes to Federal Return → Income → W-2 Wages',
    '✓ Check "Filing Status" affects EITC and CTC eligibility - verify carefully',
    '✓ Save frequently - TaxSlayer times out after 20 minutes of inactivity',
  ];

  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, FONTS.body.style);
  doc.setTextColor(...COLORS.black);
  tips.forEach(tip => {
    const lines = doc.splitTextToSize(tip, pageWidth - MARGINS.left - MARGINS.right);
    doc.text(lines, MARGINS.left, yPos);
    yPos += lines.length * 6 + 2;
  });
  yPos += 10;

  // Common Errors Section
  if (yPos > 220) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFillColor(254, 243, 199); // Yellow background
  doc.rect(MARGINS.left, yPos, pageWidth - MARGINS.left - MARGINS.right, 50, 'F');
  
  doc.setFontSize(FONTS.sectionHeader.size);
  doc.setFont(FONTS.sectionHeader.family, FONTS.sectionHeader.style);
  doc.setTextColor(...COLORS.danger);
  doc.text('⚠️ COMMON ERRORS TO AVOID', MARGINS.left + 5, yPos + 10);
  yPos += 18;

  const errors = [
    '• Entering W-2 Box 2 (Withholding) in the Wages field - goes in separate withholding field',
    '• Forgetting to enter spouse SSN for Married Filing Jointly returns',
    '• Missing state withholding - check W-2 Box 17 for MD withholding',
    '• Not claiming all eligible credits - review EITC, CTC eligibility carefully',
  ];

  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, FONTS.body.style);
  doc.setTextColor(...COLORS.black);
  errors.forEach(error => {
    const lines = doc.splitTextToSize(error, pageWidth - MARGINS.left - MARGINS.right - 10);
    doc.text(lines, MARGINS.left + 5, yPos);
    yPos += lines.length * 6;
  });

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
  const addRow = (field: string, taxslayerValue: number | null, ourValue?: number) => {
    const tsValue = taxslayerValue || 0;
    const diff = ourValue !== undefined ? ourValue - tsValue : 0;
    const variance = tsValue !== 0 && ourValue !== undefined 
      ? ((diff / tsValue) * 100).toFixed(2) 
      : '0.00';
    
    rows.push([
      field,
      formatCurrency(tsValue),
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

function getTaxpayerName(taxReturn: TaxslayerReturn): string {
  // Try to extract from related VITA session if available
  // For now, return empty - this would be populated from the actual VITA session
  return '';
}

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

function addChecklistItem(doc: jsPDF, label: string, value: string, yPos: number, pageHeight: number): number {
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFontSize(FONTS.body.size);
  doc.setFont(FONTS.body.family, FONTS.body.style);
  doc.setTextColor(...COLORS.black);
  doc.text(label, MARGINS.left, yPos);
  
  doc.setFont(FONTS.data.family, FONTS.data.style);
  doc.setTextColor(...COLORS.primary);
  doc.text(value, MARGINS.left + 80, yPos);
  
  return yPos + 7;
}

function calculateTotalFields(taxReturn: TaxslayerReturn): number {
  let count = 3; // Personal info
  count += 5; // Federal return
  count += 6; // Credits
  count += 4; // State return
  
  if (Array.isArray(taxReturn.w2Forms)) {
    count += taxReturn.w2Forms.length;
  }
  
  if (Array.isArray(taxReturn.form1099s)) {
    count += taxReturn.form1099s.length;
  }
  
  if (taxReturn.scheduleC) {
    count += 3; // Schedule C fields
  }
  
  return count;
}

interface VarianceItem {
  field: string;
  taxslayerValue: number;
  ourValue?: number;
  difference?: number;
  status: 'match' | 'minor' | 'major' | 'unknown';
}

function calculateVariances(
  taxReturn: TaxslayerReturn,
  ourCalculation?: {
    federalAGI: number;
    federalTax: number;
    federalRefund: number;
    eitcAmount: number;
    ctcAmount: number;
  }
): VarianceItem[] {
  const variances: VarianceItem[] = [];

  const addVariance = (field: string, taxslayerValue: number | null, ourValue?: number) => {
    const tsValue = taxslayerValue || 0;
    if (ourValue === undefined) {
      variances.push({
        field,
        taxslayerValue: tsValue,
        ourValue: undefined,
        difference: undefined,
        status: 'unknown',
      });
      return;
    }

    const difference = ourValue - tsValue;
    const absDiff = Math.abs(difference);
    
    let status: 'match' | 'minor' | 'major' = 'match';
    if (absDiff > 50) {
      status = 'major';
    } else if (absDiff > 0) {
      status = 'minor';
    }

    variances.push({
      field,
      taxslayerValue: tsValue,
      ourValue,
      difference,
      status,
    });
  };

  addVariance('Federal AGI', taxReturn.federalAGI, ourCalculation?.federalAGI);
  addVariance('Federal Tax', taxReturn.federalTax, ourCalculation?.federalTax);
  addVariance('Federal Refund', taxReturn.federalRefund, ourCalculation?.federalRefund);
  addVariance('EITC', taxReturn.eitcAmount, ourCalculation?.eitcAmount);
  addVariance('CTC', taxReturn.ctcAmount, ourCalculation?.ctcAmount);

  return variances;
}
