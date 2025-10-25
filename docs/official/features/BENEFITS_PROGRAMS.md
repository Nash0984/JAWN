# Benefits Programs Implementation
Based on Code Inspection: server/services/*RulesEngine.ts  
Generated: 2025-01-01

## Overview
JAWN implements six major benefit programs using Rules as Code engines with PolicyEngine third-party verification. Each program has dedicated database tables, rules engines, and compliance tracking.

## 1. SNAP (Supplemental Nutrition Assistance Program)

### Implementation Status: PRODUCTION
Location: `server/services/rulesEngine.ts` (primary SNAP engine)

### Eligibility Criteria
- **Income Test**: 130% FPL (gross), 100% FPL (net)
- **Asset Test**: $2,750 standard, $4,250 elderly/disabled
- **Work Requirements**: ABAWD 18-49 without dependents
- **Deductions**: Standard, earned income, dependent care, medical

### Database Tables
```typescript
snapApplications
snapIncomeDeductions
snapResourceLimits
snapBenefitCalculations
snapRecertifications
snapWorkRequirements
snapCaseUpdates
```

### Calculation Method
1. Gross income test (130% FPL)
2. Apply deductions (standard, shelter, medical)
3. Net income test (100% FPL)
4. Asset test if applicable
5. Calculate benefit using Thrifty Food Plan
6. Apply minimum benefit ($23)

### Policy Citations
- 7 CFR Part 273 - SNAP regulations
- Maryland COMAR 07.03.17 - State implementation
- FNS Handbook 901 - Certification procedures

## 2. Medicaid

### Implementation Status: PRODUCTION
Location: `server/services/medicaidRulesEngine.ts`

### Eligibility Pathways

#### MAGI (Modified Adjusted Gross Income)
- **Adults 19-64**: 138% FPL (ACA expansion)
- **Children <19**: 322% FPL (includes CHIP)
- **Pregnant Women**: 264% FPL
- **Parents/Caretakers**: 138% FPL

#### Non-MAGI
- **SSI Recipients**: Automatic eligibility
- **Aged/Blind/Disabled**: Asset + income tests
- **Medically Needy**: Spenddown option

### Database Tables
```typescript
medicaidCategories
medicaidIncomeLimits
medicaidMAGIRules
medicaidNonMAGIRules
medicaidSpenddown
medicaidApplications
medicaidEnrollments
medicaidRenewals
```

### Maryland-Specific Features
- HealthChoice managed care
- Rare and Expensive Case Management (REM)
- Employed Individuals with Disabilities (EID)
- Medicaid Buy-In for working disabled

### Policy References
- 42 CFR Part 435 - Federal Medicaid regulations
- COMAR 10.09.24 - Maryland Medical Assistance
- ACA Section 2001 - Medicaid expansion

## 3. TANF (Temporary Assistance for Needy Families)

### Implementation Status: PRODUCTION
Location: `server/services/tanfRulesEngine.ts`

### Maryland TCA (Temporary Cash Assistance)
- **Income Limit**: Needs standard by household size
- **Asset Limit**: $2,000 liquid assets
- **Work Requirements**: 30 hours/week (single parent)
- **Time Limits**: 60-month federal limit

### Database Tables
```typescript
tanfIncomeLimits
tanfAssetLimits
tanfWorkRequirements
tanfTimeLimits
tanfApplications
tanfCaseUpdates
tanfSanctions
```

### Special Provisions
- Domestic violence waivers
- Hardship exemptions
- Educational incentives
- Transitional benefits

### Policy Citations
- 42 USC Chapter 7, Subchapter IV
- COMAR 07.03.03 - TCA Program
- TANF State Plan - Maryland DHS

## 4. LIHEAP (Low Income Home Energy Assistance Program)

### Implementation Status: PRODUCTION  
Location: `server/services/liheapRulesEngine.ts`

### Maryland OHEP (Office of Home Energy Programs)
- **Income Limit**: 175% FPL
- **Priority Groups**: Elderly, disabled, children <6
- **Benefit Types**: Regular, crisis, arrearage
- **Seasonal**: Heating (Oct-Mar), Cooling (Jun-Sep)

### Database Tables
```typescript
liheapIncomeLimits      # Federal program name
liheapBenefitTiers      # Not "ohepBenefitTiers"
liheapSeasonalFactors
liheapApplications
liheapVendorPayments
liheapCrisisAssistance
```

### Benefit Calculation
1. Income as % of FPL
2. Priority group multipliers
3. Fuel type adjustments
4. Crisis situation bonus
5. Arrearage retirement

### Maryland-Specific Programs
- Electric Universal Service Program (EUSP)
- Arrearage Retirement Assistance (ARA)
- Utility Service Protection Program (USPP)

## 5. SSI (Supplemental Security Income)

### Implementation Status: DEVELOPMENT
Location: `server/services/ssiRulesEngine.ts` (planned)

### Federal Benefit Rates (2025)
- **Individual**: $967/month
- **Couple**: $1,450/month
- **Resource Limits**: $2,000 individual, $3,000 couple

### Database Tables
```typescript
ssiApplications
ssiIncomeLimits
ssiResourceLimits
ssiRedeterminations
```

### Maryland State Supplement
- Additional $37.10/month for individuals
- Paid through federal SSI system
- Automatic for SSI recipients

### Integration Points
- Automatic Medicaid eligibility
- SNAP categorical eligibility
- Property tax credits
- Prescription assistance

## 6. Tax Credits & VITA

### Implementation Status: PRODUCTION
Location: `server/services/vitaTaxRulesEngine.ts`

### Federal Credits
- **EITC**: Up to $7,830 (3+ children)
- **CTC**: $2,000 per child ($1,600 refundable)
- **ACTC**: Additional Child Tax Credit
- **Education Credits**: AOTC, LLC

### Maryland Credits
- **State EITC**: 45% of federal EITC
- **State CTC**: Up to $1,000 per child
- **Poverty Level Credit**: Income-based
- **Property Tax Credit**: Renters and homeowners

### Database Tables
```typescript
vitaSessions
taxReturns
taxCredits
taxDeductions
taxWithholdings
taxRefunds
taxDependents
efileBatches
```

### VITA Certification Requirements
- Basic certification for simple returns
- Advanced for complex situations
- Military for armed forces
- International for foreign income

## Cross-Program Features

### Express Lane Enrollment
**SNAP → Medicaid**: Automatic pre-population
```typescript
crossEnrollmentOpportunities
crossEnrollmentConsents
crossEnrollmentApplications
expressLaneEligibility
```

### Benefits Cliff Calculator
Analyzes income changes impact on:
- All benefit amounts
- Net household income
- Marginal tax rates
- Cliff thresholds

### PolicyEngine Third-Party Verification
- Independent calculation verification
- 50-70% cost reduction via caching
- Variance tracking and resolution
- Confidence scoring

## Rules Engine Architecture

### Common Pattern
```typescript
interface RulesEngine {
  calculateEligibility(input: HouseholdInput): EligibilityResult
  getActiveRules(effectiveDate: Date): RuleSet
  verifyWithPolicyEngine(calculation: any): Verification
  generatePolicyCitations(): Citation[]
}
```

### Temporal Data Management
- Effective dates for all rules
- Historical calculations preserved
- Point-in-time recalculations
- Audit trail of changes

### Multi-State Support
- Federal baseline rules
- State-specific variations
- County supplements
- Local program additions

## Compliance & Reporting

### Required Reports
- SNAP-QC quality control samples
- Medicaid MAGI determinations
- TANF work participation rates
- LIHEAP weatherization referrals

### Audit Requirements
- Eligibility determination records
- Calculation breakdowns
- Policy citations
- Verification documentation

### Performance Metrics
- Application processing time
- Approval/denial rates
- Recertification timeliness
- Error rates by program

## Future Enhancements

### Short-term (Q1 2025)
- WIC integration
- School lunch auto-enrollment
- Housing assistance screening
- Veterans benefits check

### Medium-term (Q2 2025)
- Social Security optimization
- Medicare Part D assistance
- State pharmaceutical programs
- Disability benefits navigation

### Long-term (Q3-Q4 2025)
- Retirement planning tools
- College financial aid integration
- Workforce development programs
- Emergency assistance coordination