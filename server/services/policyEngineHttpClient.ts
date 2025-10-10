import axios from 'axios';

/**
 * PolicyEngine HTTP API Client
 * Calls PolicyEngine REST API instead of Python package
 * Documentation: https://policyengine.org/us/api
 */

const POLICY_ENGINE_API_URL = 'https://api.policyengine.org/us/calculate';

export interface PolicyEngineHouseholdInput {
  adults: number;
  children: number;
  employmentIncome: number;
  unearnedIncome?: number;
  stateCode: string;
  year?: number;
  householdAssets?: number;
  rentOrMortgage?: number;
  utilityCosts?: number;
  medicalExpenses?: number;
  childcareExpenses?: number;
  elderlyOrDisabled?: boolean;
}

export interface PolicyEngineApiPayload {
  people: Record<string, any>;
  households: Record<string, any>;
  tax_units: Record<string, any>;
  families: Record<string, any>;
  axes?: any[][];
}

export interface BenefitCalculationResult {
  snap: number;
  medicaid: boolean;
  eitc: number;
  childTaxCredit: number;
  ssi: number;
  tanf: number;
  householdNetIncome: number;
  householdTax: number;
  householdBenefits: number;
  marginalTaxRate: number;
}

export class PolicyEngineHttpClient {
  /**
   * Build PolicyEngine API payload from household input
   */
  private buildApiPayload(household: PolicyEngineHouseholdInput): PolicyEngineApiPayload {
    const year = household.year || new Date().getFullYear();
    const people: Record<string, any> = {};
    
    // Add adults
    for (let i = 0; i < household.adults; i++) {
      const adultId = `adult_${i}`;
      people[adultId] = {
        age: { [year]: 30 + i * 5 }
      };
      
      // Distribute employment income across adults
      if (household.employmentIncome > 0) {
        people[adultId].employment_income = { 
          [year]: Math.floor(household.employmentIncome / household.adults) 
        };
      }
      
      // First adult gets unearned income
      if (household.unearnedIncome && i === 0) {
        people[adultId].interest_income = { [year]: household.unearnedIncome };
      }
      
      // Mark elderly/disabled if specified
      if (household.elderlyOrDisabled && i === 0) {
        people[adultId].is_disabled = { [year]: true };
      }
    }
    
    // Add children
    for (let i = 0; i < household.children; i++) {
      people[`child_${i}`] = {
        age: { [year]: 5 + i * 3 }
      };
    }
    
    const allMembers = Object.keys(people);
    
    // Build household structure
    const payload: PolicyEngineApiPayload = {
      people,
      households: {
        household: {
          members: allMembers,
          state_code: { [year]: household.stateCode }
        }
      },
      tax_units: {
        tax_unit: {
          members: allMembers
        }
      },
      families: {
        family: {
          members: allMembers
        }
      }
    };
    
    // Add household expenses if provided
    if (household.rentOrMortgage) {
      payload.households.household.housing_cost = { [year]: household.rentOrMortgage };
    }
    
    if (household.utilityCosts) {
      payload.households.household.utility_cost = { [year]: household.utilityCosts };
    }
    
    if (household.medicalExpenses) {
      payload.households.household.medical_out_of_pocket_expenses = { 
        [year]: household.medicalExpenses 
      };
    }
    
    if (household.childcareExpenses) {
      payload.households.household.childcare_expenses = { 
        [year]: household.childcareExpenses 
      };
    }
    
    if (household.householdAssets) {
      payload.households.household.household_assets = { [year]: household.householdAssets };
    }
    
    return payload;
  }
  
  /**
   * Calculate benefits using PolicyEngine HTTP API
   */
  async calculateBenefits(household: PolicyEngineHouseholdInput): Promise<BenefitCalculationResult> {
    const year = household.year || new Date().getFullYear();
    const payload = this.buildApiPayload(household);
    
    try {
      // Call PolicyEngine API
      const response = await axios.post(POLICY_ENGINE_API_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      const data = response.data;
      
      // Extract benefit values from response
      // PolicyEngine API returns nested structure with calculations
      const benefits: BenefitCalculationResult = {
        snap: this.extractValue(data, 'snap', year) || 0,
        medicaid: this.extractValue(data, 'medicaid_eligible', year) || false,
        eitc: this.extractValue(data, 'eitc', year) || 0,
        childTaxCredit: this.extractValue(data, 'ctc', year) || 0,
        ssi: this.extractValue(data, 'ssi', year) || 0,
        tanf: this.extractValue(data, 'tanf', year) || 0,
        householdNetIncome: this.extractValue(data, 'household_net_income', year) || 0,
        householdTax: this.extractValue(data, 'household_tax', year) || 0,
        householdBenefits: this.extractValue(data, 'household_benefits', year) || 0,
        marginalTaxRate: this.extractValue(data, 'marginal_tax_rate', year) || 0
      };
      
      return benefits;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        console.error('PolicyEngine API error:', {
          status,
          data: errorData,
          message: error.message
        });
        
        throw new Error(
          `PolicyEngine API request failed: ${error.message}` +
          (errorData ? ` - ${JSON.stringify(errorData)}` : '')
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Extract value from PolicyEngine API response
   * API returns nested structure like { variable_name: { "2024": value } }
   */
  private extractValue(data: any, variable: string, year: number): any {
    if (!data || !data[variable]) {
      return null;
    }
    
    const varData = data[variable];
    
    // Check if it's the nested year structure
    if (typeof varData === 'object' && varData[year] !== undefined) {
      return varData[year];
    }
    
    // Sometimes API returns direct values
    if (typeof varData === 'number' || typeof varData === 'boolean') {
      return varData;
    }
    
    return null;
  }
  
  /**
   * Test PolicyEngine API availability
   */
  async testConnection(): Promise<{ available: boolean; message: string }> {
    try {
      // Simple test calculation - single adult in Maryland
      const testPayload: PolicyEngineApiPayload = {
        people: {
          adult: {
            age: { 2024: 30 },
            employment_income: { 2024: 30000 }
          }
        },
        households: {
          household: {
            members: ['adult'],
            state_code: { 2024: 'MD' }
          }
        },
        tax_units: {
          tax_unit: {
            members: ['adult']
          }
        },
        families: {
          family: {
            members: ['adult']
          }
        }
      };
      
      const response = await axios.post(POLICY_ENGINE_API_URL, testPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      // Check if we got a valid response
      if (response.data && typeof response.data === 'object') {
        return {
          available: true,
          message: 'PolicyEngine REST API is operational'
        };
      }
      
      return {
        available: false,
        message: 'PolicyEngine API returned unexpected response format'
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          available: false,
          message: `PolicyEngine API unavailable: ${error.message}`
        };
      }
      
      return {
        available: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const policyEngineHttpClient = new PolicyEngineHttpClient();
