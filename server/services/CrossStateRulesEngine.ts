import { storage } from "../storage";
import { stateConfigurationService } from "./stateConfigurationService";
import type {
  CrossStateRule,
  InsertCrossStateRule,
  JurisdictionHierarchy,
  InsertJurisdictionHierarchy,
  StateReciprocityAgreement,
  InsertStateReciprocityAgreement,
  MultiStateHousehold,
  InsertMultiStateHousehold,
  CrossStateRuleApplication,
  InsertCrossStateRuleApplication,
  HouseholdProfile,
  ClientCase,
  StateConfiguration,
} from "@shared/schema";

/**
 * Cross-State Rules Engine
 * Handles jurisdiction-specific rule resolution and benefit coordination across state boundaries
 */

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  primaryState: string;
  secondaryState?: string;
  explanation: string;
  rulesApplied: CrossStateRule[];
  benefitCalculation?: BenefitCalculation;
}

export interface BenefitCalculation {
  programId: string;
  primaryStateAmount?: number;
  secondaryStateAmount?: number;
  resolvedAmount: number;
  effectiveState: string;
  notes?: string;
}

export interface StateConflict {
  type: ConflictType;
  states: string[];
  programId?: string;
  conflictingValues: Record<string, any>;
  severity: "low" | "medium" | "high" | "critical";
  requiresReview: boolean;
}

export interface PortabilityAnalysis {
  fromState: string;
  toState: string;
  programId: string;
  isPortable: boolean;
  waitingPeriod?: number;
  documentationRequired?: string[];
  restrictions?: string[];
  reciprocityAgreement?: StateReciprocityAgreement;
}

export enum ResolutionStrategy {
  PRIMARY_RESIDENCE = "primary_residence",
  WORK_STATE = "work_state",
  MOST_FAVORABLE = "most_favorable",
  FEDERAL_OVERRIDE = "federal_override",
  RECIPROCITY = "reciprocity",
  MANUAL_REVIEW = "manual_review"
}

export enum ConflictType {
  INCOME_THRESHOLD = "income_threshold",
  ASSET_LIMIT = "asset_limit",
  WORK_REQUIREMENT = "work_requirement",
  ELIGIBILITY_CRITERIA = "eligibility_criteria",
  BENEFIT_CALCULATION = "benefit_calculation",
  DOCUMENTATION = "documentation"
}

export enum HouseholdScenario {
  BORDER_WORKER = "border_worker",
  COLLEGE_STUDENT = "college_student",
  MILITARY = "military",
  SHARED_CUSTODY = "shared_custody",
  RELOCATION = "relocation",
  FEDERAL_EMPLOYEE = "federal_employee",
  MULTI_STATE = "multi_state"
}

export class CrossStateRulesEngine {
  /**
   * Analyze household for cross-state issues
   */
  async analyzeHousehold(householdId: string): Promise<{
    scenario: HouseholdScenario | null;
    conflicts: StateConflict[];
    recommendations: ConflictResolution[];
    requiresReview: boolean;
    multiStateHousehold?: MultiStateHousehold;
  }> {
    // Get household profile and case data
    const household = await storage.getHouseholdProfile(householdId);
    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    const clientCase = household.clientCaseId 
      ? await storage.getClientCase(household.clientCaseId)
      : null;

    // Check for existing multi-state household record
    let multiStateHousehold = await storage.getMultiStateHouseholdByHouseholdId(householdId);

    // Detect scenario
    const scenario = this.detectHouseholdScenario(household, clientCase);

    // If multi-state scenario detected, create or update record
    if (scenario && !multiStateHousehold) {
      multiStateHousehold = await this.createMultiStateHousehold(
        household,
        clientCase,
        scenario
      );
    }

    // Detect conflicts
    const conflicts = await this.detectStateConflicts(household, multiStateHousehold);

    // Generate recommendations
    const recommendations = await this.generateResolutionRecommendations(
      conflicts,
      household,
      multiStateHousehold
    );

    // Check if review is required
    const requiresReview = this.checkIfReviewRequired(conflicts, recommendations);

    return {
      scenario,
      conflicts,
      recommendations,
      requiresReview,
      multiStateHousehold
    };
  }

  /**
   * Detect household scenario based on profile data
   */
  private detectHouseholdScenario(
    household: HouseholdProfile,
    clientCase: ClientCase | null
  ): HouseholdScenario | null {
    const data = household.householdData as any;

    // Federal employee in DC
    if (data?.members?.some((m: any) => 
      m.employer?.toLowerCase().includes("federal") && 
      (data.state === "DC" || data.workState === "DC")
    )) {
      return HouseholdScenario.FEDERAL_EMPLOYEE;
    }

    // Military family
    if (data?.members?.some((m: any) => 
      m.military || m.employer?.toLowerCase().includes("military")
    )) {
      return HouseholdScenario.MILITARY;
    }

    // Border worker (different work and residence states)
    if (data?.state && data?.workState && data.state !== data.workState) {
      return HouseholdScenario.BORDER_WORKER;
    }

    // College student
    if (data?.members?.some((m: any) => 
      m.studentStatus === "full_time" && m.outOfState
    )) {
      return HouseholdScenario.COLLEGE_STUDENT;
    }

    // Relocation
    if (clientCase?.metadata?.relocation || data?.previousState) {
      return HouseholdScenario.RELOCATION;
    }

    // Shared custody
    if (data?.members?.some((m: any) => m.sharedCustody)) {
      return HouseholdScenario.SHARED_CUSTODY;
    }

    // Multi-state household
    const memberStates = new Set(
      data?.members?.map((m: any) => m.state || data.state).filter(Boolean)
    );
    if (memberStates.size > 1) {
      return HouseholdScenario.MULTI_STATE;
    }

    return null;
  }

  /**
   * Create multi-state household record
   */
  private async createMultiStateHousehold(
    household: HouseholdProfile,
    clientCase: ClientCase | null,
    scenario: HouseholdScenario
  ): Promise<MultiStateHousehold> {
    const data = household.householdData as any;

    // Build member states mapping
    const memberStates: Record<string, string> = {};
    data?.members?.forEach((member: any, index: number) => {
      memberStates[member.id || `member_${index}`] = member.state || data.state;
    });

    const multiStateData: InsertMultiStateHousehold = {
      householdId: household.id,
      clientCaseId: clientCase?.id,
      primaryResidenceState: data.state || "MD",
      primaryResidenceCounty: data.county,
      primaryResidenceZip: data.zipCode,
      workState: data.workState,
      workCounty: data.workCounty,
      workZip: data.workZip,
      memberStates,
      outOfStateMembers: Object.values(memberStates).filter(
        s => s !== data.state
      ).length,
      scenario,
      scenarioDetails: {
        detectedAt: new Date().toISOString(),
        householdSize: data.members?.length || 1,
      },
      hasFederalEmployee: scenario === HouseholdScenario.FEDERAL_EMPLOYEE,
      hasMilitaryMember: scenario === HouseholdScenario.MILITARY,
      status: "pending"
    };

    return await storage.createMultiStateHousehold(multiStateData);
  }

  /**
   * Detect state conflicts for a household
   */
  private async detectStateConflicts(
    household: HouseholdProfile,
    multiStateHousehold: MultiStateHousehold | null
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];
    const data = household.householdData as any;

    if (!multiStateHousehold) return conflicts;

    const primaryState = multiStateHousehold.primaryResidenceState;
    const workState = multiStateHousehold.workState;

    if (!workState || primaryState === workState) return conflicts;

    // Get state configurations
    const primaryConfig = await stateConfigurationService.getStateConfigByCode(primaryState);
    const workConfig = await stateConfigurationService.getStateConfigByCode(workState);

    if (!primaryConfig || !workConfig) return conflicts;

    // Get benefit programs for both states
    const primaryPrograms = await storage.getStateBenefitPrograms(primaryConfig.id);
    const workPrograms = await storage.getStateBenefitPrograms(workConfig.id);

    // Check for SNAP conflicts
    const primarySNAP = primaryPrograms.find(p => p.benefitProgramId === "SNAP");
    const workSNAP = workPrograms.find(p => p.benefitProgramId === "SNAP");

    if (primarySNAP && workSNAP) {
      // Income limit conflict
      if (primarySNAP.incomeLimitMultiplier !== workSNAP.incomeLimitMultiplier) {
        conflicts.push({
          type: ConflictType.INCOME_THRESHOLD,
          states: [primaryState, workState],
          programId: "SNAP",
          conflictingValues: {
            [primaryState]: primarySNAP.incomeLimitMultiplier,
            [workState]: workSNAP.incomeLimitMultiplier
          },
          severity: "medium",
          requiresReview: false
        });
      }

      // Asset limit conflict
      const primaryAssetLimit = primarySNAP.assetLimitOverride;
      const workAssetLimit = workSNAP.assetLimitOverride;
      if (primaryAssetLimit !== workAssetLimit) {
        conflicts.push({
          type: ConflictType.ASSET_LIMIT,
          states: [primaryState, workState],
          programId: "SNAP",
          conflictingValues: {
            [primaryState]: primaryAssetLimit,
            [workState]: workAssetLimit
          },
          severity: primaryAssetLimit === null || workAssetLimit === null ? "high" : "medium",
          requiresReview: false
        });
      }
    }

    // Check for Medicaid expansion conflicts (important for CA→TX scenario)
    const primaryMedicaid = primaryPrograms.find(p => p.benefitProgramId === "MEDICAID");
    const workMedicaid = workPrograms.find(p => p.benefitProgramId === "MEDICAID");

    if (primaryMedicaid && workMedicaid) {
      const primaryExpansion = primaryMedicaid.eligibilityOverrides?.["medicaidExpansion"] ?? true;
      const workExpansion = workMedicaid.eligibilityOverrides?.["medicaidExpansion"] ?? true;

      if (primaryExpansion !== workExpansion) {
        conflicts.push({
          type: ConflictType.ELIGIBILITY_CRITERIA,
          states: [primaryState, workState],
          programId: "MEDICAID",
          conflictingValues: {
            [primaryState]: { medicaidExpansion: primaryExpansion },
            [workState]: { medicaidExpansion: workExpansion }
          },
          severity: "critical",
          requiresReview: true
        });
      }
    }

    return conflicts;
  }

  /**
   * Generate resolution recommendations for conflicts
   */
  private async generateResolutionRecommendations(
    conflicts: StateConflict[],
    household: HouseholdProfile,
    multiStateHousehold: MultiStateHousehold | null
  ): Promise<ConflictResolution[]> {
    const recommendations: ConflictResolution[] = [];

    if (!multiStateHousehold) return recommendations;

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(
        conflict,
        household,
        multiStateHousehold
      );
      if (resolution) {
        recommendations.push(resolution);
      }
    }

    return recommendations;
  }

  /**
   * Resolve a specific conflict
   */
  private async resolveConflict(
    conflict: StateConflict,
    household: HouseholdProfile,
    multiStateHousehold: MultiStateHousehold
  ): Promise<ConflictResolution | null> {
    // Check for reciprocity agreements
    const reciprocity = await this.checkReciprocityAgreement(
      multiStateHousehold.primaryResidenceState,
      multiStateHousehold.workState!,
      conflict.programId
    );

    if (reciprocity) {
      return {
        strategy: ResolutionStrategy.RECIPROCITY,
        primaryState: multiStateHousehold.primaryResidenceState,
        secondaryState: multiStateHousehold.workState!,
        explanation: `States have reciprocity agreement for ${conflict.programId}`,
        rulesApplied: []
      };
    }

    // Apply resolution based on scenario
    switch (multiStateHousehold.scenario) {
      case HouseholdScenario.FEDERAL_EMPLOYEE:
        return {
          strategy: ResolutionStrategy.FEDERAL_OVERRIDE,
          primaryState: "DC",
          explanation: "Federal employee rules take precedence",
          rulesApplied: []
        };

      case HouseholdScenario.MILITARY:
        return {
          strategy: ResolutionStrategy.PRIMARY_RESIDENCE,
          primaryState: multiStateHousehold.homeOfRecord || multiStateHousehold.primaryResidenceState,
          explanation: "Military home of record rules apply",
          rulesApplied: []
        };

      case HouseholdScenario.BORDER_WORKER:
        // For SNAP, use residence state; for unemployment, use work state
        if (conflict.programId === "SNAP" || conflict.programId === "TANF") {
          return {
            strategy: ResolutionStrategy.PRIMARY_RESIDENCE,
            primaryState: multiStateHousehold.primaryResidenceState,
            secondaryState: multiStateHousehold.workState!,
            explanation: "Nutrition and cash assistance based on residence state",
            rulesApplied: []
          };
        } else {
          return {
            strategy: ResolutionStrategy.WORK_STATE,
            primaryState: multiStateHousehold.workState!,
            secondaryState: multiStateHousehold.primaryResidenceState,
            explanation: "Work-related benefits based on employment state",
            rulesApplied: []
          };
        }

      default:
        // Apply most favorable rule for other scenarios
        return this.applyMostFavorableRule(conflict, multiStateHousehold);
    }
  }

  /**
   * Apply the most favorable rule strategy
   */
  private applyMostFavorableRule(
    conflict: StateConflict,
    multiStateHousehold: MultiStateHousehold
  ): ConflictResolution {
    const primaryValue = conflict.conflictingValues[multiStateHousehold.primaryResidenceState];
    const secondaryValue = conflict.conflictingValues[multiStateHousehold.workState!];

    let effectiveState = multiStateHousehold.primaryResidenceState;
    let explanation = "Most favorable benefit calculation applied";

    // Determine which is more favorable based on conflict type
    switch (conflict.type) {
      case ConflictType.INCOME_THRESHOLD:
        // Higher income threshold is more favorable
        if (secondaryValue > primaryValue) {
          effectiveState = multiStateHousehold.workState!;
        }
        break;

      case ConflictType.ASSET_LIMIT:
        // No asset limit (null) or higher limit is more favorable
        if (primaryValue === null) {
          effectiveState = multiStateHousehold.primaryResidenceState;
        } else if (secondaryValue === null || secondaryValue > primaryValue) {
          effectiveState = multiStateHousehold.workState!;
        }
        break;

      case ConflictType.ELIGIBILITY_CRITERIA:
        // This requires more complex analysis
        explanation = "Eligibility criteria conflict requires manual review";
        break;
    }

    return {
      strategy: ResolutionStrategy.MOST_FAVORABLE,
      primaryState: effectiveState,
      secondaryState: effectiveState === multiStateHousehold.primaryResidenceState 
        ? multiStateHousehold.workState! 
        : multiStateHousehold.primaryResidenceState,
      explanation,
      rulesApplied: []
    };
  }

  /**
   * Check if states have reciprocity agreement
   */
  async checkReciprocityAgreement(
    stateA: string,
    stateB: string,
    programId?: string
  ): Promise<StateReciprocityAgreement | null> {
    const agreement = await storage.getReciprocityAgreement(stateA, stateB);
    
    if (!agreement || !agreement.isActive) return null;

    // Check if program is covered
    if (programId) {
      const covered = agreement.coveredPrograms?.includes(programId);
      const excluded = agreement.excludedPrograms?.includes(programId);
      
      if (!covered || excluded) return null;
    }

    return agreement;
  }

  /**
   * Check if review is required
   */
  private checkIfReviewRequired(
    conflicts: StateConflict[],
    recommendations: ConflictResolution[]
  ): boolean {
    // Review required if any critical conflicts
    if (conflicts.some(c => c.severity === "critical" || c.requiresReview)) {
      return true;
    }

    // Review required if manual review strategy recommended
    if (recommendations.some(r => r.strategy === ResolutionStrategy.MANUAL_REVIEW)) {
      return true;
    }

    return false;
  }

  /**
   * Get rule conflicts for household
   */
  async getConflicts(householdId: string): Promise<StateConflict[]> {
    const analysis = await this.analyzeHousehold(householdId);
    return analysis.conflicts;
  }

  /**
   * Resolve conflicts with specific strategy
   */
  async resolveWithStrategy(
    householdId: string,
    strategy: ResolutionStrategy,
    userId: string
  ): Promise<ConflictResolution> {
    const analysis = await this.analyzeHousehold(householdId);
    const multiStateHousehold = analysis.multiStateHousehold;

    if (!multiStateHousehold) {
      throw new Error("No multi-state household found");
    }

    // Update resolution in database
    await storage.updateMultiStateHousehold(multiStateHousehold.id, {
      appliedResolutionStrategy: strategy,
      resolutionDate: new Date(),
      resolutionNotes: `Resolved by user ${userId} with ${strategy} strategy`,
      status: "resolved",
      lastReviewedBy: userId,
      lastReviewedAt: new Date()
    });

    // Create resolution record
    const resolution: ConflictResolution = {
      strategy,
      primaryState: multiStateHousehold.primaryResidenceState,
      secondaryState: multiStateHousehold.workState,
      explanation: `Applied ${strategy} resolution strategy`,
      rulesApplied: []
    };

    // Apply rules based on strategy
    const rules = await this.getRulesForStrategy(strategy, multiStateHousehold);
    resolution.rulesApplied = rules;

    // Record rule application
    for (const rule of rules) {
      await storage.createCrossStateRuleApplication({
        clientCaseId: multiStateHousehold.clientCaseId!,
        householdId: multiStateHousehold.householdId,
        multiStateHouseholdId: multiStateHousehold.id,
        crossStateRuleId: rule.id,
        fromState: multiStateHousehold.primaryResidenceState,
        toState: multiStateHousehold.workState,
        applicationReason: `Applied ${strategy} strategy`,
        conflictsDetected: analysis.conflicts,
        resolutionApplied: resolution,
        outcome: "approved",
        appliedBy: userId
      });
    }

    return resolution;
  }

  /**
   * Get rules for a specific resolution strategy
   */
  private async getRulesForStrategy(
    strategy: ResolutionStrategy,
    multiStateHousehold: MultiStateHousehold
  ): Promise<CrossStateRule[]> {
    const rules = await storage.getCrossStateRules({
      primaryState: multiStateHousehold.primaryResidenceState,
      resolutionStrategy: strategy
    });

    return rules;
  }

  /**
   * Check benefit portability between states
   */
  async checkPortability(
    fromState: string,
    toState: string,
    programId: string
  ): Promise<PortabilityAnalysis> {
    // Check for reciprocity agreement
    const reciprocity = await this.checkReciprocityAgreement(fromState, toState, programId);

    const analysis: PortabilityAnalysis = {
      fromState,
      toState,
      programId,
      isPortable: false,
      waitingPeriod: 0,
      documentationRequired: [],
      restrictions: []
    };

    if (reciprocity && reciprocity.benefitPortability) {
      analysis.isPortable = true;
      analysis.waitingPeriod = reciprocity.waitingPeriodDays || 0;
      analysis.documentationRequired = reciprocity.documentationRequired?.required || [];
      analysis.reciprocityAgreement = reciprocity;
      return analysis;
    }

    // Check state-specific portability rules
    const fromConfig = await stateConfigurationService.getStateConfigByCode(fromState);
    const toConfig = await stateConfigurationService.getStateConfigByCode(toState);

    if (!fromConfig || !toConfig) {
      analysis.restrictions = ["State configuration not found"];
      return analysis;
    }

    // Default portability rules by program
    switch (programId) {
      case "SNAP":
        analysis.isPortable = true;
        analysis.waitingPeriod = 0; // SNAP benefits are immediately portable
        analysis.documentationRequired = [
          "Proof of new residence",
          "Proof of identity",
          "Income verification"
        ];
        break;

      case "MEDICAID":
        // Check if both states have Medicaid expansion
        const fromPrograms = await storage.getStateBenefitPrograms(fromConfig.id);
        const toPrograms = await storage.getStateBenefitPrograms(toConfig.id);
        
        const fromMedicaid = fromPrograms.find(p => p.benefitProgramId === "MEDICAID");
        const toMedicaid = toPrograms.find(p => p.benefitProgramId === "MEDICAID");

        if (fromMedicaid && toMedicaid) {
          const fromExpansion = fromMedicaid.eligibilityOverrides?.["medicaidExpansion"] ?? true;
          const toExpansion = toMedicaid.eligibilityOverrides?.["medicaidExpansion"] ?? true;

          if (fromExpansion && !toExpansion) {
            analysis.restrictions.push("Moving to non-expansion state may affect eligibility");
          }
          
          analysis.isPortable = true;
          analysis.waitingPeriod = 0; // Must reapply in new state
          analysis.documentationRequired = [
            "Proof of new residence",
            "Medicaid termination letter from previous state",
            "Income verification",
            "Identity documents"
          ];
        }
        break;

      case "TANF":
        analysis.isPortable = false; // TANF is state-specific
        analysis.restrictions = ["TANF benefits must be reapplied for in new state"];
        analysis.documentationRequired = [
          "Complete new application in destination state",
          "Proof of residence",
          "Income verification",
          "Work history"
        ];
        break;
    }

    return analysis;
  }

  /**
   * Calculate benefits for border workers
   */
  async calculateBorderWorkerBenefits(
    householdId: string,
    residenceState: string,
    workState: string
  ): Promise<{
    eligiblePrograms: string[];
    benefitCalculations: BenefitCalculation[];
    recommendations: string[];
  }> {
    const household = await storage.getHouseholdProfile(householdId);
    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    const eligiblePrograms: string[] = [];
    const benefitCalculations: BenefitCalculation[] = [];
    const recommendations: string[] = [];

    // Get configurations for both states
    const residenceConfig = await stateConfigurationService.getStateConfigByCode(residenceState);
    const workConfig = await stateConfigurationService.getStateConfigByCode(workState);

    if (!residenceConfig || !workConfig) {
      throw new Error("State configurations not found");
    }

    // Check SNAP eligibility (residence-based)
    const residencePrograms = await storage.getStateBenefitPrograms(residenceConfig.id);
    const snapProgram = residencePrograms.find(p => p.benefitProgramId === "SNAP");
    
    if (snapProgram) {
      eligiblePrograms.push("SNAP");
      benefitCalculations.push({
        programId: "SNAP",
        resolvedAmount: 0, // Would be calculated based on household income
        effectiveState: residenceState,
        notes: "SNAP benefits based on residence state"
      });
      recommendations.push(`Apply for SNAP benefits in ${residenceState} (residence state)`);
    }

    // Check unemployment insurance (work-based)
    recommendations.push(`Unemployment insurance would be through ${workState} (employment state)`);

    // Check for tax reciprocity
    const taxReciprocity = await this.checkReciprocityAgreement(
      residenceState,
      workState,
      "TAX"
    );

    if (taxReciprocity) {
      recommendations.push(`Tax reciprocity agreement exists - may only need to file in ${residenceState}`);
    } else {
      recommendations.push(`May need to file taxes in both ${residenceState} and ${workState}`);
    }

    // Special handling for NYC/NY
    if ((residenceState === "NY" && workState === "NYC") || 
        (residenceState === "NYC" && workState === "NY")) {
      recommendations.push("NYC uses NY State benefit rules - single application covers both");
    }

    // Special handling for DC federal employees
    const data = household.householdData as any;
    if (workState === "DC" && data?.members?.some((m: any) => 
      m.employer?.toLowerCase().includes("federal")
    )) {
      recommendations.push("As a federal employee in DC, you may have access to federal employee benefit programs");
      eligiblePrograms.push("FEHB"); // Federal Employee Health Benefits
    }

    return {
      eligiblePrograms,
      benefitCalculations,
      recommendations
    };
  }

  /**
   * Handle NYC vs NY State distinction
   */
  async resolveNYCvsNYState(householdId: string): Promise<ConflictResolution> {
    // NYC uses NY State rules, so no conflict exists
    return {
      strategy: ResolutionStrategy.PRIMARY_RESIDENCE,
      primaryState: "NY",
      explanation: "NYC follows NY State benefit rules - no conflict to resolve",
      rulesApplied: []
    };
  }

  /**
   * Handle DC federal employee special rules
   */
  async resolveDCFederalEmployee(
    householdId: string,
    employeeDetails: any
  ): Promise<ConflictResolution> {
    const rules = await storage.getCrossStateRules({
      primaryState: "DC",
      ruleType: "federal_employee"
    });

    return {
      strategy: ResolutionStrategy.FEDERAL_OVERRIDE,
      primaryState: "DC",
      explanation: "Federal employee rules apply, overriding standard DC rules",
      rulesApplied: rules,
      benefitCalculation: {
        programId: "FEHB",
        resolvedAmount: 0,
        effectiveState: "DC",
        notes: "Federal Employee Health Benefits program applies"
      }
    };
  }

  /**
   * Get jurisdiction hierarchy for a location
   */
  async getJurisdictionHierarchy(
    state: string,
    county?: string,
    city?: string
  ): Promise<JurisdictionHierarchy[]> {
    const hierarchy: JurisdictionHierarchy[] = [];

    // Get federal level
    const federal = await storage.getJurisdictionByCode("US");
    if (federal) hierarchy.push(federal);

    // Get state level
    const stateJurisdiction = await storage.getJurisdictionByCode(state);
    if (stateJurisdiction) hierarchy.push(stateJurisdiction);

    // Get county level if provided
    if (county) {
      const countyJurisdiction = await storage.getJurisdictionByCode(`${state}-${county}`);
      if (countyJurisdiction) hierarchy.push(countyJurisdiction);
    }

    // Get city level if provided
    if (city) {
      const cityJurisdiction = await storage.getJurisdictionByCode(`${state}-${city}`);
      if (cityJurisdiction) hierarchy.push(cityJurisdiction);
    }

    // Sort by hierarchy level (federal first)
    hierarchy.sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);

    return hierarchy;
  }

  /**
   * Apply jurisdiction precedence rules
   */
  async applyJurisdictionPrecedence(
    rules: any[],
    jurisdictionHierarchy: JurisdictionHierarchy[]
  ): Promise<any[]> {
    // Federal rules override state rules
    // State rules override local rules
    // Unless special override permissions exist

    const sortedRules = [...rules];
    
    sortedRules.sort((a, b) => {
      const aJurisdiction = jurisdictionHierarchy.find(j => j.jurisdictionCode === a.jurisdictionCode);
      const bJurisdiction = jurisdictionHierarchy.find(j => j.jurisdictionCode === b.jurisdictionCode);

      if (!aJurisdiction || !bJurisdiction) return 0;

      // Lower hierarchy level = higher precedence (federal = 0, state = 1, etc.)
      return aJurisdiction.hierarchyLevel - bJurisdiction.hierarchyLevel;
    });

    return sortedRules;
  }
}

// Export singleton instance
export const crossStateRulesEngine = new CrossStateRulesEngine();