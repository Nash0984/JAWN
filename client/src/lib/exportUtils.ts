import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// ============================================================================
// JSON EXPORT
// ============================================================================

export function exportToJSON(data: any, filename: string = 'export.json'): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, filename);
}

// ============================================================================
// CSV EXPORT
// ============================================================================

export function exportToCSV(
  data: any[], 
  headers: { key: string; label: string }[], 
  filename: string = 'export.csv'
): void {
  // Create CSV header
  const csvHeaders = headers.map(h => h.label).join(',');
  
  // Create CSV rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header.key];
      
      // Handle different value types
      if (value === null || value === undefined) {
        return '';
      } else if (Array.isArray(value)) {
        return `"${value.join('; ')}"`;
      } else if (typeof value === 'object') {
        return `"${JSON.stringify(value)}"`;
      } else if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      } else {
        return value;
      }
    }).join(',');
  });
  
  const csvContent = [csvHeaders, ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export function exportToPDF(options: {
  title: string;
  data: any[];
  headers: { key: string; label: string }[];
  filename?: string;
  includeTimestamp?: boolean;
  additionalInfo?: { label: string; value: string }[];
}): void {
  const {
    title,
    data,
    headers,
    filename = 'export.pdf',
    includeTimestamp = true,
    additionalInfo = []
  } = options;

  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  
  // Add timestamp if requested
  let yPosition = 30;
  if (includeTimestamp) {
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPosition);
    yPosition += 10;
  }
  
  // Add additional info
  if (additionalInfo.length > 0) {
    doc.setFontSize(10);
    additionalInfo.forEach((info) => {
      doc.text(`${info.label}: ${info.value}`, 14, yPosition);
      yPosition += 6;
    });
    yPosition += 4;
  }
  
  // Prepare table data
  const tableHeaders = headers.map(h => h.label);
  const tableData = data.map(row => 
    headers.map(header => {
      const value = row[header.key];
      if (value === null || value === undefined) {
        return '';
      } else if (Array.isArray(value)) {
        return value.join(', ');
      } else if (typeof value === 'object') {
        return JSON.stringify(value);
      } else {
        return String(value);
      }
    })
  );
  
  // Add table
  doc.autoTable({
    head: [tableHeaders],
    body: tableData,
    startY: yPosition,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [66, 66, 66] },
    margin: { top: 10 },
  });
  
  // Save the PDF
  doc.save(filename);
}

// ============================================================================
// CLIENT INTAKE SUMMARY EXPORT
// ============================================================================

export function exportClientIntakeSummary(clientData: {
  clientName?: string;
  clientIdentifier?: string;
  sessionType?: string;
  interactionDate?: string;
  benefitProgram?: string;
  householdSize?: number;
  estimatedIncome?: number;
  topicsDiscussed?: string[];
  actionItems?: any[];
  notes?: string;
  navigatorName?: string;
}): void {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text('Client Intake Summary', 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Date: ${clientData.interactionDate || new Date().toLocaleDateString()}`, 14, 30);
  
  // Client Information Section
  let y = 45;
  doc.setFontSize(14);
  doc.text('Client Information', 14, y);
  y += 10;
  
  doc.setFontSize(10);
  const clientInfo = [
    { label: 'Name', value: clientData.clientName || 'Not provided' },
    { label: 'Identifier', value: clientData.clientIdentifier || 'Not provided' },
    { label: 'Benefit Program', value: clientData.benefitProgram || 'Not specified' },
    { label: 'Household Size', value: clientData.householdSize?.toString() || 'Not provided' },
    { label: 'Estimated Income', value: clientData.estimatedIncome ? `$${(clientData.estimatedIncome / 100).toLocaleString()}` : 'Not provided' },
  ];
  
  clientInfo.forEach(item => {
    doc.text(`${item.label}:`, 14, y);
    doc.text(item.value, 60, y);
    y += 7;
  });
  
  // Session Details Section
  y += 5;
  doc.setFontSize(14);
  doc.text('Session Details', 14, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`Session Type: ${clientData.sessionType || 'Not specified'}`, 14, y);
  y += 7;
  doc.text(`Navigator: ${clientData.navigatorName || 'Not specified'}`, 14, y);
  y += 10;
  
  // Topics Discussed
  if (clientData.topicsDiscussed && clientData.topicsDiscussed.length > 0) {
    doc.setFontSize(12);
    doc.text('Topics Discussed:', 14, y);
    y += 7;
    
    doc.setFontSize(10);
    clientData.topicsDiscussed.forEach(topic => {
      doc.text(`• ${topic}`, 20, y);
      y += 6;
    });
    y += 5;
  }
  
  // Action Items
  if (clientData.actionItems && clientData.actionItems.length > 0) {
    doc.setFontSize(12);
    doc.text('Action Items:', 14, y);
    y += 7;
    
    doc.setFontSize(10);
    clientData.actionItems.forEach((item: any) => {
      const task = typeof item === 'string' ? item : item.task || JSON.stringify(item);
      doc.text(`☐ ${task}`, 20, y);
      y += 6;
    });
    y += 5;
  }
  
  // Notes
  if (clientData.notes && clientData.notes.length > 0) {
    doc.setFontSize(12);
    doc.text('Session Notes:', 14, y);
    y += 7;
    
    doc.setFontSize(10);
    const notesLines = doc.splitTextToSize(clientData.notes, 180);
    doc.text(notesLines, 14, y);
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.text('This is a summary for client records. Not an official determination.', 14, pageHeight - 15);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, pageHeight - 10);
  
  // Save
  const filename = `intake-summary-${clientData.clientIdentifier || 'client'}-${Date.now()}.pdf`;
  doc.save(filename);
}

// ============================================================================
// E&E DATA EXPORT (Structured format for manual entry)
// ============================================================================

export function exportEEDataFormat(sessionData: any, clientData: any): void {
  const eeData = {
    // Individual Demographics
    individual: {
      individualId: clientData.id || '',
      mdmId: '', // To be assigned by E&E system
      ssn: clientData.clientIdentifier || '',
      dateOfBirth: clientData.dateOfBirth || '',
      gender: clientData.gender || '',
      race: clientData.race || '',
      ethnicity: clientData.ethnicity || '',
      citizenship: clientData.citizenship || '',
    },
    
    // Name Information
    name: {
      firstName: clientData.firstName || '',
      lastName: clientData.lastName || '',
      middleName: clientData.middleName || '',
    },
    
    // Contact Information (Business Context)
    contactBusiness: {
      phoneNumber: clientData.phone || '',
      phoneType: 'CELL', // Default, should be determined from data
      email: clientData.email || '',
      communicationMode: clientData.preferredContact || 'EMAIL',
      preferredTime: clientData.contactTime || '',
    },
    
    // Address Information (Residential)
    addressResidential: {
      addressType: 'RESIDENTIAL',
      addressLine1: clientData.street || '',
      addressLine2: clientData.apartment || '',
      city: clientData.city || '',
      state: clientData.state || 'MD',
      zipCode: clientData.zipCode || '',
      county: clientData.county || '',
      countyCode: clientData.countyCode || '',
    },
    
    // Session Context
    sessionContext: {
      sessionId: sessionData.id || '',
      sessionType: sessionData.sessionType || '',
      sessionDate: sessionData.interactionDate || '',
      navigatorId: sessionData.navigatorId || '',
      location: sessionData.location || '',
      notes: sessionData.notes || '',
    }
  };
  
  exportToJSON(eeData, `ee-export-${clientData.clientIdentifier || 'client'}-${Date.now()}.json`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Export format configurations
export const exportFormats = [
  { value: 'json', label: 'JSON', description: 'Structured data format' },
  { value: 'csv', label: 'CSV', description: 'Spreadsheet compatible' },
  { value: 'pdf', label: 'PDF', description: 'Printable summary' },
  { value: 'ee_json', label: 'E&E Format (JSON)', description: 'Structured for E&E system' },
] as const;

export type ExportFormat = typeof exportFormats[number]['value'];
