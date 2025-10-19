/**
 * Multi-State Rules Engine
 * 
 * AI-powered service for handling cross-jurisdiction benefit rules and interstate
 * eligibility coordination. Uses Gemini to interpret varying state regulations
 * and identify portability/reciprocity opportunities.
 * 
 * Key Features:
 * - Interstate eligibility mapping: Compare rules across states
 * - Portability analysis: Which benefits transfer when moving
 * - Border county optimization: Leverage benefits from neighboring states  
 * - Reciprocity detection: Find states with benefit agreements
 * - Migration planning: Optimize timing for interstate moves
 * 
 * Critical scenarios:
 * - Military families moving between states
 * - College students with multi-state presence
 * - Border workers (live MD, work DC/PA/VA/WV/DE)
 * - Seasonal workers with multiple state residences
 * - Recent interstate movers maintaining continuity
 */

import { GoogleGenAI } from '@google/genai';
import { nanoid } from 'nanoid';
import type { IStorage } from '../storage';
import { db } from '../db';
import { clientCases, eligibilityCalculations } from '@shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { cacheService } from './cacheService';

export interface StateRule {
  state: string;
  program: string;
  rule: string;
  category: 'eligibility' | 'income' | 'assets' | 'residency' | 'work' | 'other';
  value?: any;
  effectiveDate: Date;
  expirationDate?: Date;
  source: string;
}

export interface StateComparison {
  program: string;
  baseState: string;
  comparisonState: string;
  
  // Rule differences
  differences: RuleDifference[];
  
  // Eligibility impact
  moreGenerous: string; // Which state has better benefits
  eligibleInBase: boolean;
  eligibleInComparison: boolean;
  
  // Benefit amounts
  benefitInBase: number;
  benefitInComparison: number;
  benefitDifference: number;
  
  // Special considerations
  reciprocityAvailable: boolean;
  portabilityRules?: string;
  waitingPeriod?: number; // Days before eligible in new state
}

export interface RuleDifference {
  category: string;
  baseStateRule: string;
  comparisonStateRule: string;
  impact: 'major' | 'minor' | 'none';
  explanation: string;
}

export interface PortabilityAnalysis {
  fromState: string;
  toState: string;
  moveDate?: Date;
  
  // Benefits that transfer
  portableBenefits: PortableBenefit[];
  
  // Benefits that don't transfer
  nonPortableBenefits: string[];
  
  // New benefits available
  newOpportunities: string[];
  
  // Timing optimization
  optimalMoveWindow?: {
    start: Date;
    end: Date;
    reason: string;
  };
  
  // Action items
  preMoveChecklist: string[];
  postMoveChecklist: string[];
  
  // Financial impact
  monthlyImpact: number; // Change in total benefits
}

export interface PortableBenefit {
  program: string;
  transferType: 'automatic' | 'application_required' | 'time_limited';
  continuityPeriod?: number; // Days benefits continue
  requirements: string[];
  notes?: string;
}

export interface BorderCountyAdvantage {
  county: string;
  state: string;
  neighboringStates: string[];
  
  // Cross-border opportunities
  opportunities: CrossBorderOpportunity[];
  
  // Commuter benefits
  workStateAdvantages?: string[];
  
  // Regional programs
  regionalPrograms: string[];
  
  // Best strategy
  recommendedApproach: string;
}

export interface CrossBorderOpportunity {
  type: 'employment' | 'education' | 'healthcare' | 'shopping' | 'services';
  description: string;
  eligibilityPath: string;
  estimatedValue: number;
  requirements: string[];
}

export class MultiStateRulesService {
  private gemini: GoogleGenAI | null = null;
  private model: any;
  private storage: IStorage;
  
  // Neighboring states for Maryland
  private readonly MD_NEIGHBORS = ['DC', 'PA', 'VA', 'WV', 'DE'];
  
  // States with reciprocity agreements
  private readonly RECIPROCITY_STATES: Record<string, string[]> = {
    'SNAP': [], // SNAP doesn't transfer
    'Medicaid': ['DC', 'VA'], // Emergency coverage agreements
    'WIC': ['DC', 'PA', 'VA', 'WV', 'DE'], // Federal program, portable
    'TANF': [], // State-specific
    'UI': ['DC', 'PA', 'VA', 'WV', 'DE'] // Unemployment insurance reciprocity
  };

  constructor(storage: IStorage) {
    this.storage = storage;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ Multi-State Rules: No Gemini API key found. Using fallback mode.');
    } else {
      this.gemini = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Compare rules between two states
   */
  async compareStates(
    program: string,
    state1: string,
    state2: string,
    householdProfile?: any
  ): Promise<StateComparison> {
    const cacheKey = `compare:${program}:${state1}:${state2}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as StateComparison;

    // Get rules for both states
    const rules1 = await this.getStateRules(state1, program);
    const rules2 = await this.getStateRules(state2, program);
    
    // Find differences
    const differences = await this.analyzeRuleDifferences(rules1, rules2, program);
    
    // Determine which is more generous
    const generosityAnalysis = await this.analyzeGenerosity(state1, state2, program, householdProfile);
    
    const comparison: StateComparison = {
      program,
      baseState: state1,
      comparisonState: state2,
      differences,
      moreGenerous: generosityAnalysis.moreGenerous,
      eligibleInBase: generosityAnalysis.eligibleIn1,
      eligibleInComparison: generosityAnalysis.eligibleIn2,
      benefitInBase: generosityAnalysis.benefit1,
      benefitInComparison: generosityAnalysis.benefit2,
      benefitDifference: generosityAnalysis.benefit2 - generosityAnalysis.benefit1,
      reciprocityAvailable: this.hasReciprocity(program, state1, state2),
      portabilityRules: this.getPortabilityRules(program),
      waitingPeriod: this.getWaitingPeriod(program, state2)
    };
    
    // Cache for 7 days
    await cacheService.set(cacheKey, comparison, 604800);
    
    return comparison;
  }

  /**
   * Analyze portability when moving between states
   */
  async analyzePortability(
    fromState: string,
    toState: string,
    currentBenefits: string[],
    moveDate?: Date
  ): Promise<PortabilityAnalysis> {
    const portableBenefits: PortableBenefit[] = [];
    const nonPortableBenefits: string[] = [];
    const newOpportunities: string[] = [];
    
    // Check each current benefit
    for (const benefit of currentBenefits) {
      const portability = await this.checkPortability(benefit, fromState, toState);
      
      if (portability.portable) {
        portableBenefits.push(portability);
      } else {
        nonPortableBenefits.push(benefit);
      }
    }
    
    // Find new opportunities in destination state
    const opportunities = await this.findNewOpportunities(toState, currentBenefits);
    newOpportunities.push(...opportunities);
    
    // Calculate optimal move timing
    const optimalWindow = this.calculateOptimalMoveWindow(
      fromState,
      toState,
      currentBenefits,
      moveDate
    );
    
    // Generate checklists
    const preMoveChecklist = this.generatePreMoveChecklist(
      fromState,
      toState,
      currentBenefits
    );
    
    const postMoveChecklist = this.generatePostMoveChecklist(
      toState,
      portableBenefits,
      newOpportunities
    );
    
    // Calculate financial impact
    const currentValue = currentBenefits.length * 200; // Simplified estimate
    const newValue = (portableBenefits.length + newOpportunities.length) * 180;
    const monthlyImpact = newValue - currentValue;
    
    return {
      fromState,
      toState,
      moveDate,
      portableBenefits,
      nonPortableBenefits,
      newOpportunities,
      optimalMoveWindow: optimalWindow,
      preMoveChecklist,
      postMoveChecklist,
      monthlyImpact
    };
  }

  /**
   * Find advantages for border county residents
   */
  async analyzeBorderCountyAdvantages(
    county: string,
    state: string = 'MD'
  ): Promise<BorderCountyAdvantage> {
    const cacheKey = `border:${county}:${state}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as BorderCountyAdvantage;

    // Determine neighboring states based on county
    const neighbors = this.getNeighboringStates(county, state);
    
    // Find cross-border opportunities
    const opportunities = await this.findCrossBorderOpportunities(
      county,
      state,
      neighbors
    );
    
    // Find regional programs
    const regionalPrograms = this.getRegionalPrograms(county, state);
    
    // Determine best strategy
    const strategy = await this.recommendBorderStrategy(
      county,
      opportunities,
      regionalPrograms
    );
    
    const analysis: BorderCountyAdvantage = {
      county,
      state,
      neighboringStates: neighbors,
      opportunities,
      regionalPrograms,
      recommendedApproach: strategy
    };
    
    // Cache for 30 days
    await cacheService.set(cacheKey, analysis, 2592000);
    
    return analysis;
  }

  /**
   * Get state-specific rules using AI
   */
  private async getStateRules(state: string, program: string): Promise<StateRule[]> {
    if (!this.gemini) {
      return this.getFallbackRules(state, program);
    }

    const prompt = `
      List the key eligibility rules for ${program} in ${state} state.
      
      Include:
      1. Income limits (% of Federal Poverty Level or dollar amounts)
      2. Asset limits if applicable
      3. Residency requirements
      4. Work requirements
      5. Household composition rules
      6. Any special state-specific provisions
      
      For each rule, specify:
      - The specific requirement
      - The category (eligibility/income/assets/residency/work/other)
      - The value or threshold if applicable
      - Any exceptions or special cases
      
      Format as JSON array of rules.
      Use 2024 rules and thresholds.
    `;

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const text = response.text;
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rules = JSON.parse(jsonMatch[0]);
        return rules.map((r: any) => ({
          state,
          program,
          rule: r.rule || r.description,
          category: r.category || 'other',
          value: r.value,
          effectiveDate: new Date(),
          source: 'AI-generated'
        }));
      }
    } catch (error) {
      console.error('Error getting state rules with AI:', error);
    }

    return this.getFallbackRules(state, program);
  }

  /**
   * Analyze differences between state rules
   */
  private async analyzeRuleDifferences(
    rules1: StateRule[],
    rules2: StateRule[],
    program: string
  ): Promise<RuleDifference[]> {
    const differences: RuleDifference[] = [];
    
    // Compare by category
    const categories = ['eligibility', 'income', 'assets', 'residency', 'work'];
    
    for (const category of categories) {
      const cat1Rules = rules1.filter(r => r.category === category);
      const cat2Rules = rules2.filter(r => r.category === category);
      
      if (cat1Rules.length === 0 && cat2Rules.length === 0) continue;
      
      const rule1 = cat1Rules[0]?.rule || 'No specific requirement';
      const rule2 = cat2Rules[0]?.rule || 'No specific requirement';
      
      if (rule1 !== rule2) {
        differences.push({
          category,
          baseStateRule: rule1,
          comparisonStateRule: rule2,
          impact: this.assessImpact(category, rule1, rule2),
          explanation: this.explainDifference(category, rule1, rule2)
        });
      }
    }
    
    return differences;
  }

  /**
   * Analyze which state is more generous
   */
  private async analyzeGenerosity(
    state1: string,
    state2: string,
    program: string,
    householdProfile?: any
  ): Promise<any> {
    // Simplified generosity analysis
    const scores: Record<string, Record<string, number>> = {
      'SNAP': { 'MD': 85, 'DC': 90, 'VA': 80, 'PA': 82, 'WV': 78, 'DE': 81 },
      'Medicaid': { 'MD': 88, 'DC': 92, 'VA': 75, 'PA': 85, 'WV': 83, 'DE': 86 },
      'TANF': { 'MD': 70, 'DC': 85, 'VA': 65, 'PA': 72, 'WV': 68, 'DE': 71 },
      'WIC': { 'MD': 90, 'DC': 90, 'VA': 90, 'PA': 90, 'WV': 90, 'DE': 90 }
    };
    
    const score1 = scores[program]?.[state1] || 75;
    const score2 = scores[program]?.[state2] || 75;
    
    return {
      moreGenerous: score2 > score1 ? state2 : state1,
      eligibleIn1: score1 > 70,
      eligibleIn2: score2 > 70,
      benefit1: Math.floor(score1 * 10), // Simplified benefit calculation
      benefit2: Math.floor(score2 * 10)
    };
  }

  /**
   * Check if benefit is portable between states
   */
  private async checkPortability(
    benefit: string,
    fromState: string,
    toState: string
  ): Promise<PortableBenefit> {
    // Federal programs are generally portable
    const federalPrograms = ['WIC', 'SSI', 'SSDI', 'Medicare'];
    
    if (federalPrograms.includes(benefit)) {
      return {
        program: benefit,
        transferType: 'automatic',
        continuityPeriod: undefined,
        requirements: ['Update address with program office'],
        notes: 'Federal program - benefits continue nationwide'
      };
    }
    
    // State-specific programs
    if (benefit === 'SNAP') {
      return {
        program: benefit,
        transferType: 'application_required',
        continuityPeriod: 0,
        requirements: [
          'Close case in ' + fromState,
          'Apply in ' + toState + ' within 30 days',
          'Provide new address proof'
        ],
        notes: 'Must reapply in new state'
      };
    }
    
    if (benefit === 'Medicaid') {
      return {
        program: benefit,
        transferType: 'time_limited',
        continuityPeriod: 90,
        requirements: [
          'Notify current state of move',
          'Apply in new state immediately',
          'May have emergency coverage during transition'
        ],
        notes: 'Coverage may continue for 90 days'
      };
    }
    
    // Default non-portable
    return {
      program: benefit,
      transferType: 'application_required',
      continuityPeriod: 0,
      requirements: ['Reapply in new state'],
      notes: 'State-specific program'
    };
  }

  /**
   * Find new benefit opportunities in destination state
   */
  private async findNewOpportunities(
    state: string,
    currentBenefits: string[]
  ): Promise<string[]> {
    const allPrograms = ['SNAP', 'Medicaid', 'TANF', 'WIC', 'LIHEAP', 'Childcare'];
    const opportunities = [];
    
    for (const program of allPrograms) {
      if (!currentBenefits.includes(program)) {
        // Check if state has good coverage for this program
        const hasGoodCoverage = await this.checkStateCoverage(state, program);
        if (hasGoodCoverage) {
          opportunities.push(program);
        }
      }
    }
    
    return opportunities;
  }

  /**
   * Check if state has good coverage for a program
   */
  private async checkStateCoverage(state: string, program: string): Promise<boolean> {
    // Simplified - in production would use actual data
    const coverage: Record<string, string[]> = {
      'MD': ['SNAP', 'Medicaid', 'WIC', 'LIHEAP'],
      'DC': ['SNAP', 'Medicaid', 'TANF', 'WIC', 'Childcare'],
      'VA': ['SNAP', 'Medicaid', 'WIC'],
      'PA': ['SNAP', 'Medicaid', 'WIC', 'LIHEAP'],
      'WV': ['SNAP', 'Medicaid', 'WIC'],
      'DE': ['SNAP', 'Medicaid', 'WIC', 'TANF']
    };
    
    return coverage[state]?.includes(program) || false;
  }

  /**
   * Calculate optimal move window
   */
  private calculateOptimalMoveWindow(
    fromState: string,
    toState: string,
    benefits: string[],
    plannedDate?: Date
  ): { start: Date; end: Date; reason: string } | undefined {
    // Avoid moving at end of month (benefit issuance)
    // Avoid moving during renewal periods
    // Best time: mid-month, after benefit issuance
    
    const today = new Date();
    const optimal = new Date(today);
    optimal.setDate(15); // Mid-month
    
    if (optimal < today) {
      optimal.setMonth(optimal.getMonth() + 1);
    }
    
    return {
      start: optimal,
      end: new Date(optimal.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 day window
      reason: 'Mid-month move avoids benefit disruption'
    };
  }

  /**
   * Generate pre-move checklist
   */
  private generatePreMoveChecklist(
    fromState: string,
    toState: string,
    benefits: string[]
  ): string[] {
    const checklist = [
      `Notify all benefit programs of upcoming move`,
      `Request case closure letters from ${fromState} programs`,
      `Gather last 3 months of benefit statements`,
      `Download all case documents from online portals`,
      `Get contact info for ${fromState} caseworkers`,
      `Research ${toState} application requirements`,
      `Find ${toState} local office locations`,
      `Check ${toState} documentation requirements`
    ];
    
    if (benefits.includes('SNAP')) {
      checklist.push('Use remaining SNAP benefits before move');
    }
    
    if (benefits.includes('Medicaid')) {
      checklist.push('Get copy of medical records');
      checklist.push('Fill prescriptions before move');
    }
    
    return checklist;
  }

  /**
   * Generate post-move checklist
   */
  private generatePostMoveChecklist(
    toState: string,
    portableBenefits: PortableBenefit[],
    newOpportunities: string[]
  ): string[] {
    const checklist = [
      `Update address with USPS`,
      `Get ${toState} driver's license/ID within 30 days`,
      `Register to vote in ${toState}`,
      `Find new healthcare providers`
    ];
    
    for (const benefit of portableBenefits) {
      if (benefit.transferType === 'application_required') {
        checklist.push(`Apply for ${benefit.program} in ${toState}`);
      } else {
        checklist.push(`Update address for ${benefit.program}`);
      }
    }
    
    for (const opportunity of newOpportunities) {
      checklist.push(`Explore eligibility for ${opportunity}`);
    }
    
    return checklist;
  }

  /**
   * Get neighboring states for a county
   */
  private getNeighboringStates(county: string, state: string): string[] {
    if (state !== 'MD') return [];
    
    const borderCounties: Record<string, string[]> = {
      'Garrett': ['PA', 'WV'],
      'Allegany': ['PA', 'WV'],
      'Washington': ['PA', 'WV', 'VA'],
      'Frederick': ['VA', 'WV', 'PA'],
      'Carroll': ['PA'],
      'Baltimore': ['PA'],
      'Harford': ['PA'],
      'Cecil': ['PA', 'DE'],
      'Montgomery': ['DC', 'VA'],
      'Prince George\'s': ['DC', 'VA'],
      'Charles': ['VA'],
      'Calvert': ['VA'],
      'St. Mary\'s': ['VA'],
      'Worcester': ['DE', 'VA'],
      'Somerset': ['VA'],
      'Wicomico': ['DE'],
      'Dorchester': ['DE'],
      'Caroline': ['DE'],
      'Kent': ['DE']
    };
    
    return borderCounties[county] || [];
  }

  /**
   * Find cross-border opportunities
   */
  private async findCrossBorderOpportunities(
    county: string,
    state: string,
    neighbors: string[]
  ): Promise<CrossBorderOpportunity[]> {
    const opportunities: CrossBorderOpportunity[] = [];
    
    // Work opportunities
    if (neighbors.includes('DC')) {
      opportunities.push({
        type: 'employment',
        description: 'Federal employment with higher pay scales',
        eligibilityPath: 'DC employment may qualify for DC benefits',
        estimatedValue: 500,
        requirements: ['Work in DC', 'Commute from MD']
      });
    }
    
    // Healthcare
    if (neighbors.includes('VA')) {
      opportunities.push({
        type: 'healthcare',
        description: 'Access to VA medical facilities if veteran',
        eligibilityPath: 'Veteran status allows cross-border VA care',
        estimatedValue: 1000,
        requirements: ['Veteran status', 'VA enrollment']
      });
    }
    
    // Tax-free shopping
    if (neighbors.includes('DE')) {
      opportunities.push({
        type: 'shopping',
        description: 'Tax-free shopping in Delaware',
        eligibilityPath: 'No sales tax on purchases',
        estimatedValue: 50,
        requirements: ['Travel to DE']
      });
    }
    
    return opportunities;
  }

  /**
   * Get regional programs available
   */
  private getRegionalPrograms(county: string, state: string): string[] {
    const programs = [];
    
    // DC Metro region
    if (['Montgomery', 'Prince George\'s', 'Frederick'].includes(county)) {
      programs.push('WMATA transit benefits');
      programs.push('COG regional programs');
    }
    
    // Chesapeake Bay region
    if (['Anne Arundel', 'Calvert', 'St. Mary\'s'].includes(county)) {
      programs.push('Bay restoration job training');
      programs.push('Waterman assistance programs');
    }
    
    // Appalachian region
    if (['Garrett', 'Allegany', 'Washington'].includes(county)) {
      programs.push('ARC development programs');
      programs.push('Rural health initiatives');
    }
    
    return programs;
  }

  /**
   * Recommend strategy for border county residents
   */
  private async recommendBorderStrategy(
    county: string,
    opportunities: CrossBorderOpportunity[],
    regionalPrograms: string[]
  ): Promise<string> {
    if (opportunities.length === 0 && regionalPrograms.length === 0) {
      return 'Focus on Maryland state programs - limited cross-border advantages';
    }
    
    const totalValue = opportunities.reduce((sum, o) => sum + o.estimatedValue, 0);
    
    if (totalValue > 1000) {
      return 'Significant cross-border opportunities available - explore work and healthcare options in neighboring states while maintaining MD residency for benefits';
    }
    
    if (regionalPrograms.length > 2) {
      return 'Leverage regional programs for additional support - your county qualifies for special regional initiatives';
    }
    
    return 'Some cross-border advantages available - consider selective use based on your specific needs';
  }

  // Fallback methods
  private getFallbackRules(state: string, program: string): StateRule[] {
    return [
      {
        state,
        program,
        rule: `Standard ${program} eligibility rules for ${state}`,
        category: 'eligibility',
        value: null,
        effectiveDate: new Date(),
        source: 'Fallback'
      }
    ];
  }

  private hasReciprocity(program: string, state1: string, state2: string): boolean {
    return this.RECIPROCITY_STATES[program]?.includes(state2) || false;
  }

  private getPortabilityRules(program: string): string {
    const rules: Record<string, string> = {
      'SNAP': 'Must close in origin state and reapply in destination state',
      'Medicaid': 'May have 90-day continuity, must apply in new state',
      'TANF': 'State-specific, no portability',
      'WIC': 'Federal program, transfer between state agencies',
      'SSI': 'Federal program, update address only'
    };
    return rules[program] || 'Check with program administrators';
  }

  private getWaitingPeriod(program: string, state: string): number {
    // Days before eligible in new state
    const periods: Record<string, number> = {
      'SNAP': 0,
      'Medicaid': 0,
      'TANF': 30,
      'WIC': 0
    };
    return periods[program] || 0;
  }

  private assessImpact(category: string, rule1: string, rule2: string): 'major' | 'minor' | 'none' {
    if (category === 'income' || category === 'eligibility') return 'major';
    if (category === 'work' || category === 'assets') return 'major';
    return 'minor';
  }

  private explainDifference(category: string, rule1: string, rule2: string): string {
    return `The ${category} requirements differ: State 1 requires "${rule1}" while State 2 requires "${rule2}"`;
  }
}

// Export singleton instance
export const multiStateRulesService = new MultiStateRulesService({} as IStorage);