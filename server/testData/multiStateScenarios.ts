/**
 * Multi-State Test Scenarios Data Generator
 * Comprehensive test households for cross-state benefit coordination
 * All monetary values are in CENTS unless otherwise specified
 */

import type {
  InsertHouseholdProfile,
  InsertMultiStateHousehold,
  InsertClientCase,
  HouseholdScenario as DBScenario,
} from "@shared/schema";

// Constants from state thresholds
const FEDERAL_POVERTY_LEVEL_2025 = {
  1: 1603500, // $16,035 in cents
  2: 2174500, // $21,745
  3: 2745500, // $27,455
  4: 3316500, // $33,165
  5: 3887500, // $38,875
  6: 4458500, // $44,585
  7: 5029500, // $50,295
  8: 5600500, // $56,005
  // Additional members add $5,710
};

interface TestHousehold {
  profile: Partial<InsertHouseholdProfile>;
  multiState: Partial<InsertMultiStateHousehold>;
  clientCase?: Partial<InsertClientCase>;
  expectedBenefits: {
    [program: string]: {
      primaryState: any;
      secondaryState?: any;
      resolved: any;
    };
  };
  validationPoints: string[];
}

/**
 * Scenario 1: MD→PA Relocation
 * Johnson family: 2 adults, 2 children moving for job opportunity
 */
export const mdToPaRelocation: TestHousehold = {
  profile: {
    name: "Johnson Family - MD to PA Relocation",
    profileMode: "combined",
    householdSize: 4,
    stateCode: "MD", // Current state
    county: "Baltimore County",
    employmentIncome: 4500000, // $45,000/year in cents
    unearnedIncome: 0,
    selfEmploymentIncome: 0,
    householdAssets: 250000, // $2,500
    rentOrMortgage: 150000, // $1,500/month
    utilityCosts: 20000, // $200/month
    childcareExpenses: 80000, // $800/month
    elderlyOrDisabled: false,
    householdData: {
      state: "MD",
      previousState: null,
      movingToState: "PA",
      movingDate: "2025-02-01",
      members: [
        {
          id: "adult1",
          name: "Robert Johnson",
          age: 35,
          relationship: "head",
          isEmployed: true,
          employer: "Manufacturing Corp",
          monthlyIncome: 312500, // $3,125
        },
        {
          id: "adult2",
          name: "Sarah Johnson",
          age: 33,
          relationship: "spouse",
          isEmployed: true,
          employer: "Retail Store",
          monthlyIncome: 62500, // $625
        },
        {
          id: "child1",
          name: "Michael Johnson",
          age: 8,
          relationship: "child",
          isStudent: true,
          grade: 3,
        },
        {
          id: "child2",
          name: "Emily Johnson",
          age: 5,
          relationship: "child",
          isStudent: true,
          grade: "K",
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "MD",
    primaryResidenceCounty: "Baltimore County",
    primaryResidenceZip: "21228",
    workState: "MD", // Will change to PA
    workCounty: "Baltimore County",
    scenario: "relocation" as DBScenario,
    scenarioDetails: {
      relocationType: "job_related",
      currentState: "MD",
      destinationState: "PA",
      reason: "New job opportunity with higher pay",
      timeline: "60 days",
      benefitTransition: true,
    },
    memberStates: {
      adult1: "MD",
      adult2: "MD",
      child1: "MD",
      child2: "MD",
    },
    outOfStateMembers: 0,
    status: "pending",
  },
  clientCase: {
    status: "active",
    priority: "medium",
    type: "relocation_assistance",
    metadata: {
      relocation: true,
      targetState: "PA",
      currentPrograms: ["SNAP", "Medicaid"],
      needsPortabilityCheck: true,
    },
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: true,
        monthlyBenefit: 93900, // $939 (family of 4 at 136% FPL)
        incomeLimitUsed: 200, // 200% FPL via BBCE
        assetTest: false, // Waived in MD
      },
      secondaryState: {
        eligible: true,
        monthlyBenefit: 93900, // Same in PA
        incomeLimitUsed: 200, // 200% FPL via BBCE
        assetTest: false, // Waived in PA
      },
      resolved: {
        continuity: true,
        waitingPeriod: 0,
        documentation: ["PA proof of residence", "New employer verification"],
        notes: "Benefits transfer seamlessly between MD and PA",
      },
    },
    Medicaid: {
      primaryState: {
        eligible: true,
        adultCoverage: true, // MD expanded
        childrenCoverage: true,
      },
      secondaryState: {
        eligible: true,
        adultCoverage: true, // PA expanded
        childrenCoverage: true,
      },
      resolved: {
        continuity: true,
        reapplicationNeeded: true,
        timeline: "Apply within 30 days of move",
      },
    },
  },
  validationPoints: [
    "SNAP benefits should transfer without interruption",
    "Both states use 200% FPL BBCE for SNAP",
    "Medicaid coverage continues in both expanded states",
    "Family remains eligible at 136% FPL",
    "No asset test in either state",
  ],
};

/**
 * Scenario 2: DC Federal Employee
 * Smith household: Federal worker living in Arlington VA
 */
export const dcFederalEmployee: TestHousehold = {
  profile: {
    name: "Smith Household - Federal Employee",
    profileMode: "combined",
    householdSize: 3,
    stateCode: "VA", // Residence
    county: "Arlington",
    employmentIncome: 7500000, // $75,000/year
    unearnedIncome: 0,
    selfEmploymentIncome: 0,
    householdAssets: 1500000, // $15,000
    rentOrMortgage: 280000, // $2,800/month
    utilityCosts: 25000, // $250/month
    elderlyOrDisabled: false,
    householdData: {
      state: "VA",
      workState: "DC",
      county: "Arlington",
      members: [
        {
          id: "adult1",
          name: "James Smith",
          age: 42,
          relationship: "head",
          isEmployed: true,
          employer: "Department of Health and Human Services",
          employerType: "federal",
          monthlyIncome: 625000, // $6,250
          federalEmployee: true,
          federalAgency: "HHS",
          federalGrade: "GS-13",
        },
        {
          id: "adult2",
          name: "Maria Smith",
          age: 40,
          relationship: "spouse",
          isEmployed: false,
        },
        {
          id: "child1",
          name: "Sofia Smith",
          age: 10,
          relationship: "child",
          isStudent: true,
          grade: 5,
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "VA",
    primaryResidenceCounty: "Arlington",
    primaryResidenceZip: "22202",
    workState: "DC",
    workCounty: "Washington",
    workZip: "20001",
    scenario: "federal_employee" as DBScenario,
    scenarioDetails: {
      federalAgency: "HHS",
      gradeLevel: "GS-13",
      dcWorkLocation: "Southwest DC",
      specialEligibility: ["DC Healthcare Alliance consideration", "Federal employee benefits coordination"],
    },
    memberStates: {
      adult1: "VA",
      adult2: "VA",
      child1: "VA",
    },
    outOfStateMembers: 0,
    hasFederalEmployee: true,
    federalEmployeeDetails: {
      agency: "HHS",
      grade: "GS-13",
      yearsOfService: 15,
      location: "DC",
    },
    status: "active",
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: false, // Over 200% FPL in VA
        monthlyBenefit: 0,
        incomeLimitUsed: 200,
        reason: "Income at 274% FPL exceeds VA limit",
      },
      resolved: {
        eligible: false,
        usesResidenceState: true,
        notes: "VA rules apply despite DC employment",
      },
    },
    Medicaid: {
      primaryState: {
        eligible: false, // Adults over 138% FPL
        childrenEligible: true, // Children up to 148% FPL in VA
      },
      resolved: {
        adultCoverage: false,
        childCoverage: true,
        notes: "Federal employment doesn't override state Medicaid rules",
      },
    },
    SpecialPrograms: {
      primaryState: {
        dcHealthcareAlliance: false, // Must be DC resident
        federalHealthBenefits: true, // FEHB available
      },
      resolved: {
        primaryCoverage: "FEHB",
        notes: "Federal Employee Health Benefits primary option",
      },
    },
  },
  validationPoints: [
    "Residence state (VA) rules apply for benefits",
    "Federal employment doesn't grant DC residency benefits",
    "Income too high for SNAP in VA (274% FPL)",
    "Child eligible for VA CHIP/Medicaid",
    "FEHB provides primary health coverage",
  ],
};

/**
 * Scenario 3: NJ/NY Cross-Border Worker
 * Rodriguez family: Lives in Newark NJ, works in Manhattan
 */
export const njNyBorderWorker: TestHousehold = {
  profile: {
    name: "Rodriguez Family - NJ/NY Border Worker",
    profileMode: "combined",
    householdSize: 4,
    stateCode: "NJ", // Residence
    county: "Essex",
    employmentIncome: 5500000, // $55,000/year
    unearnedIncome: 0,
    selfEmploymentIncome: 0,
    householdAssets: 500000, // $5,000
    rentOrMortgage: 180000, // $1,800/month
    utilityCosts: 30000, // $300/month
    childcareExpenses: 100000, // $1,000/month
    elderlyOrDisabled: false,
    householdData: {
      state: "NJ",
      workState: "NY",
      county: "Essex",
      workCounty: "New York County",
      members: [
        {
          id: "adult1",
          name: "Carlos Rodriguez",
          age: 38,
          relationship: "head",
          isEmployed: true,
          employer: "Manhattan Financial Services",
          workLocation: "New York, NY",
          monthlyIncome: 416700, // $4,167
          commuterStatus: true,
        },
        {
          id: "adult2",
          name: "Ana Rodriguez",
          age: 36,
          relationship: "spouse",
          isEmployed: true,
          employer: "Newark Medical Center",
          workLocation: "Newark, NJ",
          monthlyIncome: 41700, // $417
        },
        {
          id: "child1",
          name: "Luis Rodriguez",
          age: 12,
          relationship: "child",
          isStudent: true,
          grade: 7,
        },
        {
          id: "child2",
          name: "Isabella Rodriguez",
          age: 9,
          relationship: "child",
          isStudent: true,
          grade: 4,
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "NJ",
    primaryResidenceCounty: "Essex",
    primaryResidenceZip: "07102",
    workState: "NY",
    workCounty: "New York County",
    workZip: "10001",
    scenario: "border_worker" as DBScenario,
    scenarioDetails: {
      commuteType: "daily",
      transportMode: "NJ Transit + Subway",
      monthlyTransportCost: 40000, // $400
      taxReciprocity: false, // NJ/NY don't have reciprocity
      workPattern: "5 days/week in NYC",
    },
    memberStates: {
      adult1: "NJ",
      adult2: "NJ",
      child1: "NJ",
      child2: "NJ",
    },
    outOfStateMembers: 0,
    status: "active",
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: true,
        monthlyBenefit: 71300, // $713 (family of 4 at 166% FPL)
        incomeLimitUsed: 185, // 185% FPL in NJ
        assetTest: false,
      },
      resolved: {
        eligible: true,
        usesResidenceState: true,
        notes: "NJ residence determines SNAP eligibility, not NY work location",
      },
    },
    Medicaid: {
      primaryState: {
        eligible: true, // NJ expanded, 138% FPL for adults
        childrenEligible: true, // 355% FPL for children in NJ
      },
      resolved: {
        eligible: false, // Adults over 138% FPL
        childrenEligible: true,
        program: "NJ FamilyCare",
        notes: "NJ has highest child Medicaid threshold in region",
      },
    },
    TaxImplications: {
      primaryState: {
        njStateTax: true,
        njLocalTax: false,
      },
      secondaryState: {
        nyStateTax: true,
        nyLocalTax: true, // NYC tax
      },
      resolved: {
        filingRequired: "both",
        creditForTaxesPaid: true,
        notes: "Must file in both states, credit for taxes paid to NY",
      },
    },
  },
  validationPoints: [
    "NJ residence determines benefit eligibility",
    "SNAP uses NJ's 185% FPL threshold",
    "Children eligible for NJ FamilyCare (high threshold)",
    "Tax filing required in both NJ and NY",
    "No reciprocity agreement between NJ/NY",
  ],
};

/**
 * Scenario 4: CA→TX Move (Expansion State Change)
 * Chen family: Moving from San Francisco to Houston
 */
export const caToTxExpansionChange: TestHousehold = {
  profile: {
    name: "Chen Family - CA to TX Move",
    profileMode: "combined",
    householdSize: 3,
    stateCode: "CA", // Current state
    county: "San Francisco",
    employmentIncome: 3500000, // $35,000/year (138% FPL)
    unearnedIncome: 0,
    selfEmploymentIncome: 0,
    householdAssets: 300000, // $3,000
    rentOrMortgage: 250000, // $2,500/month (SF prices)
    utilityCosts: 20000, // $200/month
    elderlyOrDisabled: false,
    householdData: {
      state: "CA",
      previousState: null,
      movingToState: "TX",
      movingDate: "2025-03-15",
      members: [
        {
          id: "adult1",
          name: "Wei Chen",
          age: 30,
          relationship: "head",
          isEmployed: true,
          employer: "Tech Startup",
          monthlyIncome: 291700, // $2,917
        },
        {
          id: "adult2",
          name: "Lisa Chen",
          age: 28,
          relationship: "spouse",
          isEmployed: false,
          isPregnant: false,
        },
        {
          id: "child1",
          name: "Amy Chen",
          age: 3,
          relationship: "child",
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "CA",
    primaryResidenceCounty: "San Francisco",
    primaryResidenceZip: "94102",
    workState: "CA",
    scenario: "relocation" as DBScenario,
    scenarioDetails: {
      relocationType: "cost_of_living",
      currentState: "CA",
      destinationState: "TX",
      reason: "Lower cost of living",
      medicaidExpansionLoss: true,
      criticalTransition: true,
    },
    memberStates: {
      adult1: "CA",
      adult2: "CA",
      child1: "CA",
    },
    outOfStateMembers: 0,
    status: "pending",
  },
  clientCase: {
    status: "urgent",
    priority: "high",
    type: "medicaid_transition",
    metadata: {
      losingMedicaidExpansion: true,
      currentPrograms: ["Medi-Cal", "CalFresh"],
      atRisk: ["Adult Medicaid coverage"],
    },
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: true,
        monthlyBenefit: 53100, // $531 (CalFresh)
        incomeLimitUsed: 200, // CA uses 200% FPL
        assetTest: false,
      },
      secondaryState: {
        eligible: false,
        monthlyBenefit: 0,
        incomeLimitUsed: 165, // TX uses strict 165% FPL
        assetTest: true, // TX has $5,000 asset limit
        reason: "Income at 138% FPL exceeds TX gross test",
      },
      resolved: {
        continuity: false,
        eligibilityLost: true,
        notes: "TX has most restrictive SNAP rules nationally",
      },
    },
    Medicaid: {
      primaryState: {
        eligible: true, // CA expanded
        adultCoverage: true,
        childCoverage: true,
        program: "Medi-Cal",
      },
      secondaryState: {
        adultEligible: false, // TX not expanded, parents only at 17% FPL
        childEligible: true, // Children up to 201% FPL
        coverageGap: true,
      },
      resolved: {
        adultCoverageLost: true,
        childCoverageContinues: true,
        marketplaceOption: "No subsidies in coverage gap",
        criticalGap: "Adults 18-138% FPL have no coverage option in TX",
      },
    },
    TANF: {
      primaryState: {
        eligible: false, // Income too high for CalWORKs
      },
      secondaryState: {
        eligible: false, // TX TANF limit extremely low ($188/month)
      },
      resolved: {
        eligible: false,
        notes: "TX has among lowest TANF benefits nationally",
      },
    },
  },
  validationPoints: [
    "Loss of Medicaid expansion creates coverage gap",
    "SNAP eligibility lost due to TX strict rules",
    "Adults fall into TX coverage gap (18-138% FPL)",
    "Child maintains CHIP eligibility in TX",
    "Critical transition requiring advance planning",
  ],
};

/**
 * Scenario 5: Multi-State College Student
 * Davis household: Parents in MD, student at Penn State
 */
export const multiStateCollegeStudent: TestHousehold = {
  profile: {
    name: "Davis Household - College Student",
    profileMode: "combined",
    householdSize: 4,
    stateCode: "MD", // Parents' state
    county: "Montgomery",
    employmentIncome: 6000000, // $60,000/year
    unearnedIncome: 0,
    selfEmploymentIncome: 0,
    householdAssets: 800000, // $8,000
    rentOrMortgage: 200000, // $2,000/month
    utilityCosts: 25000, // $250/month
    elderlyOrDisabled: false,
    householdData: {
      state: "MD",
      county: "Montgomery",
      members: [
        {
          id: "adult1",
          name: "Robert Davis",
          age: 48,
          relationship: "head",
          isEmployed: true,
          employer: "Government Contractor",
          monthlyIncome: 416700, // $4,167
        },
        {
          id: "adult2",
          name: "Jennifer Davis",
          age: 46,
          relationship: "spouse",
          isEmployed: true,
          employer: "School District",
          monthlyIncome: 83300, // $833
        },
        {
          id: "child1",
          name: "Michael Davis",
          age: 19,
          relationship: "child",
          isStudent: true,
          studentStatus: "full_time",
          school: "Pennsylvania State University",
          schoolState: "PA",
          outOfState: true,
          dormResident: true,
        },
        {
          id: "child2",
          name: "Sarah Davis",
          age: 16,
          relationship: "child",
          isStudent: true,
          grade: 11,
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "MD",
    primaryResidenceCounty: "Montgomery",
    primaryResidenceZip: "20850",
    workState: "MD",
    scenario: "college_student" as DBScenario,
    scenarioDetails: {
      studentLocation: "PA",
      studentSchool: "Penn State",
      studentResidence: "On-campus dormitory",
      summerResidence: "Returns to MD",
      taxDependency: "Claimed by parents",
    },
    memberStates: {
      adult1: "MD",
      adult2: "MD",
      child1: "PA", // Student in PA
      child2: "MD",
    },
    outOfStateMembers: 1,
    status: "active",
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: true, // MD household
        monthlyBenefit: 64600, // $646 (reduced for 3 at home)
        studentExcluded: true, // College students generally ineligible
        householdSize: 3, // Student not counted
      },
      secondaryState: {
        studentEligible: false, // Students generally ineligible
        exceptions: ["Working 20+ hours", "Work-study", "Has dependent"],
      },
      resolved: {
        parentHousehold: true,
        studentSeparate: false,
        notes: "Student excluded from parent SNAP unless meets exception",
      },
    },
    Medicaid: {
      primaryState: {
        familyEligible: false, // Over income for MD Medicaid
        studentOption: "Remain on parent plan",
      },
      secondaryState: {
        studentMedicaid: false, // Would need own PA application
      },
      resolved: {
        coverage: "Parent's private insurance",
        studentHealth: "University health plan option",
        notes: "Student can remain on parent plan until 26",
      },
    },
    TaxImplications: {
      primaryState: {
        parentState: "MD",
        claimStudent: true,
        educationCredits: true,
      },
      secondaryState: {
        studentState: "PA",
        studentFiling: "May need to file if has PA income",
      },
      resolved: {
        dependency: "Parents claim student",
        credits: "American Opportunity Tax Credit",
        notes: "Student remains MD resident for tax purposes",
      },
    },
  },
  validationPoints: [
    "College students excluded from SNAP unless exception applies",
    "Student counts in household for some programs but not others",
    "Parents' state typically determines dependency benefits",
    "Student may establish separate PA residency if independent",
    "Tax dependency affects benefit determinations",
  ],
};

/**
 * Scenario 6: Military Home of Record
 * Williams family: Home of record TX, stationed Norfolk VA
 */
export const militaryHomeOfRecord: TestHousehold = {
  profile: {
    name: "Williams Family - Military",
    profileMode: "combined",
    householdSize: 5,
    stateCode: "VA", // Current station
    county: "Norfolk",
    employmentIncome: 4800000, // $48,000/year (E-6 pay)
    unearnedIncome: 120000, // $1,200/month BAH
    selfEmploymentIncome: 0,
    householdAssets: 500000, // $5,000
    rentOrMortgage: 140000, // $1,400/month
    utilityCosts: 20000, // $200/month
    elderlyOrDisabled: false,
    householdData: {
      state: "VA", // Stationed in VA
      homeOfRecord: "TX",
      county: "Norfolk",
      members: [
        {
          id: "adult1",
          name: "Marcus Williams",
          age: 32,
          relationship: "head",
          isEmployed: true,
          military: true,
          branch: "Navy",
          rank: "E-6",
          employer: "U.S. Navy",
          monthlyIncome: 400000, // $4,000 base pay
          militaryAllowances: 120000, // $1,200 BAH
        },
        {
          id: "adult2",
          name: "Ashley Williams",
          age: 30,
          relationship: "spouse",
          isEmployed: false,
          militarySpouse: true,
        },
        {
          id: "child1",
          name: "Marcus Jr",
          age: 10,
          relationship: "child",
          isStudent: true,
          grade: 5,
        },
        {
          id: "child2",
          name: "Jasmine Williams",
          age: 7,
          relationship: "child",
          isStudent: true,
          grade: 2,
        },
        {
          id: "child3",
          name: "Baby Williams",
          age: 1,
          relationship: "child",
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "VA",
    primaryResidenceCounty: "Norfolk",
    primaryResidenceZip: "23502",
    workState: "VA", // Naval Station Norfolk
    scenario: "military" as DBScenario,
    scenarioDetails: {
      homeOfRecord: "TX",
      currentDutyStation: "Naval Station Norfolk",
      branch: "Navy",
      deploymentStatus: "Shore duty",
      expectedPCS: "2027", // Permanent Change of Station
      tricare: true,
    },
    memberStates: {
      adult1: "TX", // Maintains TX residency
      adult2: "TX", // Spouse can claim TX
      child1: "VA",
      child2: "VA",
      child3: "VA",
    },
    outOfStateMembers: 0,
    hasMilitaryMember: true,
    militaryDetails: {
      homeOfRecord: "TX",
      branch: "Navy",
      rank: "E-6",
      yearsOfService: 12,
      dutyStation: "Norfolk Naval Station",
    },
    status: "active",
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: true,
        monthlyBenefit: 102900, // $1,029 (family of 5)
        incomeLimitUsed: 200, // VA uses 200% FPL
        bahExcluded: true, // BAH not counted as income
        notes: "Military BAH excluded from SNAP calculations",
      },
      resolved: {
        usesStationState: true,
        homeOfRecordIrrelevant: true,
        notes: "SNAP based on VA residence, not TX home of record",
      },
    },
    Medicaid: {
      primaryState: {
        eligible: false, // Has TRICARE
        tricarePrimary: true,
      },
      resolved: {
        coverage: "TRICARE",
        medicaidUnnecessary: true,
        notes: "Military families covered by TRICARE",
      },
    },
    StateTaxes: {
      primaryState: {
        vaStateTax: false, // Military exempt on military income
        vaLocalTax: false,
      },
      homeOfRecord: {
        txStateTax: false, // No state income tax in TX
      },
      resolved: {
        militaryIncome: "Not taxed by VA (military exemption)",
        spouseIncome: "Would be taxed if employed in VA",
        residency: "Maintains TX residency for tax purposes",
      },
    },
    SpecialPrograms: {
      primaryState: {
        wic: true, // Eligible based on income
        militaryChildCare: true,
        commissaryAccess: true,
      },
      resolved: {
        additionalSupport: "Military-specific programs available",
        notes: "Combination of military and state benefits",
      },
    },
  },
  validationPoints: [
    "Military BAH excluded from SNAP income",
    "SNAP uses duty station state (VA) not home of record (TX)",
    "TRICARE provides primary health coverage",
    "Military income exempt from VA state tax",
    "Maintains TX residency despite VA residence",
  ],
};

/**
 * Additional Test Scenarios for Edge Cases
 */

/**
 * Border Counties Scenario
 * Garcia family near PA/MD border using services in both states
 */
export const borderCountiesScenario: TestHousehold = {
  profile: {
    name: "Garcia Family - Border Counties",
    profileMode: "combined",
    householdSize: 3,
    stateCode: "MD",
    county: "Washington County", // MD county bordering PA
    employmentIncome: 4000000, // $40,000/year
    unearnedIncome: 0,
    selfEmploymentIncome: 0,
    householdAssets: 200000, // $2,000
    rentOrMortgage: 90000, // $900/month
    utilityCosts: 15000, // $150/month
    elderlyOrDisabled: false,
    householdData: {
      state: "MD",
      county: "Washington County",
      nearBorder: true,
      members: [
        {
          id: "adult1",
          name: "Juan Garcia",
          age: 35,
          relationship: "head",
          isEmployed: true,
          employer: "PA Manufacturing",
          workLocation: "Chambersburg, PA",
          monthlyIncome: 333300, // $3,333
        },
        {
          id: "adult2",
          name: "Maria Garcia",
          age: 33,
          relationship: "spouse",
          isEmployed: false,
        },
        {
          id: "child1",
          name: "Sofia Garcia",
          age: 8,
          relationship: "child",
          isStudent: true,
          school: "Hagerstown Elementary",
          healthcare: "Pediatrician in Chambersburg, PA",
        }
      ],
    },
  },
  multiState: {
    primaryResidenceState: "MD",
    primaryResidenceCounty: "Washington County",
    primaryResidenceZip: "21740",
    workState: "PA",
    workCounty: "Franklin County",
    scenario: "border_worker" as DBScenario,
    scenarioDetails: {
      borderDistance: "5 miles from PA border",
      crossBorderServices: {
        employment: "PA",
        shopping: "Both MD and PA",
        healthcare: "Split between states",
        childcare: "MD",
      },
      commuteDistance: "15 miles",
    },
    memberStates: {
      adult1: "MD",
      adult2: "MD",
      child1: "MD",
    },
    outOfStateMembers: 0,
    status: "active",
  },
  expectedBenefits: {
    SNAP: {
      primaryState: {
        eligible: true,
        monthlyBenefit: 64600, // $646
        usesState: "MD",
        notes: "MD residence determines eligibility despite PA work",
      },
      resolved: {
        eligible: true,
        state: "MD",
        portability: "Can use benefits in PA stores near border",
      },
    },
    Medicaid: {
      primaryState: {
        eligible: true,
        provider: "MD Medicaid",
        crossBorderCare: "Emergency only in PA",
      },
      resolved: {
        coverage: "MD Medicaid",
        outOfStateProviders: "Need prior authorization for PA providers",
        emergencyCoverage: "Covered in any state",
      },
    },
  },
  validationPoints: [
    "Residence state (MD) determines benefit eligibility",
    "SNAP EBT cards work across state lines",
    "Healthcare provider access may be limited across border",
    "Work state (PA) affects tax filing but not benefits",
    "Border residents often navigate both state systems",
  ],
};

/**
 * Generate all test scenarios
 */
export function generateAllTestScenarios(): TestHousehold[] {
  return [
    mdToPaRelocation,
    dcFederalEmployee,
    njNyBorderWorker,
    caToTxExpansionChange,
    multiStateCollegeStudent,
    militaryHomeOfRecord,
    borderCountiesScenario,
  ];
}

/**
 * Helper function to calculate FPL percentage
 */
export function calculateFPLPercentage(
  annualIncome: number, // in cents
  householdSize: number
): number {
  const fpl = FEDERAL_POVERTY_LEVEL_2025[householdSize] || 
    (FEDERAL_POVERTY_LEVEL_2025[8] + (householdSize - 8) * 571000);
  return Math.round((annualIncome / fpl) * 100);
}

/**
 * Helper to validate state benefit thresholds
 */
export function validateStateThreshold(
  state: string,
  program: string,
  fplPercentage: number
): boolean {
  const thresholds: Record<string, Record<string, number>> = {
    MD: { SNAP: 200, Medicaid: 138, CHIP: 322 },
    PA: { SNAP: 200, Medicaid: 138, CHIP: 319 },
    NJ: { SNAP: 185, Medicaid: 138, CHIP: 355 },
    NY: { SNAP: 200, Medicaid: 138, CHIP: 405 },
    VA: { SNAP: 200, Medicaid: 138, CHIP: 148 },
    DC: { SNAP: 200, Medicaid: 215, CHIP: 324 },
    CA: { SNAP: 200, Medicaid: 138, CHIP: 266 },
    TX: { SNAP: 165, Medicaid: 17, CHIP: 201 }, // Non-expansion
    DE: { SNAP: 200, Medicaid: 138, CHIP: 217 },
    FL: { SNAP: 200, Medicaid: 32, CHIP: 215 }, // Non-expansion
  };

  const stateThresholds = thresholds[state];
  if (!stateThresholds) return false;

  const threshold = stateThresholds[program];
  if (!threshold) return false;

  return fplPercentage <= threshold;
}

export default {
  generateAllTestScenarios,
  calculateFPLPercentage,
  validateStateThreshold,
  scenarios: {
    mdToPaRelocation,
    dcFederalEmployee,
    njNyBorderWorker,
    caToTxExpansionChange,
    multiStateCollegeStudent,
    militaryHomeOfRecord,
    borderCountiesScenario,
  },
};