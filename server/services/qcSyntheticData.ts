import { nanoid } from "nanoid";
import type { 
  InsertQcErrorPattern, 
  InsertFlaggedCase, 
  InsertJobAid, 
  InsertTrainingIntervention 
} from "@shared/schema";

/**
 * Maryland SNAP QC Error Categories
 * Based on actual Maryland SNAP QC error categories
 */
const ERROR_CATEGORIES = {
  shelter_utility: {
    subtypes: [
      { code: "incorrect_sua_calculation", description: "Standard Utility Allowance (SUA) calculated incorrectly" },
      { code: "missing_utility_verification", description: "Failed to verify utility expenses" },
      { code: "incorrect_shelter_deduction", description: "Shelter deduction calculation error" },
      { code: "heating_cooling_sua_error", description: "Heating/Cooling SUA incorrectly applied" },
    ],
  },
  income_verification: {
    subtypes: [
      { code: "missing_income_doc", description: "Required income documentation not obtained" },
      { code: "income_calculation_error", description: "Income incorrectly calculated or converted" },
      { code: "self_employment_error", description: "Self-employment income calculation error" },
      { code: "wage_stub_verification", description: "Wage stub verification incomplete or incorrect" },
    ],
  },
  asset_verification: {
    subtypes: [
      { code: "bank_account_verification", description: "Bank account not properly verified" },
      { code: "vehicle_asset_error", description: "Vehicle asset calculation error" },
      { code: "liquid_asset_calculation", description: "Liquid assets incorrectly calculated" },
    ],
  },
  categorical_eligibility: {
    subtypes: [
      { code: "bbce_incorrectly_applied", description: "Broad-Based Categorical Eligibility (BBCE) incorrectly applied" },
      { code: "tanf_verification_missing", description: "TANF participation not verified" },
      { code: "ssi_verification_error", description: "SSI verification error" },
    ],
  },
  earned_income: {
    subtypes: [
      { code: "wages_not_counted", description: "Wages not properly counted in benefit calculation" },
      { code: "tips_unreported", description: "Tip income not reported or verified" },
      { code: "self_employment_calculation_error", description: "Self-employment income calculation error" },
    ],
  },
  unearned_income: {
    subtypes: [
      { code: "ssi_verification_missing", description: "SSI verification missing or incomplete" },
      { code: "unemployment_not_reported", description: "Unemployment benefits not reported" },
      { code: "pension_excluded_error", description: "Pension income incorrectly excluded" },
    ],
  },
};

/**
 * Generate QC Error Patterns with realistic trends
 * Includes the signature "Shelter & Utility 500% spike in Q4 2024" example
 */
export function generateQCErrorPatterns(): InsertQcErrorPattern[] {
  const patterns: InsertQcErrorPattern[] = [];
  const quarters = ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"];

  // Shelter & Utility - Show dramatic spike in Q4 2024 (500% increase)
  const shelterBaselineQ1 = 12;
  const shelterTotalCases = 1000;
  
  patterns.push({
    errorCategory: "shelter_utility",
    errorSubtype: "incorrect_sua_calculation",
    errorDescription: "Standard Utility Allowance (SUA) calculated incorrectly",
    quarterOccurred: "2024-Q1",
    errorCount: shelterBaselineQ1,
    totalCases: shelterTotalCases,
    errorRate: (shelterBaselineQ1 / shelterTotalCases) * 100,
    trendDirection: "stable",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "shelter_utility",
    errorSubtype: "incorrect_sua_calculation",
    errorDescription: "Standard Utility Allowance (SUA) calculated incorrectly",
    quarterOccurred: "2024-Q2",
    errorCount: 15,
    totalCases: shelterTotalCases,
    errorRate: (15 / shelterTotalCases) * 100,
    trendDirection: "increasing",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "shelter_utility",
    errorSubtype: "incorrect_sua_calculation",
    errorDescription: "Standard Utility Allowance (SUA) calculated incorrectly",
    quarterOccurred: "2024-Q3",
    errorCount: 28,
    totalCases: shelterTotalCases,
    errorRate: (28 / shelterTotalCases) * 100,
    trendDirection: "increasing",
    severity: "high",
  });

  // Q4 2024: 500% spike (60 errors vs baseline of 12)
  patterns.push({
    errorCategory: "shelter_utility",
    errorSubtype: "incorrect_sua_calculation",
    errorDescription: "Standard Utility Allowance (SUA) calculated incorrectly - CRITICAL SPIKE",
    quarterOccurred: "2024-Q4",
    errorCount: 60,
    totalCases: shelterTotalCases,
    errorRate: (60 / shelterTotalCases) * 100,
    trendDirection: "increasing",
    severity: "critical",
  });

  // Heating/Cooling SUA errors also spiking
  patterns.push({
    errorCategory: "shelter_utility",
    errorSubtype: "heating_cooling_sua_error",
    errorDescription: "Heating/Cooling SUA incorrectly applied",
    quarterOccurred: "2024-Q4",
    errorCount: 42,
    totalCases: shelterTotalCases,
    errorRate: (42 / shelterTotalCases) * 100,
    trendDirection: "increasing",
    severity: "critical",
  });

  // Income Verification - Showing improvement after training
  const incomeQ1 = 45;
  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "missing_income_doc",
    errorDescription: "Required income documentation not obtained",
    quarterOccurred: "2024-Q1",
    errorCount: incomeQ1,
    totalCases: 1200,
    errorRate: (incomeQ1 / 1200) * 100,
    trendDirection: "stable",
    severity: "high",
  });

  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "missing_income_doc",
    errorDescription: "Required income documentation not obtained",
    quarterOccurred: "2024-Q2",
    errorCount: 38,
    totalCases: 1200,
    errorRate: (38 / 1200) * 100,
    trendDirection: "decreasing",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "missing_income_doc",
    errorDescription: "Required income documentation not obtained",
    quarterOccurred: "2024-Q3",
    errorCount: 22,
    totalCases: 1200,
    errorRate: (22 / 1200) * 100,
    trendDirection: "decreasing",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "missing_income_doc",
    errorDescription: "Required income documentation not obtained - Post Training",
    quarterOccurred: "2024-Q4",
    errorCount: 18,
    totalCases: 1200,
    errorRate: (18 / 1200) * 100,
    trendDirection: "decreasing",
    severity: "low",
  });

  // Asset Verification - Moderate stable errors
  patterns.push({
    errorCategory: "asset_verification",
    errorSubtype: "bank_account_verification",
    errorDescription: "Bank account not properly verified",
    quarterOccurred: "2024-Q3",
    errorCount: 25,
    totalCases: 800,
    errorRate: (25 / 800) * 100,
    trendDirection: "stable",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "asset_verification",
    errorSubtype: "bank_account_verification",
    errorDescription: "Bank account not properly verified",
    quarterOccurred: "2024-Q4",
    errorCount: 26,
    totalCases: 800,
    errorRate: (26 / 800) * 100,
    trendDirection: "stable",
    severity: "medium",
  });

  // Categorical Eligibility - Low frequency but high severity
  patterns.push({
    errorCategory: "categorical_eligibility",
    errorSubtype: "bbce_incorrectly_applied",
    errorDescription: "Broad-Based Categorical Eligibility (BBCE) incorrectly applied",
    quarterOccurred: "2024-Q2",
    errorCount: 8,
    totalCases: 600,
    errorRate: (8 / 600) * 100,
    trendDirection: "stable",
    severity: "high",
  });

  patterns.push({
    errorCategory: "categorical_eligibility",
    errorSubtype: "bbce_incorrectly_applied",
    errorDescription: "Broad-Based Categorical Eligibility (BBCE) incorrectly applied",
    quarterOccurred: "2024-Q3",
    errorCount: 7,
    totalCases: 600,
    errorRate: (7 / 600) * 100,
    trendDirection: "stable",
    severity: "high",
  });

  // Earned Income errors
  patterns.push({
    errorCategory: "earned_income",
    errorSubtype: "wages_not_counted",
    errorDescription: "Wages not properly counted in benefit calculation",
    quarterOccurred: "2024-Q1",
    errorCount: 32,
    totalCases: 1100,
    errorRate: (32 / 1100) * 100,
    trendDirection: "stable",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "earned_income",
    errorSubtype: "tips_unreported",
    errorDescription: "Tip income not reported or verified",
    quarterOccurred: "2024-Q4",
    errorCount: 28,
    totalCases: 1100,
    errorRate: (28 / 1100) * 100,
    trendDirection: "decreasing",
    severity: "medium",
  });

  // Unearned Income errors
  patterns.push({
    errorCategory: "unearned_income",
    errorSubtype: "ssi_verification_missing",
    errorDescription: "SSI verification missing or incomplete",
    quarterOccurred: "2024-Q2",
    errorCount: 18,
    totalCases: 900,
    errorRate: (18 / 900) * 100,
    trendDirection: "stable",
    severity: "high",
  });

  patterns.push({
    errorCategory: "unearned_income",
    errorSubtype: "unemployment_not_reported",
    errorDescription: "Unemployment benefits not reported",
    quarterOccurred: "2024-Q3",
    errorCount: 22,
    totalCases: 900,
    errorRate: (22 / 900) * 100,
    trendDirection: "increasing",
    severity: "high",
  });

  // Self-employment income errors increasing
  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "self_employment_error",
    errorDescription: "Self-employment income calculation error",
    quarterOccurred: "2024-Q2",
    errorCount: 15,
    totalCases: 500,
    errorRate: (15 / 500) * 100,
    trendDirection: "increasing",
    severity: "medium",
  });

  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "self_employment_error",
    errorDescription: "Self-employment income calculation error",
    quarterOccurred: "2024-Q3",
    errorCount: 22,
    totalCases: 500,
    errorRate: (22 / 500) * 100,
    trendDirection: "increasing",
    severity: "high",
  });

  patterns.push({
    errorCategory: "income_verification",
    errorSubtype: "self_employment_error",
    errorDescription: "Self-employment income calculation error",
    quarterOccurred: "2024-Q4",
    errorCount: 31,
    totalCases: 500,
    errorRate: (31 / 500) * 100,
    trendDirection: "increasing",
    severity: "high",
  });

  // Vehicle asset errors
  patterns.push({
    errorCategory: "asset_verification",
    errorSubtype: "vehicle_asset_error",
    errorDescription: "Vehicle asset calculation error",
    quarterOccurred: "2024-Q3",
    errorCount: 12,
    totalCases: 700,
    errorRate: (12 / 700) * 100,
    trendDirection: "stable",
    severity: "low",
  });

  patterns.push({
    errorCategory: "asset_verification",
    errorSubtype: "vehicle_asset_error",
    errorDescription: "Vehicle asset calculation error",
    quarterOccurred: "2024-Q4",
    errorCount: 14,
    totalCases: 700,
    errorRate: (14 / 700) * 100,
    trendDirection: "stable",
    severity: "low",
  });

  return patterns;
}

/**
 * Generate Flagged Cases for a caseworker
 * Creates 5-10 high-risk cases with realistic risk scores
 */
export function generateFlaggedCases(caseworkerId: string, count: number = 10): InsertFlaggedCase[] {
  const flaggedCases: InsertFlaggedCase[] = [];
  const errorTypeOptions = [
    ["shelter_utility", "income_verification"],
    ["asset_verification", "categorical_eligibility"],
    ["shelter_utility"],
    ["income_verification", "earned_income"],
    ["shelter_utility", "asset_verification"],
    ["categorical_eligibility"],
    ["unearned_income"],
    ["earned_income", "unearned_income"],
  ];

  for (let i = 0; i < count; i++) {
    const caseNumber = 10000 + Math.floor(Math.random() * 90000);
    const riskScore = 0.7 + Math.random() * 0.25; // 0.7 to 0.95
    const riskLevel = riskScore >= 0.85 ? "high" : riskScore >= 0.75 ? "medium" : "low";
    const flaggedErrorTypes = errorTypeOptions[Math.floor(Math.random() * errorTypeOptions.length)];

    flaggedCases.push({
      caseId: `MD-SNAP-${caseNumber}`,
      clientName: `Case #${caseNumber}`,
      assignedCaseworkerId: caseworkerId,
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel,
      flaggedErrorTypes,
      reviewStatus: "pending",
    });
  }

  return flaggedCases;
}

/**
 * Generate Job Aids - Training materials for caseworkers
 */
export function generateJobAids(): InsertJobAid[] {
  return [
    {
      title: "How to Calculate Summer Cooling Standard Utility Allowance (SUA)",
      category: "shelter_utility",
      content: `# Summer Cooling SUA Calculation Guide

## When to Apply Summer Cooling SUA

The Summer Cooling SUA applies from **June 1 through September 30** for households that:

1. Have cooling costs (air conditioning or fans)
2. Pay for electricity or have an arrangement to pay utilities
3. Meet the heating/cooling criteria in 7 CFR 273.9(d)(6)

## Current Maryland Rates (FY 2025)

- **Heating/Cooling SUA**: $412/month
- **Non-Heating/Cooling SUA**: $189/month

## Step-by-Step Process

### Step 1: Verify Utility Responsibility
- Check lease or rental agreement
- Confirm household pays for electricity/cooling
- Document verification in case file

### Step 2: Determine SUA Type
- If household has cooling costs → **Heating/Cooling SUA ($412)**
- If household has utilities but no cooling → **Non-Heating/Cooling SUA ($189)**

### Step 3: Calculate Excess Shelter Deduction
1. Add actual rent + applicable SUA
2. Subtract 50% of net income
3. If result > 0, apply excess shelter deduction (capped at $672 for non-elderly/disabled)

## Common Errors to Avoid

❌ **Incorrect**: Applying heating SUA in summer months
✅ **Correct**: Apply cooling SUA June-September if household has cooling costs

❌ **Incorrect**: Using old SUA rates from previous fiscal year
✅ **Correct**: Always verify current FY rates in policy manual Section 416

## Policy References
- 7 CFR 273.9(d)(6)(iii) - Standard Utility Allowances
- Maryland SNAP Manual Section 416 - Shelter Deduction
- Maryland Register Vol. 52, Issue 15 (July 2024) - Annual SUA Update`,
      policyReference: "7 CFR 273.9(d)(6)",
    },
    {
      title: "Income Verification Checklist - Self-Employment",
      category: "income_verification",
      content: `# Self-Employment Income Verification Guide

## Required Documentation

### For New Self-Employment Business (< 1 year)
- [ ] Business license or registration
- [ ] Recent income records (at least 30 days)
- [ ] Business expense receipts
- [ ] IRS Schedule C (if available)
- [ ] Client statement of anticipated income

### For Established Business (> 1 year)
- [ ] Previous year's tax return (Form 1040 with Schedule C)
- [ ] Current year income/expense records
- [ ] Quarterly estimated tax payments (Form 1040-ES)
- [ ] Business bank statements (last 3 months)

## Income Calculation Method

### Annualized Method (Preferred for Established Business)
1. Take prior year Schedule C net profit/loss
2. Divide by 12 to get monthly amount
3. Adjust for known changes (document in case notes)

### Prospective Method (For New Business)
1. Average income from available months
2. Subtract allowable business expenses
3. Project forward based on business plan

## Allowable Business Expenses

✅ **Allowed**:
- Cost of goods sold
- Supplies and materials
- Business-use vehicle expenses (documented)
- Business license fees
- Professional services
- Advertising

❌ **Not Allowed**:
- Personal vehicle expenses
- Home office deduction (if not separate structure)
- Depreciation
- Capital expenses

## Red Flags Requiring Supervisor Review

- Income fluctuates >50% month-to-month
- Expenses exceed 90% of gross receipts
- Cash business with minimal documentation
- Schedule C shows loss but household has assets

## Policy References
- 7 CFR 273.11(a) - Self-Employment Income
- Maryland SNAP Manual Section 310.4 - Self-Employment
- MPP-SNAP-2023-08 - Self-Employment Verification Requirements`,
      policyReference: "7 CFR 273.11(a)",
    },
    {
      title: "Asset Verification - Bank Account Requirements",
      category: "asset_verification",
      content: `# Bank Account Verification Guide

## When Asset Verification is Required

Asset verification is **mandatory** when:
- Household reports liquid assets
- Household size is 1-2 and assets may exceed $3,000
- Household has elderly/disabled member and assets may exceed $4,500
- BBCE does NOT apply (or uncertain)

## Acceptable Verification Documents

### Bank Statements
- Must show current balance
- Must be dated within 30 days of application/recertification
- Must include account holder name and account number
- Online printouts acceptable if show bank logo and account details

### Alternative Documents (if bank statement unavailable)
- Passbook showing recent entries
- Letter from bank on letterhead
- Online banking screenshot with URL visible

## Verification Process

### Step 1: Request All Accounts
Ask: "Do you or anyone in your household have any:"
- Checking accounts?
- Savings accounts?
- Money market accounts?
- Credit union accounts?
- Prepaid debit cards with balances?

### Step 2: Document Responses
- List each account reported
- Note verification provided
- Document any accounts closed (get closure date)

### Step 3: Calculate Total Countable Assets
- Add all liquid assets
- Exclude:
  - One vehicle per household (or all if under resource limit)
  - Home and lot
  - Retirement accounts (401k, IRA while actively contributing)
  - ABLE accounts

### Step 4: Determine Resource Limit
- Standard: $2,750
- Elderly/Disabled: $4,250
- BBCE households: Resource test waived

## Common Errors

❌ Counting jointly-held accounts twice
❌ Counting exempt retirement accounts
❌ Using outdated bank statements
❌ Failing to verify all accounts mentioned

## Policy References
- 7 CFR 273.8 - Resource Eligibility Standards
- Maryland SNAP Manual Section 325 - Resources
- SNAP-PL-2023-003 - Exempt Resources`,
      policyReference: "7 CFR 273.8",
    },
    {
      title: "Broad-Based Categorical Eligibility (BBCE) Verification",
      category: "categorical_eligibility",
      content: `# BBCE Verification Quick Reference

## What is BBCE?

Maryland's Broad-Based Categorical Eligibility allows households to bypass:
- Gross income test (200% FPL limit applies instead of 130%)
- Asset/resource test (no limit)

## Who Qualifies for BBCE?

Households receiving or eligible for:
1. TANF (cash assistance or services)
2. SSI (recipient or authorized representative)
3. General Assistance
4. Maryland Energy Assistance Program (MEAP)
5. Other qualifying benefits/services

## Verification Requirements

### TANF/SSI/GA Recipients
- System data match (primary verification)
- Award letter (if system unavailable)
- Client statement (with supervisor approval)

### MEAP Recipients
- MEAP approval notice
- DHR/OCA system verification

### Service-Based BBCE
- Service plan documentation
- Case manager verification
- Program enrollment confirmation

## Common BBCE Errors

### Error 1: Assuming BBCE Without Verification
❌ **Wrong**: "Client says they get energy assistance, so BBCE applies"
✅ **Right**: Verify MEAP enrollment through system or documentation

### Error 2: Applying Wrong Income Limit
❌ **Wrong**: Using 130% FPL for BBCE household
✅ **Right**: BBCE households use 200% FPL gross income limit

### Error 3: Miscounting BBCE Household Size
❌ **Wrong**: Including ineligible household members in BBCE determination
✅ **Right**: BBCE based on SNAP household composition, not benefit household

## Processing Steps

1. Check for categorical eligibility indicators in system
2. Verify qualifying program participation
3. Document BBCE determination in case notes
4. Apply 200% FPL gross income limit
5. Waive resource test

## When BBCE Does NOT Apply

- Household receives only SNAP benefits
- Former TANF/SSI recipient (no longer receiving)
- Application pending for qualifying program
- Household member is ineligible immigrant

## Policy References
- 7 CFR 273.2(j)(2) - Categorical Eligibility
- Maryland SNAP Manual Section 210 - Categorical Eligibility
- COMAR 07.03.03.05 - Maryland BBCE Policy`,
      policyReference: "7 CFR 273.2(j)(2)",
    },
    {
      title: "Earned Income Verification and Calculation",
      category: "earned_income",
      content: `# Earned Income Verification Guide

## What is Earned Income?

Earned income includes wages and salaries from employment:
- Regular wages/salaries
- Tips and gratuities
- Self-employment income
- On-the-job training wages
- Commissions and bonuses

## Verification Requirements

### Regular Wages/Salaries
**Required Documentation:**
- [ ] Most recent 4 consecutive pay stubs, OR
- [ ] Employer statement on letterhead, OR
- [ ] Collateral contact with employer

**What to Verify:**
- Gross pay amount
- Pay frequency (weekly, bi-weekly, monthly)
- Hours worked (if hourly)
- Pay rate
- Deductions (if any)

### Tips and Gratuities
**Required Documentation:**
- [ ] Pay stubs showing reported tips
- [ ] IRS Form 4070 (Employee's Report of Tips)
- [ ] Employer statement including tip income
- [ ] Self-declaration with supporting evidence

**Common Error:**
❌ Not counting cash tips that exceed $20/month
✅ Always verify and count all tip income

### Wages Not Counted Error Prevention

**Step 1: Identify All Income Sources**
Ask: "Do you have any income from:"
- Regular job?
- Second job or side work?
- Tips or commissions?
- Seasonal work?
- On-call or substitute work?

**Step 2: Calculate Monthly Earned Income**

**Weekly Pay:**
Weekly amount × 4.3 = Monthly income

**Bi-Weekly Pay:**
Bi-weekly amount × 2.15 = Monthly income

**Twice Monthly:**
Semi-monthly amount × 2 = Monthly income

**Step 3: Document in Case File**
- List each income source
- Show calculation method
- Attach verification documents

## Common Errors to Avoid

❌ **Error:** Not counting second job wages
✅ **Correct:** Count ALL earned income sources

❌ **Error:** Using net pay instead of gross
✅ **Correct:** Always use gross earned income

❌ **Error:** Forgetting to count irregular tips
✅ **Correct:** Include all tip income over $20/month

❌ **Error:** Incorrect conversion of weekly to monthly
✅ **Correct:** Use 4.3 multiplier for weekly income

## Red Flags Requiring Review

- Pay stub shows deductions but no gross amount
- Income reported verbally doesn't match pay stubs
- Unexplained gaps in employment
- Tips reported as $0 for tipped occupation

## Policy References
- 7 CFR 273.9(b) - Earned Income
- Maryland SNAP Manual Section 310 - Earned Income
- MPP-SNAP-2024-03 - Wage Verification Requirements`,
      policyReference: "7 CFR 273.9(b)",
    },
    {
      title: "Shelter Deduction Calculation Worksheet",
      category: "shelter_utility",
      content: `# Shelter Deduction Calculation

## Countable Shelter Expenses

### Allowed Expenses:
- Rent or mortgage payment (principal + interest)
- Property taxes
- Homeowner's insurance
- Condo/HOA fees
- Standard Utility Allowance (SUA)

### NOT Allowed:
- Late fees or penalties
- Furniture rental
- Appliance rental
- Security deposit (one-time, not ongoing)

## Calculation Steps

### Step 1: Total Shelter Expenses
\`\`\`
Rent/Mortgage:        $_______
Property Tax:         $_______
Insurance:            $_______
HOA Fees:             $_______
Standard Utility:     $_______
                      ________
TOTAL SHELTER:        $_______
\`\`\`

### Step 2: Calculate 50% of Net Income
\`\`\`
Net Monthly Income:   $_______
× 50% (0.50):         $_______
\`\`\`

### Step 3: Calculate Excess Shelter
\`\`\`
Total Shelter:        $_______
- 50% Net Income:     $_______
                      ________
Excess Shelter:       $_______
\`\`\`

### Step 4: Apply Cap (if applicable)
- **With elderly/disabled member**: No cap
- **No elderly/disabled**: Cap at $672 (FY 2025)

## Example Calculations

### Example 1: Household with Elderly Member
- Rent: $850
- Heating/Cooling SUA: $412
- Total Shelter: $1,262
- Net Income: $1,100
- 50% of Net Income: $550
- Excess Shelter: $1,262 - $550 = **$712** (no cap)

### Example 2: Household without Elderly/Disabled
- Rent: $950
- Non-Heating SUA: $189
- Total Shelter: $1,139
- Net Income: $800
- 50% of Net Income: $400
- Excess Shelter: $1,139 - $400 = $739
- **Capped at $672**

## Common Mistakes

❌ Forgetting to add SUA to rent
❌ Using wrong SUA amount
❌ Applying cap to elderly/disabled households
❌ Including utilities when SUA is used
❌ Counting one-time expenses

## Quick Reference: FY 2025 Rates

- **Heating/Cooling SUA**: $412
- **Non-Heating/Cooling SUA**: $189
- **Excess Shelter Cap**: $672 (non-elderly/disabled only)

## Policy References
- 7 CFR 273.9(d)(6) - Shelter Deduction
- Maryland SNAP Manual Section 416 - Shelter Costs`,
      policyReference: "7 CFR 273.9(d)(6)",
    },
    {
      title: "Unearned Income Verification and Reporting",
      category: "unearned_income",
      content: `# Unearned Income Verification Guide

## What is Unearned Income?

Unearned income includes income received without performing work:
- Social Security benefits (SSI, SSDI, retirement)
- Unemployment compensation
- Workers' compensation
- Pensions and retirement benefits
- Child support payments
- Spousal support/alimony
- Veterans benefits
- Disability payments

## Verification Requirements by Type

### SSI/SSDI Verification
**Required Documentation:**
- [ ] SSA award letter (most recent)
- [ ] SSA benefit verification letter
- [ ] Bank statement showing direct deposit
- [ ] System data match (if available)

**What to Verify:**
- Benefit amount
- Payment frequency
- Recipient name
- Effective date

**Common Error:**
❌ Missing SSI verification or using outdated award letter
✅ Always obtain current year award letter or system verification

### Unemployment Benefits
**Required Documentation:**
- [ ] Unemployment award letter
- [ ] Recent benefit statement
- [ ] Bank statement showing deposits
- [ ] State unemployment portal printout

**What to Verify:**
- Weekly benefit amount
- Weeks remaining
- Any waiting weeks
- Deductions (taxes, child support)

**Common Error:**
❌ Not reporting unemployment benefits
✅ Unemployment is countable unearned income - must be verified and counted

### Pension and Retirement Income
**Required Documentation:**
- [ ] Pension award letter
- [ ] 1099-R form (previous year)
- [ ] Bank statement showing deposits
- [ ] Pension administrator statement

**What to Verify:**
- Gross monthly amount
- Payment frequency
- Any cost-of-living adjustments (COLA)
- Lump sum vs. ongoing payments

**Common Error:**
❌ Incorrectly excluding pension income
✅ All pension income is countable unless specifically exempt

## Verification Process

### Step 1: Identify All Unearned Income Sources
Ask: "Do you or anyone in your household receive:"
- Social Security or SSI?
- Unemployment benefits?
- Pension or retirement income?
- Disability payments?
- Child support or alimony?
- Veterans benefits?

### Step 2: Obtain Required Verification
For each unearned income source:
- Request appropriate documentation
- Verify amount and frequency
- Document source and verification type

### Step 3: Calculate Monthly Unearned Income

**One-time payments:**
Count only if received in certification period

**Ongoing payments:**
- Weekly: Amount × 4.3
- Bi-weekly: Amount × 2.15
- Monthly: Use stated amount
- Quarterly: Amount ÷ 3
- Annual: Amount ÷ 12

### Step 4: Document in Case File
- List each unearned income source
- Attach verification documents
- Show calculation if conversion needed
- Note any anticipated changes

## Red Flags Requiring Supervisor Review

- Income amount changes significantly from recertification
- Multiple unearned income sources reported
- Lump sum payment received
- Benefit amount doesn't match system data
- Client reports income stopped but no termination notice

## Special Considerations

### SSI and SNAP
- SSI recipients are categorically eligible
- Must still verify SSI amount for benefit calculation
- SSI COLA increases must be budgeted timely

### Retroactive Payments
- Lump sum retroactive benefits counted in month received
- May cause temporary ineligibility
- Advise client to reapply after resource spent down

### Child Support
- Court-ordered amount vs. actual received
- Count only amounts actually received
- Irregular payments: average last 3 months

## Policy References
- 7 CFR 273.9(c) - Unearned Income
- Maryland SNAP Manual Section 311 - Unearned Income
- MPP-SNAP-2024-05 - SSI Verification Requirements
- SNAP-PL-2023-007 - Unemployment Benefit Counting`,
      policyReference: "7 CFR 273.9(c)",
    },
  ];
}

/**
 * Generate Training Interventions showing impact on error rates
 */
export function generateTrainingInterventions(userIds: string[]): InsertTrainingIntervention[] {
  return [
    {
      trainingTitle: "Shelter & Utility Allowance Calculation Refresher",
      targetErrorCategory: "shelter_utility",
      completedBy: userIds.slice(0, 3),
      completedDate: new Date("2024-09-15"),
      preTrainingErrorRate: 3.2,
      postTrainingErrorRate: 1.8,
      impactScore: 43.75, // 43.75% improvement
    },
    {
      trainingTitle: "Income Verification Best Practices",
      targetErrorCategory: "income_verification",
      completedBy: userIds.slice(0, 4),
      completedDate: new Date("2024-08-01"),
      preTrainingErrorRate: 3.75,
      postTrainingErrorRate: 1.5,
      impactScore: 60.0, // 60% improvement
    },
    {
      trainingTitle: "Self-Employment Income Documentation",
      targetErrorCategory: "income_verification",
      completedBy: userIds.slice(1, 4),
      completedDate: new Date("2024-10-10"),
      preTrainingErrorRate: 4.4,
      postTrainingErrorRate: 3.1,
      impactScore: 29.5, // 29.5% improvement
    },
    {
      trainingTitle: "Asset Verification Deep Dive",
      targetErrorCategory: "asset_verification",
      completedBy: userIds.slice(0, 5),
      completedDate: new Date("2024-07-20"),
      preTrainingErrorRate: 3.1,
      postTrainingErrorRate: 2.8,
      impactScore: 9.7, // 9.7% improvement
    },
    {
      trainingTitle: "BBCE Policy Updates - FY 2025",
      targetErrorCategory: "categorical_eligibility",
      completedBy: userIds,
      completedDate: new Date("2024-10-01"),
      preTrainingErrorRate: 1.3,
      postTrainingErrorRate: 1.1,
      impactScore: 15.4, // 15.4% improvement
    },
    {
      trainingTitle: "Earned Income Verification Best Practices",
      targetErrorCategory: "earned_income",
      completedBy: userIds.slice(0, 3),
      completedDate: new Date("2024-06-15"),
      preTrainingErrorRate: 2.9,
      postTrainingErrorRate: 2.1,
      impactScore: 27.6, // 27.6% improvement
    },
    {
      trainingTitle: "Unearned Income Documentation Requirements",
      targetErrorCategory: "unearned_income",
      completedBy: userIds.slice(0, 4),
      completedDate: new Date("2024-09-20"),
      preTrainingErrorRate: 2.2,
      postTrainingErrorRate: 1.8,
      impactScore: 18.2, // 18.2% improvement
    },
    {
      trainingTitle: "Critical: Summer Cooling SUA Emergency Training",
      targetErrorCategory: "shelter_utility",
      completedBy: userIds.slice(0, 2),
      completedDate: new Date("2024-11-01"),
      preTrainingErrorRate: 6.0,
      postTrainingErrorRate: null, // Too recent to measure impact
      impactScore: null,
    },
  ];
}
