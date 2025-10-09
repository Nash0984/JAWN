import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * PolicyEngine Service
 * Wraps the PolicyEngine US Python library for multi-benefit eligibility calculations
 */

export interface PolicyEngineHousehold {
  adults: number;
  children: number;
  employmentIncome: number;
  unearnedIncome?: number;
  stateCode: string;
  year?: number;
  // Additional household details
  householdAssets?: number;
  rentOrMortgage?: number;
  utilityCosts?: number;
  medicalExpenses?: number;
  childcareExpenses?: number;
  elderlyOrDisabled?: boolean;
}

export interface BenefitResult {
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

export interface PolicyEngineResponse {
  success: boolean;
  benefits: BenefitResult;
  error?: string;
  calculationDetails?: {
    eligibilityTests: Record<string, boolean>;
    deductions: Record<string, number>;
    warnings: string[];
  };
}

class PolicyEngineService {
  /**
   * Calculate benefits for a household using PolicyEngine
   */
  async calculateBenefits(household: PolicyEngineHousehold): Promise<PolicyEngineResponse> {
    try {
      // Build Python script to run PolicyEngine calculation
      const pythonScript = this.buildCalculationScript(household);
      
      // Execute Python script
      const result = await this.executePython(pythonScript);
      
      return {
        success: true,
        benefits: result.benefits,
        calculationDetails: result.details
      };
    } catch (error) {
      console.error('PolicyEngine calculation error:', error);
      return {
        success: false,
        benefits: this.getZeroBenefits(),
        error: error instanceof Error ? error.message : 'Unknown error during calculation'
      };
    }
  }

  /**
   * Build Python script for PolicyEngine calculation
   */
  private buildCalculationScript(household: PolicyEngineHousehold): string {
    const year = household.year || new Date().getFullYear();
    const totalIncome = household.employmentIncome + (household.unearnedIncome || 0);
    
    // Build household members structure
    const people: Record<string, any> = {};
    
    // Add adults
    for (let i = 0; i < household.adults; i++) {
      people[`adult_${i}`] = {
        age: { [year]: 30 + i * 5 },
        employment_income: { [year]: Math.floor(household.employmentIncome / household.adults) }
      };
      
      if (household.unearnedIncome && i === 0) {
        people[`adult_${i}`].interest_income = { [year]: household.unearnedIncome };
      }
    }
    
    // Add children
    for (let i = 0; i < household.children; i++) {
      people[`child_${i}`] = {
        age: { [year]: 5 + i * 3 }
      };
    }
    
    const allMembers = Object.keys(people);
    
    return `
import json
import sys
from policyengine_us import Simulation

try:
    # Build household situation
    situation = {
        "people": ${JSON.stringify(people, null, 2)},
        "households": {
            "household": {
                "members": ${JSON.stringify(allMembers)},
                "state_code": {"${year}": "${household.stateCode}"}
            }
        },
        "tax_units": {
            "tax_unit": {
                "members": ${JSON.stringify(allMembers)}
            }
        },
        "families": {
            "family": {
                "members": ${JSON.stringify(allMembers)}
            }
        }
    }
    
    # Create simulation
    sim = Simulation(situation=situation)
    
    # Calculate benefits and taxes
    benefits = {
        "snap": float(sim.calculate("snap", ${year})),
        "medicaid": bool(sim.calculate("medicaid_eligible", ${year})),
        "eitc": float(sim.calculate("eitc", ${year})),
        "childTaxCredit": float(sim.calculate("ctc", ${year})),
        "ssi": float(sim.calculate("ssi", ${year})),
        "tanf": float(sim.calculate("tanf", ${year})),
        "householdNetIncome": float(sim.calculate("household_net_income", ${year})),
        "householdTax": float(sim.calculate("household_tax", ${year})),
        "householdBenefits": float(sim.calculate("household_benefits", ${year})),
        "marginalTaxRate": float(sim.calculate("marginal_tax_rate", ${year}))
    }
    
    # Get additional details
    details = {
        "eligibilityTests": {
            "snap": bool(sim.calculate("snap_eligible", ${year})),
            "medicaid": bool(sim.calculate("medicaid_eligible", ${year})),
            "eitc": bool(sim.calculate("eitc_eligible", ${year})),
            "ctc": bool(sim.calculate("ctc_eligible", ${year})),
        },
        "deductions": {
            "standard": float(sim.calculate("standard_deduction", ${year})),
        },
        "warnings": []
    }
    
    result = {
        "benefits": benefits,
        "details": details
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "error": str(e),
        "benefits": {
            "snap": 0,
            "medicaid": False,
            "eitc": 0,
            "childTaxCredit": 0,
            "ssi": 0,
            "tanf": 0,
            "householdNetIncome": 0,
            "householdTax": 0,
            "householdBenefits": 0,
            "marginalTaxRate": 0
        }
    }
    print(json.dumps(error_result))
    sys.exit(1)
`;
  }

  /**
   * Execute Python script and parse results
   */
  private async executePython(script: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use python3.11 from Nix environment
      const python = spawn('python3.11', ['-c', script], {
        env: {
          ...process.env,
          PYTHONPATH: '/home/runner/.pythonlibs/lib/python3.11/site-packages'
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout.trim());
          
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(new Error(`Failed to parse PolicyEngine output: ${stdout}\nError: ${stderr}`));
        }
      });
      
      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Get zero benefits object (fallback)
   */
  private getZeroBenefits(): BenefitResult {
    return {
      snap: 0,
      medicaid: false,
      eitc: 0,
      childTaxCredit: 0,
      ssi: 0,
      tanf: 0,
      householdNetIncome: 0,
      householdTax: 0,
      householdBenefits: 0,
      marginalTaxRate: 0
    };
  }

  /**
   * Format benefits for human-readable display
   */
  formatBenefitsResponse(result: PolicyEngineResponse): string {
    if (!result.success) {
      return `Unable to calculate benefits: ${result.error}`;
    }

    const { benefits } = result;
    const benefitList: string[] = [];

    if (benefits.snap > 0) {
      benefitList.push(`• SNAP: $${benefits.snap.toFixed(0)}/month`);
    }
    if (benefits.medicaid) {
      benefitList.push(`• Medicaid: Eligible`);
    }
    if (benefits.eitc > 0) {
      benefitList.push(`• EITC: $${benefits.eitc.toFixed(0)}/year`);
    }
    if (benefits.childTaxCredit > 0) {
      benefitList.push(`• Child Tax Credit: $${benefits.childTaxCredit.toFixed(0)}/year`);
    }
    if (benefits.ssi > 0) {
      benefitList.push(`• SSI: $${benefits.ssi.toFixed(0)}/month`);
    }
    if (benefits.tanf > 0) {
      benefitList.push(`• TANF: $${benefits.tanf.toFixed(0)}/month`);
    }

    if (benefitList.length === 0) {
      return 'Based on the information provided, you may not qualify for these benefits. However, eligibility can vary based on additional factors.';
    }

    return `Based on your household information, you may be eligible for:\n\n${benefitList.join('\n')}\n\nNet household income: $${benefits.householdNetIncome.toFixed(0)}/year\nTotal benefits: $${benefits.householdBenefits.toFixed(0)}/year`;
  }

  /**
   * Test PolicyEngine availability
   */
  async testConnection(): Promise<boolean> {
    try {
      const testScript = `
import sys
try:
    from policyengine_us import Simulation
    print("OK")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`;
      
      const { stdout } = await execAsync(`python3.11 -c "${testScript.replace(/"/g, '\\"')}"`);
      return stdout.trim() === 'OK';
    } catch (error) {
      console.error('PolicyEngine test failed:', error);
      return false;
    }
  }
}

export const policyEngineService = new PolicyEngineService();
