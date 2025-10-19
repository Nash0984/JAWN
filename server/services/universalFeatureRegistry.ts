/**
 * Universal Feature Registry
 * Ensures feature parity across all 6 programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI)
 * "Raise the bar for everyone, never lower it."
 */

import { distributedCache } from './distributedCache';
import { connectionPool } from './connectionPool';

// Feature categories that ALL programs must support
export enum FeatureCategory {
  ELIGIBILITY = 'eligibility',
  DOCUMENT_PROCESSING = 'document_processing',
  BENEFIT_CALCULATION = 'benefit_calculation',
  SCHEDULING = 'scheduling',
  NOTIFICATIONS = 'notifications',
  WORKFLOW_AUTOMATION = 'workflow_automation',
  AI_ASSISTANCE = 'ai_assistance',
  REPORTING = 'reporting',
  CROSS_ENROLLMENT = 'cross_enrollment',
  TAX_INTEGRATION = 'tax_integration',
}

// Universal feature interface - every feature must implement this
export interface UniversalFeature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  version: string;
  enabled: boolean;
  requiredServices: string[];
  supportedPrograms: string[];
  execute(context: FeatureContext): Promise<FeatureResult>;
  validate(context: FeatureContext): Promise<boolean>;
  rollback?(context: FeatureContext): Promise<void>;
}

export interface FeatureContext {
  programId: string;
  userId: string;
  householdId?: string;
  data: any;
  metadata: Record<string, any>;
}

export interface FeatureResult {
  success: boolean;
  data?: any;
  error?: string;
  metrics?: {
    executionTime: number;
    cacheHit?: boolean;
    apiCalls?: number;
  };
}

// Base class for all universal features
export abstract class BaseUniversalFeature implements UniversalFeature {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract category: FeatureCategory;
  version: string = '1.0.0';
  enabled: boolean = true;
  requiredServices: string[] = [];
  supportedPrograms: string[] = ['SNAP', 'Medicaid', 'TANF', 'OHEP', 'TaxCredits', 'SSI'];

  protected async withMetrics<T>(
    operation: () => Promise<T>,
    context: FeatureContext
  ): Promise<{ result: T; metrics: any }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;

    // Track metrics
    await this.trackMetrics(context, { executionTime });

    return { result, metrics: { executionTime } };
  }

  protected async trackMetrics(context: FeatureContext, metrics: any): Promise<void> {
    const key = `metrics:${this.id}:${context.programId}`;
    await distributedCache.set('metrics', key, {
      ...metrics,
      timestamp: Date.now(),
      userId: context.userId,
    }, 3600);
  }

  abstract execute(context: FeatureContext): Promise<FeatureResult>;
  abstract validate(context: FeatureContext): Promise<boolean>;
  
  async rollback(context: FeatureContext): Promise<void> {
    console.log(`Rollback not implemented for ${this.id}`);
  }
}

// Universal Feature: AI Document Extraction
export class AIDocumentExtractionFeature extends BaseUniversalFeature {
  id = 'ai_document_extraction';
  name = 'AI Document Extraction';
  description = 'Extract data from uploaded documents using Gemini Vision API';
  category = FeatureCategory.DOCUMENT_PROCESSING;
  requiredServices = ['gemini-api', 'object-storage'];

  async validate(context: FeatureContext): Promise<boolean> {
    return !!(context.data.documentId && context.data.documentType);
  }

  async execute(context: FeatureContext): Promise<FeatureResult> {
    const { result, metrics } = await this.withMetrics(async () => {
      // Check cache first
      const cacheKey = `doc-extract:${context.data.documentId}`;
      const cached = await distributedCache.get('documents', cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }

      // Simulate AI extraction (would call Gemini Vision API)
      const extractedData = {
        documentId: context.data.documentId,
        programId: context.programId,
        extractedFields: {
          name: 'John Doe',
          income: 2500,
          dependents: 2,
          // Program-specific fields would be added here
        },
        confidence: 0.95,
      };

      // Cache the result
      await distributedCache.set('documents', cacheKey, extractedData, 86400);
      return extractedData;
    }, context);

    return {
      success: true,
      data: result,
      metrics: { ...metrics, cacheHit: result.fromCache || false },
    };
  }
}

// Universal Feature: Eligibility Calculator
export class EligibilityCalculatorFeature extends BaseUniversalFeature {
  id = 'eligibility_calculator';
  name = 'Eligibility Calculator';
  description = 'Calculate benefit eligibility using PolicyEngine and Rules as Code';
  category = FeatureCategory.BENEFIT_CALCULATION;
  requiredServices = ['policyengine-api', 'rules-engine'];

  async validate(context: FeatureContext): Promise<boolean> {
    return !!(context.householdId && context.programId);
  }

  async execute(context: FeatureContext): Promise<FeatureResult> {
    const { result, metrics } = await this.withMetrics(async () => {
      const { programId, householdId } = context;
      
      // Check cache
      const cacheKey = `eligibility:${programId}:${householdId}`;
      const cached = await distributedCache.get('calculations', cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }

      // Fetch household data from database
      const db = await connectionPool.getConnection();
      try {
        // Program-specific eligibility rules
        const eligibilityRules = this.getEligibilityRules(programId);
        
        // Calculate eligibility (would integrate with PolicyEngine)
        const eligibility = {
          programId,
          householdId,
          eligible: true,
          benefitAmount: this.calculateBenefitAmount(programId, context.data),
          reasons: ['Income below threshold', 'Household size qualifies'],
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        };

        // Cache result
        await distributedCache.set('calculations', cacheKey, eligibility, 3600);
        return eligibility;
      } finally {
        db.release();
      }
    }, context);

    return {
      success: true,
      data: result,
      metrics: { ...metrics, cacheHit: result.fromCache || false },
    };
  }

  private getEligibilityRules(programId: string): any {
    // Program-specific rules would be loaded from Rules as Code
    const rules = {
      SNAP: { incomeLimit: 2000, householdMultiplier: 500 },
      Medicaid: { incomeLimit: 2500, householdMultiplier: 600 },
      TANF: { incomeLimit: 1800, householdMultiplier: 400 },
      OHEP: { incomeLimit: 3000, householdMultiplier: 700 },
      TaxCredits: { incomeLimit: 5000, householdMultiplier: 1000 },
      SSI: { incomeLimit: 1500, householdMultiplier: 300 },
    };
    return rules[programId] || rules.SNAP;
  }

  private calculateBenefitAmount(programId: string, data: any): number {
    const rules = this.getEligibilityRules(programId);
    const baseAmount = rules.incomeLimit;
    const householdBonus = (data.householdSize || 1) * rules.householdMultiplier;
    return Math.max(0, baseAmount + householdBonus - (data.income || 0));
  }
}

// Universal Feature: Smart Scheduler
export class SmartSchedulerFeature extends BaseUniversalFeature {
  id = 'smart_scheduler';
  name = 'Smart Scheduler';
  description = 'AI-powered appointment scheduling with conflict detection';
  category = FeatureCategory.SCHEDULING;
  requiredServices = ['calendar-api', 'notification-service'];

  async validate(context: FeatureContext): Promise<boolean> {
    return !!(context.data.appointmentType && context.data.preferredDate);
  }

  async execute(context: FeatureContext): Promise<FeatureResult> {
    const { result, metrics } = await this.withMetrics(async () => {
      const { appointmentType, preferredDate } = context.data;
      
      // Find available slots (would integrate with Google Calendar)
      const availableSlots = await this.findAvailableSlots(
        context.programId,
        preferredDate,
        appointmentType
      );

      // Schedule appointment
      const appointment = {
        id: `apt-${Date.now()}`,
        programId: context.programId,
        userId: context.userId,
        type: appointmentType,
        scheduledDate: availableSlots[0],
        status: 'confirmed',
        location: this.getLocationForProgram(context.programId),
      };

      // Store in database
      const db = await connectionPool.getConnection();
      try {
        // Would insert into appointments table
        await distributedCache.set(
          'appointments',
          `appointment:${appointment.id}`,
          appointment,
          86400
        );
      } finally {
        db.release();
      }

      return appointment;
    }, context);

    return {
      success: true,
      data: result,
      metrics,
    };
  }

  private async findAvailableSlots(
    programId: string,
    preferredDate: Date,
    type: string
  ): Promise<Date[]> {
    // Would check calendar availability
    const slots = [];
    const baseDate = new Date(preferredDate);
    for (let i = 0; i < 5; i++) {
      const slot = new Date(baseDate);
      slot.setDate(slot.getDate() + i);
      slot.setHours(9 + i * 2, 0, 0, 0);
      slots.push(slot);
    }
    return slots;
  }

  private getLocationForProgram(programId: string): string {
    const locations = {
      SNAP: 'Maryland Department of Human Services - Baltimore',
      Medicaid: 'Maryland Health Connection Center',
      TANF: 'Family Investment Administration Office',
      OHEP: 'Office of Home Energy Programs',
      TaxCredits: 'VITA Tax Site - Downtown',
      SSI: 'Social Security Administration Office',
    };
    return locations[programId] || 'Main Office';
  }
}

// Universal Feature: Cross-Enrollment Intelligence
export class CrossEnrollmentIntelligenceFeature extends BaseUniversalFeature {
  id = 'cross_enrollment_intelligence';
  name = 'Cross-Enrollment Intelligence';
  description = 'AI-powered detection of unclaimed benefits across programs';
  category = FeatureCategory.CROSS_ENROLLMENT;
  requiredServices = ['ai-orchestrator', 'eligibility-engine'];

  async validate(context: FeatureContext): Promise<boolean> {
    return !!context.householdId;
  }

  async execute(context: FeatureContext): Promise<FeatureResult> {
    const { result, metrics } = await this.withMetrics(async () => {
      const { householdId } = context;
      
      // Get current enrollments
      const currentEnrollments = await this.getCurrentEnrollments(householdId);
      
      // Check eligibility for all programs
      const allPrograms = ['SNAP', 'Medicaid', 'TANF', 'OHEP', 'TaxCredits', 'SSI'];
      const opportunities = [];

      for (const program of allPrograms) {
        if (!currentEnrollments.includes(program)) {
          // Check eligibility for this program
          const eligibilityFeature = registry.getFeature('eligibility_calculator');
          const eligibilityResult = await eligibilityFeature.execute({
            ...context,
            programId: program,
          });

          if (eligibilityResult.success && eligibilityResult.data?.eligible) {
            opportunities.push({
              programId: program,
              estimatedBenefit: eligibilityResult.data.benefitAmount,
              confidence: 0.85,
              reasons: eligibilityResult.data.reasons,
            });
          }
        }
      }

      // Sort by benefit amount
      opportunities.sort((a, b) => b.estimatedBenefit - a.estimatedBenefit);

      return {
        householdId,
        currentPrograms: currentEnrollments,
        opportunities,
        totalPotentialBenefit: opportunities.reduce((sum, o) => sum + o.estimatedBenefit, 0),
      };
    }, context);

    return {
      success: true,
      data: result,
      metrics,
    };
  }

  private async getCurrentEnrollments(householdId: string): Promise<string[]> {
    // Would query database for current enrollments
    const cacheKey = `enrollments:${householdId}`;
    const cached = await distributedCache.get('enrollments', cacheKey);
    return cached || ['SNAP']; // Example default
  }
}

// Universal Feature: Workflow Automation
export class WorkflowAutomationFeature extends BaseUniversalFeature {
  id = 'workflow_automation';
  name = 'Workflow Automation';
  description = 'Automate multi-step processes across programs';
  category = FeatureCategory.WORKFLOW_AUTOMATION;
  requiredServices = ['workflow-engine', 'notification-service'];

  async validate(context: FeatureContext): Promise<boolean> {
    return !!(context.data.workflowType && context.data.steps);
  }

  async execute(context: FeatureContext): Promise<FeatureResult> {
    const { result, metrics } = await this.withMetrics(async () => {
      const { workflowType, steps } = context.data;
      
      const workflow = {
        id: `wf-${Date.now()}`,
        type: workflowType,
        programId: context.programId,
        userId: context.userId,
        steps: steps,
        currentStep: 0,
        status: 'in_progress',
        startedAt: new Date(),
      };

      // Execute workflow steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        workflow.currentStep = i;
        
        try {
          // Execute step based on type
          await this.executeWorkflowStep(step, context);
        } catch (error) {
          workflow.status = 'failed';
          workflow.error = error.message;
          break;
        }
      }

      if (workflow.status === 'in_progress') {
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }

      // Store workflow state
      await distributedCache.set(
        'workflows',
        `workflow:${workflow.id}`,
        workflow,
        86400
      );

      return workflow;
    }, context);

    return {
      success: result.status === 'completed',
      data: result,
      metrics,
    };
  }

  private async executeWorkflowStep(step: any, context: FeatureContext): Promise<void> {
    switch (step.type) {
      case 'document_verification':
        // Verify documents
        break;
      case 'eligibility_check':
        // Check eligibility
        break;
      case 'notification':
        // Send notification
        break;
      case 'approval':
        // Process approval
        break;
      default:
        console.log(`Executing workflow step: ${step.type}`);
    }
  }
}

// Feature Registry - manages all universal features
export class UniversalFeatureRegistry {
  private static instance: UniversalFeatureRegistry;
  private features: Map<string, UniversalFeature> = new Map();
  private programFeatures: Map<string, Set<string>> = new Map();

  private constructor() {
    this.registerDefaultFeatures();
  }

  public static getInstance(): UniversalFeatureRegistry {
    if (!UniversalFeatureRegistry.instance) {
      UniversalFeatureRegistry.instance = new UniversalFeatureRegistry();
    }
    return UniversalFeatureRegistry.instance;
  }

  private registerDefaultFeatures(): void {
    // Register all universal features
    const defaultFeatures = [
      new AIDocumentExtractionFeature(),
      new EligibilityCalculatorFeature(),
      new SmartSchedulerFeature(),
      new CrossEnrollmentIntelligenceFeature(),
      new WorkflowAutomationFeature(),
    ];

    defaultFeatures.forEach(feature => {
      this.registerFeature(feature);
    });
  }

  public registerFeature(feature: UniversalFeature): void {
    this.features.set(feature.id, feature);
    
    // Register for each supported program
    feature.supportedPrograms.forEach(program => {
      if (!this.programFeatures.has(program)) {
        this.programFeatures.set(program, new Set());
      }
      this.programFeatures.get(program)!.add(feature.id);
    });

    console.log(`✅ Registered universal feature: ${feature.name} for programs: ${feature.supportedPrograms.join(', ')}`);
  }

  public getFeature(featureId: string): UniversalFeature {
    const feature = this.features.get(featureId);
    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }
    return feature;
  }

  public getFeaturesForProgram(programId: string): UniversalFeature[] {
    const featureIds = this.programFeatures.get(programId) || new Set();
    return Array.from(featureIds).map(id => this.getFeature(id));
  }

  public getAllFeatures(): UniversalFeature[] {
    return Array.from(this.features.values());
  }

  public async executeFeature(
    featureId: string,
    context: FeatureContext
  ): Promise<FeatureResult> {
    const feature = this.getFeature(featureId);
    
    // Validate context
    const isValid = await feature.validate(context);
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid context for feature execution',
      };
    }

    // Check if feature is enabled
    if (!feature.enabled) {
      return {
        success: false,
        error: 'Feature is disabled',
      };
    }

    // Check if program is supported
    if (!feature.supportedPrograms.includes(context.programId)) {
      return {
        success: false,
        error: `Feature not supported for program: ${context.programId}`,
      };
    }

    try {
      // Execute feature
      return await feature.execute(context);
    } catch (error) {
      console.error(`Error executing feature ${featureId}:`, error);
      
      // Attempt rollback
      if (feature.rollback) {
        await feature.rollback(context);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  public getFeatureMatrix(): Record<string, Record<string, boolean>> {
    const matrix: Record<string, Record<string, boolean>> = {};
    const allPrograms = ['SNAP', 'Medicaid', 'TANF', 'OHEP', 'TaxCredits', 'SSI'];
    
    allPrograms.forEach(program => {
      matrix[program] = {};
      this.getAllFeatures().forEach(feature => {
        matrix[program][feature.id] = feature.supportedPrograms.includes(program);
      });
    });

    return matrix;
  }

  public getFeatureStats(): {
    totalFeatures: number;
    enabledFeatures: number;
    featuresByCategory: Record<string, number>;
    averageProgramCoverage: number;
  } {
    const features = this.getAllFeatures();
    const enabledFeatures = features.filter(f => f.enabled).length;
    
    const featuresByCategory: Record<string, number> = {};
    features.forEach(feature => {
      featuresByCategory[feature.category] = (featuresByCategory[feature.category] || 0) + 1;
    });

    const totalCoverage = features.reduce((sum, f) => sum + f.supportedPrograms.length, 0);
    const averageProgramCoverage = totalCoverage / features.length;

    return {
      totalFeatures: features.length,
      enabledFeatures,
      featuresByCategory,
      averageProgramCoverage,
    };
  }
}

// Export singleton instance
export const registry = UniversalFeatureRegistry.getInstance();