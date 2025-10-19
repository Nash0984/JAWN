/**
 * QC Analytics Service
 * 
 * AI-powered quality control analytics engine using Gemini
 * for risk scoring, pattern detection, and predictive analysis.
 * 
 * Features:
 * - Real-time risk scoring of cases using AI
 * - Pattern detection across error types
 * - Predictive analytics for error prevention
 * - Caseworker performance analysis
 * - Error trend forecasting
 */

import { db } from '../db';
import { 
  households, 
  benefits, 
  documents, 
  auditLogs,
  users,
  notifications,
  benchmarkMetrics
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql, inArray, notInArray } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { cacheService } from './cacheService';

const gemini = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI(process.env.GEMINI_API_KEY)
  : null;

export interface ErrorPattern {
  id: string;
  type: string;
  category: string;
  description: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  trend: 'increasing' | 'stable' | 'decreasing';
  riskScore: number;
  affectedCases: number;
  recommendedAction: string;
  aiInsights?: string;
  detectedAt?: Date;
}

export interface FlaggedCase {
  id: string;
  householdId: string;
  householdName: string;
  program: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  flagReason: string;
  lastReviewed?: Date;
  caseworkerId?: string;
  caseworkerName?: string;
  errorHistory: string[];
  aiRecommendations?: string[];
  predictedOutcome?: string;
}

export interface CaseworkerPerformance {
  id: string;
  name: string;
  errorRate: number;
  caseVolume: number;
  avgProcessingTime: number;
  accuracyScore: number;
  trainingNeeds: string[];
  strengths: string[];
  riskLevel: 'low' | 'medium' | 'high';
  trend: 'improving' | 'stable' | 'declining';
  aiCoaching?: string[];
}

export interface QCMetrics {
  overallErrorRate: number;
  errorTrend: 'increasing' | 'stable' | 'decreasing';
  highRiskCases: number;
  totalCasesReviewed: number;
  avgProcessingTime: number;
  complianceScore: number;
  topErrorTypes: string[];
  predictedNextMonthErrors: number;
  aiConfidence: number;
}

class QCAnalyticsService {
  private model = gemini?.getGenerativeModel({ model: "gemini-pro" });
  
  /**
   * Analyze a case using AI to calculate risk score and identify issues
   */
  async analyzeCase(householdId: string): Promise<FlaggedCase | null> {
    const cacheKey = `qc:case:${householdId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as FlaggedCase;

    try {
      // Get household data with benefits and documents
      const household = await db.query.households.findFirst({
        where: eq(households.id, householdId),
        with: {
          benefits: true,
          documents: true
        }
      });

      if (!household) return null;

      // Get audit history for this household
      const auditHistory = await db.select()
        .from(auditLogs)
        .where(eq(auditLogs.resourceId, householdId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(20);

      // Use AI to analyze the case if Gemini is available
      let aiAnalysis = null;
      if (this.model) {
        const prompt = `
          Analyze this household case for quality control risk factors:
          
          Household: ${household.name}
          Active Benefits: ${household.benefits?.map(b => b.programId).join(', ') || 'None'}
          Documents: ${household.documents?.length || 0} documents
          Recent Activity: ${auditHistory.length} audit events
          
          Identify:
          1. Risk level (critical/high/medium/low) with score 0-100
          2. Main risk factors (list top 3)
          3. Recommended actions for caseworker
          4. Predicted outcome if unaddressed
          
          Format as JSON with fields: riskScore, riskLevel, flagReasons, recommendations, predictedOutcome
        `;

        try {
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          // Parse AI response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiAnalysis = JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.error('AI analysis failed:', error);
        }
      }

      // Fallback risk calculation if AI unavailable
      const riskScore = aiAnalysis?.riskScore || this.calculateRiskScore(household, auditHistory);
      const riskLevel = this.getRiskLevel(riskScore);

      const flaggedCase: FlaggedCase = {
        id: `flag_${householdId}`,
        householdId,
        householdName: household.name,
        program: household.benefits?.[0]?.programId || 'Multiple',
        riskScore,
        riskLevel,
        flagReason: aiAnalysis?.flagReasons?.[0] || this.generateFlagReason(household),
        lastReviewed: auditHistory[0]?.createdAt || undefined,
        caseworkerId: household.assignedTo || undefined,
        errorHistory: this.extractErrorHistory(auditHistory),
        aiRecommendations: aiAnalysis?.recommendations || [],
        predictedOutcome: aiAnalysis?.predictedOutcome
      };

      // Cache for 1 hour
      await cacheService.set(cacheKey, flaggedCase, 3600);
      return flaggedCase;

    } catch (error) {
      console.error('Error analyzing case:', error);
      return null;
    }
  }

  /**
   * Detect patterns across all error types using AI
   */
  async detectErrorPatterns(startDate: Date, endDate: Date): Promise<ErrorPattern[]> {
    const cacheKey = `qc:patterns:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as ErrorPattern[];

    try {
      // Get error data from audit logs
      const errorLogs = await db.select({
        action: auditLogs.action,
        resource: auditLogs.resource,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        metadata: auditLogs.metadata
      })
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, startDate),
        lte(auditLogs.createdAt, endDate),
        inArray(auditLogs.action, ['ERROR', 'VALIDATION_FAILED', 'PROCESSING_FAILED'])
      ));

      // Group errors by type
      const errorGroups = this.groupErrorsByType(errorLogs);

      // Use AI to analyze patterns if available
      let aiPatterns: ErrorPattern[] = [];
      if (this.model && errorGroups.length > 0) {
        const prompt = `
          Analyze these error patterns for quality control:
          
          ${JSON.stringify(errorGroups.slice(0, 10), null, 2)}
          
          For each error type, identify:
          1. Root cause and impact level (high/medium/low)
          2. Trend (increasing/stable/decreasing)
          3. Risk score (0-100)
          4. Recommended preventive action
          5. Deeper insights about why this error occurs
          
          Format as JSON array with ErrorPattern objects.
        `;

        try {
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const patterns = JSON.parse(jsonMatch[0]);
            aiPatterns = patterns.map((p: any, idx: number) => ({
              id: `pattern_${idx}`,
              type: errorGroups[idx]?.type || p.type,
              category: p.category || 'Processing',
              description: p.description || errorGroups[idx]?.type,
              frequency: errorGroups[idx]?.count || p.frequency,
              impact: p.impact || 'medium',
              trend: p.trend || 'stable',
              riskScore: p.riskScore || 50,
              affectedCases: errorGroups[idx]?.affectedCases || 0,
              recommendedAction: p.recommendedAction || 'Review process',
              aiInsights: p.insights,
              detectedAt: new Date()
            }));
          }
        } catch (error) {
          console.error('AI pattern detection failed:', error);
        }
      }

      // Fallback pattern generation if AI unavailable
      if (aiPatterns.length === 0) {
        aiPatterns = errorGroups.map((group, idx) => ({
          id: `pattern_${idx}`,
          type: group.type,
          category: this.categorizeError(group.type),
          description: group.type,
          frequency: group.count,
          impact: group.count > 50 ? 'high' : group.count > 20 ? 'medium' : 'low',
          trend: this.calculateTrend(group.timeline),
          riskScore: Math.min(100, group.count * 2),
          affectedCases: group.affectedCases,
          recommendedAction: this.getRecommendedAction(group.type),
          detectedAt: new Date()
        }));
      }

      // Cache for 4 hours
      await cacheService.set(cacheKey, aiPatterns, 14400);
      return aiPatterns;

    } catch (error) {
      console.error('Error detecting patterns:', error);
      return [];
    }
  }

  /**
   * Analyze caseworker performance using AI
   */
  async analyzeCaseworkerPerformance(caseworkerId: string): Promise<CaseworkerPerformance | null> {
    const cacheKey = `qc:caseworker:${caseworkerId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as CaseworkerPerformance;

    try {
      // Get caseworker data
      const caseworker = await db.query.users.findFirst({
        where: eq(users.id, caseworkerId)
      });

      if (!caseworker) return null;

      // Get caseworker's recent activity
      const recentActivity = await db.select({
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, caseworkerId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

      // Calculate metrics
      const metrics = this.calculateCaseworkerMetrics(recentActivity);

      // Use AI for performance analysis if available
      let aiAnalysis = null;
      if (this.model) {
        const prompt = `
          Analyze caseworker performance:
          
          Caseworker: ${caseworker.name}
          Recent Actions: ${recentActivity.length}
          Error Rate: ${metrics.errorRate}%
          Processing Speed: ${metrics.avgProcessingTime} minutes
          
          Provide:
          1. Accuracy score (0-100)
          2. Top 3 training needs
          3. Top 3 strengths
          4. Risk level (low/medium/high)
          5. Performance trend (improving/stable/declining)
          6. 2-3 specific coaching recommendations
          
          Format as JSON.
        `;

        try {
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiAnalysis = JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.error('AI performance analysis failed:', error);
        }
      }

      const performance: CaseworkerPerformance = {
        id: caseworkerId,
        name: caseworker.name,
        errorRate: metrics.errorRate,
        caseVolume: metrics.caseVolume,
        avgProcessingTime: metrics.avgProcessingTime,
        accuracyScore: aiAnalysis?.accuracyScore || (100 - metrics.errorRate),
        trainingNeeds: aiAnalysis?.trainingNeeds || this.identifyTrainingNeeds(metrics),
        strengths: aiAnalysis?.strengths || this.identifyStrengths(metrics),
        riskLevel: aiAnalysis?.riskLevel || this.getCaseworkerRiskLevel(metrics),
        trend: aiAnalysis?.trend || 'stable',
        aiCoaching: aiAnalysis?.coaching || []
      };

      // Cache for 2 hours
      await cacheService.set(cacheKey, performance, 7200);
      return performance;

    } catch (error) {
      console.error('Error analyzing caseworker:', error);
      return null;
    }
  }

  /**
   * Get overall QC metrics with AI predictions
   */
  async getQCMetrics(programId?: string): Promise<QCMetrics> {
    const cacheKey = `qc:metrics:${programId || 'all'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as QCMetrics;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get error patterns
      const patterns = await this.detectErrorPatterns(thirtyDaysAgo, new Date());
      
      // Calculate metrics
      const totalErrors = patterns.reduce((sum, p) => sum + p.frequency, 0);
      const avgRiskScore = patterns.reduce((sum, p) => sum + p.riskScore, 0) / (patterns.length || 1);
      
      // Count high risk cases
      const highRiskCount = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(households)
        .where(sql`EXISTS (
          SELECT 1 FROM ${benefits} b 
          WHERE b.household_id = ${households.id} 
          AND b.status != 'approved'
        )`);

      // Use AI for predictions if available
      let aiPrediction = null;
      if (this.model) {
        const prompt = `
          Based on these QC metrics:
          - Total errors last 30 days: ${totalErrors}
          - Error patterns detected: ${patterns.length}
          - Average risk score: ${avgRiskScore}
          
          Predict:
          1. Next month's expected error count
          2. Overall error trend (increasing/stable/decreasing)
          3. Compliance score (0-100)
          4. Top 3 error types to watch
          5. Confidence level in predictions (0-100)
          
          Format as JSON.
        `;

        try {
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiPrediction = JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.error('AI prediction failed:', error);
        }
      }

      const metrics: QCMetrics = {
        overallErrorRate: totalErrors > 0 ? (totalErrors / 1000) * 100 : 0, // Per 1000 cases
        errorTrend: aiPrediction?.errorTrend || this.calculateOverallTrend(patterns),
        highRiskCases: highRiskCount[0]?.count || 0,
        totalCasesReviewed: 1000, // Placeholder - would query actual review count
        avgProcessingTime: 24, // Hours - placeholder
        complianceScore: aiPrediction?.complianceScore || (100 - avgRiskScore),
        topErrorTypes: aiPrediction?.topErrorTypes || patterns.slice(0, 3).map(p => p.type),
        predictedNextMonthErrors: aiPrediction?.nextMonthErrors || Math.round(totalErrors * 1.1),
        aiConfidence: aiPrediction?.confidence || 75
      };

      // Cache for 1 hour
      await cacheService.set(cacheKey, metrics, 3600);
      return metrics;

    } catch (error) {
      console.error('Error getting QC metrics:', error);
      return {
        overallErrorRate: 0,
        errorTrend: 'stable',
        highRiskCases: 0,
        totalCasesReviewed: 0,
        avgProcessingTime: 0,
        complianceScore: 100,
        topErrorTypes: [],
        predictedNextMonthErrors: 0,
        aiConfidence: 0
      };
    }
  }

  /**
   * Get training recommendations based on error patterns
   */
  async getTrainingRecommendations(): Promise<any[]> {
    const cacheKey = 'qc:training:recommendations';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as any[];

    try {
      const patterns = await this.detectErrorPatterns(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      // Use AI to generate training recommendations
      if (this.model && patterns.length > 0) {
        const prompt = `
          Based on these error patterns:
          ${JSON.stringify(patterns.slice(0, 5), null, 2)}
          
          Generate 5 specific training recommendations:
          1. Title
          2. Target audience (caseworkers/supervisors/all)
          3. Priority (high/medium/low)
          4. Duration (hours)
          5. Key topics to cover
          6. Expected impact
          
          Format as JSON array.
        `;

        try {
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const recommendations = JSON.parse(jsonMatch[0]);
            await cacheService.set(cacheKey, recommendations, 7200);
            return recommendations;
          }
        } catch (error) {
          console.error('AI training recommendations failed:', error);
        }
      }

      // Fallback recommendations
      const fallback = patterns.slice(0, 3).map(p => ({
        title: `Training: Preventing ${p.type} Errors`,
        audience: 'caseworkers',
        priority: p.impact,
        duration: 2,
        topics: [p.type, 'Quality Control', 'Error Prevention'],
        expectedImpact: `Reduce ${p.type} errors by 25%`
      }));

      await cacheService.set(cacheKey, fallback, 7200);
      return fallback;

    } catch (error) {
      console.error('Error getting training recommendations:', error);
      return [];
    }
  }

  // Helper methods
  private calculateRiskScore(household: any, auditHistory: any[]): number {
    let score = 0;
    
    // Factor in missing documents
    if (!household.documents || household.documents.length < 3) score += 20;
    
    // Factor in recent errors
    const errorCount = auditHistory.filter(a => 
      a.action === 'ERROR' || a.action === 'VALIDATION_FAILED'
    ).length;
    score += errorCount * 10;
    
    // Factor in time since last review
    const lastReview = auditHistory[0]?.createdAt;
    if (lastReview) {
      const daysSinceReview = (Date.now() - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReview > 30) score += 15;
      if (daysSinceReview > 60) score += 25;
    } else {
      score += 30;
    }
    
    return Math.min(100, score);
  }

  private getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private generateFlagReason(household: any): string {
    if (!household.documents || household.documents.length === 0) {
      return 'Missing required documentation';
    }
    if (!household.benefits || household.benefits.length === 0) {
      return 'No active benefits - verification needed';
    }
    return 'Routine quality control review required';
  }

  private extractErrorHistory(auditLogs: any[]): string[] {
    return auditLogs
      .filter(log => log.action === 'ERROR' || log.action === 'VALIDATION_FAILED')
      .map(log => `${log.action}: ${log.resource}`)
      .slice(0, 5);
  }

  private groupErrorsByType(errorLogs: any[]): any[] {
    const groups = new Map();
    
    errorLogs.forEach(log => {
      const type = log.action;
      if (!groups.has(type)) {
        groups.set(type, {
          type,
          count: 0,
          timeline: [],
          affectedCases: new Set()
        });
      }
      
      const group = groups.get(type);
      group.count++;
      group.timeline.push(log.createdAt);
      if (log.metadata?.householdId) {
        group.affectedCases.add(log.metadata.householdId);
      }
    });
    
    return Array.from(groups.values()).map(g => ({
      ...g,
      affectedCases: g.affectedCases.size
    }));
  }

  private categorizeError(type: string): string {
    if (type.includes('VALIDATION')) return 'Validation';
    if (type.includes('PROCESSING')) return 'Processing';
    if (type.includes('AUTH')) return 'Authentication';
    if (type.includes('CALCULATION')) return 'Calculation';
    return 'Other';
  }

  private calculateTrend(timeline: Date[]): 'increasing' | 'stable' | 'decreasing' {
    if (timeline.length < 2) return 'stable';
    
    const midpoint = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, midpoint).length;
    const secondHalf = timeline.slice(midpoint).length;
    
    const ratio = secondHalf / firstHalf;
    if (ratio > 1.2) return 'increasing';
    if (ratio < 0.8) return 'decreasing';
    return 'stable';
  }

  private calculateOverallTrend(patterns: ErrorPattern[]): 'increasing' | 'stable' | 'decreasing' {
    const trends = patterns.map(p => p.trend);
    const increasing = trends.filter(t => t === 'increasing').length;
    const decreasing = trends.filter(t => t === 'decreasing').length;
    
    if (increasing > decreasing + 2) return 'increasing';
    if (decreasing > increasing + 2) return 'decreasing';
    return 'stable';
  }

  private getRecommendedAction(errorType: string): string {
    const actions: Record<string, string> = {
      'VALIDATION_FAILED': 'Review validation rules and provide training on data entry',
      'PROCESSING_FAILED': 'Check system performance and review processing workflow',
      'ERROR': 'Investigate root cause and implement preventive measures',
      'CALCULATION_ERROR': 'Verify calculation logic and test with edge cases'
    };
    return actions[errorType] || 'Review and investigate';
  }

  private calculateCaseworkerMetrics(activity: any[]): any {
    const errors = activity.filter(a => a.action === 'ERROR' || a.action === 'VALIDATION_FAILED');
    const totalActions = activity.length;
    
    return {
      errorRate: totalActions > 0 ? (errors.length / totalActions) * 100 : 0,
      caseVolume: totalActions,
      avgProcessingTime: 15 // Placeholder - would calculate from timestamps
    };
  }

  private identifyTrainingNeeds(metrics: any): string[] {
    const needs = [];
    if (metrics.errorRate > 10) needs.push('Data accuracy and validation');
    if (metrics.avgProcessingTime > 30) needs.push('Process efficiency');
    if (metrics.caseVolume < 50) needs.push('Case management basics');
    return needs.length > 0 ? needs : ['General quality control'];
  }

  private identifyStrengths(metrics: any): string[] {
    const strengths = [];
    if (metrics.errorRate < 5) strengths.push('High accuracy');
    if (metrics.avgProcessingTime < 15) strengths.push('Fast processing');
    if (metrics.caseVolume > 100) strengths.push('High productivity');
    return strengths.length > 0 ? strengths : ['Consistent performance'];
  }

  private getCaseworkerRiskLevel(metrics: any): 'low' | 'medium' | 'high' {
    if (metrics.errorRate > 15) return 'high';
    if (metrics.errorRate > 10) return 'medium';
    return 'low';
  }
}

export const qcAnalyticsService = new QCAnalyticsService();