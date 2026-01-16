import { db } from '../../db';
import { eeSyntheticLifeEvents } from '../../../shared/schema';
import { eq, isNull, desc, and, gte, lte, sql } from 'drizzle-orm';
import { dataSourceRegistry, initializeExternalDataSources } from './index';
import type { LifeEvent } from './types';
import { logger as log } from '../logger.service';

export interface LifeEventImpactAssessment {
  eventId: string;
  impactType: 'eligibility_change' | 'benefit_change' | 'recertification_needed' | 'no_impact';
  impactSeverity: 'high' | 'medium' | 'low';
  affectedPrograms: string[];
  actionRequired: string;
  explanation: string;
  policyEngineVerification?: {
    verified: boolean;
    discrepancy?: string;
    timestamp: Date;
  };
}

export interface MonitoringStats {
  totalEvents: number;
  unprocessedEvents: number;
  highSeverityEvents: number;
  eventsByType: Record<string, number>;
  eventsBySource: Record<string, number>;
  lastProcessedAt?: Date;
}

class LifeEventMonitorService {
  private static instance: LifeEventMonitorService;
  private isMonitoring = false;

  private constructor() {
    initializeExternalDataSources();
  }

  static getInstance(): LifeEventMonitorService {
    if (!LifeEventMonitorService.instance) {
      LifeEventMonitorService.instance = new LifeEventMonitorService();
    }
    return LifeEventMonitorService.instance;
  }

  async getUnprocessedEvents(limit = 100): Promise<LifeEvent[]> {
    const events = await db
      .select()
      .from(eeSyntheticLifeEvents)
      .where(isNull(eeSyntheticLifeEvents.processedAt))
      .orderBy(desc(eeSyntheticLifeEvents.detectedAt))
      .limit(limit);

    return events.map(e => ({
      id: e.id,
      individualId: e.individualId,
      eventType: e.eventType as LifeEvent['eventType'],
      eventDate: new Date(e.eventDate),
      detectedAt: e.detectedAt || new Date(),
      source: e.source as any,
      details: (e.details || {}) as Record<string, unknown>,
      processedAt: e.processedAt || undefined,
      caseImpactAssessed: e.caseImpactAssessed || false,
    }));
  }

  async assessEventImpact(event: LifeEvent): Promise<LifeEventImpactAssessment> {
    const assessment = await this.determineImpact(event);
    
    await db
      .update(eeSyntheticLifeEvents)
      .set({
        impactType: assessment.impactType,
        impactSeverity: assessment.impactSeverity,
        actionRequired: assessment.actionRequired,
        caseImpactAssessed: true,
        updatedAt: new Date(),
      })
      .where(eq(eeSyntheticLifeEvents.id, event.id));

    log.info('[LifeEventMonitor] Impact assessed', {
      eventId: event.id,
      eventType: event.eventType,
      impactType: assessment.impactType,
      impactSeverity: assessment.impactSeverity,
    });

    return assessment;
  }

  private async determineImpact(event: LifeEvent): Promise<LifeEventImpactAssessment> {
    const eventType = event.eventType;
    
    switch (eventType) {
      case 'death':
        return {
          eventId: event.id,
          impactType: 'eligibility_change',
          impactSeverity: 'high',
          affectedPrograms: ['snap', 'medicaid', 'tanf'],
          actionRequired: 'Immediate case review required. Update household composition and recalculate benefits.',
          explanation: 'Death of household member affects household size and income calculations for all programs.',
        };

      case 'birth':
        return {
          eventId: event.id,
          impactType: 'benefit_change',
          impactSeverity: 'medium',
          affectedPrograms: ['snap', 'medicaid', 'tanf'],
          actionRequired: 'Add new household member. Review eligibility for increased benefits.',
          explanation: 'Birth of new household member may increase benefit amounts and qualify household for additional programs.',
        };

      case 'income_change':
        const incomeDetails = event.details as { changeType?: string; changePercent?: number };
        const changePercent = incomeDetails?.changePercent || 0;
        const severity = Math.abs(changePercent) > 20 ? 'high' : Math.abs(changePercent) > 10 ? 'medium' : 'low';
        
        return {
          eventId: event.id,
          impactType: Math.abs(changePercent) > 15 ? 'eligibility_change' : 'benefit_change',
          impactSeverity: severity,
          affectedPrograms: ['snap', 'medicaid', 'tanf'],
          actionRequired: `Income change of ${changePercent}% detected. ${severity === 'high' ? 'Immediate' : 'Scheduled'} eligibility review required.`,
          explanation: `Significant income change may affect eligibility thresholds or benefit calculations across programs.`,
        };

      case 'employment_change':
        const employmentDetails = event.details as { type?: string };
        const isJobLoss = employmentDetails?.type === 'termination' || employmentDetails?.type === 'layoff';
        
        return {
          eventId: event.id,
          impactType: isJobLoss ? 'eligibility_change' : 'recertification_needed',
          impactSeverity: isJobLoss ? 'high' : 'medium',
          affectedPrograms: ['snap', 'medicaid'],
          actionRequired: isJobLoss 
            ? 'Job loss detected. Expedite benefit review and potential increase.'
            : 'Employment change detected. Schedule recertification to verify income.',
          explanation: isJobLoss
            ? 'Job loss may qualify household for expedited SNAP benefits and increased Medicaid coverage.'
            : 'Employment change requires income verification at next recertification.',
        };

      case 'address_change':
        return {
          eventId: event.id,
          impactType: 'recertification_needed',
          impactSeverity: 'low',
          affectedPrograms: ['snap', 'medicaid', 'ohep'],
          actionRequired: 'Update address records. Verify residence is within jurisdiction.',
          explanation: 'Address change requires verification for continued program eligibility and utility assistance.',
        };

      case 'household_composition_change':
        return {
          eventId: event.id,
          impactType: 'benefit_change',
          impactSeverity: 'medium',
          affectedPrograms: ['snap', 'medicaid', 'tanf'],
          actionRequired: 'Review household composition changes and recalculate benefits.',
          explanation: 'Changes in household members affect benefit calculations and eligibility.',
        };

      case 'marriage':
      case 'divorce':
        return {
          eventId: event.id,
          impactType: 'eligibility_change',
          impactSeverity: 'high',
          affectedPrograms: ['snap', 'medicaid', 'tanf', 'tax_credits'],
          actionRequired: `${eventType === 'marriage' ? 'Marriage' : 'Divorce'} detected. Full case review required.`,
          explanation: `${eventType === 'marriage' ? 'Marriage' : 'Divorce'} significantly changes household composition, income, and filing status.`,
        };

      default:
        return {
          eventId: event.id,
          impactType: 'no_impact',
          impactSeverity: 'low',
          affectedPrograms: [],
          actionRequired: 'No immediate action required.',
          explanation: 'Event type does not require case action.',
        };
    }
  }

  async markEventProcessed(eventId: string): Promise<void> {
    await db
      .update(eeSyntheticLifeEvents)
      .set({
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eeSyntheticLifeEvents.id, eventId));
  }

  async processUnprocessedEvents(batchSize = 50): Promise<{ processed: number; assessments: LifeEventImpactAssessment[] }> {
    const events = await this.getUnprocessedEvents(batchSize);
    const assessments: LifeEventImpactAssessment[] = [];

    for (const event of events) {
      try {
        const assessment = await this.assessEventImpact(event);
        assessments.push(assessment);
        await this.markEventProcessed(event.id);
      } catch (error) {
        log.error('[LifeEventMonitor] Error processing event', {
          eventId: event.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { processed: assessments.length, assessments };
  }

  async getMonitoringStats(): Promise<MonitoringStats> {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE processed_at IS NULL) as unprocessed_events,
        COUNT(*) FILTER (WHERE impact_severity = 'high') as high_severity_events,
        MAX(processed_at) as last_processed_at
      FROM ee_synthetic_life_events
    `);

    const eventsByType = await db.execute(sql`
      SELECT event_type, COUNT(*) as count
      FROM ee_synthetic_life_events
      GROUP BY event_type
    `);

    const eventsBySource = await db.execute(sql`
      SELECT source, COUNT(*) as count
      FROM ee_synthetic_life_events
      GROUP BY source
    `);

    const row = stats.rows[0] as any || {};
    
    return {
      totalEvents: parseInt(row.total_events) || 0,
      unprocessedEvents: parseInt(row.unprocessed_events) || 0,
      highSeverityEvents: parseInt(row.high_severity_events) || 0,
      eventsByType: Object.fromEntries(
        (eventsByType.rows as any[]).map(r => [r.event_type, parseInt(r.count)])
      ),
      eventsBySource: Object.fromEntries(
        (eventsBySource.rows as any[]).map(r => [r.source, parseInt(r.count)])
      ),
      lastProcessedAt: row.last_processed_at ? new Date(row.last_processed_at) : undefined,
    };
  }

  async getEventsByIndividual(individualId: string, days = 90): Promise<LifeEvent[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const events = await db
      .select()
      .from(eeSyntheticLifeEvents)
      .where(
        and(
          eq(eeSyntheticLifeEvents.individualId, individualId),
          gte(eeSyntheticLifeEvents.eventDate, startDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(eeSyntheticLifeEvents.eventDate));

    return events.map(e => ({
      id: e.id,
      individualId: e.individualId,
      eventType: e.eventType as LifeEvent['eventType'],
      eventDate: new Date(e.eventDate),
      detectedAt: e.detectedAt || new Date(),
      source: e.source as any,
      details: (e.details || {}) as Record<string, unknown>,
      processedAt: e.processedAt || undefined,
      caseImpactAssessed: e.caseImpactAssessed || false,
    }));
  }

  async getHighPriorityEvents(limit = 20): Promise<Array<LifeEvent & { impactSeverity?: string }>> {
    const events = await db
      .select()
      .from(eeSyntheticLifeEvents)
      .where(
        and(
          isNull(eeSyntheticLifeEvents.processedAt),
          eq(eeSyntheticLifeEvents.impactSeverity, 'high')
        )
      )
      .orderBy(desc(eeSyntheticLifeEvents.detectedAt))
      .limit(limit);

    return events.map(e => ({
      id: e.id,
      individualId: e.individualId,
      eventType: e.eventType as LifeEvent['eventType'],
      eventDate: new Date(e.eventDate),
      detectedAt: e.detectedAt || new Date(),
      source: e.source as any,
      details: (e.details || {}) as Record<string, unknown>,
      processedAt: e.processedAt || undefined,
      caseImpactAssessed: e.caseImpactAssessed || false,
      impactSeverity: e.impactSeverity || undefined,
    }));
  }

  async generateSyntheticLifeEvent(params: {
    individualId: string;
    eventType: string;
    source?: string;
    details?: Record<string, unknown>;
  }): Promise<string> {
    const result = await db.insert(eeSyntheticLifeEvents).values({
      individualId: params.individualId,
      caseNumber: null,
      eventType: params.eventType,
      eventDate: new Date().toISOString().split('T')[0],
      source: params.source || 'synthetic_generator',
      details: params.details || {},
    }).returning({ id: eeSyntheticLifeEvents.id });

    log.info('[LifeEventMonitor] Synthetic event generated', {
      eventId: result[0].id,
      eventType: params.eventType,
      individualId: params.individualId,
    });

    return result[0].id;
  }

  async getDataSourceHealth(): Promise<Record<string, { healthy: boolean; usingSynthetic: boolean }>> {
    return dataSourceRegistry.healthCheckAll();
  }
}

export const lifeEventMonitor = LifeEventMonitorService.getInstance();
