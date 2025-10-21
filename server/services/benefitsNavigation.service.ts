/**
 * Benefits Navigation Engine
 * 
 * AI-powered service for discovering hidden benefit pathways and optimizing
 * multi-program enrollment strategies. Uses Gemini to analyze household situations
 * and identify non-obvious benefit combinations.
 * 
 * Key Features:
 * - Pathway discovery: Find creative benefit combinations
 * - Eligibility chains: Identify cascading eligibilities
 * - Time-based optimization: Sequence applications for maximum coverage
 * - Cross-program synergies: Leverage one benefit to qualify for others
 * 
 * Example pathways:
 * - SNAP → School meals → Summer EBT → WIC
 * - TANF → Medicaid → LIHEAP → Lifeline phone service
 * - SSI → automatic SNAP → automatic Medicaid
 */

import { GoogleGenAI } from '@google/genai';
import { nanoid } from 'nanoid';
import type { IStorage } from '../storage';
import { db } from '../db';
import { clientCases, documents, eligibilityCalculations } from '@shared/schema';
import { eq, and, or, gte, lte, desc, sql } from 'drizzle-orm';
import { cacheService } from './cacheService';
import { logger } from './logger.service';

export interface BenefitPathway {
  id: string;
  name: string;
  description: string;
  steps: PathwayStep[];
  estimatedTotalValue: number; // Annual value across all benefits
  timeToComplete: number; // Days to complete full pathway
  difficulty: 'easy' | 'moderate' | 'complex';
  successRate: number; // Historical success rate 0-100
  aiConfidence: number; // AI's confidence in this pathway
}

export interface PathwayStep {
  order: number;
  program: string;
  action: string;
  requirements: string[];
  estimatedTime: number; // Days
  value: number; // Monthly benefit value
  dependencies?: string[]; // Previous steps that must be completed
  automationAvailable: boolean;
  documentation: string[];
}

export interface NavigationAnalysis {
  currentBenefits: string[];
  discoveredPathways: BenefitPathway[];
  quickWins: BenefitPathway[]; // Easy pathways with high value
  strategicOptions: BenefitPathway[]; // Complex but valuable pathways
  blockers: string[]; // Issues preventing certain pathways
  nextBestAction: string;
  estimatedNewBenefits: number; // Additional monthly value available
}

export interface HouseholdSituation {
  householdSize: number;
  monthlyIncome: number;
  hasChildren: boolean;
  hasElderly: boolean;
  hasDisabled: boolean;
  currentBenefits: string[];
  county: string;
  housingStatus: 'owned' | 'rented' | 'homeless' | 'subsidized';
  employmentStatus: string[];
  barriers?: string[]; // e.g., "no transportation", "limited english"
}

export class BenefitsNavigationService {
  private gemini: GoogleGenAI | null = null;
  private model: any;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      logger.warn('⚠️ Benefits Navigation: No Gemini API key found. Using fallback mode.', {
        service: 'BenefitsNavigation'
      });
    } else {
      this.gemini = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Analyze household situation and discover benefit pathways
   */
  async analyzeHousehold(situation: HouseholdSituation): Promise<NavigationAnalysis> {
    const cacheKey = `nav:${this.generateSituationHash(situation)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached as NavigationAnalysis;

    // Discover pathways using AI
    const pathways = await this.discoverPathways(situation);
    
    // Categorize pathways
    const quickWins = pathways.filter(p => 
      p.difficulty === 'easy' && p.estimatedTotalValue > 1000
    );
    
    const strategicOptions = pathways.filter(p => 
      p.difficulty !== 'easy' && p.estimatedTotalValue > 5000
    );
    
    // Identify blockers
    const blockers = await this.identifyBlockers(situation);
    
    // Calculate potential new benefits
    const estimatedNewBenefits = pathways.reduce((sum, p) => 
      sum + (p.estimatedTotalValue / 12), 0
    );
    
    // Determine next best action
    const nextBestAction = this.determineNextAction(pathways, situation);
    
    const analysis: NavigationAnalysis = {
      currentBenefits: situation.currentBenefits,
      discoveredPathways: pathways,
      quickWins,
      strategicOptions,
      blockers,
      nextBestAction,
      estimatedNewBenefits
    };
    
    // Cache for 1 hour
    await cacheService.set(cacheKey, analysis, 3600);
    
    return analysis;
  }

  /**
   * Discover benefit pathways using AI
   */
  private async discoverPathways(situation: HouseholdSituation): Promise<BenefitPathway[]> {
    if (!this.gemini) {
      return this.getFallbackPathways(situation);
    }

    const prompt = `
      You are a benefits navigation expert. Analyze this household situation and identify 
      creative benefit pathways they may not know about.
      
      Household Situation:
      - Size: ${situation.householdSize} people
      - Monthly Income: $${situation.monthlyIncome}
      - Has Children: ${situation.hasChildren}
      - Has Elderly (65+): ${situation.hasElderly}
      - Has Disabled Member: ${situation.hasDisabled}
      - Current Benefits: ${situation.currentBenefits.join(', ') || 'None'}
      - County: ${situation.county}, Maryland
      - Housing: ${situation.housingStatus}
      - Employment: ${situation.employmentStatus.join(', ')}
      ${situation.barriers ? `- Barriers: ${situation.barriers.join(', ')}` : ''}
      
      Identify benefit pathways including:
      1. Direct eligibilities they qualify for
      2. Chain eligibilities (one benefit leads to another)
      3. Time-based strategies (seasonal programs, temporary assistance)
      4. Creative combinations most people miss
      
      For each pathway, provide:
      - Name and description
      - Step-by-step process
      - Estimated value (monthly/annual)
      - Time to complete
      - Required documentation
      - Success likelihood
      
      Focus on Maryland-specific programs and federal programs available in Maryland.
      Consider categorical eligibility rules where one program auto-qualifies for others.
      
      Format as JSON array of pathways.
    `;

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const text = response.text;
      
      // Parse AI response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rawPathways = JSON.parse(jsonMatch[0]);
        return this.formatPathways(rawPathways);
      }
    } catch (error) {
      logger.error('Error discovering pathways with AI', { 
        error: error instanceof Error ? error.message : String(error),
        service: 'BenefitsNavigation'
      });
    }

    return this.getFallbackPathways(situation);
  }

  /**
   * Identify blockers preventing certain pathways
   */
  private async identifyBlockers(situation: HouseholdSituation): Promise<string[]> {
    const blockers: string[] = [];
    
    // Income too high for some programs
    const povertyLevel = this.getFederalPovertyLevel(situation.householdSize);
    if (situation.monthlyIncome > povertyLevel * 2) {
      blockers.push('Income exceeds 200% FPL - limits some program eligibility');
    }
    
    // Asset limits for certain programs
    if (situation.housingStatus === 'owned') {
      blockers.push('Homeownership may affect asset-tested programs');
    }
    
    // Work requirements
    if (situation.employmentStatus.includes('unemployed')) {
      blockers.push('Work requirements may apply for SNAP/TANF (unless exempt)');
    }
    
    // Documentation barriers
    if (situation.barriers?.includes('undocumented')) {
      blockers.push('Immigration status limits federal benefit eligibility');
    }
    
    return blockers;
  }

  /**
   * Determine the next best action for the household
   */
  private determineNextAction(
    pathways: BenefitPathway[], 
    situation: HouseholdSituation
  ): string {
    if (pathways.length === 0) {
      return 'Schedule appointment with benefits counselor for personalized assessment';
    }
    
    // Find highest value easy pathway
    const easyPathways = pathways.filter(p => p.difficulty === 'easy');
    if (easyPathways.length > 0) {
      const best = easyPathways.sort((a, b) => b.estimatedTotalValue - a.estimatedTotalValue)[0];
      return `Apply for ${best.steps[0].program}: ${best.steps[0].action}`;
    }
    
    // Find pathway with quickest time to first benefit
    const quickest = pathways.sort((a, b) => a.steps[0].estimatedTime - b.steps[0].estimatedTime)[0];
    return `Start with ${quickest.steps[0].program}: ${quickest.steps[0].action}`;
  }

  /**
   * Format raw AI pathways into structured format
   */
  private formatPathways(rawPathways: any[]): BenefitPathway[] {
    return rawPathways.map(raw => ({
      id: nanoid(),
      name: raw.name || 'Benefit Pathway',
      description: raw.description || '',
      steps: this.formatSteps(raw.steps || []),
      estimatedTotalValue: raw.estimatedValue || 0,
      timeToComplete: raw.timeToComplete || 30,
      difficulty: raw.difficulty || 'moderate',
      successRate: raw.successRate || 75,
      aiConfidence: raw.confidence || 80
    }));
  }

  /**
   * Format pathway steps
   */
  private formatSteps(rawSteps: any[]): PathwayStep[] {
    return rawSteps.map((step, index) => ({
      order: index + 1,
      program: step.program || 'Unknown Program',
      action: step.action || 'Apply',
      requirements: step.requirements || [],
      estimatedTime: step.estimatedTime || 7,
      value: step.value || 0,
      dependencies: step.dependencies,
      automationAvailable: step.automationAvailable || false,
      documentation: step.documentation || []
    }));
  }

  /**
   * Get fallback pathways when AI is unavailable
   */
  private getFallbackPathways(situation: HouseholdSituation): BenefitPathway[] {
    const pathways: BenefitPathway[] = [];
    
    // SNAP pathway
    if (!situation.currentBenefits.includes('SNAP')) {
      const snapEligible = situation.monthlyIncome < this.getFederalPovertyLevel(situation.householdSize) * 2;
      if (snapEligible) {
        pathways.push({
          id: nanoid(),
          name: 'SNAP Food Assistance Pathway',
          description: 'Apply for SNAP benefits to receive monthly food assistance',
          steps: [{
            order: 1,
            program: 'SNAP',
            action: 'Complete online application at MyMDTHINK',
            requirements: ['Income verification', 'Identity proof', 'Residency proof'],
            estimatedTime: 7,
            value: Math.min(939, situation.householdSize * 200), // Rough estimate
            automationAvailable: true,
            documentation: ['Pay stubs', 'ID', 'Utility bill']
          }],
          estimatedTotalValue: Math.min(939, situation.householdSize * 200) * 12,
          timeToComplete: 7,
          difficulty: 'easy',
          successRate: 85,
          aiConfidence: 90
        });
      }
    }
    
    // Medicaid pathway
    if (!situation.currentBenefits.includes('Medicaid') && situation.hasChildren) {
      pathways.push({
        id: nanoid(),
        name: 'Medicaid/CHIP Healthcare Pathway',
        description: 'Enroll children in free or low-cost health coverage',
        steps: [{
            order: 1,
            program: 'Medicaid/CHIP',
            action: 'Apply through Maryland Health Connection',
            requirements: ['Income verification', 'Birth certificates'],
            estimatedTime: 14,
            value: 500, // Value of healthcare coverage
            automationAvailable: true,
            documentation: ['Pay stubs', 'Birth certificates']
        }],
        estimatedTotalValue: 6000,
        timeToComplete: 14,
        difficulty: 'easy',
        successRate: 90,
        aiConfidence: 85
      });
    }
    
    return pathways;
  }

  /**
   * Get federal poverty level for household size
   */
  private getFederalPovertyLevel(householdSize: number): number {
    // 2024 FPL monthly values
    const baseFPL = 1255; // 1 person
    const increment = 440; // Each additional person
    return baseFPL + (increment * Math.max(0, householdSize - 1));
  }

  /**
   * Generate hash for caching
   */
  private generateSituationHash(situation: HouseholdSituation): string {
    const key = `${situation.householdSize}_${situation.monthlyIncome}_${situation.currentBenefits.sort().join('_')}`;
    return Buffer.from(key).toString('base64').slice(0, 20);
  }

  /**
   * Get pathway recommendations for a specific case
   */
  async getRecommendationsForCase(caseId: string): Promise<BenefitPathway[]> {
    try {
      const clientCase = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, caseId)
      });

      if (!clientCase) {
        return [];
      }

      // Convert case to household situation
      const situation: HouseholdSituation = {
        householdSize: 1, // Would need to extract from case data
        monthlyIncome: 0, // Would need to extract from case data
        hasChildren: false,
        hasElderly: false,
        hasDisabled: false,
        currentBenefits: [],
        county: 'Baltimore', // Default
        housingStatus: 'rented',
        employmentStatus: ['unknown']
      };

      const analysis = await this.analyzeHousehold(situation);
      return analysis.discoveredPathways;
    } catch (error) {
      logger.error('Error getting recommendations', { 
        error: error instanceof Error ? error.message : String(error),
        caseId,
        service: 'BenefitsNavigation'
      });
      return [];
    }
  }
}

// Export singleton instance
export const benefitsNavigationService = new BenefitsNavigationService({} as IStorage);