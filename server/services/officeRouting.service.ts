/**
 * Office Routing Service
 * 
 * Implements intelligent case routing for multi-state JAWN deployment:
 * - Geographic routing based on applicant residence (county/ZIP)
 * - Workload balancing across offices within a state
 * - Specialty matching (program-specific expertise)
 * - Hub-and-spoke model support (centralized vs decentralized)
 * - Manual override capability with audit trail
 * 
 * Processing Models:
 * 1. Centralized Hub-and-Spoke: All cases routed to designated hub offices
 * 2. Decentralized On-Site: Cases routed to local offices based on geography
 * 3. Hybrid: Geographic routing with hub escalation for complex cases
 */

import { storage } from '../storage';
import { createLogger } from './logger.service';
import { immutableAuditService } from './immutableAudit.service';
import type { Office, RoutingRule, ClientCase } from '@shared/schema';

const logger = createLogger('OfficeRouting');

export interface RoutingDecision {
  officeId: string;
  officeName: string;
  routingMethod: 'automatic' | 'manual_override' | 'fallback';
  routingReason: string;
  confidence: number; // 0.0 - 1.0
  alternativeOffices?: Array<{
    officeId: string;
    officeName: string;
    score: number;
    reason: string;
  }>;
  metadata?: Record<string, any>;
}

export interface RoutingCriteria {
  stateTenantId: string;
  benefitProgramCode?: string;
  applicantZipCode?: string;
  applicantCounty?: string;
  caseComplexity?: 'low' | 'medium' | 'high';
  languagePreference?: string;
  specialNeeds?: string[];
  userId?: string; // For manual routing by specific user
}

class OfficeRoutingService {
  /**
   * Route a case to an office using intelligent routing logic
   */
  async routeCase(criteria: RoutingCriteria, clientCaseId?: string): Promise<RoutingDecision> {
    logger.info('🎯 Routing case to office', {
      service: 'OfficeRouting',
      action: 'routeCase',
      stateTenantId: criteria.stateTenantId,
      benefitProgram: criteria.benefitProgramCode,
      zipCode: criteria.applicantZipCode,
      county: criteria.applicantCounty,
    });

    try {
      // Get active routing rules for this state (ordered by priority)
      const routingRules = await storage.getActiveRoutingRules(
        criteria.stateTenantId,
        criteria.benefitProgramCode
      );

      // Get all active offices for this state
      const offices = await storage.getOffices({
        stateTenantId: criteria.stateTenantId,
        isActive: true,
      });

      if (offices.length === 0) {
        throw new Error('No active offices found for state tenant');
      }

      // Apply routing rules in priority order
      let decision: RoutingDecision | null = null;

      for (const rule of routingRules) {
        decision = await this.applyRoutingRule(rule, criteria, offices);
        if (decision) {
          // Rule matched - use this routing decision
          break;
        }
      }

      // Fallback: If no rules matched, use geographic routing
      if (!decision) {
        logger.warn('No routing rules matched, attempting geographic fallback', {
          stateTenantId: criteria.stateTenantId,
        });
        try {
          decision = await this.geographicRouting(criteria, offices);
        } catch (routingError) {
          // Geographic fallback failed - audit failure and rethrow
          await immutableAuditService.log({
            action: 'ROUTING_FAILED',
            resource: 'office_routing',
            resourceId: clientCaseId || 'new_case',
            userId: criteria.userId || 'system',
            success: false,
            errorMessage: routingError instanceof Error ? routingError.message : 'Unknown error',
            metadata: {
              stateTenantId: criteria.stateTenantId,
              benefitProgramCode: criteria.benefitProgramCode,
              county: criteria.applicantCounty,
              zipCode: criteria.applicantZipCode,
              availableOffices: offices.length,
              routingRulesCount: routingRules.length,
            },
          });
          
          throw routingError;
        }
      }

      // Audit the routing decision
      await this.auditRoutingDecision(decision, criteria, clientCaseId);

      return decision;
    } catch (error) {
      logger.error('Case routing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        criteria,
      });
      throw error;
    }
  }

  /**
   * Apply a routing rule to determine office assignment
   */
  private async applyRoutingRule(
    rule: RoutingRule,
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision | null> {
    switch (rule.ruleType) {
      case 'hub_routing':
        return this.hubRouting(rule, criteria, offices);
      
      case 'geographic':
        return this.geographicRuleRouting(rule, criteria, offices);
      
      case 'workload_balanced':
        return this.workloadBalancedRouting(rule, criteria, offices);
      
      case 'specialty_match':
        return this.specialtyMatchRouting(rule, criteria, offices);
      
      case 'language_match':
        return this.languageMatchRouting(rule, criteria, offices);
      
      default:
        logger.warn('Unknown routing rule type', {
          ruleType: rule.ruleType,
          ruleId: rule.id,
        });
        return null;
    }
  }

  /**
   * Hub-and-spoke routing: Route to designated hub offices
   */
  private async hubRouting(
    rule: RoutingRule,
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision | null> {
    // Filter to hub offices only
    const hubOffices = offices.filter(office => office.isHub);

    if (hubOffices.length === 0) {
      logger.warn('No hub offices found for hub routing rule', {
        ruleId: rule.id,
      });
      return null;
    }

    // If rule has target office(s), prefer those
    const targetOffices = rule.targetOfficeIds && rule.targetOfficeIds.length > 0
      ? hubOffices.filter(office => rule.targetOfficeIds!.includes(office.id))
      : hubOffices;

    if (targetOffices.length === 0) {
      logger.warn('Target hub offices not found', {
        ruleId: rule.id,
        targetOfficeIds: rule.targetOfficeIds,
      });
      return null;
    }

    // Select hub with lowest workload
    const selectedHub = await this.selectLowestWorkloadOffice(targetOffices);

    return {
      officeId: selectedHub.id,
      officeName: selectedHub.officeName,
      routingMethod: 'automatic',
      routingReason: `Hub-and-spoke routing via rule "${rule.ruleName}" - Centralized processing`,
      confidence: 0.9,
      metadata: {
        ruleId: rule.id,
        ruleType: 'hub_routing',
        isHub: true,
      },
    };
  }

  /**
   * Geographic routing based on applicant location
   */
  private async geographicRuleRouting(
    rule: RoutingRule,
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision | null> {
    const { applicantZipCode, applicantCounty } = criteria;

    if (!applicantZipCode && !applicantCounty) {
      logger.debug('No geographic criteria provided for geographic routing', {
        ruleId: rule.id,
      });
      return null;
    }

    // Check rule conditions for geographic match
    const conditions = rule.conditions as any;
    
    if (applicantCounty && conditions?.counties?.includes(applicantCounty)) {
      // County match - find offices serving this county
      const matchingOffices = offices.filter(office => 
        office.serviceCounties?.includes(applicantCounty)
      );

      if (matchingOffices.length > 0) {
        const selectedOffice = await this.selectLowestWorkloadOffice(matchingOffices);
        
        return {
          officeId: selectedOffice.id,
          officeName: selectedOffice.officeName,
          routingMethod: 'automatic',
          routingReason: `Geographic routing to county service area: ${applicantCounty}`,
          confidence: 0.95,
          alternativeOffices: matchingOffices
            .filter(o => o.id !== selectedOffice.id)
            .slice(0, 3)
            .map(o => ({
              officeId: o.id,
              officeName: o.officeName,
              score: 0.85,
              reason: `Alternative office serving ${applicantCounty}`,
            })),
          metadata: {
            ruleId: rule.id,
            ruleType: 'geographic',
            county: applicantCounty,
          },
        };
      }
    }

    if (applicantZipCode && conditions?.zipCodes?.includes(applicantZipCode)) {
      // ZIP code match
      const matchingOffices = offices.filter(office => 
        office.serviceZipCodes?.includes(applicantZipCode)
      );

      if (matchingOffices.length > 0) {
        const selectedOffice = await this.selectLowestWorkloadOffice(matchingOffices);
        
        return {
          officeId: selectedOffice.id,
          officeName: selectedOffice.officeName,
          routingMethod: 'automatic',
          routingReason: `Geographic routing to ZIP service area: ${applicantZipCode}`,
          confidence: 0.9,
          metadata: {
            ruleId: rule.id,
            ruleType: 'geographic',
            zipCode: applicantZipCode,
          },
        };
      }
    }

    return null;
  }

  /**
   * Workload-balanced routing across offices
   */
  private async workloadBalancedRouting(
    rule: RoutingRule,
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision | null> {
    // Filter to target offices if specified
    const targetOffices = rule.targetOfficeIds && rule.targetOfficeIds.length > 0
      ? offices.filter(office => rule.targetOfficeIds!.includes(office.id))
      : offices;

    if (targetOffices.length === 0) {
      return null;
    }

    const selectedOffice = await this.selectLowestWorkloadOffice(targetOffices);

    return {
      officeId: selectedOffice.id,
      officeName: selectedOffice.officeName,
      routingMethod: 'automatic',
      routingReason: 'Workload-balanced routing to office with lowest active caseload',
      confidence: 0.85,
      metadata: {
        ruleId: rule.id,
        ruleType: 'workload_balanced',
      },
    };
  }

  /**
   * Specialty-based routing for program-specific expertise
   */
  private async specialtyMatchRouting(
    rule: RoutingRule,
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision | null> {
    if (!criteria.benefitProgramCode) {
      return null;
    }

    // Filter offices with specialty in this program
    const specialtyOffices = offices.filter(office => 
      office.specialties?.includes(criteria.benefitProgramCode!)
    );

    if (specialtyOffices.length === 0) {
      logger.debug('No specialty offices found for program', {
        programCode: criteria.benefitProgramCode,
      });
      return null;
    }

    const selectedOffice = await this.selectLowestWorkloadOffice(specialtyOffices);

    return {
      officeId: selectedOffice.id,
      officeName: selectedOffice.officeName,
      routingMethod: 'automatic',
      routingReason: `Specialty routing to ${criteria.benefitProgramCode} expert office`,
      confidence: 0.88,
      metadata: {
        ruleId: rule.id,
        ruleType: 'specialty_match',
        programCode: criteria.benefitProgramCode,
      },
    };
  }

  /**
   * Language preference matching
   */
  private async languageMatchRouting(
    rule: RoutingRule,
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision | null> {
    if (!criteria.languagePreference || criteria.languagePreference === 'en') {
      return null; // No special routing needed for English
    }

    // Filter offices supporting this language
    const languageOffices = offices.filter(office => 
      office.supportedLanguages?.includes(criteria.languagePreference!)
    );

    if (languageOffices.length === 0) {
      logger.warn('No offices support requested language', {
        language: criteria.languagePreference,
      });
      return null;
    }

    const selectedOffice = await this.selectLowestWorkloadOffice(languageOffices);

    return {
      officeId: selectedOffice.id,
      officeName: selectedOffice.officeName,
      routingMethod: 'automatic',
      routingReason: `Language-matched routing for ${criteria.languagePreference} support`,
      confidence: 0.92,
      metadata: {
        ruleId: rule.id,
        ruleType: 'language_match',
        language: criteria.languagePreference,
      },
    };
  }

  /**
   * Fallback: Pure geographic routing without rules
   * 
   * CRITICAL FIX (Architect-reviewed):
   * - Returns explicit error when no valid office exists
   * - Prevents invalid routing with false success audits
   * - Ensures compliance audit trail integrity
   */
  private async geographicRouting(
    criteria: RoutingCriteria,
    offices: Office[]
  ): Promise<RoutingDecision> {
    const { applicantCounty, applicantZipCode } = criteria;

    // Try county match first
    if (applicantCounty) {
      const countyOffices = offices.filter(office => 
        office.serviceCounties?.includes(applicantCounty)
      );

      if (countyOffices.length > 0) {
        const selectedOffice = await this.selectLowestWorkloadOffice(countyOffices);
        
        return {
          officeId: selectedOffice.id,
          officeName: selectedOffice.officeName,
          routingMethod: 'fallback',
          routingReason: `Fallback geographic routing to county: ${applicantCounty}`,
          confidence: 0.75,
        };
      }
    }

    // Try ZIP code match
    if (applicantZipCode) {
      const zipOffices = offices.filter(office => 
        office.serviceZipCodes?.includes(applicantZipCode)
      );

      if (zipOffices.length > 0) {
        const selectedOffice = await this.selectLowestWorkloadOffice(zipOffices);
        
        return {
          officeId: selectedOffice.id,
          officeName: selectedOffice.officeName,
          routingMethod: 'fallback',
          routingReason: `Fallback geographic routing to ZIP: ${applicantZipCode}`,
          confidence: 0.7,
        };
      }
    }

    // CRITICAL: NO default fallback to arbitrary office
    // If no office matches criteria, throw explicit error
    // This prevents invalid routing and ensures compliance audit integrity
    logger.error('Routing failed - no office matches criteria', {
      criteria,
      availableOffices: offices.length,
      county: applicantCounty,
      zipCode: applicantZipCode,
    });

    throw new Error(
      `No office available for routing: county=${applicantCounty}, zip=${applicantZipCode}. ` +
      `State tenant has ${offices.length} active offices but none match criteria. ` +
      `Admin must configure routing rules or office service areas.`
    );
  }

  /**
   * Select office with lowest active caseload
   */
  private async selectLowestWorkloadOffice(offices: Office[]): Promise<Office> {
    if (offices.length === 1) {
      return offices[0];
    }

    // Get active case counts for each office
    // TODO: Implement actual workload calculation from database
    // For now, use simple round-robin or random selection
    const workloadScores = await Promise.all(
      offices.map(async (office) => {
        // Placeholder: In production, query active cases per office
        const activeCases = Math.floor(Math.random() * 100); // Mock workload
        
        return {
          office,
          activeCases,
          score: 1 / (activeCases + 1), // Lower cases = higher score
        };
      })
    );

    // Sort by score (highest first = lowest workload)
    workloadScores.sort((a, b) => b.score - a.score);

    const selected = workloadScores[0].office;
    
    logger.debug('Selected office with lowest workload', {
      officeId: selected.id,
      officeName: selected.officeName,
      activeCases: workloadScores[0].activeCases,
    });

    return selected;
  }

  /**
   * Manual routing override with audit trail
   */
  async manualRouteOverride(
    clientCaseId: string,
    targetOfficeId: string,
    overriddenBy: string,
    reason: string
  ): Promise<RoutingDecision> {
    logger.warn('🔄 Manual routing override', {
      service: 'OfficeRouting',
      action: 'manualRouteOverride',
      clientCaseId,
      targetOfficeId,
      overriddenBy,
      reason,
    });

    const office = await storage.getOffice(targetOfficeId);
    
    if (!office) {
      throw new Error(`Office not found: ${targetOfficeId}`);
    }

    const decision: RoutingDecision = {
      officeId: office.id,
      officeName: office.officeName,
      routingMethod: 'manual_override',
      routingReason: `Manual override by ${overriddenBy}: ${reason}`,
      confidence: 1.0,
      metadata: {
        overriddenBy,
        overrideReason: reason,
        overrideTimestamp: new Date().toISOString(),
      },
    };

    // Audit the manual override
    await immutableAuditService.log({
      action: 'MANUAL_ROUTE_OVERRIDE',
      resource: 'client_cases',
      resourceId: clientCaseId,
      userId: overriddenBy,
      metadata: {
        targetOfficeId,
        officeName: office.officeName,
        reason,
      },
    });

    return decision;
  }

  /**
   * Audit routing decision
   */
  private async auditRoutingDecision(
    decision: RoutingDecision,
    criteria: RoutingCriteria,
    clientCaseId?: string
  ): Promise<void> {
    await immutableAuditService.log({
      action: decision.routingMethod === 'automatic' ? 'AUTO_ROUTE' : 'MANUAL_ROUTE_OVERRIDE',
      resource: 'office_routing',
      resourceId: clientCaseId || 'new_case',
      userId: criteria.userId || 'system',
      metadata: {
        officeId: decision.officeId,
        officeName: decision.officeName,
        routingReason: decision.routingReason,
        confidence: decision.confidence,
        stateTenantId: criteria.stateTenantId,
        benefitProgramCode: criteria.benefitProgramCode,
        county: criteria.applicantCounty,
        zipCode: criteria.applicantZipCode,
      },
    });
  }

  /**
   * Get routing statistics for monitoring
   */
  async getRoutingStatistics(
    stateTenantId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalRouted: number;
    automaticRouting: number;
    manualOverrides: number;
    fallbackRouting: number;
    officeDistribution: Record<string, number>;
    averageConfidence: number;
  }> {
    // TODO: Implement actual statistics from audit logs
    // This is a placeholder structure
    
    return {
      totalRouted: 0,
      automaticRouting: 0,
      manualOverrides: 0,
      fallbackRouting: 0,
      officeDistribution: {},
      averageConfidence: 0,
    };
  }

  /**
   * Validate routing rules for a state
   */
  async validateRoutingRules(stateTenantId: string): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    const rules = await storage.getActiveRoutingRules(stateTenantId);
    const offices = await storage.getOffices({ stateTenantId, isActive: true });

    if (rules.length === 0) {
      warnings.push('No routing rules defined - all routing will use fallback logic');
    }

    if (offices.length === 0) {
      issues.push('No active offices found for state tenant');
    }

    // Check for hub offices if hub routing is used
    const hubRules = rules.filter(r => r.ruleType === 'hub_routing');
    if (hubRules.length > 0) {
      const hubOffices = offices.filter(o => o.isHub);
      if (hubOffices.length === 0) {
        issues.push('Hub routing rules exist but no hub offices are designated');
      }
    }

    // Check for overlapping priorities
    const priorities = rules.map(r => r.priority);
    const duplicatePriorities = priorities.filter(
      (p, idx) => priorities.indexOf(p) !== idx
    );
    if (duplicatePriorities.length > 0) {
      warnings.push(
        `Duplicate rule priorities found: ${[...new Set(duplicatePriorities)].join(', ')}`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }
}

// Export singleton instance
export const officeRoutingService = new OfficeRoutingService();
export type { RoutingDecision, RoutingCriteria };
