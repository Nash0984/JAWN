import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';
import { policyEngineTaxCalculationService } from './policyEngineTaxCalculation';
import { GoogleGenAI } from '@google/genai';
import { cacheService } from './cacheService';
import { logger } from './logger.service';

/**
 * Cross-Enrollment Intelligence Engine
 * 
 * Analyzes tax return data to identify unclaimed benefit opportunities and vice versa.
 * Core innovation: One household interview drives BOTH benefit applications AND tax return prep,
 * with AI-driven cross-program intelligence that mines tax data to reveal missed benefits.
 * 
 * Key Scenarios:
 * 1. Tax → Benefits: High EITC indicates low income → likely SNAP eligible
 * 2. Tax → Benefits: High medical expenses → Medicaid screening
 * 3. Tax → Benefits: 1095-A health insurance → Premium Tax Credit optimization
 * 4. Benefits → Tax: Child care assistance → Child and Dependent Care Credit
 * 5. Benefits → Tax: Education expenses → education tax credits
 * 
 * Maryland DHS strategic advantage: Government-to-government data sharing enables
 * automatic cross-program enrollment that commercial tax preparers cannot provide.
 */

export interface CrossEnrollmentOpportunity {
  id: string;
  type: 'tax_to_benefit' | 'benefit_to_tax';
  priority: 'high' | 'medium' | 'low';
  category: string; // SNAP, Medicaid, EITC, CTC, etc.
  
  // Triggering indicator
  trigger: {
    source: string; // e.g., "High EITC", "Medical expenses", "1095-A coverage"
    value: number | string;
    threshold?: number;
  };
  
  // Recommended action
  recommendation: {
    program: string; // Target benefit or tax credit
    estimatedValue: number; // Monthly or annual value
    action: string; // Human-readable next step
    automationAvailable: boolean; // Can auto-enroll or pre-fill?
  };
  
  // Supporting data
  evidence: {
    incomeIndicators?: {
      agi: number;
      eitc: number;
      wages: number;
    };
    householdIndicators?: {
      dependents: number;
      medicalExpenses?: number;
      childcareExpenses?: number;
    };
    programEligibility?: {
      snapIncomeLimitMonthly: number;
      currentIncomeMonthly: number;
      likelyEligible: boolean;
    };
  };
  
  // Navigator guidance
  navigatorNotes: string;
  urgency: 'immediate' | 'within_30_days' | 'annual' | 'future_planning';
}

export interface CrossEnrollmentAnalysis {
  opportunities: CrossEnrollmentOpportunity[];
  summary: {
    totalPotentialValue: number; // Annual value across all opportunities
    highPriorityCount: number;
    autoEnrollableCount: number;
  };
  householdProfile: {
    agi: number;
    householdSize: number;
    dependents: number;
    hasDisability: boolean;
    hasElderly: boolean;
  };
}

export class CrossEnrollmentIntelligenceService {
  private gemini: GoogleGenAI | null = null;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (apiKey) {
      this.gemini = new GoogleGenAI({ apiKey });
    } else {
      logger.warn('⚠️ Cross-Enrollment Intelligence: No Gemini API key found.', {
        service: 'CrossEnrollmentIntelligence'
      });
    }
  }
  /**
   * Analyze tax data for missed benefit opportunities
   */
  async analyzeTaxForBenefits(
    taxInput: TaxHouseholdInput,
    taxResult: TaxCalculationResult
  ): Promise<CrossEnrollmentOpportunity[]> {
    const opportunities: CrossEnrollmentOpportunity[] = [];
    
    // 1. High EITC → SNAP Screening
    if (taxResult.eitc > 3000) { // Significant EITC indicates low income
      const householdSize = 1 + (taxInput.spouse ? 1 : 0) + (taxInput.dependents?.length || 0);
      const monthlyIncome = taxResult.adjustedGrossIncome / 12;
      
      // SNAP gross income limit: ~200% FPL (varies by state)
      const snapIncomeLimit = this.getSNAPIncomeLimit(householdSize, taxInput.stateCode);
      
      if (monthlyIncome < snapIncomeLimit) {
        opportunities.push({
          id: `snap_eitc_${Date.now()}`,
          type: 'tax_to_benefit',
          priority: 'high',
          category: 'SNAP',
          trigger: {
            source: 'High Earned Income Tax Credit',
            value: taxResult.eitc,
            threshold: 3000
          },
          recommendation: {
            program: 'SNAP (Food Assistance)',
            estimatedValue: this.estimateSNAPBenefit(monthlyIncome, householdSize),
            action: 'Screen for SNAP eligibility - likely qualifies based on income',
            automationAvailable: true // Can pre-populate from tax data
          },
          evidence: {
            incomeIndicators: {
              agi: taxResult.adjustedGrossIncome,
              eitc: taxResult.eitc,
              wages: (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0)
            },
            programEligibility: {
              snapIncomeLimitMonthly: snapIncomeLimit,
              currentIncomeMonthly: monthlyIncome,
              likelyEligible: true
            }
          },
          navigatorNotes: `EITC of $${taxResult.eitc} indicates household income well below SNAP threshold. Recommend immediate SNAP application - can pre-fill from tax data.`,
          urgency: 'immediate'
        });
      }
    }
    
    // 2. High Medical Expenses → Medicaid Screening
    if (taxInput.medicalExpenses && taxInput.medicalExpenses > 3000) {
      const householdSize = 1 + (taxInput.spouse ? 1 : 0) + (taxInput.dependents?.length || 0);
      const monthlyIncome = taxResult.adjustedGrossIncome / 12;
      const medicaidIncomeLimit = this.getMedicaidIncomeLimit(householdSize, taxInput.stateCode);
      
      if (monthlyIncome < medicaidIncomeLimit * 1.5) { // Check expanded Medicaid
        opportunities.push({
          id: `medicaid_medical_${Date.now()}`,
          type: 'tax_to_benefit',
          priority: 'high',
          category: 'Medicaid',
          trigger: {
            source: 'High out-of-pocket medical expenses',
            value: taxInput.medicalExpenses,
            threshold: 3000
          },
          recommendation: {
            program: 'Medicaid',
            estimatedValue: taxInput.medicalExpenses * 0.8, // Potential coverage
            action: 'Screen for Medicaid - high medical costs indicate need',
            automationAvailable: true
          },
          evidence: {
            householdIndicators: {
              dependents: taxInput.dependents?.length || 0,
              medicalExpenses: taxInput.medicalExpenses
            },
            incomeIndicators: {
              agi: taxResult.adjustedGrossIncome,
              eitc: taxResult.eitc,
              wages: (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0)
            },
            programEligibility: {
              snapIncomeLimitMonthly: medicaidIncomeLimit,
              currentIncomeMonthly: monthlyIncome,
              likelyEligible: monthlyIncome < medicaidIncomeLimit
            }
          },
          navigatorNotes: `Medical expenses of $${taxInput.medicalExpenses} suggest significant healthcare burden. Medicaid could reduce out-of-pocket costs substantially.`,
          urgency: 'within_30_days'
        });
      }
    }
    
    // 3. Premium Tax Credit Optimization (1095-A analysis)
    if (taxInput.healthInsurance) {
      const aptcShortfall = taxInput.healthInsurance.slcspPremium - taxInput.healthInsurance.aptcReceived;
      
      if (aptcShortfall > 100 && taxResult.premiumTaxCredit > aptcShortfall) {
        opportunities.push({
          id: `ptc_optimization_${Date.now()}`,
          type: 'tax_to_benefit',
          priority: 'medium',
          category: 'Premium Tax Credit',
          trigger: {
            source: 'Marketplace health insurance with low APTC',
            value: taxInput.healthInsurance.aptcReceived,
            threshold: taxInput.healthInsurance.slcspPremium * 0.5
          },
          recommendation: {
            program: 'Premium Tax Credit (Advance)',
            estimatedValue: aptcShortfall * 12, // Annual savings
            action: 'Update Marketplace application to increase advance PTC - reduce monthly premiums',
            automationAvailable: false // Requires Marketplace portal
          },
          evidence: {
            householdIndicators: {
              dependents: taxInput.dependents?.length || 0
            },
            incomeIndicators: {
              agi: taxResult.adjustedGrossIncome,
              eitc: taxResult.eitc,
              wages: (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0)
            }
          },
          navigatorNotes: `Eligible for $${Math.round(aptcShortfall)}/month more in advance Premium Tax Credit. Client paying too much monthly - can reduce premiums now vs. waiting for refund.`,
          urgency: 'within_30_days'
        });
      }
    }
    
    // 4. Child Tax Credit → Child Care Assistance
    if (taxResult.childTaxCredit > 0 && taxInput.dependents) {
      const youngChildren = taxInput.dependents.filter(d => d.age < 13).length;
      
      if (youngChildren > 0 && !taxInput.childcareCosts) {
        opportunities.push({
          id: `childcare_ctc_${Date.now()}`,
          type: 'tax_to_benefit',
          priority: 'medium',
          category: 'Child Care',
          trigger: {
            source: 'Child Tax Credit with young children',
            value: taxResult.childTaxCredit,
            threshold: 0
          },
          recommendation: {
            program: 'Child Care Subsidy Program',
            estimatedValue: 800 * 12 * youngChildren, // Estimated subsidy
            action: 'Screen for child care assistance - has qualifying children',
            automationAvailable: true
          },
          evidence: {
            householdIndicators: {
              dependents: youngChildren,
              childcareExpenses: 0
            },
            incomeIndicators: {
              agi: taxResult.adjustedGrossIncome,
              eitc: taxResult.eitc,
              wages: (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0)
            }
          },
          navigatorNotes: `${youngChildren} child(ren) under 13. No childcare expenses reported - may need child care assistance for employment.`,
          urgency: 'within_30_days'
        });
      }
    }
    
    // 5. Low Income + Elderly/Disabled → SSI Screening
    if (taxResult.adjustedGrossIncome < 15000) {
      const hasElderly = taxInput.taxpayer.age >= 65 || (taxInput.spouse?.age && taxInput.spouse.age >= 65);
      const hasDisabled = taxInput.taxpayer.isDisabled || taxInput.spouse?.isDisabled || 
                          taxInput.dependents?.some(d => d.disabilityStatus);
      
      if (hasElderly || hasDisabled) {
        opportunities.push({
          id: `ssi_screening_${Date.now()}`,
          type: 'tax_to_benefit',
          priority: 'high',
          category: 'SSI',
          trigger: {
            source: 'Low income with elderly/disabled household member',
            value: taxResult.adjustedGrossIncome,
            threshold: 15000
          },
          recommendation: {
            program: 'Supplemental Security Income (SSI)',
            estimatedValue: 943 * 12, // 2024 federal benefit rate
            action: 'Screen for SSI - likely eligible based on income and household status',
            automationAvailable: false // Requires SSA application
          },
          evidence: {
            incomeIndicators: {
              agi: taxResult.adjustedGrossIncome,
              eitc: taxResult.eitc,
              wages: (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0)
            },
            householdIndicators: {
              dependents: taxInput.dependents?.length || 0
            }
          },
          navigatorNotes: `AGI of $${taxResult.adjustedGrossIncome} with ${hasElderly ? 'elderly' : 'disabled'} household member. SSI provides cash assistance - recommend Social Security office referral.`,
          urgency: 'immediate'
        });
      }
    }
    
    return opportunities;
  }
  
  /**
   * Analyze benefits data for tax credit opportunities
   */
  async analyzeBenefitsForTax(
    benefitData: {
      childcareExpenses?: number;
      educationExpenses?: number;
      medicalExpenses?: number;
      dependents?: number;
      agi?: number;
    }
  ): Promise<CrossEnrollmentOpportunity[]> {
    const opportunities: CrossEnrollmentOpportunity[] = [];
    
    // 1. Child care expenses → Child and Dependent Care Credit
    if (benefitData.childcareExpenses && benefitData.childcareExpenses > 0) {
      const creditAmount = Math.min(benefitData.childcareExpenses * 0.35, 1050); // Up to $1,050 per child
      
      opportunities.push({
        id: `cdcc_childcare_${Date.now()}`,
        type: 'benefit_to_tax',
        priority: 'high',
        category: 'Child and Dependent Care Credit',
        trigger: {
          source: 'Child care expenses from benefits application',
          value: benefitData.childcareExpenses
        },
        recommendation: {
          program: 'Child and Dependent Care Credit (CDCC)',
          estimatedValue: creditAmount,
          action: 'Include child care expenses on tax return for CDCC',
          automationAvailable: true // Can pre-fill from benefits data
        },
        evidence: {
          householdIndicators: {
            dependents: benefitData.dependents || 0,
            childcareExpenses: benefitData.childcareExpenses
          }
        },
        navigatorNotes: `Child care expenses of $${benefitData.childcareExpenses} reported in benefits application can generate tax credit of ~$${Math.round(creditAmount)}. Ensure Form 2441 included with tax return.`,
        urgency: 'annual'
      });
    }
    
    // 2. Education expenses → Education Credits
    if (benefitData.educationExpenses && benefitData.educationExpenses > 0) {
      const creditAmount = Math.min(benefitData.educationExpenses, 2500); // American Opportunity Credit max
      
      opportunities.push({
        id: `education_credit_${Date.now()}`,
        type: 'benefit_to_tax',
        priority: 'medium',
        category: 'Education Credits',
        trigger: {
          source: 'Education expenses from benefits screening',
          value: benefitData.educationExpenses
        },
        recommendation: {
          program: 'American Opportunity Credit or Lifetime Learning Credit',
          estimatedValue: creditAmount,
          action: 'Review education expenses for tax credit eligibility',
          automationAvailable: true
        },
        evidence: {
          householdIndicators: {
            dependents: benefitData.dependents || 0
          }
        },
        navigatorNotes: `Education expenses of $${benefitData.educationExpenses} may qualify for up to $${creditAmount} in tax credits. Verify enrollment and qualified expenses.`,
        urgency: 'annual'
      });
    }
    
    return opportunities;
  }
  
  /**
   * Generate comprehensive cross-enrollment analysis
   */
  async generateFullAnalysis(
    taxInput: TaxHouseholdInput,
    taxResult: TaxCalculationResult,
    benefitData?: any
  ): Promise<CrossEnrollmentAnalysis> {
    const taxOpportunities = await this.analyzeTaxForBenefits(taxInput, taxResult);
    const benefitOpportunities = benefitData ? 
      await this.analyzeBenefitsForTax(benefitData) : [];
    
    const allOpportunities = [...taxOpportunities, ...benefitOpportunities];
    
    const totalPotentialValue = allOpportunities.reduce(
      (sum, opp) => sum + opp.recommendation.estimatedValue, 
      0
    );
    
    const highPriorityCount = allOpportunities.filter(o => o.priority === 'high').length;
    const autoEnrollableCount = allOpportunities.filter(
      o => o.recommendation.automationAvailable
    ).length;
    
    return {
      opportunities: allOpportunities,
      summary: {
        totalPotentialValue,
        highPriorityCount,
        autoEnrollableCount
      },
      householdProfile: {
        agi: taxResult.adjustedGrossIncome,
        householdSize: 1 + (taxInput.spouse ? 1 : 0) + (taxInput.dependents?.length || 0),
        dependents: taxInput.dependents?.length || 0,
        hasDisability: taxInput.taxpayer.isDisabled || 
                      taxInput.spouse?.isDisabled || 
                      !!taxInput.dependents?.some(d => d.disabilityStatus),
        hasElderly: taxInput.taxpayer.age >= 65 || (taxInput.spouse?.age ?? 0) >= 65
      }
    };
  }
  
  /**
   * Helper: Get SNAP income limit (Maryland 2024)
   */
  private getSNAPIncomeLimit(householdSize: number, stateCode: string): number {
    // Maryland SNAP: 200% FPL
    // 100% FPL 2024 monthly (baseline)
    const fpl100Percent: Record<number, number> = {
      1: 1255,
      2: 1704,
      3: 2152,
      4: 2600,
      5: 3048,
      6: 3496,
      7: 3945,
      8: 4393
    };
    
    const baseFPL = fpl100Percent[Math.min(householdSize, 8)] || 4393;
    return baseFPL * 2; // 200% FPL for SNAP
  }
  
  /**
   * Helper: Get Medicaid income limit (Maryland 2024)
   */
  private getMedicaidIncomeLimit(householdSize: number, stateCode: string): number {
    // Maryland Medicaid: 138% FPL (ACA expansion)
    // 100% FPL 2024 monthly (baseline)
    const fpl100Percent: Record<number, number> = {
      1: 1255,
      2: 1704,
      3: 2152,
      4: 2600,
      5: 3048,
      6: 3496,
      7: 3945,
      8: 4393
    };
    
    const baseFPL = fpl100Percent[Math.min(householdSize, 8)] || 4393;
    return baseFPL * 1.38; // 138% FPL for Medicaid
  }
  
  /**
   * Helper: Estimate SNAP benefit amount (Maryland 2024)
   */
  private estimateSNAPBenefit(monthlyIncome: number, householdSize: number): number {
    // SNAP maximum monthly allotments (2024)
    const maxBenefit: Record<number, number> = {
      1: 291,
      2: 535,
      3: 766,
      4: 973,
      5: 1155,
      6: 1386,
      7: 1532,
      8: 1751
    };
    
    const max = maxBenefit[Math.min(householdSize, 8)] || 1751;
    
    // Simplified SNAP calculation:
    // Net income = gross - standard deduction (approx $200 per person)
    // Benefit = max allotment - (30% of net income)
    const standardDeduction = householdSize * 200; // Simplified
    const netIncome = Math.max(0, monthlyIncome - standardDeduction);
    
    return Math.max(20, max - (netIncome * 0.3)); // Minimum $20/month
  }
}

export const crossEnrollmentIntelligenceService = new CrossEnrollmentIntelligenceService();
