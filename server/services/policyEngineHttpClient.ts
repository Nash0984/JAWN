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
  spm_units?: Record<string, any>;
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
        age: { [year]: 30 + i * 5 },
        // Request Medicaid eligibility calculation
        medicaid: { [year]: null }
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
          state_name: { [year]: household.stateCode }
        }
      },
      tax_units: {
        tax_unit: {
          members: allMembers,
          filing_status: { [year]: household.adults > 1 ? 'JOINT' : 'SINGLE' },
          // Request tax credit calculations
          eitc: { [year]: null },
          ctc: { [year]: null },
          income_tax: { [year]: null }
        }
      },
      families: {
        family: {
          members: allMembers
        }
      },
      // Add SPM unit for SNAP, SSI, TANF calculations
      spm_units: {
        spm_unit: {
          members: allMembers,
          // Request benefit calculations
          snap: { [year]: null },
          ssi: { [year]: null },
          tanf: { [year]: null },
          spm_unit_net_income: { [year]: null },
          spm_unit_benefits: { [year]: null }
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
    const householdPayload = this.buildApiPayload(household);
    
    // Wrap in household key as per API spec
    const payload = {
      household: householdPayload
    };
    
    try {
      // Call PolicyEngine API
      const response = await axios.post(POLICY_ENGINE_API_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      // API returns { message, result: {...entities...}, status }
      // The calculated values are in result.entities
      const data = response.data.result || response.data;
      
      // Extract benefit values from response
      // PolicyEngine returns calculated values within the returned household structure
      const benefits: BenefitCalculationResult = {
        snap: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'snap', year) || 0,
        medicaid: this.extractEntityValue(data, 'people', 'adult_0', 'medicaid', year) || false,
        eitc: this.extractEntityValue(data, 'tax_units', 'tax_unit', 'eitc', year) || 0,
        childTaxCredit: this.extractEntityValue(data, 'tax_units', 'tax_unit', 'ctc', year) || 0,
        ssi: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'ssi', year) || 0,
        tanf: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'tanf', year) || 0,
        householdNetIncome: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'spm_unit_net_income', year) || 0,
        householdTax: this.extractEntityValue(data, 'tax_units', 'tax_unit', 'income_tax', year) || 0,
        householdBenefits: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'spm_unit_benefits', year) || 0,
        marginalTaxRate: 0 // Not easily accessible in basic response
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
   * Extract value from PolicyEngine API response entity
   * API returns nested structure: { entity_type: { entity_name: { variable: { "2024": value } } } }
   */
  private extractEntityValue(data: any, entityType: string, entityName: string, variable: string, year: number): any {
    if (!data || !data[entityType] || !data[entityType][entityName]) {
      return null;
    }
    
    const entity = data[entityType][entityName];
    const varData = entity[variable];
    
    if (!varData) {
      return null;
    }
    
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
      // Simple test calculation - single adult in Maryland with $30k income
      const testPayload = {
        household: {
          people: {
            person: {
              age: { 2024: 30 },
              employment_income: { 2024: 30000 }
            }
          },
          tax_units: {
            tax_unit: {
              members: ['person'],
              filing_status: { 2024: 'SINGLE' },
              eitc: { 2024: null }
            }
          },
          spm_units: {
            spm_unit: {
              members: ['person'],
              snap: { 2024: null }
            }
          },
          households: {
            household: {
              members: ['person'],
              state_name: { 2024: 'MD' }
            }
          },
          families: {
            family: {
              members: ['person']
            }
          }
        }
      };
      
      const response = await axios.post(POLICY_ENGINE_API_URL, testPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      // Response is { message, result: {...entities...}, status }
      const result = response.data.result;
      
      // Check if we got a valid response with calculated values
      if (result && result.spm_units && result.spm_units.spm_unit) {
        const snapValue = result.spm_units.spm_unit.snap;
        const hasCalculation = snapValue && typeof snapValue === 'object' && snapValue[2024] !== undefined;
        
        return {
          available: hasCalculation,
          message: hasCalculation 
            ? `PolicyEngine REST API is operational (SNAP: $${snapValue[2024]})` 
            : 'PolicyEngine API returned response but no calculations'
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
