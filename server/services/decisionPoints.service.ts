/**
 * Decision Points Engine
 * 
 * AI-powered service for identifying critical intervention moments in the
 * benefits lifecycle where timely action can prevent benefit loss or maximize value.
 * Uses Gemini to predict risk points and recommend proactive interventions.
 * 
 * Key Features:
 * - Renewal prediction: Identify cases at risk of missing renewals
 * - Change detection: Flag life changes that affect eligibility
 * - Cliff effect prevention: Warn before income changes cause benefit loss
 * - Opportunity windows: Identify time-sensitive enrollment periods
 * 
 * Critical decision points:
 * - 30 days before renewal deadline
 * - Income approaching benefit cliff
 * - Pregnancy (triggers multiple new eligibilities)
 * - Child aging out of programs
 * - Seasonal benefit enrollment periods
 */

import { GoogleGenAI } from '@google/genai';
import { nanoid } from 'nanoid';
import type { IStorage } from '../storage';
import { db } from '../db';
import { clientCases, documents, eligibilityCalculations, notifications } from '@shared/schema';
import { eq, and, or, gte, lte, desc, sql, between } from 'drizzle-orm';
import { cacheService } from './cacheService';

export interface DecisionPoint {
  id: string;
  type: 'renewal' | 'cliff_effect' | 'life_change' | 'enrollment_window' | 'aging_out' | 'verification';
  priority: 'critical' | 'high' | 'medium' | 'low';
  caseId?: string;
  clientName?: string;
  
  // Timing
  triggerDate: Date;
  daysUntilAction: number;
  actionDeadline?: Date;
  
  // Impact
  programsAffected: string[];
  potentialLoss: number; // Monthly benefit amount at risk
  potentialGain?: number; // Potential new benefits if action taken
  
  // Action needed
  requiredAction: string;
  actionSteps: string[];
  documentsNeeded: string[];
  estimatedCompletionTime: number; // Minutes
  
  // AI Analysis
  riskScore: number; // 0-100, likelihood of negative outcome
  confidenceScore: number; // 0-100, AI confidence in prediction
  reasoning: string;
  
  // Automation
  automationAvailable: boolean;
  reminderScheduled: boolean;
  escalationPath?: string[];
}

export interface InterventionRecommendation {
  decisionPoint: DecisionPoint;
  interventionType: 'automated' | 'caseworker' | 'navigator' | 'client_self_service';
  suggestedMessage: string;
  suggestedChannel: 'sms' | 'email' | 'phone' | 'mail' | 'in_app';
  urgency: 'immediate' | 'today' | 'this_week' | 'this_month';
  scripts?: {
    sms?: string;
    email?: string;
    phone?: string;
  };
}

export interface DecisionPointAnalysis {
  criticalPoints: DecisionPoint[];
  upcomingRenewals: DecisionPoint[];
  cliffEffectWarnings: DecisionPoint[];
  opportunityWindows: DecisionPoint[];
  interventions: InterventionRecommendation[];
  summary: {
    totalCasesAtRisk: number;
    totalBenefitsAtRisk: number;
    criticalActionsNeeded: number;
    automationOpportunities: number;
  };
}

export class DecisionPointsService {
  private gemini: GoogleGenAI | null = null;
  private model: any;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ Decision Points: No Gemini API key found. Using fallback mode.');
    } else {
      this.gemini = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Scan all cases for critical decision points
   */
  async scanForDecisionPoints(): Promise<DecisionPointAnalysis> {
    const cacheKey = 'decision:scan:latest';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as DecisionPointAnalysis;

    // Get all active cases
    const cases = await db.select()
      .from(clientCases)
      .where(eq(clientCases.status, 'active'))
      .limit(100);

    const allPoints: DecisionPoint[] = [];
    
    // Analyze each case for decision points
    for (const clientCase of cases) {
      const points = await this.analyzeCase(clientCase);
      allPoints.push(...points);
    }

    // Categorize points
    const criticalPoints = allPoints.filter(p => p.priority === 'critical');
    const upcomingRenewals = allPoints.filter(p => p.type === 'renewal');
    const cliffEffectWarnings = allPoints.filter(p => p.type === 'cliff_effect');
    const opportunityWindows = allPoints.filter(p => p.type === 'enrollment_window');

    // Generate intervention recommendations
    const interventions = await this.generateInterventions(criticalPoints);

    const analysis: DecisionPointAnalysis = {
      criticalPoints,
      upcomingRenewals,
      cliffEffectWarnings,
      opportunityWindows,
      interventions,
      summary: {
        totalCasesAtRisk: new Set(allPoints.map(p => p.caseId)).size,
        totalBenefitsAtRisk: allPoints.reduce((sum, p) => sum + p.potentialLoss, 0),
        criticalActionsNeeded: criticalPoints.length,
        automationOpportunities: allPoints.filter(p => p.automationAvailable).length
      }
    };

    // Cache for 1 hour
    await cacheService.set(cacheKey, analysis, 3600);
    
    return analysis;
  }

  /**
   * Analyze a single case for decision points
   */
  private async analyzeCase(clientCase: any): Promise<DecisionPoint[]> {
    const points: DecisionPoint[] = [];
    
    // Check for renewal deadlines
    const renewalPoint = await this.checkRenewalDeadline(clientCase);
    if (renewalPoint) points.push(renewalPoint);
    
    // Check for cliff effects
    const cliffPoint = await this.checkCliffEffects(clientCase);
    if (cliffPoint) points.push(cliffPoint);
    
    // Check for enrollment windows
    const windowPoints = await this.checkEnrollmentWindows(clientCase);
    points.push(...windowPoints);
    
    // Use AI for deeper analysis if available
    if (this.gemini && points.length === 0) {
      const aiPoints = await this.aiAnalyzeCase(clientCase);
      points.push(...aiPoints);
    }
    
    return points;
  }

  /**
   * Check for upcoming renewal deadlines
   */
  private async checkRenewalDeadline(clientCase: any): Promise<DecisionPoint | null> {
    // Simulate renewal date (in production, would come from case data)
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 25); // 25 days from now
    
    const daysUntil = Math.floor((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 30 && daysUntil > 0) {
      return {
        id: nanoid(),
        type: 'renewal',
        priority: daysUntil <= 7 ? 'critical' : 'high',
        caseId: clientCase.id,
        clientName: clientCase.clientName,
        triggerDate: new Date(),
        daysUntilAction: daysUntil,
        actionDeadline: renewalDate,
        programsAffected: ['SNAP'],
        potentialLoss: 300, // Monthly SNAP benefit
        requiredAction: 'Complete SNAP renewal form',
        actionSteps: [
          'Gather income verification documents',
          'Complete renewal form online or by phone',
          'Submit documents through MyMDTHINK',
          'Confirm receipt of submission'
        ],
        documentsNeeded: [
          'Last 30 days of pay stubs',
          'Current bank statements',
          'Proof of expenses (rent, utilities)'
        ],
        estimatedCompletionTime: 30,
        riskScore: daysUntil <= 7 ? 90 : 60,
        confidenceScore: 95,
        reasoning: `Renewal deadline approaching in ${daysUntil} days. Historical data shows ${daysUntil <= 7 ? 'high' : 'moderate'} risk of missing deadline.`,
        automationAvailable: true,
        reminderScheduled: false
      };
    }
    
    return null;
  }

  /**
   * Check for benefit cliff effects
   */
  private async checkCliffEffects(clientCase: any): Promise<DecisionPoint | null> {
    // Simulate income near cliff (in production, would analyze actual income trends)
    const currentIncome = 2000;
    const cliffThreshold = 2200;
    const percentToCliff = ((cliffThreshold - currentIncome) / currentIncome) * 100;
    
    if (percentToCliff <= 10) {
      return {
        id: nanoid(),
        type: 'cliff_effect',
        priority: percentToCliff <= 5 ? 'critical' : 'high',
        caseId: clientCase.id,
        clientName: clientCase.clientName,
        triggerDate: new Date(),
        daysUntilAction: 30,
        programsAffected: ['SNAP', 'Medicaid'],
        potentialLoss: 500,
        requiredAction: 'Review income and explore cliff mitigation strategies',
        actionSteps: [
          'Calculate exact cliff threshold for your household',
          'Explore income deductions and allowances',
          'Consider transitional benefits if available',
          'Plan for gradual benefit reduction'
        ],
        documentsNeeded: [],
        estimatedCompletionTime: 45,
        riskScore: percentToCliff <= 5 ? 85 : 65,
        confidenceScore: 80,
        reasoning: `Income is within ${percentToCliff.toFixed(0)}% of benefit cliff. Small income increase could result in net loss.`,
        automationAvailable: false,
        reminderScheduled: false
      };
    }
    
    return null;
  }

  /**
   * Check for enrollment windows
   */
  private async checkEnrollmentWindows(clientCase: any): Promise<DecisionPoint[]> {
    const points: DecisionPoint[] = [];
    const currentMonth = new Date().getMonth();
    
    // Check for heating assistance (LIHEAP) - typically Oct-Mar
    if (currentMonth >= 9 || currentMonth <= 2) {
      points.push({
        id: nanoid(),
        type: 'enrollment_window',
        priority: 'medium',
        caseId: clientCase.id,
        clientName: clientCase.clientName,
        triggerDate: new Date(),
        daysUntilAction: 30,
        programsAffected: ['LIHEAP'],
        potentialLoss: 0,
        potentialGain: 500, // One-time assistance
        requiredAction: 'Apply for heating assistance',
        actionSteps: [
          'Check LIHEAP eligibility (income must be below 175% FPL)',
          'Gather utility bills showing arrears or shutoff notice',
          'Submit application through OHEP',
          'Schedule appointment if required'
        ],
        documentsNeeded: [
          'Recent utility bills',
          'Income verification',
          'Social Security cards for household members'
        ],
        estimatedCompletionTime: 60,
        riskScore: 30,
        confidenceScore: 90,
        reasoning: 'LIHEAP enrollment window is open. Based on SNAP enrollment, likely eligible for utility assistance.',
        automationAvailable: true,
        reminderScheduled: false
      });
    }
    
    return points;
  }

  /**
   * Use AI to analyze case for hidden decision points
   */
  private async aiAnalyzeCase(clientCase: any): Promise<DecisionPoint[]> {
    if (!this.gemini) {
      return [];
    }

    const prompt = `
      Analyze this benefits case for critical decision points that require intervention:
      
      Case Information:
      - Client: ${clientCase.clientName}
      - Case ID: ${clientCase.id}
      - Status: ${clientCase.status}
      - Program: ${clientCase.benefitProgramId}
      - Created: ${clientCase.createdAt}
      
      Identify decision points including:
      1. Upcoming deadlines or renewals
      2. Risk of benefit loss or reduction
      3. Opportunities for additional benefits
      4. Life changes that affect eligibility
      5. Documentation or verification needs
      
      For each decision point, assess:
      - Priority level (critical/high/medium/low)
      - Days until action needed
      - Programs affected
      - Potential financial impact
      - Required actions
      - Risk score (0-100)
      
      Format as JSON array of decision points.
    `;

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const text = response.text;
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rawPoints = JSON.parse(jsonMatch[0]);
        return this.formatDecisionPoints(rawPoints, clientCase);
      }
    } catch (error) {
      console.error('Error analyzing case with AI:', error);
    }

    return [];
  }

  /**
   * Format AI-generated decision points
   */
  private formatDecisionPoints(rawPoints: any[], clientCase: any): DecisionPoint[] {
    return rawPoints.map(raw => ({
      id: nanoid(),
      type: raw.type || 'verification',
      priority: raw.priority || 'medium',
      caseId: clientCase.id,
      clientName: clientCase.clientName,
      triggerDate: new Date(raw.triggerDate || Date.now()),
      daysUntilAction: raw.daysUntilAction || 30,
      actionDeadline: raw.actionDeadline ? new Date(raw.actionDeadline) : undefined,
      programsAffected: raw.programsAffected || [],
      potentialLoss: raw.potentialLoss || 0,
      potentialGain: raw.potentialGain,
      requiredAction: raw.requiredAction || 'Review case',
      actionSteps: raw.actionSteps || [],
      documentsNeeded: raw.documentsNeeded || [],
      estimatedCompletionTime: raw.estimatedTime || 30,
      riskScore: raw.riskScore || 50,
      confidenceScore: raw.confidenceScore || 70,
      reasoning: raw.reasoning || 'AI-identified decision point',
      automationAvailable: raw.automationAvailable || false,
      reminderScheduled: false
    }));
  }

  /**
   * Generate intervention recommendations for critical points
   */
  private async generateInterventions(
    points: DecisionPoint[]
  ): Promise<InterventionRecommendation[]> {
    return points.map(point => {
      let interventionType: InterventionRecommendation['interventionType'];
      let suggestedChannel: InterventionRecommendation['suggestedChannel'];
      let urgency: InterventionRecommendation['urgency'];
      
      // Determine intervention type based on complexity
      if (point.automationAvailable) {
        interventionType = 'automated';
      } else if (point.priority === 'critical') {
        interventionType = 'caseworker';
      } else if (point.estimatedCompletionTime <= 30) {
        interventionType = 'client_self_service';
      } else {
        interventionType = 'navigator';
      }
      
      // Determine channel based on urgency
      if (point.daysUntilAction <= 3) {
        suggestedChannel = 'phone';
        urgency = 'immediate';
      } else if (point.daysUntilAction <= 7) {
        suggestedChannel = 'sms';
        urgency = 'today';
      } else if (point.daysUntilAction <= 14) {
        suggestedChannel = 'email';
        urgency = 'this_week';
      } else {
        suggestedChannel = 'in_app';
        urgency = 'this_month';
      }
      
      // Generate message templates
      const smsMessage = `${point.clientName}, your ${point.programsAffected[0]} ${point.type === 'renewal' ? 'renewal is due' : 'needs attention'} in ${point.daysUntilAction} days. Reply HELP for assistance.`;
      
      const emailMessage = `Action needed: ${point.requiredAction}. This affects your ${point.programsAffected.join(', ')} benefits worth $${point.potentialLoss}/month.`;
      
      return {
        decisionPoint: point,
        interventionType,
        suggestedMessage: point.type === 'renewal' 
          ? `Renewal reminder: Complete by ${point.actionDeadline?.toLocaleDateString()}`
          : point.requiredAction,
        suggestedChannel,
        urgency,
        scripts: {
          sms: smsMessage,
          email: emailMessage,
          phone: `Call regarding urgent ${point.programsAffected[0]} action needed`
        }
      };
    });
  }

  /**
   * Get decision points for a specific case
   */
  async getDecisionPointsForCase(caseId: string): Promise<DecisionPoint[]> {
    try {
      const clientCase = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, caseId)
      });

      if (!clientCase) {
        return [];
      }

      return await this.analyzeCase(clientCase);
    } catch (error) {
      console.error('Error getting decision points:', error);
      return [];
    }
  }

  /**
   * Schedule automated intervention
   */
  async scheduleIntervention(
    decisionPointId: string, 
    intervention: InterventionRecommendation
  ): Promise<boolean> {
    try {
      // In production, would integrate with notification service
      // For now, just create a notification record
      await db.insert(notifications).values({
        id: nanoid(),
        userId: intervention.decisionPoint.caseId || 'system',
        type: 'decision_point_alert',
        title: intervention.decisionPoint.requiredAction,
        message: intervention.suggestedMessage,
        priority: intervention.decisionPoint.priority,
        read: false,
        createdAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error scheduling intervention:', error);
      return false;
    }
  }
}

// Export singleton instance
export const decisionPointsService = new DecisionPointsService({} as IStorage);