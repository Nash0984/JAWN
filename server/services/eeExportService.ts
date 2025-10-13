import { storage } from "../storage";
import type { ClientInteractionSession, ClientCase, EligibilityCalculation, ClientVerificationDocument } from "../../shared/schema";

/**
 * E&E (Errors & Exclusions) Export Service
 * 
 * Generates comprehensive reports for LDSS (Local Department of Social Services) submission
 * including client data, benefit calculations, document checklist, and navigator notes.
 */

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

export class EEExportService {
  /**
   * Prepare sessions with full context for E&E export
   */
  async prepareExportData(sessionIds: string[]): Promise<EEExportData> {
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
          console.error(`Error loading client case ${session.clientCaseId}:`, error);
        }
      }

      // Get actual verification documents for this session
      try {
        const verificationDocs = await storage.getClientVerificationDocuments({ sessionId: session.id });
        enriched.verificationDocuments = verificationDocs;
        
        // Calculate document verification status from actual documents
        enriched.documentVerificationStatus = {
          total: verificationDocs.length,
          verified: verificationDocs.filter(d => d.verificationStatus === 'verified').length,
          rejected: verificationDocs.filter(d => d.verificationStatus === 'rejected').length,
          pending: verificationDocs.filter(d => d.verificationStatus === 'pending').length
        };
      } catch (error) {
        console.error(`Error loading verification documents for session ${session.id}:`, error);
        enriched.verificationDocuments = [];
        enriched.documentVerificationStatus = { total: 0, verified: 0, rejected: 0, pending: 0 };
      }

      // Track summary statistics
      sessionTypes[session.sessionType] = (sessionTypes[session.sessionType] || 0) + 1;
      if (session.outcomeStatus) {
        outcomeStatuses[session.outcomeStatus] = (outcomeStatuses[session.outcomeStatus] || 0) + 1;
      }

      enrichedSessions.push(enriched);
    }

    return {
      sessions: enrichedSessions,
      summary: {
        totalSessions: sessions.length,
        totalClients: uniqueClients.size,
        totalBenefitsSecured: totalBenefits,
        sessionTypes,
        outcomeStatuses
      }
    };
  }

  /**
   * Generate CSV format for E&E export
   */
  async generateCSV(sessionIds: string[]): Promise<string> {
    const data = await this.prepareExportData(sessionIds);

    // Enhanced CSV headers with full benefit calculation details
    const headers = [
      'Session ID',
      'Session Date',
      'Session Type',
      'Duration (min)',
      'Location',
      'Outcome Status',
      'Client Name',
      'Client ID',
      'Household Size',
      'Estimated Income',
      'Case Status',
      'Eligible',
      'Monthly Benefit',
      'Calculation Method',
      'Calculation Date',
      'Topics Discussed',
      'Action Items',
      'Documents Total',
      'Documents Verified',
      'Documents Pending',
      'Document Checklist',
      'Navigator Notes',
      'Session Created'
    ].join(',');

    const rows = data.sessions.map(session => {
      const client = session.clientCase;
      const calc = session.eligibilityCalculation;
      const docStatus = session.documentVerificationStatus;
      
      // Build document checklist with type, filename, status, analysis status, and date
      const documentChecklist = (session.verificationDocuments || [])
        .map(doc => `${doc.documentType}:${doc.fileName}:${doc.verificationStatus || 'pending'}:${doc.visionAnalysisStatus || 'pending'}:${new Date(doc.createdAt).toISOString().split('T')[0]}`)
        .join('; ');

      return [
        session.id,
        new Date(session.interactionDate).toISOString().split('T')[0],
        session.sessionType,
        session.durationMinutes != null ? session.durationMinutes : '',
        session.location || '',
        session.outcomeStatus || '',
        client?.clientName || '',
        client?.clientIdentifier || '',
        client?.householdSize != null ? client.householdSize : '',
        client?.estimatedIncome != null ? (client.estimatedIncome / 100).toFixed(2) : '',
        client?.status || '',
        calc?.isEligible ? 'Yes' : 'No',
        calc?.monthlyBenefit != null ? (calc.monthlyBenefit / 100).toFixed(2) : '',
        calc?.calculationMethod || '',
        calc?.calculatedAt ? new Date(calc.calculatedAt).toISOString().split('T')[0] : '',
        Array.isArray(session.topicsDiscussed) ? session.topicsDiscussed.join('; ') : '',
        Array.isArray(session.actionItems) ? session.actionItems.map((a: any) => a.task || a).join('; ') : '',
        docStatus?.total != null ? docStatus.total : '0',
        docStatus?.verified != null ? docStatus.verified : '0',
        docStatus?.pending != null ? docStatus.pending : '0',
        documentChecklist,
        (session.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
        new Date(session.createdAt).toISOString()
      ].map(value => `"${value}"`).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Generate JSON format for E&E export
   */
  async generateJSON(sessionIds: string[]): Promise<string> {
    const data = await this.prepareExportData(sessionIds);
    
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      summary: data.summary,
      sessions: data.sessions.map(session => ({
        sessionId: session.id,
        sessionDate: session.interactionDate,
        sessionType: session.sessionType,
        durationMinutes: session.durationMinutes,
        location: session.location,
        outcomeStatus: session.outcomeStatus,
        createdAt: session.createdAt,
        client: session.clientCase ? {
          name: session.clientCase.clientName,
          identifier: session.clientCase.clientIdentifier,
          householdSize: session.clientCase.householdSize,
          estimatedIncome: session.clientCase.estimatedIncome,
          status: session.clientCase.status
        } : null,
        benefitCalculation: session.eligibilityCalculation ? {
          isEligible: session.eligibilityCalculation.isEligible,
          monthlyBenefit: session.eligibilityCalculation.monthlyBenefit,
          calculationMethod: session.eligibilityCalculation.calculationMethod,
          calculatedAt: session.eligibilityCalculation.calculatedAt,
          calculationId: session.eligibilityCalculation.id,
          householdData: session.eligibilityCalculation.householdData,
          resultsBreakdown: session.eligibilityCalculation.resultsBreakdown
        } : null,
        topicsDiscussed: session.topicsDiscussed,
        actionItems: session.actionItems,
        documentStatus: session.documentVerificationStatus,
        verificationDocuments: (session.verificationDocuments || []).map(doc => ({
          documentType: doc.documentType,
          fileName: doc.fileName,
          verificationStatus: doc.verificationStatus,
          uploadedBy: doc.uploadedBy,
          createdAt: doc.createdAt,
          extractedData: doc.extractedData,
          visionAnalysisStatus: doc.visionAnalysisStatus
        })),
        navigatorNotes: session.notes
      }))
    }, null, 2);
  }

  /**
   * Generate XML format for E&E export (legacy LDSS systems)
   */
  async generateXML(sessionIds: string[]): Promise<string> {
    const data = await this.prepareExportData(sessionIds);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<EEExport>\n';
    xml += `  <ExportDate>${new Date().toISOString()}</ExportDate>\n`;
    xml += '  <Summary>\n';
    xml += `    <TotalSessions>${data.summary.totalSessions}</TotalSessions>\n`;
    xml += `    <TotalClients>${data.summary.totalClients}</TotalClients>\n`;
    xml += `    <TotalBenefitsSecured>${(data.summary.totalBenefitsSecured / 100).toFixed(2)}</TotalBenefitsSecured>\n`;
    xml += '  </Summary>\n';
    xml += '  <Sessions>\n';

    for (const session of data.sessions) {
      xml += '    <Session>\n';
      xml += `      <ID>${session.id}</ID>\n`;
      xml += `      <Date>${new Date(session.interactionDate).toISOString()}</Date>\n`;
      xml += `      <Type>${session.sessionType}</Type>\n`;
      xml += `      <Duration>${session.durationMinutes || 0}</Duration>\n`;
      xml += `      <Location>${session.location || ''}</Location>\n`;
      xml += `      <Outcome>${session.outcomeStatus || ''}</Outcome>\n`;

      if (session.clientCase) {
        xml += '      <Client>\n';
        xml += `        <Name>${this.escapeXml(session.clientCase.clientName)}</Name>\n`;
        xml += `        <Identifier>${session.clientCase.clientIdentifier || ''}</Identifier>\n`;
        xml += `        <HouseholdSize>${session.clientCase.householdSize || 0}</HouseholdSize>\n`;
        xml += `        <EstimatedIncome>${session.clientCase.estimatedIncome ? (session.clientCase.estimatedIncome / 100).toFixed(2) : '0'}</EstimatedIncome>\n`;
        xml += `        <Status>${session.clientCase.status}</Status>\n`;
        xml += '      </Client>\n';
      }

      if (session.eligibilityCalculation) {
        xml += '      <BenefitCalculation>\n';
        xml += `        <Eligible>${session.eligibilityCalculation.isEligible}</Eligible>\n`;
        xml += `        <MonthlyBenefit>${session.eligibilityCalculation.monthlyBenefit ? (session.eligibilityCalculation.monthlyBenefit / 100).toFixed(2) : '0'}</MonthlyBenefit>\n`;
        xml += `        <CalculationMethod>${this.escapeXml(session.eligibilityCalculation.calculationMethod || '')}</CalculationMethod>\n`;
        xml += `        <CalculatedAt>${session.eligibilityCalculation.calculatedAt ? new Date(session.eligibilityCalculation.calculatedAt).toISOString() : ''}</CalculatedAt>\n`;
        xml += '      </BenefitCalculation>\n';
      }

      if (session.verificationDocuments && session.verificationDocuments.length > 0) {
        xml += '      <VerificationDocuments>\n';
        for (const doc of session.verificationDocuments) {
          xml += '        <Document>\n';
          xml += `          <Type>${this.escapeXml(doc.documentType)}</Type>\n`;
          xml += `          <FileName>${this.escapeXml(doc.fileName)}</FileName>\n`;
          xml += `          <Status>${this.escapeXml(doc.verificationStatus || 'pending')}</Status>\n`;
          xml += `          <UploadedDate>${new Date(doc.createdAt).toISOString()}</UploadedDate>\n`;
          xml += `          <AnalysisStatus>${this.escapeXml(doc.visionAnalysisStatus || 'pending')}</AnalysisStatus>\n`;
          xml += '        </Document>\n';
        }
        xml += '      </VerificationDocuments>\n';
      }

      if (session.documentVerificationStatus) {
        xml += '      <DocumentSummary>\n';
        xml += `        <Total>${session.documentVerificationStatus.total}</Total>\n`;
        xml += `        <Verified>${session.documentVerificationStatus.verified}</Verified>\n`;
        xml += `        <Rejected>${session.documentVerificationStatus.rejected}</Rejected>\n`;
        xml += `        <Pending>${session.documentVerificationStatus.pending}</Pending>\n`;
        xml += '      </DocumentSummary>\n';
      }

      if (session.notes) {
        xml += `      <Notes>${this.escapeXml(session.notes)}</Notes>\n`;
        xml += `      <SessionCreatedAt>${new Date(session.createdAt).toISOString()}</SessionCreatedAt>\n`;
      }

      xml += '    </Session>\n';
    }

    xml += '  </Sessions>\n';
    xml += '</EEExport>';

    return xml;
  }

  /**
   * Helper: Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const eeExportService = new EEExportService();
