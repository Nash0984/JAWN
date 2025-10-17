/**
 * Tax Year Configuration (2020-2024)
 * 
 * Historical tax data for prior year tax return preparation
 * VITA compliance requires support for current year + up to 3 prior years
 * 
 * Sources:
 * - IRS Revenue Procedures and Tax Tables
 * - Maryland Comptroller Historical Tax Tables
 * - PolicyEngine US tax parameter library
 */

export interface FederalTaxBracket {
  limit: number; // Upper limit of bracket (Infinity for highest)
  rate: number; // Tax rate as decimal
}

export interface StandardDeductions {
  single: number;
  married_joint: number;
  married_separate: number;
  head_of_household: number;
  qualifying_widow: number;
}

export interface ChildTaxCreditConfig {
  maxCreditPerChild: number;
  phaseoutThreshold: {
    single: number;
    married_joint: number;
    married_separate: number;
    head_of_household: number;
  };
  refundableLimit: number; // Additional Child Tax Credit limit
  // Age-based amounts (only for 2021 American Rescue Plan)
  ageBasedAmounts?: {
    under6: number; // Children under 6 years old
    ages6to17: number; // Children ages 6-17
  };
}

export interface EITCConfig {
  maxCredit: {
    noChildren: number;
    oneChild: number;
    twoChildren: number;
    threeOrMore: number;
  };
  phaseoutStart: {
    noChildren: { single: number; married: number };
    oneChild: { single: number; married: number };
    twoChildren: { single: number; married: number };
    threeOrMore: { single: number; married: number };
  };
}

export interface MarylandTaxBracket {
  limit: number;
  rate: number;
}

export interface TaxYearConfig {
  year: number;
  federal: {
    taxBrackets: {
      single: FederalTaxBracket[];
      married_joint: FederalTaxBracket[];
      married_separate: FederalTaxBracket[];
      head_of_household: FederalTaxBracket[];
    };
    standardDeductions: StandardDeductions;
    childTaxCredit: ChildTaxCreditConfig;
    eitc: EITCConfig;
  };
  maryland: {
    stateTaxBrackets: MarylandTaxBracket[];
    standardDeductions: StandardDeductions;
    eitcPercentage: number; // Percentage of federal EITC
    pensionSubtractionMax: number;
  };
}

/**
 * Federal Tax Brackets by Year and Filing Status
 */
const FEDERAL_TAX_BRACKETS: Record<number, TaxYearConfig['federal']['taxBrackets']> = {
  2024: {
    single: [
      { limit: 11600, rate: 0.10 },
      { limit: 47150, rate: 0.12 },
      { limit: 100525, rate: 0.22 },
      { limit: 191950, rate: 0.24 },
      { limit: 243725, rate: 0.32 },
      { limit: 609350, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_joint: [
      { limit: 23200, rate: 0.10 },
      { limit: 94300, rate: 0.12 },
      { limit: 201050, rate: 0.22 },
      { limit: 383900, rate: 0.24 },
      { limit: 487450, rate: 0.32 },
      { limit: 731200, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_separate: [
      { limit: 11600, rate: 0.10 },
      { limit: 47150, rate: 0.12 },
      { limit: 100525, rate: 0.22 },
      { limit: 191950, rate: 0.24 },
      { limit: 243725, rate: 0.32 },
      { limit: 365600, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    head_of_household: [
      { limit: 16550, rate: 0.10 },
      { limit: 63100, rate: 0.12 },
      { limit: 100500, rate: 0.22 },
      { limit: 191950, rate: 0.24 },
      { limit: 243700, rate: 0.32 },
      { limit: 609350, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  2023: {
    single: [
      { limit: 11000, rate: 0.10 },
      { limit: 44725, rate: 0.12 },
      { limit: 95375, rate: 0.22 },
      { limit: 182100, rate: 0.24 },
      { limit: 231250, rate: 0.32 },
      { limit: 578125, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_joint: [
      { limit: 22000, rate: 0.10 },
      { limit: 89075, rate: 0.12 },
      { limit: 190750, rate: 0.22 },
      { limit: 364200, rate: 0.24 },
      { limit: 462500, rate: 0.32 },
      { limit: 693750, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_separate: [
      { limit: 11000, rate: 0.10 },
      { limit: 44725, rate: 0.12 },
      { limit: 95375, rate: 0.22 },
      { limit: 182100, rate: 0.24 },
      { limit: 231250, rate: 0.32 },
      { limit: 346875, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    head_of_household: [
      { limit: 15700, rate: 0.10 },
      { limit: 59850, rate: 0.12 },
      { limit: 95350, rate: 0.22 },
      { limit: 182100, rate: 0.24 },
      { limit: 231250, rate: 0.32 },
      { limit: 578100, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  2022: {
    single: [
      { limit: 10275, rate: 0.10 },
      { limit: 41775, rate: 0.12 },
      { limit: 89075, rate: 0.22 },
      { limit: 170050, rate: 0.24 },
      { limit: 215950, rate: 0.32 },
      { limit: 539900, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_joint: [
      { limit: 20550, rate: 0.10 },
      { limit: 83550, rate: 0.12 },
      { limit: 178150, rate: 0.22 },
      { limit: 340100, rate: 0.24 },
      { limit: 431900, rate: 0.32 },
      { limit: 647850, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_separate: [
      { limit: 10275, rate: 0.10 },
      { limit: 41775, rate: 0.12 },
      { limit: 89075, rate: 0.22 },
      { limit: 170050, rate: 0.24 },
      { limit: 215950, rate: 0.32 },
      { limit: 323925, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    head_of_household: [
      { limit: 14650, rate: 0.10 },
      { limit: 55900, rate: 0.12 },
      { limit: 89050, rate: 0.22 },
      { limit: 170050, rate: 0.24 },
      { limit: 215950, rate: 0.32 },
      { limit: 539900, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  2021: {
    single: [
      { limit: 9950, rate: 0.10 },
      { limit: 40525, rate: 0.12 },
      { limit: 86375, rate: 0.22 },
      { limit: 164925, rate: 0.24 },
      { limit: 209425, rate: 0.32 },
      { limit: 523600, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_joint: [
      { limit: 19900, rate: 0.10 },
      { limit: 81050, rate: 0.12 },
      { limit: 172750, rate: 0.22 },
      { limit: 329850, rate: 0.24 },
      { limit: 418850, rate: 0.32 },
      { limit: 628300, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_separate: [
      { limit: 9950, rate: 0.10 },
      { limit: 40525, rate: 0.12 },
      { limit: 86375, rate: 0.22 },
      { limit: 164925, rate: 0.24 },
      { limit: 209425, rate: 0.32 },
      { limit: 314150, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    head_of_household: [
      { limit: 14200, rate: 0.10 },
      { limit: 54200, rate: 0.12 },
      { limit: 86350, rate: 0.22 },
      { limit: 164900, rate: 0.24 },
      { limit: 209400, rate: 0.32 },
      { limit: 523600, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  2020: {
    single: [
      { limit: 9875, rate: 0.10 },
      { limit: 40125, rate: 0.12 },
      { limit: 85525, rate: 0.22 },
      { limit: 163300, rate: 0.24 },
      { limit: 207350, rate: 0.32 },
      { limit: 518400, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_joint: [
      { limit: 19750, rate: 0.10 },
      { limit: 80250, rate: 0.12 },
      { limit: 171050, rate: 0.22 },
      { limit: 326600, rate: 0.24 },
      { limit: 414700, rate: 0.32 },
      { limit: 622050, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    married_separate: [
      { limit: 9875, rate: 0.10 },
      { limit: 40125, rate: 0.12 },
      { limit: 85525, rate: 0.22 },
      { limit: 163300, rate: 0.24 },
      { limit: 207350, rate: 0.32 },
      { limit: 311025, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ],
    head_of_household: [
      { limit: 14100, rate: 0.10 },
      { limit: 53700, rate: 0.12 },
      { limit: 85500, rate: 0.22 },
      { limit: 163300, rate: 0.24 },
      { limit: 207350, rate: 0.32 },
      { limit: 518400, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  }
};

/**
 * Federal Standard Deductions by Year
 */
const FEDERAL_STANDARD_DEDUCTIONS: Record<number, StandardDeductions> = {
  2024: {
    single: 14600,
    married_joint: 29200,
    married_separate: 14600,
    head_of_household: 21900,
    qualifying_widow: 29200
  },
  2023: {
    single: 13850,
    married_joint: 27700,
    married_separate: 13850,
    head_of_household: 20800,
    qualifying_widow: 27700
  },
  2022: {
    single: 12950,
    married_joint: 25900,
    married_separate: 12950,
    head_of_household: 19400,
    qualifying_widow: 25900
  },
  2021: {
    single: 12550,
    married_joint: 25100,
    married_separate: 12550,
    head_of_household: 18800,
    qualifying_widow: 25100
  },
  2020: {
    single: 12400,
    married_joint: 24800,
    married_separate: 12400,
    head_of_household: 18650,
    qualifying_widow: 24800
  }
};

/**
 * Child Tax Credit Configuration by Year
 */
const CHILD_TAX_CREDIT_CONFIG: Record<number, ChildTaxCreditConfig> = {
  2024: {
    maxCreditPerChild: 2000,
    phaseoutThreshold: {
      single: 200000,
      married_joint: 400000,
      married_separate: 200000,
      head_of_household: 200000
    },
    refundableLimit: 1700
  },
  2023: {
    maxCreditPerChild: 2000,
    phaseoutThreshold: {
      single: 200000,
      married_joint: 400000,
      married_separate: 200000,
      head_of_household: 200000
    },
    refundableLimit: 1600
  },
  2022: {
    maxCreditPerChild: 2000,
    phaseoutThreshold: {
      single: 200000,
      married_joint: 400000,
      married_separate: 200000,
      head_of_household: 200000
    },
    refundableLimit: 1500
  },
  2021: {
    maxCreditPerChild: 3600, // Default for children under 6 (American Rescue Plan)
    phaseoutThreshold: {
      single: 75000,
      married_joint: 150000,
      married_separate: 75000,
      head_of_household: 112500
    },
    refundableLimit: 3600, // Fully refundable in 2021
    // 2021 American Rescue Plan: Age-based CTC amounts
    ageBasedAmounts: {
      under6: 3600,      // $3,600 for children under 6
      ages6to17: 3000    // $3,000 for children ages 6-17
    }
  },
  2020: {
    maxCreditPerChild: 2000,
    phaseoutThreshold: {
      single: 200000,
      married_joint: 400000,
      married_separate: 200000,
      head_of_household: 200000
    },
    refundableLimit: 1400
  }
};

/**
 * EITC Configuration by Year
 */
const EITC_CONFIG: Record<number, EITCConfig> = {
  2024: {
    maxCredit: {
      noChildren: 632,
      oneChild: 4213,
      twoChildren: 6960,
      threeOrMore: 7830
    },
    phaseoutStart: {
      noChildren: { single: 9800, married: 16760 },
      oneChild: { single: 12060, married: 19210 },
      twoChildren: { single: 12060, married: 19210 },
      threeOrMore: { single: 12060, married: 19210 }
    }
  },
  2023: {
    maxCredit: {
      noChildren: 600,
      oneChild: 3995,
      twoChildren: 6604,
      threeOrMore: 7430
    },
    phaseoutStart: {
      noChildren: { single: 9800, married: 16370 },
      oneChild: { single: 11750, married: 18110 },
      twoChildren: { single: 11750, married: 18110 },
      threeOrMore: { single: 11750, married: 18110 }
    }
  },
  2022: {
    maxCredit: {
      noChildren: 560,
      oneChild: 3733,
      twoChildren: 6164,
      threeOrMore: 6935
    },
    phaseoutStart: {
      noChildren: { single: 9160, married: 15290 },
      oneChild: { single: 10980, married: 17330 },
      twoChildren: { single: 10980, married: 17330 },
      threeOrMore: { single: 10980, married: 17330 }
    }
  },
  2021: {
    maxCredit: {
      noChildren: 1502, // Enhanced under American Rescue Plan
      oneChild: 3618,
      twoChildren: 5980,
      threeOrMore: 6728
    },
    phaseoutStart: {
      noChildren: { single: 11610, married: 17550 },
      oneChild: { single: 10640, married: 16450 },
      twoChildren: { single: 10640, married: 16450 },
      threeOrMore: { single: 10640, married: 16450 }
    }
  },
  2020: {
    maxCredit: {
      noChildren: 538,
      oneChild: 3584,
      twoChildren: 5920,
      threeOrMore: 6660
    },
    phaseoutStart: {
      noChildren: { single: 8790, married: 14680 },
      oneChild: { single: 10540, married: 16370 },
      twoChildren: { single: 10540, married: 16370 },
      threeOrMore: { single: 10540, married: 16370 }
    }
  }
};

/**
 * Maryland State Tax Brackets (same for all years 2020-2024)
 */
const MARYLAND_STATE_TAX_BRACKETS: MarylandTaxBracket[] = [
  { limit: 1000, rate: 0.02 },
  { limit: 2000, rate: 0.03 },
  { limit: 3000, rate: 0.04 },
  { limit: 100000, rate: 0.0475 },
  { limit: 125000, rate: 0.05 },
  { limit: 150000, rate: 0.0525 },
  { limit: 250000, rate: 0.055 },
  { limit: Infinity, rate: 0.0575 }
];

/**
 * Maryland Standard Deductions by Year
 */
const MARYLAND_STANDARD_DEDUCTIONS: Record<number, StandardDeductions> = {
  2024: { single: 2350, married_joint: 4700, married_separate: 2350, head_of_household: 2350, qualifying_widow: 4700 },
  2023: { single: 2350, married_joint: 4700, married_separate: 2350, head_of_household: 2350, qualifying_widow: 4700 },
  2022: { single: 2350, married_joint: 4700, married_separate: 2350, head_of_household: 2350, qualifying_widow: 4700 },
  2021: { single: 2300, married_joint: 4600, married_separate: 2300, head_of_household: 2300, qualifying_widow: 4600 },
  2020: { single: 2300, married_joint: 4600, married_separate: 2300, head_of_household: 2300, qualifying_widow: 4600 }
};

/**
 * Complete Tax Year Configurations
 */
export const TAX_YEAR_CONFIGS: Record<number, TaxYearConfig> = {
  2024: {
    year: 2024,
    federal: {
      taxBrackets: FEDERAL_TAX_BRACKETS[2024],
      standardDeductions: FEDERAL_STANDARD_DEDUCTIONS[2024],
      childTaxCredit: CHILD_TAX_CREDIT_CONFIG[2024],
      eitc: EITC_CONFIG[2024]
    },
    maryland: {
      stateTaxBrackets: MARYLAND_STATE_TAX_BRACKETS,
      standardDeductions: MARYLAND_STANDARD_DEDUCTIONS[2024],
      eitcPercentage: 0.50, // 50% of federal EITC
      pensionSubtractionMax: 37100
    }
  },
  2023: {
    year: 2023,
    federal: {
      taxBrackets: FEDERAL_TAX_BRACKETS[2023],
      standardDeductions: FEDERAL_STANDARD_DEDUCTIONS[2023],
      childTaxCredit: CHILD_TAX_CREDIT_CONFIG[2023],
      eitc: EITC_CONFIG[2023]
    },
    maryland: {
      stateTaxBrackets: MARYLAND_STATE_TAX_BRACKETS,
      standardDeductions: MARYLAND_STANDARD_DEDUCTIONS[2023],
      eitcPercentage: 0.50,
      pensionSubtractionMax: 35700
    }
  },
  2022: {
    year: 2022,
    federal: {
      taxBrackets: FEDERAL_TAX_BRACKETS[2022],
      standardDeductions: FEDERAL_STANDARD_DEDUCTIONS[2022],
      childTaxCredit: CHILD_TAX_CREDIT_CONFIG[2022],
      eitc: EITC_CONFIG[2022]
    },
    maryland: {
      stateTaxBrackets: MARYLAND_STATE_TAX_BRACKETS,
      standardDeductions: MARYLAND_STANDARD_DEDUCTIONS[2022],
      eitcPercentage: 0.50,
      pensionSubtractionMax: 34300
    }
  },
  2021: {
    year: 2021,
    federal: {
      taxBrackets: FEDERAL_TAX_BRACKETS[2021],
      standardDeductions: FEDERAL_STANDARD_DEDUCTIONS[2021],
      childTaxCredit: CHILD_TAX_CREDIT_CONFIG[2021],
      eitc: EITC_CONFIG[2021]
    },
    maryland: {
      stateTaxBrackets: MARYLAND_STATE_TAX_BRACKETS,
      standardDeductions: MARYLAND_STANDARD_DEDUCTIONS[2021],
      eitcPercentage: 0.50, // Increased to 100% temporarily for 2021, but reverting to 50% standard
      pensionSubtractionMax: 33100
    }
  },
  2020: {
    year: 2020,
    federal: {
      taxBrackets: FEDERAL_TAX_BRACKETS[2020],
      standardDeductions: FEDERAL_STANDARD_DEDUCTIONS[2020],
      childTaxCredit: CHILD_TAX_CREDIT_CONFIG[2020],
      eitc: EITC_CONFIG[2020]
    },
    maryland: {
      stateTaxBrackets: MARYLAND_STATE_TAX_BRACKETS,
      standardDeductions: MARYLAND_STANDARD_DEDUCTIONS[2020],
      eitcPercentage: 0.50,
      pensionSubtractionMax: 32000
    }
  }
};

/**
 * Get tax configuration for a specific year
 */
export function getTaxYearConfig(year: number): TaxYearConfig {
  if (!TAX_YEAR_CONFIGS[year]) {
    throw new Error(`Tax year ${year} not supported. Supported years: 2020-2024`);
  }
  return TAX_YEAR_CONFIGS[year];
}

/**
 * Get supported tax years
 */
export function getSupportedTaxYears(): number[] {
  return Object.keys(TAX_YEAR_CONFIGS).map(Number).sort((a, b) => b - a);
}

/**
 * Validate tax year is supported
 */
export function isTaxYearSupported(year: number): boolean {
  return year in TAX_YEAR_CONFIGS;
}
