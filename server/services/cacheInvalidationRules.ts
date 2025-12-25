/**
 * Cache Invalidation Rules and Dependency Mappings
 * 
 * Defines relationships between data changes and cache invalidation patterns.
 * Ensures cache consistency across the hierarchical caching strategy.
 */

export type InvalidationTrigger =
  | 'maryland_rule_update'      // Maryland SNAP/TANF/Medicaid rule changes
  | 'tax_year_rollover'          // January 1st tax year change
  | 'policy_change'              // Federal or state policy updates
  | 'dhs_form_update'            // DHS form version changes
  | 'benefit_amount_change'      // Benefit allotment/limit changes
  | 'income_limit_change'        // Income threshold updates
  | 'deduction_rule_change'      // Deduction calculation changes
  | 'document_requirement_change' // Document verification rules
  | 'categorical_eligibility_change' // Categorical eligibility updates
  | 'tax_law_change'             // Federal/state tax law updates
  | 'poverty_level_change'       // Federal poverty level updates
  | 'county_tax_rate_change';    // Maryland county tax rates

export type CacheLayer = 
  | 'embedding'                   // L1: Gemini embeddings
  | 'rag'                        // L1: RAG query results
  | 'document_analysis'          // L1: Document Vision API results
  | 'policy_engine'              // L1: PolicyEngine calculations
  | 'rules_engine'               // L1: Rules engine calculations (cacheService)
  | 'hybrid_calc'                // L1: Hybrid calculations
  | 'benefit_summary'            // L1: Benefit summaries
  | 'manual_sections'            // L1: Policy manual sections
  | 'all';                       // All caches

export interface InvalidationRule {
  trigger: InvalidationTrigger;
  affectedCaches: CacheLayer[];
  programCodes?: string[];        // Specific programs affected (e.g., ['SNAP', 'TANF'])
  reason: string;                 // Human-readable explanation
  severity: 'critical' | 'high' | 'medium' | 'low';
  notifyAdmins?: boolean;         // Whether to send admin notifications
}

export interface CacheDependency {
  source: string;                 // Source data that changed
  dependentCaches: CacheLayer[];  // Caches that must be invalidated
  cascadePattern?: string;        // Optional pattern for partial invalidation
}

/**
 * Invalidation Rules Registry
 * Maps triggers to affected cache layers
 */
export const INVALIDATION_RULES: Record<InvalidationTrigger, InvalidationRule> = {
  maryland_rule_update: {
    trigger: 'maryland_rule_update',
    affectedCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary', 'rag'],
    programCodes: ['SNAP', 'TANF', 'MEDICAID', 'OHEP'],
    reason: 'Maryland rule update requires recalculation of all benefit eligibility and amounts',
    severity: 'critical',
    notifyAdmins: true
  },
  
  tax_year_rollover: {
    trigger: 'tax_year_rollover',
    affectedCaches: ['policy_engine', 'hybrid_calc', 'benefit_summary', 'rules_engine', 'rag'],
    programCodes: ['VITA', 'EITC', 'CTC'],
    reason: 'Tax year rollover on January 1 - all tax calculations must use new year rules',
    severity: 'critical',
    notifyAdmins: true
  },
  
  policy_change: {
    trigger: 'policy_change',
    affectedCaches: ['policy_engine', 'hybrid_calc', 'benefit_summary', 'rag'],
    reason: 'Federal or state policy change affects benefit calculations',
    severity: 'high',
    notifyAdmins: true
  },
  
  dhs_form_update: {
    trigger: 'dhs_form_update',
    affectedCaches: ['document_analysis', 'rag', 'embedding'],
    reason: 'DHS form update requires reprocessing document analysis and embeddings',
    severity: 'medium',
    notifyAdmins: false
  },
  
  benefit_amount_change: {
    trigger: 'benefit_amount_change',
    affectedCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary'],
    reason: 'Benefit allotment or limit change affects eligibility calculations',
    severity: 'high',
    notifyAdmins: true
  },
  
  income_limit_change: {
    trigger: 'income_limit_change',
    affectedCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary'],
    reason: 'Income limit change affects household eligibility determinations',
    severity: 'high',
    notifyAdmins: true
  },
  
  deduction_rule_change: {
    trigger: 'deduction_rule_change',
    affectedCaches: ['rules_engine', 'policy_engine', 'hybrid_calc'],
    reason: 'Deduction calculation rule change affects net income and benefit amounts',
    severity: 'high',
    notifyAdmins: true
  },
  
  document_requirement_change: {
    trigger: 'document_requirement_change',
    affectedCaches: ['rag', 'manual_sections'],
    reason: 'Document verification requirements updated',
    severity: 'medium',
    notifyAdmins: false
  },
  
  categorical_eligibility_change: {
    trigger: 'categorical_eligibility_change',
    affectedCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary'],
    reason: 'Categorical eligibility rule change affects automatic eligibility paths',
    severity: 'high',
    notifyAdmins: true
  },
  
  tax_law_change: {
    trigger: 'tax_law_change',
    affectedCaches: ['policy_engine', 'hybrid_calc', 'benefit_summary', 'rag'],
    programCodes: ['VITA', 'EITC', 'CTC', 'FEDERAL_TAX', 'MD_TAX'],
    reason: 'Tax law change requires recalculation of all tax-related benefits',
    severity: 'critical',
    notifyAdmins: true
  },
  
  poverty_level_change: {
    trigger: 'poverty_level_change',
    affectedCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary'],
    programCodes: ['MEDICAID', 'SNAP', 'TANF'],
    reason: 'Federal Poverty Level update affects income eligibility thresholds',
    severity: 'critical',
    notifyAdmins: true
  },
  
  county_tax_rate_change: {
    trigger: 'county_tax_rate_change',
    affectedCaches: ['policy_engine', 'hybrid_calc', 'benefit_summary'],
    programCodes: ['MD_TAX', 'VITA'],
    reason: 'Maryland county tax rate change affects state tax calculations',
    severity: 'high',
    notifyAdmins: true
  }
};

/**
 * Cache Dependencies Map
 * Defines which caches depend on which data sources
 */
export const CACHE_DEPENDENCIES: CacheDependency[] = [
  {
    source: 'snap_income_limits',
    dependentCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary'],
    cascadePattern: 'rules:SNAP:*'
  },
  {
    source: 'snap_deductions',
    dependentCaches: ['rules_engine', 'policy_engine', 'hybrid_calc'],
    cascadePattern: 'rules:SNAP:*'
  },
  {
    source: 'snap_allotments',
    dependentCaches: ['rules_engine', 'benefit_summary'],
    cascadePattern: 'rules:SNAP:*'
  },
  {
    source: 'categorical_eligibility_rules',
    dependentCaches: ['rules_engine', 'policy_engine', 'hybrid_calc'],
    cascadePattern: 'rules:*'
  },
  {
    source: 'document_requirements',
    dependentCaches: ['rag', 'manual_sections'],
    cascadePattern: 'manual_section:*'
  },
  {
    source: 'policy_sources',
    dependentCaches: ['embedding', 'rag', 'manual_sections'],
    cascadePattern: 'manual_*'
  },
  {
    source: 'dhs_forms',
    dependentCaches: ['document_analysis', 'rag', 'embedding']
  },
  {
    source: 'poverty_levels',
    dependentCaches: ['rules_engine', 'policy_engine', 'hybrid_calc', 'benefit_summary']
  },
  {
    source: 'county_tax_rates',
    dependentCaches: ['policy_engine', 'hybrid_calc', 'benefit_summary'],
    cascadePattern: 'pe:*'
  }
];

/**
 * Tax Year Rollover Affected Programs
 * Programs that require cache clearing on January 1
 */
export const TAX_YEAR_AFFECTED_PROGRAMS = [
  'VITA',
  'FEDERAL_TAX',
  'MD_TAX',
  'EITC',
  'CTC',
  'FEDERAL_W2',
  'MD_502',
  'FORM_1040'
];

/**
 * Get invalidation rule by trigger
 */
export function getInvalidationRule(trigger: InvalidationTrigger): InvalidationRule {
  return INVALIDATION_RULES[trigger];
}

/**
 * Get all cache layers affected by a trigger
 */
export function getAffectedCaches(trigger: InvalidationTrigger): CacheLayer[] {
  return INVALIDATION_RULES[trigger].affectedCaches;
}

/**
 * Get cache dependencies for a data source
 */
export function getCacheDependencies(source: string): CacheDependency | undefined {
  return CACHE_DEPENDENCIES.find(dep => dep.source === source);
}

/**
 * Check if a program is affected by tax year rollover
 */
export function isTaxYearAffected(programCode: string): boolean {
  return TAX_YEAR_AFFECTED_PROGRAMS.includes(programCode);
}

/**
 * Get all critical invalidation rules
 */
export function getCriticalInvalidationRules(): InvalidationRule[] {
  return Object.values(INVALIDATION_RULES).filter(rule => rule.severity === 'critical');
}
