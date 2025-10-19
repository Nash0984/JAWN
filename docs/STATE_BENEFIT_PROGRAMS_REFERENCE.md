# State Benefit Programs Reference
*Last Updated: October 19, 2025*

## Executive Summary

### Multi-State Expansion Strategy
The Maryland Benefits Platform is expanding across 19 jurisdictions with a strategic focus on the Mid-Atlantic corridor. This reference document consolidates state-specific benefit eligibility criteria, income limits, and program rules to enable accurate multi-state benefit determinations.

### Key Strategic Insights
- **Mid-Atlantic Priority Region**: Pennsylvania, New Jersey, Delaware, Virginia, New York, and Washington DC form a contiguous service area with varying benefit generosity levels
- **High-Impact National Markets**: California, Texas, and Florida represent major population centers with distinct policy landscapes
- **Additional Expansion States**: Ten additional states provide geographic diversity and testing grounds for varying policy environments

### Implementation Approach
Each state requires customized rules engines, income calculations, and eligibility pathways. This document provides the technical specifications needed to configure state-specific logic within the Multi-State Rules Engine.

---

## State-by-State Profiles

### Pennsylvania (PA)
**Population**: 13.0 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (gross income test waived via BBCE)
- **Asset Test**: None (waived via BBCE)
- **Work Requirements**: Standard ABAWD rules (18-54, able-bodied without dependents)
- **Special Programs**: State Food Purchase Program (SFPP) for those over income limits

#### TANF (Cash Assistance)
- **Income Limits**: Varies by county, generally around 50% FPL
- **Benefit Amount**: $403-$543 for family of 3
- **Time Limits**: 60-month federal limit
- **Work Requirements**: 20-30 hours/week after 24 months

#### Medicaid
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 319% FPL (CHIP)
- **Pregnant Women**: 220% FPL

---

### New Jersey (NJ)
**Population**: 9.3 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 185% FPL
- **Asset Test**: None (waived via BBCE)
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: Simplified reporting for most households

#### TANF (WorkFirst NJ)
- **Income Limits**: Approximately $636/month for family of 3
- **Benefit Amount**: $424 maximum for family of 3
- **Time Limits**: 60-month cumulative limit
- **Work Requirements**: Immediate work activities required

#### Medicaid (NJ FamilyCare)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 355% FPL (highest in region)
- **Pregnant Women**: 200% FPL
- **Parents/Caretakers**: 138% FPL

---

### Delaware (DE)
**Population**: 1.0 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None for most households
- **Work Requirements**: 
  - Current: Ages 18-49
  - **NEW November 2025**: Expanding to ages 50-54
  - **Future 2030**: Will expand to ages 55-64
- **Special Rules**: Transitional benefits for 5 months after leaving TANF

#### TANF (Delaware TANF)
- **Income Limits**: $338/month for family of 3
- **Benefit Amount**: $338 maximum for family of 3
- **Time Limits**: 36-month limit (more restrictive than federal)
- **Work Requirements**: 30 hours/week

#### Medicaid
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 217% FPL
- **Pregnant Women**: 217% FPL

---

### Virginia (VA)
**Population**: 8.7 million | **Medicaid Expansion**: Yes (recent)

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: $2,750 standard, $4,250 if elderly/disabled
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: Expedited processing for emergencies

#### TANF (Virginia TANF)
- **Income Limits**: Very low, approximately $389/month for family of 3
- **Benefit Amount**: $389 maximum for family of 3
- **Time Limits**: 24 months (consecutive), 60 months lifetime
- **Work Requirements**: Virginia Initiative for Education and Work (VIEW)
- **Special Rules**: One of the most restrictive TANF programs nationally

#### Medicaid
- **Expansion Status**: Expanded (2019)
- **Adults (19-64)**: 138% FPL
- **Children**: 148% FPL (FAMIS)
- **Pregnant Women**: 148% FPL
- **Note**: Recent expansion, still building enrollment

---

### New York (NY/NYC)
**Population**: 19.5 million (8.3M in NYC) | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None (waived statewide)
- **Work Requirements**: Standard ABAWD rules with NYC waivers
- **Special Features**: 
  - Same rules apply statewide (NYC not different)
  - Restaurant Meals Program in NYC
  - Enhanced emergency allotments

#### TANF (Family Assistance)
- **Income Limits**: $789/month for family of 3
- **Benefit Amount**: $789 maximum for family of 3 (higher in NYC)
- **Time Limits**: 60-month federal limit
- **Work Requirements**: Extensive employment programs
- **NYC Specifics**: Higher payment standard due to cost of living

#### Medicaid
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 405% FPL (highest nationally)
- **Pregnant Women**: 223% FPL
- **Essential Plan**: Up to 200% FPL ($0-$20/month)

---

### Washington DC
**Population**: 0.7 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None
- **Work Requirements**: Waived due to high unemployment
- **Special Features**: 
  - Federal employee considerations
  - Homeless services integration
  - Higher benefit calculations

#### TANF (DC TANF)
- **Income Limits**: Varies by family size
- **Benefit Amount**: $712-$1,093 (varies by family size)
- **Time Limits**: 60-month federal limit
- **Work Requirements**: TANF Employment Program (TEP)
- **Special Rules**: Additional support for federal workers during shutdowns

#### Medicaid (DC Medicaid)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 215% FPL (higher than standard)
- **Children**: 324% FPL
- **Pregnant Women**: 324% FPL
- **Immigrants**: Local funding for excluded populations

---

### California (CA)
**Population**: 39.2 million | **Medicaid Expansion**: Yes

#### SNAP (CalFresh)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None
- **Work Requirements**: Standard ABAWD with many county waivers
- **Special Features**:
  - Restaurant Meals Program
  - Simplified application process
  - SSI recipients eligible (unlike most states)

#### TANF (CalWORKs)
- **Income Limits**: Varies by region and family size
- **Benefit Amount**: $925 maximum for family of 3 (Region 1)
- **Time Limits**: 48 months for adults, children continue
- **Work Requirements**: Welfare-to-Work participation
- **Special Features**: Highest benefits in continental US

#### Medicaid (Medi-Cal)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 266% FPL
- **Pregnant Women**: 213% FPL
- **Undocumented**: Full scope up to 138% FPL (state funded)

---

### Texas (TX)
**Population**: 30.5 million | **Medicaid Expansion**: No

#### SNAP (Food Stamps)
- **Income Limit**: 165% FPL (no BBCE)
- **Asset Test**: $5,000
- **Work Requirements**: Strict ABAWD enforcement
- **Special Features**: 
  - Most restrictive SNAP rules nationally
  - Limited categorical eligibility

#### TANF (Texas TANF)
- **Income Limits**: Extremely low, $188/month for family of 3
- **Benefit Amount**: $308 maximum for family of 3
- **Time Limits**: 12-36-60 month graduated limits
- **Work Requirements**: Choices employment program
- **Special Rules**: Among lowest benefits nationally

#### Medicaid
- **Expansion Status**: Not expanded
- **Adults (19-64)**: Parents only at 17% FPL (extremely restrictive)
- **Children**: 201% FPL (CHIP)
- **Pregnant Women**: 202% FPL
- **Coverage Gap**: Adults 18-138% FPL have no coverage option

---

### Florida (FL)
**Population**: 22.6 million | **Medicaid Expansion**: No

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: Waived for most via BBCE
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: Disaster SNAP (D-SNAP) frequent activation

#### TANF (Temporary Cash Assistance)
- **Income Limits**: $303/month for family of 3
- **Benefit Amount**: $303 maximum for family of 3
- **Time Limits**: 48 months lifetime (more restrictive than federal)
- **Work Requirements**: Mandatory work activities
- **Special Rules**: Very low payment standard

#### Medicaid
- **Expansion Status**: Not expanded
- **Adults (19-64)**: Parents only at 32% FPL
- **Children**: 215% FPL (Florida KidCare)
- **Pregnant Women**: 196% FPL
- **Coverage Gap**: Large adult coverage gap

---

## Additional Expansion States

### Ohio (OH)
**Population**: 11.8 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 130% FPL standard (no BBCE expansion)
- **Asset Test**: None for most households (waived via BBCE)
- **Work Requirements**: 
  - Currently: 18-52 without dependents
  - Expanding to 18-64 by 2026 (parents with children 14+ included)
- **Special Features**: Online portal at benefits.ohio.gov

#### TANF (Ohio Works First)
- **Income Limits**: Varies by county
- **Benefit Amount**: Approximately $505 for family of 3
- **Time Limits**: 60-month federal limit
- **Work Requirements**: 30 hours/week participation

#### Medicaid
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 206% FPL
- **Pregnant Women**: 200% FPL

---

### Georgia (GA)
**Population**: 11.0 million | **Medicaid Expansion**: No

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None for most; $4,500 for elderly/disabled above 200% FPL
- **Work Requirements**: Adults 18-64 must work 80 hours/month
- **Special Features**: Georgia Gateway portal

#### TANF (Cash Assistance)
- **Income Limits**: $784/month for family of 3 (extremely low, ~29% FPL)
- **Benefit Amount**: $280 maximum for family of 3
- **Time Limits**: 48 months (4 years) lifetime
- **Work Requirements**: 30 hours/week (20 if child under 6)
- **Asset Limit**: $1,000 in countable resources

#### Medicaid
- **Expansion Status**: Not expanded
- **Adults (19-64)**: Parents only at 38% FPL (one of lowest in US)
- **Children**: 318% FPL (PeachCare for Kids)
- **Pregnant Women**: 218% FPL
- **Coverage Gap**: Childless adults ineligible regardless of income

---

### North Carolina (NC)
**Population**: 10.8 million | **Medicaid Expansion**: Yes (Dec 2023)

#### SNAP (Food & Nutrition Services)
- **Income Limit**: 130% FPL standard
- **Asset Test**: None
- **Work Requirements**: Standard ABAWD rules (18-51)
- **Special Features**: Known as FNS in NC; 1.5M+ recipients

#### TANF (Work First Family Assistance)
- **Income Limits**: Approximately 45% FPL
- **Benefit Amount**: Varies by county and family size
- **Time Limits**: 60-month federal limit
- **Work Requirements**: Work First participation required

#### Medicaid
- **Expansion Status**: Expanded (December 1, 2023)
- **Adults (19-64)**: 138% FPL (650,000+ enrolled)
- **Children**: 200% FPL
- **Pregnant Women**: 195% FPL
- **Note**: Recent expansion with strong enrollment

---

### Michigan (MI)
**Population**: 10.0 million | **Medicaid Expansion**: Yes

#### SNAP (Food Assistance)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None for most; $4,500 for elderly/disabled exceeding 165% FPL
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: MI Bridges portal

#### TANF (Family Independence Program)
- **Income Limits**: Uses payment standard test
- **Benefit Amount**: Approximately $492 for family of 3
- **Time Limits**: 60 months (increased from 48 in 2025)
- **Work Requirements**: Jobs Program participation
- **Note**: Only 12,000 households receive FIP (85% decline since 2011)

#### Medicaid (Healthy Michigan Plan)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 200% FPL (MIChild)
- **Pregnant Women**: 185% FPL

---

### Illinois (IL)
**Population**: 12.5 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 165% FPL gross income
- **Asset Test**: None
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: ABE portal for applications

#### TANF (Cash Assistance)
- **Income Limits**: Set at 35% FPL (very low)
- **Benefit Amount**: $753 maximum for family of 3
- **Time Limits**: 60-month federal limit
- **Work Requirements**: Standard federal requirements
- **Asset Test**: None

#### Medicaid
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 142-317% FPL (varies by age)
- **Pregnant Women**: 213% FPL

---

### Massachusetts (MA)
**Population**: 7.0 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL gross income
- **Asset Test**: None for most; $4,500 for elderly/disabled exceeding limits
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: DTAConnect portal

#### TANF (TAFDC)
- **Income Limits**: Need standards vary by family size
- **Benefit Amount**: $650-700 for family of 3
- **Time Limits**: 24 months within 60-month period (non-exempt)
- **Work Requirements**: Mandatory work activities
- **Special Features**: $500/child annual clothing allowance

#### Medicaid (MassHealth)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL (Standard)
- **Children**: 300% FPL
- **Pregnant Women**: 200%+ FPL
- **Special Programs**: Multiple tiers (Standard, CarePlus, Limited)

---

### Washington State (WA)
**Population**: 7.8 million | **Medicaid Expansion**: Yes

#### SNAP (Basic Food)
- **Income Limit**: 200% FPL (one of most generous)
- **Asset Test**: None for most households
- **Work Requirements**: 80 hours/month for adults 18-64
- **Special Features**: Washington Connection portal

#### TANF (Temporary Assistance)
- **Income Limits**: Varies by family size
- **Benefit Amount**: $654 for family of 3 with no income
- **Time Limits**: 60-month lifetime (extensions available)
- **Work Requirements**: WorkFirst program participation
- **Asset Limit**: $6,000 including bank accounts

#### Medicaid (Apple Health)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 200-300% FPL
- **Pregnant Women**: 200%+ FPL
- **Special Features**: Automatic eligibility for TANF/SSI recipients

---

### Colorado (CO)
**Population**: 5.9 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 200% FPL (generous)
- **Asset Test**: None for most; $4,500 for elderly/disabled exceeding limits
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: Colorado PEAK portal

#### TANF (Colorado Works)
- **Income Limits**: $421/month for 1 parent + 2 children
- **Benefit Amount**: $559 for family of 3
- **Time Limits**: 60 months lifetime
- **Work Requirements**: Individualized Plan required
- **Asset Test**: None (eliminated)

#### Medicaid (Health First Colorado)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 133% FPL
- **Children**: 260% FPL
- **Pregnant Women**: 195% FPL
- **Special Programs**: Buy-in for working disabled adults

---

### Arizona (AZ)
**Population**: 7.4 million | **Medicaid Expansion**: Yes

#### SNAP (Food Stamps)
- **Income Limit**: 185% FPL gross income
- **Asset Test**: None for most households
- **Work Requirements**: Standard ABAWD 18-49
- **Special Features**: Health-e-Arizona Plus portal

#### TANF (Cash Assistance)
- **Income Limits**: 100% FPL for most; 130% FPL for kinship care
- **Benefit Amount**: $347 maximum for family of 3
- **Time Limits**: 60 months federal; 12 consecutive months state
- **Work Requirements**: Jobs Program participation
- **Asset Limit**: $2,000 in countable assets

#### Medicaid (AHCCCS)
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 200% FPL
- **Pregnant Women**: 156% FPL
- **Special Programs**: KidsCare for children above regular limits

---

### Maryland (MD) - Home State
**Population**: 6.2 million | **Medicaid Expansion**: Yes

#### SNAP (Food Supplement Program)
- **Income Limit**: 200% FPL (via BBCE)
- **Asset Test**: None (waived)
- **Work Requirements**: Standard ABAWD rules
- **Special Features**: Integrated with other state benefits

#### TANF (Temporary Cash Assistance)
- **Income Limits**: $748/month for family of 3
- **Benefit Amount**: $748 maximum for family of 3
- **Time Limits**: 60-month federal limit
- **Work Requirements**: Mandatory work participation

#### Medicaid
- **Expansion Status**: Expanded
- **Adults (19-64)**: 138% FPL
- **Children**: 322% FPL (Maryland Children's Health Program)
- **Pregnant Women**: 264% FPL

---

## Comparative Analysis Tables

### SNAP Income Limits Comparison
| State | Income Limit (% FPL) | Asset Test | Work Requirements |
|-------|---------------------|------------|-------------------|
| **Most Generous (200% FPL)** | | | |
| PA | 200% | None | Standard |
| NY | 200% | None | Standard/Waived NYC |
| CA | 200% | None | Many waivers |
| DE | 200% | None | Expanding to 64 |
| DC | 200% | None | Waived |
| MD | 200% | None | Standard |
| MI | 200% | None* | Standard |
| GA | 200% | None* | Standard |
| FL | 200% | None* | Standard |
| MA | 200% | None* | Standard |
| WA | 200% | None | 80 hrs/month |
| CO | 200% | None* | Standard |
| **Moderate (165-185% FPL)** | | | |
| NJ | 185% | None | Standard |
| AZ | 185% | None | Standard 18-49 |
| IL | 165% | None | Standard |
| TX | 165% | $5,000 | Strict enforcement |
| **Most Restrictive** | | | |
| OH | 130% | None* | Expanding to 64 |
| NC | 130% | None | Standard 18-51 |
| VA | 200%** | $2,750-$4,250 | Standard |

*Asset test for elderly/disabled exceeding income limits ($4,500)
**Via BBCE but with asset limits

### TANF Benefit Levels (Family of 3)
| State | Maximum Benefit | Time Limit | Notes |
|-------|----------------|------------|-------|
| **Highest Benefits** | | | |
| CA | $925 | 48 months | Regional variation |
| NY | $789 | 60 months | Higher in NYC |
| IL | $753 | 60 months | 35% FPL income limit |
| MD | $748 | 60 months | Standard |
| DC | $712-$1,093 | 60 months | Varies by size |
| MA | $650-700 | 24 months in 60 | With clothing allowance |
| WA | $654 | 60 months | Extensions available |
| **Moderate Benefits** | | | |
| CO | $559 | 60 months | No asset test |
| OH | $505 | 60 months | Varies by county |
| MI | $492 | 60 months | Low participation |
| PA | $403-543 | 60 months | County variation |
| NJ | $424 | 60 months | WorkFirst program |
| **Lowest Benefits** | | | |
| VA | $389 | 24 months consecutive | Most restrictive time |
| AZ | $347 | 60 months/12 consecutive | Dual limits |
| DE | $338 | 36 months | Shorter than federal |
| TX | $308 | 12-36-60 graduated | Among lowest nationally |
| FL | $303 | 48 months | Very restrictive |
| GA | $280 | 48 months | ~29% FPL income limit |

### Medicaid Expansion Status

#### Expanded States
| State | Adult Income Limit | Children Limit | Special Features |
|-------|-------------------|----------------|------------------|
| NY | 138% FPL | 405% FPL | Highest child coverage, Essential Plan |
| NJ | 138% FPL | 355% FPL | Generous child coverage |
| DC | 215% FPL | 324% FPL | Higher adult threshold |
| MD | 138% FPL | 322% FPL | Home state system |
| PA | 138% FPL | 319% FPL | CHIP coverage |
| GA* | N/A | 318% FPL | PeachCare for Kids (non-expansion) |
| IL | 138% FPL | 317% FPL | Age-varied limits |
| MA | 138% FPL | 300% FPL | Multiple program tiers |
| CA | 138% FPL | 266% FPL | Covers undocumented |
| CO | 133% FPL | 260% FPL | Buy-in for disabled |
| DE | 138% FPL | 217% FPL | Standard expansion |
| FL* | N/A | 215% FPL | KidCare (non-expansion) |
| OH | 138% FPL | 206% FPL | Standard expansion |
| MI | 138% FPL | 200% FPL | Healthy Michigan |
| NC | 138% FPL | 200% FPL | Recent expansion (Dec 2023) |
| WA | 138% FPL | 200-300% FPL | Apple Health |
| AZ | 138% FPL | 200% FPL | AHCCCS system |
| TX* | N/A | 201% FPL | CHIP only (non-expansion) |
| VA | 138% FPL | 148% FPL | Recent expansion (2019) |

#### Non-Expansion States
| State | Parent Coverage | Coverage Gap | Notes |
|-------|-----------------|--------------|-------|
| TX | 17% FPL | 18-138% FPL | Most restrictive nationally |
| FL | 32% FPL | 33-138% FPL | Large gap population |
| GA | 38% FPL | 39-138% FPL | One of lowest parent limits |

### Work Requirement Variations

| State | SNAP Work Rules | TANF Work Rules |
|-------|----------------|-----------------|
| **Most Lenient** | | |
| DC | Waived | TEP program |
| NY | Waived in NYC | Extensive programs |
| CA | Many county waivers | Welfare-to-Work |
| **Standard Federal** | | |
| PA, NJ, MD, VA | 18-54 ABAWD | 20-30 hrs/week |
| MA, CO, AZ, MI | Standard ABAWD | Standard requirements |
| **Most Strict** | | |
| TX | Strict enforcement | Choices program |
| DE | Expanding to 64 by 2030 | 30 hrs/week |
| OH | Expanding to 64 by 2026 | 30 hrs/week |
| WA | 80 hrs/month (18-64) | WorkFirst required |
| GA | 80 hrs/month | 30 hrs/week |

### Asset Limit Comparison

| Program | States with NO Asset Limits | States with Asset Limits |
|---------|----------------------------|--------------------------|
| **SNAP** | Most states via BBCE | TX ($5,000), VA ($2,750-4,250) |
| **TANF** | IL, CO, MD, NJ, NY, PA | GA ($1,000), AZ ($2,000), WA ($6,000) |
| **Medicaid** | All expansion states | SSI-related categories only |

---

## Implementation Notes for Multi-State Rules Engine

### Core Configuration Requirements

#### 1. State-Specific Data Points
Each state configuration must include:
- **SNAP Settings**:
  - Gross income limit (% of FPL)
  - Net income calculation rules
  - Asset limits (if applicable)
  - BBCE implementation status
  - Work requirement age ranges
  - Deduction amounts (standard, shelter, medical)

- **TANF Parameters**:
  - Income eligibility thresholds
  - Payment standards by family size
  - Time limit rules (consecutive vs. lifetime)
  - Work participation requirements
  - Sanction policies

- **Medicaid Thresholds**:
  - Expansion status boolean
  - Adult income limits
  - Child income limits (CHIP)
  - Pregnant women limits
  - Parent/caretaker limits (non-expansion states)

#### 2. Rules Engine Architecture
```
State Configuration Module
├── Income Calculators
│   ├── SNAP gross/net income
│   ├── TANF countable income
│   └── Medicaid MAGI
├── Eligibility Determiners
│   ├── Categorical eligibility
│   ├── Work requirements
│   └── Time limits
└── Benefit Calculators
    ├── SNAP allotments
    ├── TANF grants
    └── Cost sharing (Medicaid)
```

#### 3. Special State Rules
**High Priority Implementations**:
- **TX**: No BBCE, strict asset tests, minimal categorical eligibility
- **CA**: SSI recipients eligible for SNAP (exception to federal rule)
- **NY**: Essential Plan for 138-200% FPL
- **DE**: Age-expanding work requirements (implement date triggers)
- **VA**: 24-month consecutive TANF limit tracker
- **DC**: Federal employee special provisions

#### 4. Data Validation Requirements
- Validate FPL percentages are within federal guidelines
- Ensure TANF benefits don't exceed federal block grant restrictions
- Verify work requirement waivers against USDA approved areas
- Cross-reference with PolicyEngine US for calculation verification

#### 5. Integration Considerations
- **PolicyEngine API**: Validate calculations for CA, TX, FL (high volume states)
- **State APIs**: 
  - CA: CalSAWS integration
  - TX: YourTexasBenefits portal
  - NY: myBenefits system
- **Federal Systems**: Interface with SSA for SSI/SSDI status

### Testing Requirements
1. **Unit Tests**: Each state's calculation logic
2. **Integration Tests**: Cross-state household moves
3. **Regression Tests**: Federal poverty level updates
4. **Compliance Tests**: Federal minimum requirements

### Monitoring & Maintenance
- **Policy Change Tracking**: Monthly review of state policy bulletins
- **FPL Updates**: Annual update every January
- **SNAP Allotments**: October COLA adjustments
- **Medicaid Thresholds**: Annual federal poverty level impacts
- **TANF Block Grants**: Federal allocation changes

---

## Document Maintenance
- **Owner**: Multi-State Expansion Team
- **Review Cycle**: Monthly
- **Last Policy Verification**: October 19, 2025
- **Next Scheduled Update**: November 2025 (to include pending states)

## References
- USDA FNS State Options Reports
- Kaiser Family Foundation Medicaid Data
- CBPP TANF State Fact Sheets
- Individual State Policy Manuals
- PolicyEngine US State Configurations