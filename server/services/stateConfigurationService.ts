import { storage } from "../storage";
import { tenantService } from "./tenantService";
import type { 
  StateConfiguration, 
  InsertStateConfiguration,
  StateBenefitProgram,
  InsertStateBenefitProgram,
  StateForm,
  InsertStateForm,
  StatePolicyRule,
  InsertStatePolicyRule,
  Tenant,
  TenantBranding,
  BenefitProgram
} from "@shared/schema";

/**
 * State Configuration Service
 * Manages multi-state white-labeling and jurisdiction-specific configurations
 */

export class StateConfigurationService {
  /**
   * Get complete state configuration by tenant ID
   */
  async getStateConfigByTenant(tenantId: string): Promise<{
    tenant: Tenant;
    stateConfig: StateConfiguration;
    branding?: TenantBranding;
    programs?: StateBenefitProgram[];
  } | null> {
    const tenant = await tenantService.getTenant(tenantId);
    if (!tenant) return null;

    const stateConfig = await storage.getStateConfigurationByTenant(tenantId);
    if (!stateConfig) return null;

    const branding = await tenantService.getTenantBranding(tenantId);
    const programs = await storage.getStateBenefitPrograms(stateConfig.id);

    return {
      tenant,
      stateConfig,
      branding,
      programs
    };
  }

  /**
   * Get state configuration by state code
   */
  async getStateConfigByCode(stateCode: string): Promise<StateConfiguration | undefined> {
    return await storage.getStateConfigurationByCode(stateCode);
  }

  /**
   * Get all active state configurations
   */
  async getActiveStateConfigs(): Promise<StateConfiguration[]> {
    return await storage.getStateConfigurations({ isActive: true });
  }

  /**
   * Get state configurations by region
   */
  async getStateConfigsByRegion(region: string): Promise<StateConfiguration[]> {
    return await storage.getStateConfigurations({ region });
  }

  /**
   * Create complete state configuration with tenant
   */
  async createStateConfiguration(data: {
    tenant: { name: string; slug: string; domain?: string };
    stateConfig: InsertStateConfiguration;
    branding?: Partial<TenantBranding>;
    programs?: { benefitProgramId: string; overrides?: any }[];
  }): Promise<{
    tenant: Tenant;
    stateConfig: StateConfiguration;
    branding?: TenantBranding;
    programs?: StateBenefitProgram[];
  }> {
    // Create tenant first
    const tenant = await tenantService.createTenant({
      name: data.tenant.name,
      slug: data.tenant.slug,
      type: "state",
      domain: data.tenant.domain,
      status: "active",
      config: {}
    });

    // Create state configuration linked to tenant
    const stateConfig = await storage.createStateConfiguration({
      ...data.stateConfig,
      tenantId: tenant.id
    });

    // Create branding if provided
    let branding: TenantBranding | undefined;
    if (data.branding) {
      branding = await tenantService.createTenantBranding({
        tenantId: tenant.id,
        ...data.branding
      });
    }

    // Create program configurations if provided
    let programs: StateBenefitProgram[] = [];
    if (data.programs && data.programs.length > 0) {
      for (const prog of data.programs) {
        const created = await storage.createStateBenefitProgram({
          stateConfigId: stateConfig.id,
          benefitProgramId: prog.benefitProgramId,
          eligibilityOverrides: prog.overrides || {},
          isActive: true
        });
        programs.push(created);
      }
    }

    return {
      tenant,
      stateConfig,
      branding,
      programs
    };
  }

  /**
   * Update state configuration
   */
  async updateStateConfiguration(id: string, updates: Partial<StateConfiguration>): Promise<StateConfiguration> {
    return await storage.updateStateConfiguration(id, updates);
  }

  /**
   * Configure benefit program for a state
   */
  async configureStateBenefitProgram(
    stateConfigId: string, 
    benefitProgramId: string,
    config: Partial<InsertStateBenefitProgram>
  ): Promise<StateBenefitProgram> {
    // Check if program already configured for this state
    const existing = await storage.getStateBenefitPrograms(stateConfigId);
    const existingProgram = existing.find(p => p.benefitProgramId === benefitProgramId);

    if (existingProgram) {
      // Update existing configuration
      return await storage.updateStateBenefitProgram(existingProgram.id, config);
    } else {
      // Create new configuration
      return await storage.createStateBenefitProgram({
        stateConfigId,
        benefitProgramId,
        ...config
      });
    }
  }

  /**
   * Get available benefit programs for a state
   */
  async getStateBenefitPrograms(stateConfigId: string): Promise<{
    configured: StateBenefitProgram[];
    available: BenefitProgram[];
  }> {
    const configured = await storage.getStateBenefitPrograms(stateConfigId);
    const allPrograms = await storage.getBenefitPrograms();
    
    const configuredProgramIds = new Set(configured.map(p => p.benefitProgramId));
    const available = allPrograms.filter(p => !configuredProgramIds.has(p.id));

    return {
      configured,
      available
    };
  }

  /**
   * Add state-specific form
   */
  async addStateForm(stateConfigId: string, form: InsertStateForm): Promise<StateForm> {
    return await storage.createStateForm({
      ...form,
      stateConfigId
    });
  }

  /**
   * Get state forms by type
   */
  async getStateFormsByType(stateConfigId: string, formType: string): Promise<StateForm[]> {
    return await storage.getStateForms(stateConfigId, { formType, isActive: true });
  }

  /**
   * Add state policy rule
   */
  async addStatePolicyRule(stateConfigId: string, rule: InsertStatePolicyRule): Promise<StatePolicyRule> {
    return await storage.createStatePolicyRule({
      ...rule,
      stateConfigId
    });
  }

  /**
   * Get state policy rules for a program
   */
  async getStatePolicyRulesForProgram(
    stateConfigId: string, 
    benefitProgramId: string
  ): Promise<StatePolicyRule[]> {
    return await storage.getStatePolicyRules(stateConfigId, {
      benefitProgramId,
      isActive: true
    });
  }

  /**
   * Apply state-specific eligibility overrides
   */
  async applyStateEligibilityRules(
    stateCode: string,
    benefitProgramId: string,
    baseEligibility: any
  ): Promise<any> {
    const stateConfig = await this.getStateConfigByCode(stateCode);
    if (!stateConfig) return baseEligibility;

    const stateBenefitPrograms = await storage.getStateBenefitPrograms(stateConfig.id);
    const stateProgram = stateBenefitPrograms.find(p => p.benefitProgramId === benefitProgramId);
    
    if (!stateProgram || !stateProgram.eligibilityOverrides) {
      return baseEligibility;
    }

    // Apply state-specific overrides
    const overrides = stateProgram.eligibilityOverrides as any;
    
    // Apply income limit multiplier if present
    if (stateProgram.incomeLimitMultiplier && baseEligibility.incomeLimit) {
      baseEligibility.incomeLimit = Math.round(
        baseEligibility.incomeLimit * stateProgram.incomeLimitMultiplier
      );
    }

    // Apply asset limit override if present
    if (stateProgram.assetLimitOverride !== null) {
      baseEligibility.assetLimit = stateProgram.assetLimitOverride;
    }

    // Apply other overrides from JSON configuration
    return {
      ...baseEligibility,
      ...overrides
    };
  }

  /**
   * Get state configuration for routing
   */
  async getStateRoutingInfo(stateCode: string): Promise<{
    stateCode: string;
    slug: string;
    name: string;
    isActive: boolean;
  } | null> {
    const stateConfig = await this.getStateConfigByCode(stateCode);
    if (!stateConfig) return null;

    const tenant = await tenantService.getTenant(stateConfig.tenantId);
    if (!tenant) return null;

    return {
      stateCode: stateConfig.stateCode,
      slug: tenant.slug,
      name: stateConfig.stateName,
      isActive: stateConfig.isActive
    };
  }

  /**
   * Get all states for state selector
   */
  async getStatesForSelector(): Promise<{
    stateCode: string;
    stateName: string;
    region: string;
    slug: string;
    isActive: boolean;
  }[]> {
    const configs = await storage.getStateConfigurations();
    const results = [];

    for (const config of configs) {
      const tenant = await tenantService.getTenant(config.tenantId);
      if (tenant) {
        results.push({
          stateCode: config.stateCode,
          stateName: config.stateName,
          region: config.region,
          slug: tenant.slug,
          isActive: config.isActive
        });
      }
    }

    return results.sort((a, b) => a.stateName.localeCompare(b.stateName));
  }

  /**
   * Validate state configuration completeness
   */
  async validateStateConfiguration(stateConfigId: string): Promise<{
    isComplete: boolean;
    missingElements: string[];
  }> {
    const missingElements: string[] = [];
    
    const stateConfig = await storage.getStateConfiguration(stateConfigId);
    if (!stateConfig) {
      return { isComplete: false, missingElements: ['State configuration not found'] };
    }

    // Check required fields
    if (!stateConfig.agencyName) missingElements.push('Agency name');
    if (!stateConfig.agencyWebsite) missingElements.push('Agency website');
    if (!stateConfig.supportPhone) missingElements.push('Support phone');
    if (!stateConfig.supportEmail) missingElements.push('Support email');

    // Check for at least one benefit program
    const programs = await storage.getStateBenefitPrograms(stateConfigId);
    if (programs.length === 0) {
      missingElements.push('At least one benefit program');
    }

    // Check for branding
    const tenant = await tenantService.getTenant(stateConfig.tenantId);
    if (tenant) {
      const branding = await tenantService.getTenantBranding(tenant.id);
      if (!branding) {
        missingElements.push('Branding configuration');
      }
    }

    return {
      isComplete: missingElements.length === 0,
      missingElements
    };
  }

  /**
   * Clone state configuration from another state
   */
  async cloneStateConfiguration(
    sourceStateCode: string,
    targetStateCode: string,
    targetData: {
      tenant: { name: string; slug: string; domain?: string };
      stateConfig: Partial<InsertStateConfiguration>;
    }
  ): Promise<StateConfiguration | null> {
    const sourceConfig = await this.getStateConfigByCode(sourceStateCode);
    if (!sourceConfig) return null;

    // Get source programs, forms, and rules
    const sourcePrograms = await storage.getStateBenefitPrograms(sourceConfig.id);
    const sourceForms = await storage.getStateForms(sourceConfig.id);
    const sourceRules = await storage.getStatePolicyRules(sourceConfig.id);

    // Create new state configuration
    const newConfig = await this.createStateConfiguration({
      tenant: targetData.tenant,
      stateConfig: {
        ...sourceConfig,
        ...targetData.stateConfig,
        stateCode: targetStateCode,
        tenantId: '', // Will be set by createStateConfiguration
      },
      programs: sourcePrograms.map(p => ({
        benefitProgramId: p.benefitProgramId,
        overrides: p.eligibilityOverrides
      }))
    });

    // Clone forms and rules
    for (const form of sourceForms) {
      await storage.createStateForm({
        ...form,
        id: undefined as any,
        stateConfigId: newConfig.stateConfig.id,
        createdAt: undefined as any,
        updatedAt: undefined as any
      });
    }

    for (const rule of sourceRules) {
      await storage.createStatePolicyRule({
        ...rule,
        id: undefined as any,
        stateConfigId: newConfig.stateConfig.id,
        createdAt: undefined as any,
        updatedAt: undefined as any
      });
    }

    return newConfig.stateConfig;
  }
}

export const stateConfigurationService = new StateConfigurationService();