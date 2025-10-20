import { db } from "../db";
import { 
  clientCases,
  predictionHistory,
  mlModels,
  analyticsAggregations,
  householdProfiles,
  benefitPrograms,
  eligibilityCalculations,
  programEnrollments,
  type InsertPredictionHistory,
  type InsertMlModel,
  type InsertAnalyticsAggregation
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc, count, avg } from "drizzle-orm";
import { generateTextWithGemini } from "./gemini.service";
import { cacheService } from "./cacheService";
import { notificationService } from "./notification.service";

interface CaseOutcomePrediction {
  caseId: string;
  outcome: 'approved' | 'denied' | 'pending_review';
  confidence: number;
  estimatedProcessingDays: number;
  riskFactors: string[];
  recommendations: string[];
}

interface ProcessingTimePrediction {
  programId: string;
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  estimatedDays: number;
  confidenceInterval: { lower: number; upper: number };
  bottlenecks: string[];
}

interface RenewalPrediction {
  householdId: string;
  renewalLikelihood: number;
  churnRisk: number;
  riskFactors: string[];
  interventions: string[];
  nextRenewalDate: Date;
}

interface BenefitAmountForecast {
  householdId: string;
  programId: string;
  currentAmount: number;
  forecastedAmount: number;
  changePercent: number;
  factors: string[];
  confidenceLevel: number;
}

interface ResourceAllocationPrediction {
  office: string;
  date: Date;
  predictedCaseload: number;
  requiredStaff: number;
  utilizationRate: number;
  recommendations: string[];
}

interface AnomalyDetection {
  entityType: string;
  entityId: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  suggestedAction: string;
}

interface SeasonalTrend {
  metric: string;
  period: string;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  seasonalIndex: number;
  forecast: number[];
  confidence: number;
}

class PredictiveAnalyticsService {
  private readonly MODEL_VERSION = "v1.0.0";

  /**
   * Predict case outcome using historical patterns
   */
  async predictCaseOutcome(caseId: string): Promise<CaseOutcomePrediction> {
    const cacheKey = `prediction:outcome:${caseId}`;
    const cached = await cacheService.get<CaseOutcomePrediction>(cacheKey);
    if (cached) return cached;

    try {
      // Get case details
      const caseData = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, caseId)
      });

      if (!caseData) {
        throw new Error(`Case ${caseId} not found`);
      }

      // Get historical similar cases
      const historicalCases = await this.getHistoricalSimilarCases(caseData);

      // Generate AI prediction
      const prompt = `
        Analyze this benefits case and predict the outcome:
        
        Case Details:
        - Program: ${caseData.benefitProgramId}
        - Household Size: ${caseData.householdSize}
        - Income: $${caseData.estimatedIncome ? caseData.estimatedIncome / 100 : 0}
        - Status: ${caseData.status}
        - Days Since Application: ${this.daysSince(caseData.createdAt)}
        
        Historical Similar Cases:
        - Total Cases: ${historicalCases.length}
        - Approval Rate: ${this.calculateApprovalRate(historicalCases)}%
        - Average Processing Time: ${this.calculateAvgProcessingTime(historicalCases)} days
        
        Predict:
        1. Most likely outcome (approved/denied/pending_review)
        2. Confidence level (0-1)
        3. Estimated processing days
        4. Key risk factors
        5. Recommendations to improve outcome
        
        Format as JSON:
        {
          "outcome": "approved",
          "confidence": 0.85,
          "estimatedProcessingDays": 21,
          "riskFactors": ["Missing documentation", "Income verification needed"],
          "recommendations": ["Submit pay stubs", "Complete interview"]
        }
      `;

      const aiResponse = await generateTextWithGemini(prompt);
      const prediction = JSON.parse(aiResponse);

      const result: CaseOutcomePrediction = {
        caseId,
        outcome: prediction.outcome,
        confidence: prediction.confidence,
        estimatedProcessingDays: prediction.estimatedProcessingDays,
        riskFactors: prediction.riskFactors,
        recommendations: prediction.recommendations
      };

      // Store prediction
      await this.storePrediction('case_outcome', caseId, result);

      // Cache for 1 hour
      await cacheService.set(cacheKey, result, 3600);

      return result;
    } catch (error) {
      console.error("Error predicting case outcome:", error);
      throw error;
    }
  }

  /**
   * Estimate processing time based on case complexity
   */
  async estimateProcessingTime(programId: string, caseAttributes: any): Promise<ProcessingTimePrediction> {
    const complexity = await this.assessCaseComplexity(caseAttributes);
    
    // Get historical processing times
    const historicalTimes = await this.getHistoricalProcessingTimes(programId, complexity);
    
    const prompt = `
      Estimate processing time for a ${complexity} complexity case:
      
      Program: ${programId}
      Case Attributes: ${JSON.stringify(caseAttributes)}
      Historical Data:
      - Average: ${historicalTimes.avg} days
      - Median: ${historicalTimes.median} days
      - 90th Percentile: ${historicalTimes.p90} days
      
      Consider:
      1. Current backlog and seasonality
      2. Documentation requirements
      3. Verification processes
      4. Common bottlenecks
      
      Provide:
      1. Point estimate in days
      2. Confidence interval (lower and upper bounds)
      3. Main bottlenecks
      
      Format as JSON:
      {
        "estimatedDays": 25,
        "confidenceInterval": {"lower": 20, "upper": 35},
        "bottlenecks": ["Income verification", "Medical review"]
      }
    `;

    const aiResponse = await generateTextWithGemini(prompt);
    const prediction = JSON.parse(aiResponse);

    const result: ProcessingTimePrediction = {
      programId,
      complexity,
      estimatedDays: prediction.estimatedDays,
      confidenceInterval: prediction.confidenceInterval,
      bottlenecks: prediction.bottlenecks
    };

    await this.storePrediction('processing_time', programId, result);
    return result;
  }

  /**
   * Predict renewal likelihood and churn risk
   */
  async predictRenewalLikelihood(householdId: string): Promise<RenewalPrediction> {
    const household = await db.query.householdProfiles.findFirst({
      where: eq(householdProfiles.id, householdId),
      with: { programEnrollments: true }
    });

    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    // Analyze engagement patterns
    const engagementScore = await this.calculateEngagementScore(householdId);
    const benefitUtilization = await this.calculateBenefitUtilization(householdId);

    const prompt = `
      Predict renewal likelihood for household:
      
      Household Profile:
      - Size: ${household.householdSize}
      - Enrolled Programs: ${household.programEnrollments?.length || 0}
      - Account Age: ${this.daysSince(household.createdAt)} days
      - Engagement Score: ${engagementScore}/100
      - Benefit Utilization: ${benefitUtilization}%
      
      Analyze:
      1. Renewal likelihood (0-1)
      2. Churn risk (0-1)
      3. Risk factors for non-renewal
      4. Recommended interventions
      5. Optimal renewal date
      
      Format as JSON:
      {
        "renewalLikelihood": 0.75,
        "churnRisk": 0.25,
        "riskFactors": ["Low engagement", "Recent income change"],
        "interventions": ["Send reminder", "Offer assistance"],
        "nextRenewalDate": "2025-03-15"
      }
    `;

    const aiResponse = await generateTextWithGemini(prompt);
    const prediction = JSON.parse(aiResponse);

    const result: RenewalPrediction = {
      householdId,
      renewalLikelihood: prediction.renewalLikelihood,
      churnRisk: prediction.churnRisk,
      riskFactors: prediction.riskFactors,
      interventions: prediction.interventions,
      nextRenewalDate: new Date(prediction.nextRenewalDate)
    };

    // Alert if high churn risk
    if (result.churnRisk > 0.7) {
      await this.alertHighChurnRisk(householdId, result);
    }

    await this.storePrediction('renewal_likelihood', householdId, result);
    return result;
  }

  /**
   * Forecast benefit amounts
   */
  async forecastBenefitAmount(
    householdId: string, 
    programId: string, 
    months: number = 6
  ): Promise<BenefitAmountForecast> {
    const historicalAmounts = await this.getHistoricalBenefitAmounts(householdId, programId);
    const economicIndicators = await this.getEconomicIndicators();

    const prompt = `
      Forecast benefit amount for the next ${months} months:
      
      Current Amount: $${historicalAmounts.current}
      Historical Trend: ${historicalAmounts.trend}
      Program: ${programId}
      
      Economic Factors:
      - Inflation Rate: ${economicIndicators.inflation}%
      - COLA Adjustment: ${economicIndicators.cola}%
      - Policy Changes: ${economicIndicators.policyChanges}
      
      Predict:
      1. Forecasted amount
      2. Percent change
      3. Contributing factors
      4. Confidence level (0-1)
      
      Format as JSON:
      {
        "forecastedAmount": 285,
        "changePercent": 2.5,
        "factors": ["COLA increase", "Inflation adjustment"],
        "confidenceLevel": 0.82
      }
    `;

    const aiResponse = await generateTextWithGemini(prompt);
    const prediction = JSON.parse(aiResponse);

    const result: BenefitAmountForecast = {
      householdId,
      programId,
      currentAmount: historicalAmounts.current,
      forecastedAmount: prediction.forecastedAmount,
      changePercent: prediction.changePercent,
      factors: prediction.factors,
      confidenceLevel: prediction.confidenceLevel
    };

    await this.storePrediction('benefit_amount', householdId, result);
    return result;
  }

  /**
   * Predict resource allocation needs
   */
  async predictResourceAllocation(
    office: string, 
    targetDate: Date
  ): Promise<ResourceAllocationPrediction> {
    const historicalCaseload = await this.getHistoricalCaseload(office);
    const seasonalFactors = await this.getSeasonalFactors(targetDate);

    const prompt = `
      Predict resource allocation for office:
      
      Office: ${office}
      Target Date: ${targetDate.toISOString().split('T')[0]}
      
      Historical Data:
      - Average Daily Cases: ${historicalCaseload.avgDaily}
      - Peak Cases: ${historicalCaseload.peak}
      - Current Staff: ${historicalCaseload.currentStaff}
      
      Seasonal Factors:
      - Season: ${seasonalFactors.season}
      - Holiday Impact: ${seasonalFactors.holidayImpact}
      - Historical Multiplier: ${seasonalFactors.multiplier}
      
      Predict:
      1. Expected caseload
      2. Required staff count
      3. Utilization rate (0-1)
      4. Staffing recommendations
      
      Format as JSON:
      {
        "predictedCaseload": 125,
        "requiredStaff": 8,
        "utilizationRate": 0.85,
        "recommendations": ["Add 2 temporary staff", "Extend hours"]
      }
    `;

    const aiResponse = await generateTextWithGemini(prompt);
    const prediction = JSON.parse(aiResponse);

    const result: ResourceAllocationPrediction = {
      office,
      date: targetDate,
      predictedCaseload: prediction.predictedCaseload,
      requiredStaff: prediction.requiredStaff,
      utilizationRate: prediction.utilizationRate,
      recommendations: prediction.recommendations
    };

    await this.storePrediction('resource_allocation', office, result);
    return result;
  }

  /**
   * Detect anomalies in patterns
   */
  async detectAnomalies(entityType: string, timeWindow: number = 24): Promise<AnomalyDetection[]> {
    const recentData = await this.getRecentData(entityType, timeWindow);
    const baseline = await this.getBaselineMetrics(entityType);

    const prompt = `
      Detect anomalies in ${entityType} data:
      
      Time Window: Last ${timeWindow} hours
      Data Points: ${recentData.length}
      
      Baseline Metrics:
      ${JSON.stringify(baseline, null, 2)}
      
      Recent Patterns:
      ${JSON.stringify(recentData.slice(0, 5), null, 2)}
      
      Identify:
      1. Anomaly type and severity
      2. Affected entities
      3. Description of unusual pattern
      4. Suggested actions
      
      Return array of anomalies as JSON:
      [{
        "entityId": "123",
        "anomalyType": "sudden_spike",
        "severity": "high",
        "description": "300% increase in applications",
        "suggestedAction": "Investigate data quality"
      }]
    `;

    const aiResponse = await generateTextWithGemini(prompt);
    const anomalies = JSON.parse(aiResponse);

    const results: AnomalyDetection[] = anomalies.map((a: any) => ({
      entityType,
      entityId: a.entityId,
      anomalyType: a.anomalyType,
      severity: a.severity,
      description: a.description,
      detectedAt: new Date(),
      suggestedAction: a.suggestedAction
    }));

    // Alert on critical anomalies
    const critical = results.filter(a => a.severity === 'critical');
    if (critical.length > 0) {
      await this.alertCriticalAnomalies(critical);
    }

    return results;
  }

  /**
   * Analyze seasonal trends
   */
  async analyzeSeasonalTrends(metric: string, period: string = 'monthly'): Promise<SeasonalTrend> {
    const historicalData = await this.getHistoricalMetricData(metric, period);

    const prompt = `
      Analyze seasonal trends for ${metric}:
      
      Period: ${period}
      Historical Data Points: ${historicalData.length}
      
      Data:
      ${JSON.stringify(historicalData.slice(-12), null, 2)}
      
      Analyze:
      1. Trend direction (increasing/decreasing/stable)
      2. Seasonal index (multiplier)
      3. Next 3 period forecast
      4. Confidence level
      
      Format as JSON:
      {
        "trendDirection": "increasing",
        "seasonalIndex": 1.15,
        "forecast": [125, 130, 128],
        "confidence": 0.78
      }
    `;

    const aiResponse = await generateTextWithGemini(prompt);
    const analysis = JSON.parse(aiResponse);

    const result: SeasonalTrend = {
      metric,
      period,
      trendDirection: analysis.trendDirection,
      seasonalIndex: analysis.seasonalIndex,
      forecast: analysis.forecast,
      confidence: analysis.confidence
    };

    await this.storeAggregation(metric, period, result);
    return result;
  }

  /**
   * Train and update ML models
   */
  async trainModels(): Promise<void> {
    const models = [
      { name: 'case_outcome_classifier', type: 'classification', target: 'case_outcome' },
      { name: 'processing_time_regressor', type: 'regression', target: 'processing_days' },
      { name: 'churn_predictor', type: 'classification', target: 'churn_risk' },
      { name: 'benefit_forecaster', type: 'regression', target: 'benefit_amount' }
    ];

    for (const model of models) {
      await this.trainModel(model);
    }
  }

  /**
   * Private helper methods
   */

  private async getHistoricalSimilarCases(caseData: any): Promise<any[]> {
    return await db.query.clientCases.findMany({
      where: and(
        eq(clientCases.benefitProgramId, caseData.benefitProgramId),
        eq(clientCases.status, 'approved')
      ),
      limit: 100
    });
  }

  private calculateApprovalRate(cases: any[]): number {
    const approved = cases.filter(c => c.status === 'approved').length;
    return cases.length > 0 ? (approved / cases.length) * 100 : 0;
  }

  private calculateAvgProcessingTime(cases: any[]): number {
    const times = cases
      .filter(c => c.applicationSubmittedAt && c.applicationApprovedAt)
      .map(c => this.daysBetween(c.applicationSubmittedAt, c.applicationApprovedAt));
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private daysBetween(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async assessCaseComplexity(attributes: any): Promise<'low' | 'medium' | 'high' | 'very_high'> {
    const factors = {
      householdSize: attributes.householdSize > 5 ? 2 : 1,
      multiplePrograms: attributes.programs?.length > 2 ? 2 : 1,
      documentation: attributes.missingDocs > 0 ? 3 : 1,
      specialCircumstances: attributes.hasDisability || attributes.isHomeless ? 3 : 1
    };

    const score = Object.values(factors).reduce((a, b) => a + b, 0);
    
    if (score <= 4) return 'low';
    if (score <= 6) return 'medium';
    if (score <= 9) return 'high';
    return 'very_high';
  }

  private async getHistoricalProcessingTimes(programId: string, complexity: string): Promise<any> {
    // Simulate historical data
    const times = {
      low: { avg: 15, median: 12, p90: 20 },
      medium: { avg: 25, median: 22, p90: 35 },
      high: { avg: 40, median: 38, p90: 55 },
      very_high: { avg: 60, median: 55, p90: 80 }
    };
    
    return times[complexity] || times.medium;
  }

  private async calculateEngagementScore(householdId: string): Promise<number> {
    // Simulate engagement calculation
    return Math.floor(Math.random() * 40) + 60; // 60-100
  }

  private async calculateBenefitUtilization(householdId: string): Promise<number> {
    // Simulate utilization calculation
    return Math.floor(Math.random() * 30) + 70; // 70-100
  }

  private async getHistoricalBenefitAmounts(householdId: string, programId: string): Promise<any> {
    // Simulate historical amounts
    return {
      current: 278,
      trend: 'increasing',
      history: [250, 255, 260, 270, 275, 278]
    };
  }

  private async getEconomicIndicators(): Promise<any> {
    return {
      inflation: 2.3,
      cola: 2.5,
      policyChanges: 'Minor adjustments expected'
    };
  }

  private async getHistoricalCaseload(office: string): Promise<any> {
    return {
      avgDaily: 100,
      peak: 150,
      currentStaff: 6
    };
  }

  private async getSeasonalFactors(date: Date): Promise<any> {
    const month = date.getMonth();
    const season = month < 3 ? 'winter' : month < 6 ? 'spring' : month < 9 ? 'summer' : 'fall';
    
    return {
      season,
      holidayImpact: month === 11 || month === 0 ? 'high' : 'low',
      multiplier: month === 0 ? 1.3 : month === 11 ? 1.2 : 1.0
    };
  }

  private async getRecentData(entityType: string, hours: number): Promise<any[]> {
    // Simulate recent data retrieval
    return Array(10).fill(null).map((_, i) => ({
      id: `entity_${i}`,
      value: Math.random() * 100,
      timestamp: new Date(Date.now() - i * 3600000)
    }));
  }

  private async getBaselineMetrics(entityType: string): Promise<any> {
    return {
      avgValue: 50,
      stdDev: 10,
      min: 20,
      max: 80
    };
  }

  private async getHistoricalMetricData(metric: string, period: string): Promise<any[]> {
    // Simulate historical metric data
    return Array(24).fill(null).map((_, i) => ({
      period: `${period}_${i}`,
      value: 100 + Math.sin(i / 3) * 20 + Math.random() * 10
    }));
  }

  private async alertHighChurnRisk(householdId: string, prediction: RenewalPrediction): Promise<void> {
    await notificationService.create({
      userId: 'system',
      type: 'churn_risk_alert',
      title: 'High Churn Risk Detected',
      message: `Household ${householdId} has ${Math.round(prediction.churnRisk * 100)}% churn risk. Interventions recommended.`,
      priority: 'high',
      relatedEntityType: 'household_profile',
      relatedEntityId: householdId
    });
  }

  private async alertCriticalAnomalies(anomalies: AnomalyDetection[]): Promise<void> {
    for (const anomaly of anomalies) {
      await notificationService.create({
        userId: 'system',
        type: 'anomaly_alert',
        title: `Critical Anomaly: ${anomaly.anomalyType}`,
        message: anomaly.description,
        priority: 'urgent',
        relatedEntityType: anomaly.entityType,
        relatedEntityId: anomaly.entityId
      });
    }
  }

  private async storePrediction(type: string, entityId: string, prediction: any): Promise<void> {
    const record: InsertPredictionHistory = {
      predictionType: type,
      entityType: this.getEntityType(type),
      entityId,
      prediction,
      confidence: prediction.confidence || prediction.confidenceLevel || 0.5,
      features: {},
      modelName: `${type}_model`,
      modelVersion: this.MODEL_VERSION,
      metadata: { timestamp: new Date().toISOString() }
    };

    await db.insert(predictionHistory).values(record);
  }

  private getEntityType(predictionType: string): string {
    const mapping = {
      case_outcome: 'client_case',
      processing_time: 'benefit_program',
      renewal_likelihood: 'household_profile',
      benefit_amount: 'household_profile',
      resource_allocation: 'office'
    };
    return mapping[predictionType] || 'unknown';
  }

  private async storeAggregation(metric: string, period: string, data: any): Promise<void> {
    const record: InsertAnalyticsAggregation = {
      aggregationType: period,
      metricCategory: metric,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 86400000 * 30), // 30 days
      metrics: data
    };

    await db.insert(analyticsAggregations).values(record);
  }

  private async trainModel(modelConfig: any): Promise<void> {
    // Simulate model training
    const modelRecord: InsertMlModel = {
      modelName: modelConfig.name,
      modelType: modelConfig.type,
      targetVariable: modelConfig.target,
      version: this.MODEL_VERSION,
      algorithm: 'gradient_boosting',
      features: ['feature1', 'feature2', 'feature3'],
      status: 'training',
      trainingDataSize: 10000,
      trainingStartDate: new Date()
    };

    await db.insert(mlModels).values(modelRecord);

    // Simulate training completion
    setTimeout(async () => {
      await db.update(mlModels)
        .set({
          status: 'production',
          trainingEndDate: new Date(),
          trainingMetrics: { accuracy: 0.92, precision: 0.89, recall: 0.91 },
          deployedAt: new Date()
        })
        .where(eq(mlModels.modelName, modelConfig.name));
    }, 5000);
  }
}

export const predictiveAnalyticsService = new PredictiveAnalyticsService();