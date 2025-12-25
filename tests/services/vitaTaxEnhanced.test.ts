import { describe, it, expect } from 'vitest';
import { vitaTaxRulesEngine, VITATaxInput } from '../../server/services/vitaTaxRulesEngine';

describe('VITA Tax Rules Engine - Enhanced Features', () => {
  
  describe('Schedule C - Business Income', () => {
    it('should calculate self-employment tax and deduction for business income', async () => {
      const input: VITATaxInput = {
        filingStatus: 'single',
        taxYear: 2024,
        wages: 2000000, // $20,000
        otherIncome: 0,
        selfEmploymentIncome: 3000000, // $30,000 gross business income
        businessExpenses: 1000000, // $10,000 business expenses
        numberOfQualifyingChildren: 0,
        dependents: 0,
        marylandCounty: 'baltimore_city',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      // Verify Schedule C calculation
      expect(result.federalTax.scheduleC).toBeDefined();
      expect(result.federalTax.scheduleC?.grossBusinessIncome).toBe(3000000);
      expect(result.federalTax.scheduleC?.businessExpenses).toBe(1000000);
      expect(result.federalTax.scheduleC?.netProfit).toBe(2000000); // $20,000
      
      // Verify Self-Employment Tax calculation
      expect(result.federalTax.selfEmploymentTax).toBeDefined();
      const netEarnings = Math.round(2000000 * 0.9235); // 92.35% of net profit
      const seTax = Math.round(netEarnings * 0.153); // 15.3%
      const deductible = Math.round(seTax * 0.50); // 50% deductible
      
      expect(result.federalTax.selfEmploymentTax?.netEarnings).toBe(netEarnings);
      expect(result.federalTax.selfEmploymentTax?.seTax).toBe(seTax);
      expect(result.federalTax.selfEmploymentTax?.deductiblePortion).toBe(deductible);
      
      // Verify AGI includes SE tax deduction
      const totalIncome = 2000000 + 2000000; // wages + net profit
      const expectedAGI = totalIncome - deductible;
      expect(result.federalTax.adjustedGrossIncome).toBe(expectedAGI);
      
      // Verify breakdown includes Schedule C
      expect(result.calculationBreakdown.some(line => line.includes('SCHEDULE C'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('SELF-EMPLOYMENT TAX'))).toBe(true);
      
      // Verify citations
      expect(result.policyCitations.some(c => c.includes('Schedule C'))).toBe(true);
      expect(result.policyCitations.some(c => c.includes('Publication 334'))).toBe(true);
    });
    
    it('should not calculate SE tax when business has a loss', async () => {
      const input: VITATaxInput = {
        filingStatus: 'single',
        taxYear: 2024,
        wages: 3000000, // $30,000
        otherIncome: 0,
        selfEmploymentIncome: 1000000, // $10,000 gross
        businessExpenses: 1500000, // $15,000 expenses (loss)
        numberOfQualifyingChildren: 0,
        dependents: 0,
        marylandCounty: 'montgomery',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      // Net profit should be negative
      expect(result.federalTax.scheduleC?.netProfit).toBe(-500000); // -$5,000
      
      // No SE tax on a loss
      expect(result.federalTax.selfEmploymentTax).toBeUndefined();
      
      // AGI should reflect the loss
      const expectedAGI = 3000000 - 500000; // wages + loss
      expect(result.federalTax.adjustedGrossIncome).toBe(expectedAGI);
    });
  });
  
  describe('Education Credits (Form 8863)', () => {
    it('should calculate American Opportunity Credit (AOC) for eligible students', async () => {
      const input: VITATaxInput = {
        filingStatus: 'married_joint',
        taxYear: 2024,
        wages: 6000000, // $60,000
        otherIncome: 0,
        numberOfQualifyingChildren: 1,
        dependents: 1,
        qualifiedEducationExpenses: 500000, // $5,000
        numberOfStudents: 1,
        marylandCounty: 'howard',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      // Verify education credits calculation
      expect(result.federalTax.educationCredits).toBeDefined();
      
      // AOC: 100% of first $2,000 + 25% of next $2,000
      // $5,000 expense = $2,000 + 25% of $2,000 = $2,000 + $500 = $2,500
      expect(result.federalTax.educationCredits?.americanOpportunityCredit).toBe(250000);
      
      // 40% refundable (max $1,000 per student)
      const refundable = Math.round(250000 * 0.40);
      expect(result.federalTax.educationCredits?.aocRefundablePortion).toBe(refundable);
      
      // Verify breakdown
      expect(result.calculationBreakdown.some(line => line.includes('EDUCATION CREDITS'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('American Opportunity Credit'))).toBe(true);
      
      // Verify citations
      expect(result.policyCitations.some(c => c.includes('Publication 970'))).toBe(true);
    });
    
    it('should calculate Lifetime Learning Credit when no students for AOC', async () => {
      const input: VITATaxInput = {
        filingStatus: 'single',
        taxYear: 2024,
        wages: 5000000, // $50,000
        otherIncome: 0,
        numberOfQualifyingChildren: 0,
        dependents: 0,
        qualifiedEducationExpenses: 800000, // $8,000
        numberOfStudents: 0, // No AOC eligible students
        marylandCounty: 'prince_georges',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      expect(result.federalTax.educationCredits).toBeDefined();
      
      // LLC: 20% of expenses (max $10,000)
      // $8,000 * 20% = $1,600
      expect(result.federalTax.educationCredits?.lifetimeLearningCredit).toBe(160000);
      expect(result.federalTax.educationCredits?.americanOpportunityCredit).toBe(0);
      expect(result.federalTax.educationCredits?.aocRefundablePortion).toBe(0);
      
      // Verify citations
      expect(result.policyCitations.some(c => c.includes('Lifetime Learning Credit'))).toBe(true);
    });
    
    it('should apply phase-out for high-income taxpayers', async () => {
      const input: VITATaxInput = {
        filingStatus: 'single',
        taxYear: 2024,
        wages: 8500000, // $85,000 (in phase-out range $80k-$90k)
        otherIncome: 0,
        numberOfQualifyingChildren: 0,
        dependents: 0,
        qualifiedEducationExpenses: 500000, // $5,000
        numberOfStudents: 1,
        marylandCounty: 'anne_arundel',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      // Should have partial phase-out
      // AGI $85,000 is $5,000 into $10,000 phase-out range = 50% reduction
      expect(result.federalTax.educationCredits).toBeDefined();
      
      const fullCredit = 250000; // $2,500 AOC for $5,000 expense
      const phaseOutPercentage = 0.5; // 50% of credit (halfway through phase-out)
      const reducedCredit = Math.round(fullCredit * phaseOutPercentage);
      
      expect(result.federalTax.educationCredits?.americanOpportunityCredit).toBe(reducedCredit);
      
      // Verify breakdown mentions phase-out
      expect(result.calculationBreakdown.some(line => line.includes('Phase-out'))).toBe(true);
    });
    
    it('should completely phase-out credits for very high income', async () => {
      const input: VITATaxInput = {
        filingStatus: 'single',
        taxYear: 2024,
        wages: 10000000, // $100,000 (above $90k threshold)
        otherIncome: 0,
        numberOfQualifyingChildren: 0,
        dependents: 0,
        qualifiedEducationExpenses: 500000,
        numberOfStudents: 1,
        marylandCounty: 'frederick',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      // Credits should be completely phased out
      expect(result.federalTax.educationCredits).toBeDefined();
      expect(result.federalTax.educationCredits?.americanOpportunityCredit).toBe(0);
      expect(result.federalTax.educationCredits?.totalEducationCredits).toBe(0);
      
      // Verify phase-out message
      expect(result.calculationBreakdown.some(line => line.includes('phased out'))).toBe(true);
    });
  });
  
  describe('Combined Scenarios', () => {
    it('should correctly calculate tax with both business income and education credits', async () => {
      const input: VITATaxInput = {
        filingStatus: 'head_of_household',
        taxYear: 2024,
        wages: 2500000, // $25,000 wages
        otherIncome: 0,
        selfEmploymentIncome: 2000000, // $20,000 business income
        businessExpenses: 800000, // $8,000 expenses
        numberOfQualifyingChildren: 2,
        dependents: 2,
        qualifiedEducationExpenses: 600000, // $6,000
        numberOfStudents: 2,
        marylandCounty: 'baltimore_county',
        marylandResidentMonths: 12,
      };
      
      const result = await vitaTaxRulesEngine.calculateTax(input);
      
      // Verify all components are calculated
      expect(result.federalTax.scheduleC).toBeDefined();
      expect(result.federalTax.selfEmploymentTax).toBeDefined();
      expect(result.federalTax.educationCredits).toBeDefined();
      
      // Net business profit
      expect(result.federalTax.scheduleC?.netProfit).toBe(1200000); // $12,000
      
      // SE tax should be calculated
      expect(result.federalTax.selfEmploymentTax?.seTax).toBeGreaterThan(0);
      
      // Education credits (2 students, $3,000 each)
      // Each student: $2,000 + 25% of $1,000 = $2,250
      // Total: $4,500
      expect(result.federalTax.educationCredits?.totalEducationCredits).toBe(450000);
      
      // Verify total credits includes EITC, CTC, and education
      expect(result.federalTax.totalCredits).toBeGreaterThan(0);
      
      // Verify breakdown is comprehensive
      expect(result.calculationBreakdown.some(line => line.includes('SCHEDULE C'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('SELF-EMPLOYMENT TAX'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('EDUCATION CREDITS'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('EITC'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('Child Tax Credit'))).toBe(true);
    });
  });
});
