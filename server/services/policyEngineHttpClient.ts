import axios from 'axios';
import { policyEngineOAuth } from './policyEngineOAuth';

/**
 * PolicyEngine HTTP API Client
 * Calls PolicyEngine REST API with OAuth 2.0 authentication
 * Documentation: https://policyengine.org/us/api
 * 
 * AUTHENTICATED ENDPOINT (US): https://household.api.policyengine.org/us/calculate
 * Note: The /us path prefix is required for US PolicyEngine calculations
 */

const POLICY_ENGINE_API_URL = 'https://household.api.policyengine.org/us/calculate';

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
  marital_units: Record<string, any>;
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
        age: { [year]: 5 + i * 3 },
        ssi: { [year]: null }  // Request SSI at person level
      };
    }
    
    // Request SSI for all adults (person-level variable)
    for (let i = 0; i < household.adults; i++) {
      const adultId = `adult_${i}`;
      people[adultId].ssi = { [year]: null };
    }
    
    const allMembers = Object.keys(people);
    const adultMembers = Object.keys(people).filter(id => id.startsWith('adult_'));
    
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
      // Add marital_units entity group (required for authenticated API)
      marital_units: {
        parent_marital_unit: {
          members: adultMembers // Only adults in marital unit
        }
      },
      // Add SPM unit for SNAP and TANF calculations
      spm_units: {
        spm_unit: {
          members: allMembers,
          // Request benefit calculations (SSI is person-level, not SPM-level)
          snap: { [year]: null },
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
   * Calculate benefits using PolicyEngine HTTP API (OAuth 2.0 authenticated)
   * Automatically retries once with token refresh if auth failure (401/403) occurs
   */
  async calculateBenefits(household: PolicyEngineHouseholdInput): Promise<BenefitCalculationResult> {
    try {
      return await this._performCalculation(household);
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        console.warn('PolicyEngine auth failure detected, refreshing token and retrying...');
        
        await policyEngineOAuth.refreshToken();
        console.log('PolicyEngine token refreshed successfully');
        
        return await this._performCalculation(household);
      }
      
      throw error;
    }
  }

  /**
   * Perform benefit calculation (extracted for retry logic)
   */
  private async _performCalculation(household: PolicyEngineHouseholdInput): Promise<BenefitCalculationResult> {
    const year = household.year || new Date().getFullYear();
    const householdPayload = this.buildApiPayload(household);
    
    const payload = {
      household: householdPayload
    };
    
    try {
      const accessToken = await policyEngineOAuth.getAccessToken();
      
      const response = await axios.post(POLICY_ENGINE_API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 30000
      });
      
      const data = response.data.result || response.data;
      
      let totalSSI = 0;
      if (data.people) {
        for (const personId of Object.keys(data.people)) {
          const ssiAmount = this.extractEntityValue(data, 'people', personId, 'ssi', year);
          if (ssiAmount && typeof ssiAmount === 'number') {
            totalSSI += ssiAmount;
          }
        }
      }
      
      const benefits: BenefitCalculationResult = {
        snap: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'snap', year) || 0,
        medicaid: this.extractEntityValue(data, 'people', 'adult_0', 'medicaid', year) || false,
        eitc: this.extractEntityValue(data, 'tax_units', 'tax_unit', 'eitc', year) || 0,
        childTaxCredit: this.extractEntityValue(data, 'tax_units', 'tax_unit', 'ctc', year) || 0,
        ssi: totalSSI,
        tanf: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'tanf', year) || 0,
        householdNetIncome: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'spm_unit_net_income', year) || 0,
        householdTax: this.extractEntityValue(data, 'tax_units', 'tax_unit', 'income_tax', year) || 0,
        householdBenefits: this.extractEntityValue(data, 'spm_units', 'spm_unit', 'spm_unit_benefits', year) || 0,
        marginalTaxRate: 0
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
        
        // Rethrow the original axios error to preserve status metadata
        // This allows the outer retry logic to detect 401/403 and refresh tokens
        throw error;
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
   * Test PolicyEngine API availability (OAuth 2.0 authenticated)
   * Automatically retries once with token refresh if auth failure (401/403) occurs
   */
  async testConnection(): Promise<{ available: boolean; message: string }> {
    try {
      return await this._performTestConnection();
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        console.warn('PolicyEngine auth failure during test, refreshing token and retrying...');
        
        await policyEngineOAuth.refreshToken();
        console.log('PolicyEngine token refreshed successfully');
        
        return await this._performTestConnection();
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        if (status === 401 || status === 403) {
          return {
            available: false,
            message: `PolicyEngine authentication failed (${status}): Token refresh failed`
          };
        }
        
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

  /**
   * Perform test connection (extracted for retry logic)
   */
  private async _performTestConnection(): Promise<{ available: boolean; message: string }> {
    const accessToken = await policyEngineOAuth.getAccessToken();
    
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
        marital_units: {
          marital_unit: {
            members: ['person']
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
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 10000
    });
    
    const result = response.data.result;
    
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
  }
}

export const policyEngineHttpClient = new PolicyEngineHttpClient();
