import { describe, it, expect } from 'vitest';
import { getTaxYearConfig, getSupportedTaxYears, isTaxYearSupported } from '../../server/services/taxYearConfig';

describe('Tax Year Configuration', () => {
  describe('getSupportedTaxYears', () => {
    it('should return all supported tax years in descending order', () => {
      const years = getSupportedTaxYears();
      expect(years).toEqual([2024, 2023, 2022, 2021, 2020]);
    });
  });

  describe('isTaxYearSupported', () => {
    it('should return true for supported years', () => {
      expect(isTaxYearSupported(2024)).toBe(true);
      expect(isTaxYearSupported(2023)).toBe(true);
      expect(isTaxYearSupported(2022)).toBe(true);
      expect(isTaxYearSupported(2021)).toBe(true);
      expect(isTaxYearSupported(2020)).toBe(true);
    });

    it('should return false for unsupported years', () => {
      expect(isTaxYearSupported(2025)).toBe(false);
      expect(isTaxYearSupported(2019)).toBe(false);
      expect(isTaxYearSupported(2015)).toBe(false);
    });
  });

  describe('getTaxYearConfig', () => {
    it('should throw error for unsupported years', () => {
      expect(() => getTaxYearConfig(2019)).toThrow('Tax year 2019 not supported');
      expect(() => getTaxYearConfig(2025)).toThrow('Tax year 2025 not supported');
    });

    describe('2024 Federal Configuration', () => {
      const config = getTaxYearConfig(2024);

      it('should have correct standard deductions', () => {
        expect(config.federal.standardDeductions.single).toBe(14600);
        expect(config.federal.standardDeductions.married_joint).toBe(29200);
        expect(config.federal.standardDeductions.head_of_household).toBe(21900);
      });

      it('should have correct Child Tax Credit configuration', () => {
        expect(config.federal.childTaxCredit.maxCreditPerChild).toBe(2000);
        expect(config.federal.childTaxCredit.refundableLimit).toBe(1700);
        expect(config.federal.childTaxCredit.phaseoutThreshold.single).toBe(200000);
        expect(config.federal.childTaxCredit.phaseoutThreshold.married_joint).toBe(400000);
      });

      it('should have correct EITC maximums', () => {
        expect(config.federal.eitc.maxCredit.noChildren).toBe(632);
        expect(config.federal.eitc.maxCredit.oneChild).toBe(4213);
        expect(config.federal.eitc.maxCredit.twoChildren).toBe(6960);
        expect(config.federal.eitc.maxCredit.threeOrMore).toBe(7830);
      });

      it('should have correct single filer tax brackets', () => {
        const singleBrackets = config.federal.taxBrackets.single;
        expect(singleBrackets[0]).toEqual({ limit: 11600, rate: 0.10 });
        expect(singleBrackets[1]).toEqual({ limit: 47150, rate: 0.12 });
        expect(singleBrackets[6]).toEqual({ limit: Infinity, rate: 0.37 });
      });
    });

    describe('2021 Federal Configuration (Enhanced Credits)', () => {
      const config = getTaxYearConfig(2021);

      it('should have enhanced Child Tax Credit (American Rescue Plan)', () => {
        expect(config.federal.childTaxCredit.maxCreditPerChild).toBe(3600);
        expect(config.federal.childTaxCredit.refundableLimit).toBe(3600); // Fully refundable
        expect(config.federal.childTaxCredit.phaseoutThreshold.single).toBe(75000); // Lower threshold
      });

      it('should have age-based CTC amounts (2021 American Rescue Plan)', () => {
        expect(config.federal.childTaxCredit.ageBasedAmounts).toBeDefined();
        expect(config.federal.childTaxCredit.ageBasedAmounts?.under6).toBe(3600); // $3,600 for children under 6
        expect(config.federal.childTaxCredit.ageBasedAmounts?.ages6to17).toBe(3000); // $3,000 for children ages 6-17
      });

      it('should NOT have age-based amounts in other years', () => {
        const config2024 = getTaxYearConfig(2024);
        const config2022 = getTaxYearConfig(2022);
        const config2020 = getTaxYearConfig(2020);
        
        expect(config2024.federal.childTaxCredit.ageBasedAmounts).toBeUndefined();
        expect(config2022.federal.childTaxCredit.ageBasedAmounts).toBeUndefined();
        expect(config2020.federal.childTaxCredit.ageBasedAmounts).toBeUndefined();
      });

      it('should have enhanced EITC for childless workers', () => {
        expect(config.federal.eitc.maxCredit.noChildren).toBe(1502); // Nearly tripled from normal
      });

      it('should have correct standard deductions', () => {
        expect(config.federal.standardDeductions.single).toBe(12550);
        expect(config.federal.standardDeductions.married_joint).toBe(25100);
      });
    });

    describe('2020 Federal Configuration', () => {
      const config = getTaxYearConfig(2020);

      it('should have correct standard deductions', () => {
        expect(config.federal.standardDeductions.single).toBe(12400);
        expect(config.federal.standardDeductions.married_joint).toBe(24800);
      });

      it('should have correct Child Tax Credit', () => {
        expect(config.federal.childTaxCredit.maxCreditPerChild).toBe(2000);
        expect(config.federal.childTaxCredit.refundableLimit).toBe(1400);
      });

      it('should have correct tax brackets for single filers', () => {
        const singleBrackets = config.federal.taxBrackets.single;
        expect(singleBrackets[0]).toEqual({ limit: 9875, rate: 0.10 });
        expect(singleBrackets[1]).toEqual({ limit: 40125, rate: 0.12 });
      });
    });

    describe('Maryland Configuration', () => {
      it('should have consistent state tax brackets across years', () => {
        const config2024 = getTaxYearConfig(2024);
        const config2020 = getTaxYearConfig(2020);
        
        expect(config2024.maryland.stateTaxBrackets).toEqual(config2020.maryland.stateTaxBrackets);
      });

      it('should have correct Maryland standard deductions', () => {
        const config2024 = getTaxYearConfig(2024);
        expect(config2024.maryland.standardDeductions.single).toBe(2350);
        expect(config2024.maryland.standardDeductions.married_joint).toBe(4700);

        const config2020 = getTaxYearConfig(2020);
        expect(config2020.maryland.standardDeductions.single).toBe(2300);
        expect(config2020.maryland.standardDeductions.married_joint).toBe(4600);
      });

      it('should have correct Maryland EITC percentage', () => {
        const config2024 = getTaxYearConfig(2024);
        expect(config2024.maryland.eitcPercentage).toBe(0.50); // 50% of federal

        const config2020 = getTaxYearConfig(2020);
        expect(config2020.maryland.eitcPercentage).toBe(0.50);
      });

      it('should have correct pension subtraction limits by year', () => {
        expect(getTaxYearConfig(2024).maryland.pensionSubtractionMax).toBe(37100);
        expect(getTaxYearConfig(2023).maryland.pensionSubtractionMax).toBe(35700);
        expect(getTaxYearConfig(2022).maryland.pensionSubtractionMax).toBe(34300);
        expect(getTaxYearConfig(2021).maryland.pensionSubtractionMax).toBe(33100);
        expect(getTaxYearConfig(2020).maryland.pensionSubtractionMax).toBe(32000);
      });
    });

    describe('Historical Accuracy Verification', () => {
      it('2023: should reflect inflation-adjusted values', () => {
        const config = getTaxYearConfig(2023);
        expect(config.federal.standardDeductions.single).toBe(13850);
        expect(config.federal.eitc.maxCredit.threeOrMore).toBe(7430);
      });

      it('2022: should have post-pandemic tax parameters', () => {
        const config = getTaxYearConfig(2022);
        expect(config.federal.standardDeductions.single).toBe(12950);
        expect(config.federal.childTaxCredit.maxCreditPerChild).toBe(2000); // Back to normal after 2021
      });
    });
  });
});
