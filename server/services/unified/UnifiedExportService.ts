/**
 * Unified Export Service
 * 
 * Consolidates all export functionality into a single service using strategy pattern
 * for different export formats and types.
 * 
 * Combines functionality from:
 * - eeExportService.ts (E&E reports for LDSS submission)
 * - taxslayerExport.ts (TaxSlayer return data export to PDF)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Parser } from 'json2csv';
import * as XLSX from 'xlsx';
import { storage } from '../../storage';
import { logger } from '../logger.service';
import type { 
  ClientInteractionSession, 
  ClientCase, 
  EligibilityCalculation, 
  ClientVerificationDocument,
  TaxslayerReturn 
} from '@shared/schema';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'excel' | 'json';
  type: 'ee_report' | 'taxslayer_worksheet' | 'client_summary' | 'benefit_analysis' | 'document_checklist';
  includeMetadata?: boolean;
  groupBy?: string;
  sortBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  customFields?: string[];
}

export interface ExportMetadata {
  exportDate: Date;
  exportedBy?: string;
  recordCount: number;
  format: string;
  type: string;
  filters?: Record<string, any>;
}

export interface EEExportSession extends ClientInteractionSession {
  clientCase?: ClientCase;
  eligibilityCalculation?: EligibilityCalculation;
  verificationDocuments?: ClientVerificationDocument[];
  documentVerificationStatus?: {
    total: number;
    verified: number;
    rejected: number;
    pending: number;
  };
}

export interface EEExportData {
  sessions: EEExportSession[];
  summary: {
    totalSessions: number;
    totalClients: number;
    totalBenefitsSecured: number;
    sessionTypes: Record<string, number>;
    outcomeStatuses: Record<string, number>;
  };
}

// PDF Formatting Constants
const PDF_CONFIG = {
  MARGINS: { top: 54, bottom: 54, left: 54, right: 54 },
  FONTS: {
    title: { size: 16, family: 'helvetica', style: 'bold' },
    sectionHeader: { size: 12, family: 'helvetica', style: 'bold' },
    body: { size: 10, family: 'helvetica', style: 'normal' },
    data: { size: 10, family: 'courier', style: 'normal' },
    footer: { size: 8, family: 'helvetica', style: 'normal' },
  },
  COLORS: {
    primary: [41, 98, 255] as [number, number, number],
    secondary: [100, 116, 139] as [number, number, number],
    success: [34, 197, 94] as [number, number, number],
    warning: [234, 179, 8] as [number, number, number],
    danger: [239, 68, 68] as [number, number, number],
    gray: [148, 163, 184] as [number, number, number],
    black: [0, 0, 0] as [number, number, number],
  }
};

// ============================================================================
// EXPORT STRATEGIES
// ============================================================================

interface ExportStrategy {
  export(data: any, options: ExportOptions): Promise<Buffer>;
}

/**
 * PDF Export Strategy
 */
class PDFExportStrategy implements ExportStrategy {
  async export(data: any, options: ExportOptions): Promise<Buffer> {
    const doc = new jsPDF();
    
    switch (options.type) {
      case 'taxslayer_worksheet':
        return this.exportTaxSlayerWorksheet(doc, data);
      case 'ee_report':
        return this.exportEEReport(doc, data);
      case 'client_summary':
        return this.exportClientSummary(doc, data);
      case 'benefit_analysis':
        return this.exportBenefitAnalysis(doc, data);
      case 'document_checklist':
        return this.exportDocumentChecklist(doc, data);
      default:
        throw new Error(`Unsupported PDF export type: ${options.type}`);
    }
  }

  private exportTaxSlayerWorksheet(doc: jsPDF, taxReturn: TaxslayerReturn): Buffer {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFontSize(PDF_CONFIG.FONTS.title.size);
    doc.setFont(PDF_CONFIG.FONTS.title.family, PDF_CONFIG.FONTS.title.style);
    doc.setTextColor(...PDF_CONFIG.COLORS.primary);
    doc.text('TaxSlayer Pro Data Entry Worksheet', PDF_CONFIG.MARGINS.left, 35);
    
    doc.setFontSize(PDF_CONFIG.FONTS.sectionHeader.size);
    doc.setTextColor(...PDF_CONFIG.COLORS.black);
    doc.text(`Tax Year ${taxReturn.taxYear}`, PDF_CONFIG.MARGINS.left, 50);

    // Basic Information Section
    let currentY = 70;
    doc.setFontSize(PDF_CONFIG.FONTS.sectionHeader.size);
    doc.setFont(PDF_CONFIG.FONTS.sectionHeader.family, PDF_CONFIG.FONTS.sectionHeader.style);
    doc.text('1. TAXPAYER INFORMATION', PDF_CONFIG.MARGINS.left, currentY);
    
    currentY += 10;
    const basicInfo = [
      ['Filing Status:', taxReturn.filingStatus || 'Not specified'],
      ['First Name:', taxReturn.firstName || ''],
      ['Last Name:', taxReturn.lastName || ''],
      ['SSN:', taxReturn.ssn ? `XXX-XX-${taxReturn.ssn.slice(-4)}` : ''],
      ['Date of Birth:', taxReturn.dateOfBirth || ''],
      ['Phone:', taxReturn.phone || ''],
      ['Email:', taxReturn.email || ''],
    ];

    doc.setFont(PDF_CONFIG.FONTS.body.family, PDF_CONFIG.FONTS.body.style);
    doc.setFontSize(PDF_CONFIG.FONTS.body.size);
    basicInfo.forEach(([label, value]) => {
      doc.text(label, PDF_CONFIG.MARGINS.left + 10, currentY);
      doc.text(value, PDF_CONFIG.MARGINS.left + 60, currentY);
      currentY += 7;
    });

    // Income Section
    currentY += 10;
    if (currentY > pageHeight - PDF_CONFIG.MARGINS.bottom) {
      doc.addPage();
      currentY = PDF_CONFIG.MARGINS.top;
    }

    doc.setFont(PDF_CONFIG.FONTS.sectionHeader.family, PDF_CONFIG.FONTS.sectionHeader.style);
    doc.text('2. INCOME SUMMARY', PDF_CONFIG.MARGINS.left, currentY);
    
    currentY += 10;
    const incomeData = [
      ['W-2 Wages (Box 1):', taxReturn.w2Income?.toFixed(2) || '0.00'],
      ['1099-NEC Income:', taxReturn.income1099Nec?.toFixed(2) || '0.00'],
      ['1099-MISC Income:', taxReturn.income1099Misc?.toFixed(2) || '0.00'],
      ['Interest Income:', taxReturn.interestIncome?.toFixed(2) || '0.00'],
      ['Dividend Income:', taxReturn.dividendIncome?.toFixed(2) || '0.00'],
      ['Total Income:', (taxReturn.agi || 0).toFixed(2)],
    ];

    doc.setFont(PDF_CONFIG.FONTS.data.family, PDF_CONFIG.FONTS.data.style);
    incomeData.forEach(([label, value]) => {
      doc.text(label, PDF_CONFIG.MARGINS.left + 10, currentY);
      doc.text(`$${value}`, PDF_CONFIG.MARGINS.left + 80, currentY);
      currentY += 7;
    });

    // Add footer
    doc.setFontSize(PDF_CONFIG.FONTS.footer.size);
    doc.setTextColor(...PDF_CONFIG.COLORS.gray);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} | Page 1`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );

    return Buffer.from(doc.output('arraybuffer'));
  }

  private exportEEReport(doc: jsPDF, data: EEExportData): Buffer {
    // Header
    doc.setFontSize(PDF_CONFIG.FONTS.title.size);
    doc.setFont(PDF_CONFIG.FONTS.title.family, PDF_CONFIG.FONTS.title.style);
    doc.text('E&E Report for LDSS Submission', PDF_CONFIG.MARGINS.left, 35);
    
    // Summary Section
    let currentY = 60;
    doc.setFontSize(PDF_CONFIG.FONTS.sectionHeader.size);
    doc.text('Executive Summary', PDF_CONFIG.MARGINS.left, currentY);
    
    currentY += 10;
    doc.setFont(PDF_CONFIG.FONTS.body.family, PDF_CONFIG.FONTS.body.style);
    doc.setFontSize(PDF_CONFIG.FONTS.body.size);
    
    const summaryData = [
      ['Total Sessions:', data.summary.totalSessions.toString()],
      ['Unique Clients:', data.summary.totalClients.toString()],
      ['Benefits Secured:', `$${data.summary.totalBenefitsSecured.toFixed(2)}`],
    ];
    
    summaryData.forEach(([label, value]) => {
      doc.text(label, PDF_CONFIG.MARGINS.left + 10, currentY);
      doc.text(value, PDF_CONFIG.MARGINS.left + 60, currentY);
      currentY += 7;
    });

    // Sessions Table
    currentY += 15;
    doc.setFont(PDF_CONFIG.FONTS.sectionHeader.family, PDF_CONFIG.FONTS.sectionHeader.style);
    doc.text('Session Details', PDF_CONFIG.MARGINS.left, currentY);
    currentY += 10;

    const tableData = data.sessions.map(session => [
      session.sessionDate ? new Date(session.sessionDate).toLocaleDateString() : 'N/A',
      session.clientCase?.clientIdentifier || 'Anonymous',
      session.sessionType || 'Unknown',
      session.outcome || 'Pending',
      session.eligibilityCalculation?.monthlyBenefit 
        ? `$${session.eligibilityCalculation.monthlyBenefit.toFixed(2)}`
        : 'N/A'
    ]);

    autoTable(doc, {
      head: [['Date', 'Client ID', 'Type', 'Outcome', 'Benefit Amount']],
      body: tableData,
      startY: currentY,
      margin: { left: PDF_CONFIG.MARGINS.left },
      styles: { fontSize: 9 },
      headStyles: { fillColor: PDF_CONFIG.COLORS.primary },
    });

    return Buffer.from(doc.output('arraybuffer'));
  }

  private exportClientSummary(doc: jsPDF, data: any): Buffer {
    // Implement client summary PDF export
    doc.text('Client Summary Report', PDF_CONFIG.MARGINS.left, 35);
    // Add implementation
    return Buffer.from(doc.output('arraybuffer'));
  }

  private exportBenefitAnalysis(doc: jsPDF, data: any): Buffer {
    // Implement benefit analysis PDF export
    doc.text('Benefit Analysis Report', PDF_CONFIG.MARGINS.left, 35);
    // Add implementation
    return Buffer.from(doc.output('arraybuffer'));
  }

  private exportDocumentChecklist(doc: jsPDF, data: any): Buffer {
    // Implement document checklist PDF export
    doc.text('Document Verification Checklist', PDF_CONFIG.MARGINS.left, 35);
    // Add implementation
    return Buffer.from(doc.output('arraybuffer'));
  }
}

/**
 * CSV Export Strategy
 */
class CSVExportStrategy implements ExportStrategy {
  async export(data: any, options: ExportOptions): Promise<Buffer> {
    let csvData: any[] = [];
    let fields: string[] = [];

    switch (options.type) {
      case 'ee_report':
        ({ csvData, fields } = this.prepareEEReportData(data));
        break;
      case 'taxslayer_worksheet':
        ({ csvData, fields } = this.prepareTaxSlayerData(data));
        break;
      default:
        ({ csvData, fields } = this.prepareGenericData(data));
    }

    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    return Buffer.from(csv, 'utf-8');
  }

  private prepareEEReportData(data: EEExportData) {
    const fields = [
      'sessionDate',
      'clientId',
      'sessionType',
      'outcome',
      'benefitAmount',
      'navigatorName',
      'location',
      'documentsVerified',
      'documentsRejected',
      'notes'
    ];

    const csvData = data.sessions.map(session => ({
      sessionDate: session.sessionDate ? new Date(session.sessionDate).toLocaleDateString() : '',
      clientId: session.clientCase?.clientIdentifier || '',
      sessionType: session.sessionType || '',
      outcome: session.outcome || '',
      benefitAmount: session.eligibilityCalculation?.monthlyBenefit || 0,
      navigatorName: session.navigatorName || '',
      location: session.location || '',
      documentsVerified: session.documentVerificationStatus?.verified || 0,
      documentsRejected: session.documentVerificationStatus?.rejected || 0,
      notes: session.notes || ''
    }));

    return { csvData, fields };
  }

  private prepareTaxSlayerData(data: TaxslayerReturn) {
    const fields = [
      'taxYear',
      'filingStatus',
      'firstName',
      'lastName',
      'ssn',
      'w2Income',
      'income1099Nec',
      'income1099Misc',
      'interestIncome',
      'dividendIncome',
      'agi',
      'standardDeduction',
      'taxableIncome',
      'federalTaxWithheld',
      'refund'
    ];

    const csvData = [{
      taxYear: data.taxYear,
      filingStatus: data.filingStatus,
      firstName: data.firstName,
      lastName: data.lastName,
      ssn: data.ssn ? `XXX-XX-${data.ssn.slice(-4)}` : '',
      w2Income: data.w2Income || 0,
      income1099Nec: data.income1099Nec || 0,
      income1099Misc: data.income1099Misc || 0,
      interestIncome: data.interestIncome || 0,
      dividendIncome: data.dividendIncome || 0,
      agi: data.agi || 0,
      standardDeduction: data.standardDeduction || 0,
      taxableIncome: data.taxableIncome || 0,
      federalTaxWithheld: data.federalTaxWithheld || 0,
      refund: data.refund || 0
    }];

    return { csvData, fields };
  }

  private prepareGenericData(data: any) {
    // Handle generic data export
    const fields = Object.keys(data[0] || {});
    return { csvData: data, fields };
  }
}

/**
 * Excel Export Strategy
 */
class ExcelExportStrategy implements ExportStrategy {
  async export(data: any, options: ExportOptions): Promise<Buffer> {
    const workbook = XLSX.utils.book_new();
    
    switch (options.type) {
      case 'ee_report':
        this.createEEReportWorkbook(workbook, data);
        break;
      case 'taxslayer_worksheet':
        this.createTaxSlayerWorkbook(workbook, data);
        break;
      default:
        this.createGenericWorkbook(workbook, data);
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  private createEEReportWorkbook(workbook: XLSX.WorkBook, data: EEExportData) {
    // Summary sheet
    const summaryData = [
      ['E&E Report Summary'],
      [''],
      ['Metric', 'Value'],
      ['Total Sessions', data.summary.totalSessions],
      ['Unique Clients', data.summary.totalClients],
      ['Total Benefits Secured', data.summary.totalBenefitsSecured],
      [''],
      ['Session Types', ''],
      ...Object.entries(data.summary.sessionTypes).map(([type, count]) => [type, count]),
      [''],
      ['Outcome Statuses', ''],
      ...Object.entries(data.summary.outcomeStatuses).map(([status, count]) => [status, count])
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sessions detail sheet
    const sessionsData = [
      ['Date', 'Client ID', 'Session Type', 'Outcome', 'Benefit Amount', 'Navigator', 'Location'],
      ...data.sessions.map(session => [
        session.sessionDate ? new Date(session.sessionDate).toLocaleDateString() : '',
        session.clientCase?.clientIdentifier || '',
        session.sessionType || '',
        session.outcome || '',
        session.eligibilityCalculation?.monthlyBenefit || 0,
        session.navigatorName || '',
        session.location || ''
      ])
    ];
    const sessionsSheet = XLSX.utils.aoa_to_sheet(sessionsData);
    XLSX.utils.book_append_sheet(workbook, sessionsSheet, 'Sessions');
  }

  private createTaxSlayerWorkbook(workbook: XLSX.WorkBook, data: TaxslayerReturn) {
    // Basic info sheet
    const basicInfo = [
      ['TaxSlayer Data Entry Worksheet'],
      [''],
      ['Tax Year', data.taxYear],
      ['Filing Status', data.filingStatus || ''],
      [''],
      ['Taxpayer Information'],
      ['First Name', data.firstName || ''],
      ['Last Name', data.lastName || ''],
      ['SSN', data.ssn ? `XXX-XX-${data.ssn.slice(-4)}` : ''],
      ['Date of Birth', data.dateOfBirth || ''],
      ['Phone', data.phone || ''],
      ['Email', data.email || '']
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(basicInfo);
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Basic Info');

    // Income sheet
    const incomeData = [
      ['Income Summary'],
      [''],
      ['Income Type', 'Amount'],
      ['W-2 Wages', data.w2Income || 0],
      ['1099-NEC Income', data.income1099Nec || 0],
      ['1099-MISC Income', data.income1099Misc || 0],
      ['Interest Income', data.interestIncome || 0],
      ['Dividend Income', data.dividendIncome || 0],
      [''],
      ['Adjusted Gross Income', data.agi || 0]
    ];
    const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);
    XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Income');

    // Tax calculation sheet
    const taxData = [
      ['Tax Calculation'],
      [''],
      ['Description', 'Amount'],
      ['Adjusted Gross Income', data.agi || 0],
      ['Standard Deduction', data.standardDeduction || 0],
      ['Taxable Income', data.taxableIncome || 0],
      ['Federal Tax', data.federalTax || 0],
      ['Federal Tax Withheld', data.federalTaxWithheld || 0],
      ['Refund/Amount Due', data.refund || 0]
    ];
    const taxSheet = XLSX.utils.aoa_to_sheet(taxData);
    XLSX.utils.book_append_sheet(workbook, taxSheet, 'Tax Calculation');
  }

  private createGenericWorkbook(workbook: XLSX.WorkBook, data: any) {
    const worksheet = XLSX.utils.json_to_sheet(Array.isArray(data) ? data : [data]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  }
}

/**
 * JSON Export Strategy
 */
class JSONExportStrategy implements ExportStrategy {
  async export(data: any, options: ExportOptions): Promise<Buffer> {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        type: options.type,
        format: 'json',
        recordCount: Array.isArray(data) ? data.length : 1
      },
      data: data
    };
    
    return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
  }
}

// ============================================================================
// UNIFIED EXPORT SERVICE
// ============================================================================

export class UnifiedExportService {
  private exportStrategies = new Map<string, ExportStrategy>();

  constructor() {
    // Register export strategies
    this.exportStrategies.set('pdf', new PDFExportStrategy());
    this.exportStrategies.set('csv', new CSVExportStrategy());
    this.exportStrategies.set('excel', new ExcelExportStrategy());
    this.exportStrategies.set('json', new JSONExportStrategy());
  }

  // ============================================================================
  // E&E EXPORT FUNCTIONALITY
  // ============================================================================

  /**
   * Prepare sessions with full context for E&E export
   */
  async prepareEEExportData(sessionIds: string[]): Promise<EEExportData> {
    const sessions = await storage.getClientInteractionSessionsByIds(sessionIds);
    const enrichedSessions: EEExportSession[] = [];
    
    const uniqueClients = new Set<string>();
    let totalBenefits = 0;
    const sessionTypes: Record<string, number> = {};
    const outcomeStatuses: Record<string, number> = {};

    for (const session of sessions) {
      const enriched: EEExportSession = { ...session };

      // Get client case if exists
      if (session.clientCaseId) {
        try {
          const clientCase = await storage.getClientCase(session.clientCaseId);
          if (clientCase) {
            enriched.clientCase = clientCase;
            uniqueClients.add(clientCase.clientIdentifier || clientCase.id);

            // Get eligibility calculation
            if (clientCase.eligibilityCalculationId) {
              const calc = await storage.getEligibilityCalculation(clientCase.eligibilityCalculationId);
              if (calc) {
                enriched.eligibilityCalculation = calc;
                if (calc.monthlyBenefit) {
                  totalBenefits += calc.monthlyBenefit;
                }
              }
            }
          }
        } catch (error) {
          logger.error('Error loading client case', {
            error: error instanceof Error ? error.message : String(error),
            clientCaseId: session.clientCaseId,
            service: 'UnifiedExportService'
          });
        }
      }

      // Get verification documents
      if (session.id) {
        try {
          const docs = await storage.getClientVerificationDocumentsBySessionId(session.id);
          enriched.verificationDocuments = docs;
          
          // Calculate verification status
          enriched.documentVerificationStatus = {
            total: docs.length,
            verified: docs.filter(d => d.verificationStatus === 'verified').length,
            rejected: docs.filter(d => d.verificationStatus === 'rejected').length,
            pending: docs.filter(d => d.verificationStatus === 'pending').length,
          };
        } catch (error) {
          logger.error('Error loading documents for session', {
            error: error instanceof Error ? error.message : String(error),
            sessionId: session.id,
            service: 'UnifiedExportService'
          });
        }
      }

      // Track statistics
      const sessionType = session.sessionType || 'unknown';
      sessionTypes[sessionType] = (sessionTypes[sessionType] || 0) + 1;
      
      const outcome = session.outcome || 'pending';
      outcomeStatuses[outcome] = (outcomeStatuses[outcome] || 0) + 1;

      enrichedSessions.push(enriched);
    }

    return {
      sessions: enrichedSessions,
      summary: {
        totalSessions: sessions.length,
        totalClients: uniqueClients.size,
        totalBenefitsSecured: totalBenefits,
        sessionTypes,
        outcomeStatuses,
      },
    };
  }

  /**
   * Export E&E report
   */
  async exportEEReport(sessionIds: string[], options: ExportOptions): Promise<Buffer> {
    const data = await this.prepareEEExportData(sessionIds);
    return this.export(data, { ...options, type: 'ee_report' });
  }

  // ============================================================================
  // TAXSLAYER EXPORT FUNCTIONALITY
  // ============================================================================

  /**
   * Export TaxSlayer return data
   */
  async exportTaxSlayerReturn(returnId: string, options: ExportOptions): Promise<Buffer> {
    const taxReturn = await storage.getTaxslayerReturn(returnId);
    if (!taxReturn) {
      throw new Error('TaxSlayer return not found');
    }
    
    return this.export(taxReturn, { ...options, type: 'taxslayer_worksheet' });
  }

  // ============================================================================
  // GENERIC EXPORT FUNCTIONALITY
  // ============================================================================

  /**
   * Generic export method
   */
  async export(data: any, options: ExportOptions): Promise<Buffer> {
    const strategy = this.exportStrategies.get(options.format);
    if (!strategy) {
      throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Apply filtering and sorting if specified
    if (options.dateRange && Array.isArray(data)) {
      data = this.filterByDateRange(data, options.dateRange);
    }
    if (options.sortBy && Array.isArray(data)) {
      data = this.sortData(data, options.sortBy);
    }
    if (options.groupBy && Array.isArray(data)) {
      data = this.groupData(data, options.groupBy);
    }

    return strategy.export(data, options);
  }

  /**
   * Export multiple datasets in a single workbook/document
   */
  async exportMultiple(
    datasets: Array<{ name: string; data: any }>,
    options: ExportOptions
  ): Promise<Buffer> {
    if (options.format === 'excel') {
      const workbook = XLSX.utils.book_new();
      
      for (const dataset of datasets) {
        const worksheet = XLSX.utils.json_to_sheet(
          Array.isArray(dataset.data) ? dataset.data : [dataset.data]
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, dataset.name);
      }
      
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } else if (options.format === 'pdf') {
      // Create multi-section PDF
      const doc = new jsPDF();
      let pageNum = 0;
      
      for (const dataset of datasets) {
        if (pageNum > 0) doc.addPage();
        doc.text(dataset.name, PDF_CONFIG.MARGINS.left, 35);
        // Add dataset content
        pageNum++;
      }
      
      return Buffer.from(doc.output('arraybuffer'));
    } else {
      // For CSV and JSON, combine all datasets
      const combined = datasets.reduce((acc, dataset) => {
        acc[dataset.name] = dataset.data;
        return acc;
      }, {} as Record<string, any>);
      
      return this.export(combined, options);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private filterByDateRange(data: any[], dateRange: { start: Date; end: Date }): any[] {
    return data.filter(item => {
      const dateFields = ['date', 'createdAt', 'sessionDate', 'updatedAt'];
      for (const field of dateFields) {
        if (item[field]) {
          const itemDate = new Date(item[field]);
          if (itemDate >= dateRange.start && itemDate <= dateRange.end) {
            return true;
          }
        }
      }
      return false;
    });
  }

  private sortData(data: any[], sortBy: string): any[] {
    const [field, direction = 'asc'] = sortBy.split(':');
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) return 0;
      const result = aVal > bVal ? 1 : -1;
      return direction === 'desc' ? -result : result;
    });
  }

  private groupData(data: any[], groupBy: string): Record<string, any[]> {
    return data.reduce((groups, item) => {
      const key = item[groupBy] || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  }

  /**
   * Get supported export formats for a given type
   */
  getSupportedFormats(exportType: string): string[] {
    // All types support all formats currently
    return Array.from(this.exportStrategies.keys());
  }

  /**
   * Validate export options
   */
  validateOptions(options: ExportOptions): void {
    if (!this.exportStrategies.has(options.format)) {
      throw new Error(`Unsupported export format: ${options.format}`);
    }
    
    const validTypes = [
      'ee_report',
      'taxslayer_worksheet',
      'client_summary',
      'benefit_analysis',
      'document_checklist'
    ];
    
    if (!validTypes.includes(options.type)) {
      throw new Error(`Invalid export type: ${options.type}`);
    }
  }
}

// Export singleton instance
export const unifiedExportService = new UnifiedExportService();