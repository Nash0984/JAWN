import { storage } from "../storage";
import type { InsertNavigatorKpi, InsertCaseActivityEvent, NavigatorKpi } from "@shared/schema";
import { achievementSystemService } from "./achievementSystem.service";

/**
 * KPI Tracking Service
 * Automatically tracks navigator performance metrics and calculates KPIs
 */

interface CaseClosedEvent {
  navigatorId: string;
  caseId: string;
  countyId?: string;
  benefitAmount?: number;
  isApproved: boolean;
  responseTimeHours?: number;
  completionTimeDays?: number;
}

interface DocumentVerifiedEvent {
  navigatorId: string;
  caseId: string;
  countyId?: string;
  documentQuality: number; // Gemini confidence 0-1
}

interface CrossEnrollmentIdentifiedEvent {
  navigatorId: string;
  caseId: string;
  countyId?: string;
  potentialBenefitAmount: number;
}

class KpiTrackingService {
  /**
   * Track case closure and update KPIs
   */
  async trackCaseClosed(event: CaseClosedEvent): Promise<void> {
    // Create activity event
    await storage.createCaseActivityEvent({
      navigatorId: event.navigatorId,
      caseId: event.caseId,
      countyId: event.countyId || null,
      eventType: event.isApproved ? 'case_approved' : 'case_denied',
      benefitAmount: event.benefitAmount || null,
      responseTime: event.responseTimeHours || null,
      eventData: {
        completionTimeDays: event.completionTimeDays,
      },
      occurredAt: new Date(),
    });

    // Update daily, weekly, monthly, and all-time KPIs
    await this.updateKpiPeriod(event.navigatorId, 'daily', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'weekly', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'monthly', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'all_time', event.countyId);
  }

  /**
   * Track document verification and update quality metrics
   */
  async trackDocumentVerified(event: DocumentVerifiedEvent): Promise<void> {
    await storage.createCaseActivityEvent({
      navigatorId: event.navigatorId,
      caseId: event.caseId,
      countyId: event.countyId || null,
      eventType: 'document_verified',
      documentQuality: event.documentQuality,
      eventData: {},
      occurredAt: new Date(),
    });

    await this.updateKpiPeriod(event.navigatorId, 'daily', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'weekly', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'monthly', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'all_time', event.countyId);
  }

  /**
   * Track cross-enrollment opportunity identified
   */
  async trackCrossEnrollmentIdentified(event: CrossEnrollmentIdentifiedEvent): Promise<void> {
    await storage.createCaseActivityEvent({
      navigatorId: event.navigatorId,
      caseId: event.caseId,
      countyId: event.countyId || null,
      eventType: 'cross_enrollment_identified',
      benefitAmount: event.potentialBenefitAmount,
      eventData: {},
      occurredAt: new Date(),
    });

    await this.updateKpiPeriod(event.navigatorId, 'daily', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'weekly', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'monthly', event.countyId);
    await this.updateKpiPeriod(event.navigatorId, 'all_time', event.countyId);
  }

  /**
   * Update KPI metrics for a specific period
   */
  private async updateKpiPeriod(
    navigatorId: string, 
    periodType: 'daily' | 'weekly' | 'monthly' | 'all_time',
    countyId?: string
  ): Promise<void> {
    const { periodStart, periodEnd } = this.getPeriodBounds(periodType);

    // Get all activity events for this period
    const events = await storage.getCaseActivityEvents(navigatorId);
    const periodEvents = events.filter(e => {
      const eventTime = new Date(e.occurredAt);
      return eventTime >= periodStart && eventTime <= periodEnd;
    });

    // Calculate metrics
    const metrics = this.calculateMetrics(periodEvents);

    // Check if KPI record exists for this period
    const existingKpi = await storage.getLatestNavigatorKpi(navigatorId, periodType);
    
    const kpiData: InsertNavigatorKpi = {
      navigatorId,
      countyId: countyId || null,
      periodType,
      periodStart,
      periodEnd,
      ...metrics,
    };

    let updatedKpi: NavigatorKpi;
    
    if (existingKpi && 
        existingKpi.periodStart.getTime() === periodStart.getTime() &&
        existingKpi.periodEnd.getTime() === periodEnd.getTime()) {
      // Update existing
      await storage.updateNavigatorKpi(existingKpi.id, kpiData);
      updatedKpi = { ...existingKpi, ...kpiData };
    } else {
      // Create new
      updatedKpi = await storage.createNavigatorKpi(kpiData);
    }

    // Auto-evaluate achievements based on updated KPIs (only for all_time period)
    if (periodType === 'all_time') {
      await achievementSystemService.evaluateAchievements(navigatorId, updatedKpi);
    }
  }

  /**
   * Calculate metrics from activity events
   */
  private calculateMetrics(events: any[]) {
    const casesClosed = events.filter(e => 
      e.eventType === 'case_approved' || e.eventType === 'case_denied'
    ).length;

    const casesApproved = events.filter(e => e.eventType === 'case_approved').length;
    const casesDenied = events.filter(e => e.eventType === 'case_denied').length;
    
    const successRate = casesClosed > 0 ? (casesApproved / casesClosed) * 100 : 0;

    const benefitEvents = events.filter(e => e.benefitAmount && e.benefitAmount > 0);
    const totalBenefitsSecured = benefitEvents.reduce((sum, e) => sum + (e.benefitAmount || 0), 0);
    const avgBenefitPerCase = casesApproved > 0 ? totalBenefitsSecured / casesApproved : 0;
    const highValueCases = benefitEvents.filter(e => e.benefitAmount && e.benefitAmount >= 1000).length;

    const responseTimeEvents = events.filter(e => e.responseTime);
    const avgResponseTime = responseTimeEvents.length > 0
      ? responseTimeEvents.reduce((sum, e) => sum + (e.responseTime || 0), 0) / responseTimeEvents.length
      : 0;

    const completionTimeEvents = events.filter(e => e.eventData?.completionTimeDays);
    const avgCaseCompletionTime = completionTimeEvents.length > 0
      ? completionTimeEvents.reduce((sum, e) => sum + (e.eventData?.completionTimeDays || 0), 0) / completionTimeEvents.length
      : 0;

    const documentsProcessed = events.filter(e => e.eventType === 'document_verified').length;
    const documentsVerified = documentsProcessed; // All processed docs are verified in this context

    const qualityEvents = events.filter(e => e.documentQuality);
    const avgDocumentQuality = qualityEvents.length > 0
      ? qualityEvents.reduce((sum, e) => sum + (e.documentQuality || 0), 0) / qualityEvents.length
      : 0;

    const crossEnrollmentsIdentified = events.filter(e => e.eventType === 'cross_enrollment_identified').length;
    const aiRecommendationsAccepted = events.filter(e => e.eventType === 'ai_recommendation_accepted').length;

    // Calculate composite performance score (0-100)
    const performanceScore = this.calculatePerformanceScore({
      successRate,
      avgBenefitPerCase,
      avgResponseTime,
      avgDocumentQuality,
      crossEnrollmentsIdentified,
    });

    return {
      casesClosed,
      casesApproved,
      casesDenied,
      successRate,
      totalBenefitsSecured,
      avgBenefitPerCase,
      highValueCases,
      avgResponseTime,
      avgCaseCompletionTime,
      documentsProcessed,
      documentsVerified,
      avgDocumentQuality,
      crossEnrollmentsIdentified,
      aiRecommendationsAccepted,
      performanceScore,
    };
  }

  /**
   * Calculate weighted performance score
   */
  private calculatePerformanceScore(metrics: {
    successRate: number;
    avgBenefitPerCase: number;
    avgResponseTime: number;
    avgDocumentQuality: number;
    crossEnrollmentsIdentified: number;
  }): number {
    // Weighted scoring formula
    const weights = {
      successRate: 0.30,        // 30% - Most important
      benefitAmount: 0.25,       // 25% - High impact
      speed: 0.20,              // 20% - Efficiency
      quality: 0.15,            // 15% - Document quality
      crossEnrollment: 0.10,    // 10% - Proactive identification
    };

    // Normalize metrics to 0-100 scale
    const successRateScore = metrics.successRate; // Already 0-100
    const benefitScore = Math.min((metrics.avgBenefitPerCase / 500) * 100, 100); // Cap at $500/case
    const speedScore = Math.max(100 - (metrics.avgResponseTime / 24) * 100, 0); // Lower time = higher score
    const qualityScore = metrics.avgDocumentQuality * 100; // Convert 0-1 to 0-100
    const crossEnrollScore = Math.min(metrics.crossEnrollmentsIdentified * 10, 100); // 10 points per identification

    return (
      successRateScore * weights.successRate +
      benefitScore * weights.benefitAmount +
      speedScore * weights.speed +
      qualityScore * weights.quality +
      crossEnrollScore * weights.crossEnrollment
    );
  }

  /**
   * Get period boundaries based on period type
   */
  private getPeriodBounds(periodType: 'daily' | 'weekly' | 'monthly' | 'all_time'): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (periodType) {
      case 'daily':
        return {
          periodStart: today,
          periodEnd: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        };
      
      case 'weekly': {
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek); // Sunday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Saturday
        weekEnd.setHours(23, 59, 59, 999);
        return { periodStart: weekStart, periodEnd: weekEnd };
      }
      
      case 'monthly': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { periodStart: monthStart, periodEnd: monthEnd };
      }
      
      case 'all_time':
        return {
          periodStart: new Date('2024-01-01'), // System start date
          periodEnd: new Date('2099-12-31'),
        };
    }
  }

  /**
   * Get navigator performance summary
   */
  async getNavigatorPerformance(navigatorId: string, periodType: string = 'monthly'): Promise<NavigatorKpi | undefined> {
    return await storage.getLatestNavigatorKpi(navigatorId, periodType);
  }

  /**
   * Get county-wide performance metrics
   */
  async getCountyPerformance(countyId: string, periodType: string = 'monthly'): Promise<NavigatorKpi[]> {
    // This would need a custom query - for now return empty
    // In production, add a storage method to query KPIs by county
    return [];
  }
}

export const kpiTrackingService = new KpiTrackingService();
