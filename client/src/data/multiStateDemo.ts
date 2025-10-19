/**
 * Multi-State Demo Scenarios for Frontend
 * Interactive demonstrations of cross-state benefit coordination
 */

export interface DemoHousehold {
  id: string;
  name: string;
  description: string;
  scenario: string;
  icon: string;
  primaryState: string;
  secondaryState?: string;
  householdSize: number;
  annualIncome: number;
  fplPercentage: number;
  members: DemoMember[];
  benefits: DemoBenefit[];
  stateComparison?: StateComparison;
  keyInsights: string[];
  nextSteps: string[];
}

export interface DemoMember {
  id: string;
  name: string;
  age: number;
  relationship: string;
  location: string;
  special?: string[];
}

export interface DemoBenefit {
  program: string;
  currentState: BenefitStatus;
  newState?: BenefitStatus;
  portability: string;
  action: string;
}

export interface BenefitStatus {
  eligible: boolean;
  amount?: number;
  reason?: string;
  coverage?: string;
}

export interface StateComparison {
  category: string;
  primaryState: StateDetails;
  secondaryState: StateDetails;
  impact: "positive" | "negative" | "neutral";
  explanation: string;
}

export interface StateDetails {
  name: string;
  value: string | number | boolean;
  threshold?: number;
}

/**
 * Demo Scenario 1: MD→PA Relocation
 * Family moving for better job opportunity
 */
export const relocationDemo: DemoHousehold = {
  id: "relocation-md-pa",
  name: "Johnson Family Relocation",
  description: "Moving from Maryland to Pennsylvania for a new job opportunity",
  scenario: "relocation",
  icon: "🚚",
  primaryState: "Maryland",
  secondaryState: "Pennsylvania",
  householdSize: 4,
  annualIncome: 45000,
  fplPercentage: 136,
  members: [
    {
      id: "robert",
      name: "Robert Johnson",
      age: 35,
      relationship: "Head of Household",
      location: "Moving to PA",
      special: ["Primary earner", "New job in PA"],
    },
    {
      id: "sarah",
      name: "Sarah Johnson",
      age: 33,
      relationship: "Spouse",
      location: "Moving to PA",
      special: ["Part-time worker"],
    },
    {
      id: "michael",
      name: "Michael Johnson",
      age: 8,
      relationship: "Child",
      location: "Moving to PA",
      special: ["Elementary school"],
    },
    {
      id: "emily",
      name: "Emily Johnson",
      age: 5,
      relationship: "Child",
      location: "Moving to PA",
      special: ["Kindergarten"],
    },
  ],
  benefits: [
    {
      program: "SNAP (Food Assistance)",
      currentState: {
        eligible: true,
        amount: 939,
        coverage: "Full household",
      },
      newState: {
        eligible: true,
        amount: 939,
        coverage: "Full household",
      },
      portability: "Seamless transfer",
      action: "Update address with PA DHS within 10 days",
    },
    {
      program: "Medicaid",
      currentState: {
        eligible: true,
        coverage: "All family members",
      },
      newState: {
        eligible: true,
        coverage: "All family members",
      },
      portability: "Reapplication required",
      action: "Apply for PA Medicaid within 30 days of move",
    },
    {
      program: "School Lunch",
      currentState: {
        eligible: true,
        coverage: "Both children",
      },
      newState: {
        eligible: true,
        coverage: "Both children",
      },
      portability: "Direct certification",
      action: "Automatic qualification through SNAP",
    },
  ],
  stateComparison: {
    category: "SNAP Income Limits",
    primaryState: {
      name: "Maryland",
      value: "200% FPL",
      threshold: 200,
    },
    secondaryState: {
      name: "Pennsylvania",
      value: "200% FPL",
      threshold: 200,
    },
    impact: "neutral",
    explanation: "Both states use the same income threshold for SNAP eligibility",
  },
  keyInsights: [
    "✅ SNAP benefits transfer seamlessly between MD and PA",
    "✅ Both states have expanded Medicaid (no coverage gap)",
    "📋 New Medicaid application required but no waiting period",
    "🏫 Children automatically qualify for free school lunch",
  ],
  nextSteps: [
    "Notify Maryland DSS of upcoming move",
    "Gather proof of new PA residence (lease, utility bill)",
    "Apply for PA Medicaid online before moving",
    "Update SNAP case with new address after move",
    "Register children for new school with benefit letters",
  ],
};

/**
 * Demo Scenario 2: Federal Employee
 * DC federal worker living in Virginia
 */
export const federalEmployeeDemo: DemoHousehold = {
  id: "federal-employee-dc-va",
  name: "Smith Federal Household",
  description: "Federal employee working in DC, living in Arlington VA",
  scenario: "federal_employee",
  icon: "🏛️",
  primaryState: "Virginia",
  secondaryState: "Washington DC",
  householdSize: 3,
  annualIncome: 75000,
  fplPercentage: 274,
  members: [
    {
      id: "james",
      name: "James Smith",
      age: 42,
      relationship: "Head of Household",
      location: "Lives VA, Works DC",
      special: ["GS-13 Federal Employee", "HHS", "FEHB enrolled"],
    },
    {
      id: "maria",
      name: "Maria Smith",
      age: 40,
      relationship: "Spouse",
      location: "Arlington, VA",
      special: ["Not employed"],
    },
    {
      id: "sofia",
      name: "Sofia Smith",
      age: 10,
      relationship: "Child",
      location: "Arlington, VA",
      special: ["5th grade student"],
    },
  ],
  benefits: [
    {
      program: "SNAP",
      currentState: {
        eligible: false,
        reason: "Income exceeds 200% FPL threshold",
      },
      portability: "N/A - Not eligible",
      action: "Income too high for assistance",
    },
    {
      program: "Health Coverage",
      currentState: {
        eligible: true,
        coverage: "Federal Employee Health Benefits (FEHB)",
      },
      portability: "Nationwide coverage",
      action: "Maintain FEHB enrollment",
    },
    {
      program: "Child Healthcare",
      currentState: {
        eligible: true,
        coverage: "FEHB or VA CHIP (up to 148% FPL)",
      },
      portability: "FEHB covers nationwide",
      action: "Continue FEHB family coverage",
    },
    {
      program: "DC Healthcare Alliance",
      currentState: {
        eligible: false,
        reason: "Must be DC resident",
      },
      portability: "DC residents only",
      action: "Not applicable for VA residents",
    },
  ],
  stateComparison: {
    category: "Benefit Determination",
    primaryState: {
      name: "Virginia (Residence)",
      value: "Determines eligibility",
    },
    secondaryState: {
      name: "DC (Employment)",
      value: "No benefit eligibility",
    },
    impact: "neutral",
    explanation: "Benefits determined by state of residence, not employment",
  },
  keyInsights: [
    "🏛️ Federal employment doesn't grant DC resident benefits",
    "🏥 FEHB provides comprehensive nationwide coverage",
    "❌ Income too high for SNAP in VA (274% FPL > 200% limit)",
    "📍 Virginia residency rules apply for all state benefits",
  ],
  nextSteps: [
    "Maintain FEHB enrollment for family health coverage",
    "File taxes with Virginia as state of residence",
    "Consider TSP contributions for retirement",
    "Review federal employee assistance programs",
  ],
};

/**
 * Demo Scenario 3: Cross-Border Worker
 * Living in NJ, working in NYC
 */
export const borderWorkerDemo: DemoHousehold = {
  id: "nj-ny-border-worker",
  name: "Rodriguez Border Workers",
  description: "Family living in Newark NJ, primary earner works in Manhattan",
  scenario: "border_worker",
  icon: "🌉",
  primaryState: "New Jersey",
  secondaryState: "New York",
  householdSize: 4,
  annualIncome: 55000,
  fplPercentage: 166,
  members: [
    {
      id: "carlos",
      name: "Carlos Rodriguez",
      age: 38,
      relationship: "Head of Household",
      location: "Lives NJ, Works NYC",
      special: ["Daily commuter", "Financial services"],
    },
    {
      id: "ana",
      name: "Ana Rodriguez",
      age: 36,
      relationship: "Spouse",
      location: "Newark, NJ",
      special: ["Part-time at Newark Medical"],
    },
    {
      id: "luis",
      name: "Luis Rodriguez",
      age: 12,
      relationship: "Child",
      location: "Newark, NJ",
      special: ["7th grade"],
    },
    {
      id: "isabella",
      name: "Isabella Rodriguez",
      age: 9,
      relationship: "Child",
      location: "Newark, NJ",
      special: ["4th grade"],
    },
  ],
  benefits: [
    {
      program: "SNAP",
      currentState: {
        eligible: true,
        amount: 713,
        coverage: "Full household",
      },
      portability: "NJ residence determines",
      action: "Apply through NJ SNAP",
    },
    {
      program: "Medicaid (Adults)",
      currentState: {
        eligible: false,
        reason: "Income above 138% FPL",
      },
      portability: "N/A",
      action: "Consider marketplace coverage",
    },
    {
      program: "NJ FamilyCare (Children)",
      currentState: {
        eligible: true,
        coverage: "Both children (up to 355% FPL)",
      },
      portability: "NJ program",
      action: "Maintain NJ FamilyCare enrollment",
    },
    {
      program: "Tax Filing",
      currentState: {
        eligible: true,
        coverage: "Must file both NJ and NY",
      },
      portability: "Credit for taxes paid",
      action: "File in both states, claim credit",
    },
  ],
  stateComparison: {
    category: "SNAP Income Limits",
    primaryState: {
      name: "New Jersey",
      value: "185% FPL",
      threshold: 185,
    },
    secondaryState: {
      name: "New York",
      value: "200% FPL",
      threshold: 200,
    },
    impact: "positive",
    explanation: "NJ's lower threshold still allows eligibility at 166% FPL",
  },
  keyInsights: [
    "🏠 NJ residence determines all benefit eligibility",
    "👶 NJ has highest child Medicaid limit (355% FPL) in region",
    "💰 Must file taxes in both NJ and NY",
    "🚇 $400/month commute costs factored into budget",
  ],
  nextSteps: [
    "Apply for NJ SNAP benefits online",
    "Keep children enrolled in NJ FamilyCare",
    "Track commute expenses for tax deductions",
    "File NJ resident return and NY non-resident return",
    "Consider pre-tax transit benefits from employer",
  ],
};

/**
 * Demo Scenario 4: Medicaid Expansion Loss
 * Moving from California to Texas
 */
export const expansionLossDemo: DemoHousehold = {
  id: "ca-tx-expansion-loss",
  name: "Chen Family Crisis",
  description: "Moving from California (expanded) to Texas (not expanded)",
  scenario: "expansion_loss",
  icon: "⚠️",
  primaryState: "California",
  secondaryState: "Texas",
  householdSize: 3,
  annualIncome: 35000,
  fplPercentage: 138,
  members: [
    {
      id: "wei",
      name: "Wei Chen",
      age: 30,
      relationship: "Head of Household",
      location: "Moving CA → TX",
      special: ["Tech worker", "Remote eligible"],
    },
    {
      id: "lisa",
      name: "Lisa Chen",
      age: 28,
      relationship: "Spouse",
      location: "Moving CA → TX",
      special: ["Not employed", "Managing health condition"],
    },
    {
      id: "amy",
      name: "Amy Chen",
      age: 3,
      relationship: "Child",
      location: "Moving CA → TX",
      special: ["Preschool age"],
    },
  ],
  benefits: [
    {
      program: "SNAP/CalFresh",
      currentState: {
        eligible: true,
        amount: 531,
        coverage: "Full household",
      },
      newState: {
        eligible: false,
        reason: "TX: Exceeds 165% gross income test",
      },
      portability: "Lost on move",
      action: "Apply for food banks in TX",
    },
    {
      program: "Medicaid (Adults)",
      currentState: {
        eligible: true,
        coverage: "Both adults covered",
      },
      newState: {
        eligible: false,
        reason: "TX: No expansion, parents only at 17% FPL",
      },
      portability: "Coverage gap",
      action: "Explore private insurance before move",
    },
    {
      program: "Medicaid/CHIP (Child)",
      currentState: {
        eligible: true,
        coverage: "Child covered",
      },
      newState: {
        eligible: true,
        coverage: "TX CHIP up to 201% FPL",
      },
      portability: "Child maintains coverage",
      action: "Apply for TX CHIP immediately",
    },
    {
      program: "Healthcare Marketplace",
      currentState: {
        eligible: false,
        reason: "Have Medicaid",
      },
      newState: {
        eligible: false,
        reason: "Fall in coverage gap (18-138% FPL)",
      },
      portability: "No subsidies available",
      action: "No affordable option in TX",
    },
  ],
  stateComparison: {
    category: "Medicaid Expansion",
    primaryState: {
      name: "California",
      value: "Expanded (138% FPL)",
      threshold: 138,
    },
    secondaryState: {
      name: "Texas",
      value: "Not Expanded (17% FPL parents)",
      threshold: 17,
    },
    impact: "negative",
    explanation: "Adults lose Medicaid coverage with no affordable alternative",
  },
  keyInsights: [
    "🚨 CRITICAL: Adults lose all health coverage in TX",
    "❌ SNAP eligibility lost (TX has strictest rules)",
    "✅ Child maintains CHIP coverage in TX",
    "⚠️ Adults fall into coverage gap with no options",
    "💔 No marketplace subsidies in coverage gap",
  ],
  nextSteps: [
    "🚨 Reconsider move due to healthcare loss",
    "Get all medical care before leaving CA",
    "Stock up on medications",
    "Research TX community health centers",
    "Consider keeping CA address if possible",
    "Apply for TX CHIP for child Day 1",
  ],
};

/**
 * Demo Scenario 5: College Student
 * Parents in MD, student at Penn State
 */
export const collegeStudentDemo: DemoHousehold = {
  id: "college-student-multi-state",
  name: "Davis College Family",
  description: "Parents in Maryland, oldest child at Penn State University",
  scenario: "college_student",
  icon: "🎓",
  primaryState: "Maryland",
  secondaryState: "Pennsylvania",
  householdSize: 4,
  annualIncome: 60000,
  fplPercentage: 181,
  members: [
    {
      id: "robert",
      name: "Robert Davis",
      age: 48,
      relationship: "Head of Household",
      location: "Maryland",
      special: ["Government contractor"],
    },
    {
      id: "jennifer",
      name: "Jennifer Davis",
      age: 46,
      relationship: "Spouse",
      location: "Maryland",
      special: ["School district employee"],
    },
    {
      id: "michael",
      name: "Michael Davis",
      age: 19,
      relationship: "College Student",
      location: "Pennsylvania (Penn State)",
      special: ["Full-time student", "On-campus housing", "Claimed as dependent"],
    },
    {
      id: "sarah",
      name: "Sarah Davis",
      age: 16,
      relationship: "Child",
      location: "Maryland",
      special: ["High school junior"],
    },
  ],
  benefits: [
    {
      program: "SNAP (Parents)",
      currentState: {
        eligible: true,
        amount: 646,
        coverage: "3-person household (student excluded)",
      },
      portability: "Student ineligible",
      action: "Household size reduced to 3",
    },
    {
      program: "SNAP (Student)",
      currentState: {
        eligible: false,
        reason: "Full-time students generally ineligible",
      },
      newState: {
        eligible: false,
        reason: "Would need to work 20+ hrs/week",
      },
      portability: "N/A",
      action: "Use campus meal plan",
    },
    {
      program: "Health Insurance",
      currentState: {
        eligible: true,
        coverage: "Parent's employer plan",
      },
      newState: {
        eligible: true,
        coverage: "Can stay on until age 26",
      },
      portability: "Nationwide coverage",
      action: "Keep on parent's plan",
    },
    {
      program: "Tax Benefits",
      currentState: {
        eligible: true,
        coverage: "American Opportunity Credit",
      },
      portability: "Parent's tax return",
      action: "Claim education credits",
    },
  ],
  stateComparison: {
    category: "Student Benefit Eligibility",
    primaryState: {
      name: "Maryland (Parents)",
      value: "Determines dependency benefits",
    },
    secondaryState: {
      name: "Pennsylvania (Student)",
      value: "Must apply independently if eligible",
    },
    impact: "neutral",
    explanation: "Student remains part of MD household for tax purposes",
  },
  keyInsights: [
    "🎓 College students excluded from household SNAP count",
    "❌ Students rarely eligible for SNAP unless working",
    "✅ Student stays on parent's health insurance",
    "💰 Parents claim education tax credits",
    "🏠 Student remains MD resident for tax purposes",
  ],
  nextSteps: [
    "Update SNAP case to 3-person household",
    "Keep student on family health plan",
    "Apply for work-study to gain SNAP eligibility",
    "Track education expenses for tax credits",
    "Student files MD tax return if has income",
  ],
};

/**
 * Demo Scenario 6: Military Family
 * Home of record Texas, stationed in Virginia
 */
export const militaryDemo: DemoHousehold = {
  id: "military-home-record",
  name: "Williams Military Family",
  description: "Military family with TX home of record, stationed in Norfolk VA",
  scenario: "military",
  icon: "🎖️",
  primaryState: "Virginia",
  secondaryState: "Texas",
  householdSize: 5,
  annualIncome: 48000,
  fplPercentage: 144, // BAH excluded
  members: [
    {
      id: "marcus",
      name: "Marcus Williams",
      age: 32,
      relationship: "Head of Household",
      location: "Norfolk, VA",
      special: ["U.S. Navy E-6", "TX Home of Record", "12 years service"],
    },
    {
      id: "ashley",
      name: "Ashley Williams",
      age: 30,
      relationship: "Spouse",
      location: "Norfolk, VA",
      special: ["Military spouse", "Not employed"],
    },
    {
      id: "junior",
      name: "Marcus Jr",
      age: 10,
      relationship: "Child",
      location: "Norfolk, VA",
      special: ["5th grade", "Base school"],
    },
    {
      id: "jasmine",
      name: "Jasmine Williams",
      age: 7,
      relationship: "Child",
      location: "Norfolk, VA",
      special: ["2nd grade"],
    },
    {
      id: "baby",
      name: "Baby Williams",
      age: 1,
      relationship: "Child",
      location: "Norfolk, VA",
      special: ["Infant"],
    },
  ],
  benefits: [
    {
      program: "SNAP",
      currentState: {
        eligible: true,
        amount: 1029,
        coverage: "BAH excluded from income",
      },
      portability: "VA rules apply",
      action: "Apply in VA, not TX",
    },
    {
      program: "Healthcare",
      currentState: {
        eligible: true,
        coverage: "TRICARE Prime",
      },
      portability: "Nationwide coverage",
      action: "Maintain TRICARE enrollment",
    },
    {
      program: "State Taxes",
      currentState: {
        eligible: true,
        coverage: "TX resident (no state tax)",
      },
      newState: {
        eligible: true,
        coverage: "VA can't tax military income",
      },
      portability: "Military exemption",
      action: "File as TX resident",
    },
    {
      program: "WIC",
      currentState: {
        eligible: true,
        coverage: "Infant and young children",
      },
      portability: "Apply in VA",
      action: "Use base or local WIC office",
    },
  ],
  stateComparison: {
    category: "Benefit Determination",
    primaryState: {
      name: "Virginia (Duty Station)",
      value: "Determines SNAP/WIC eligibility",
    },
    secondaryState: {
      name: "Texas (Home of Record)",
      value: "Determines tax residency",
    },
    impact: "positive",
    explanation: "Get VA benefits while keeping TX tax advantages",
  },
  keyInsights: [
    "🎖️ BAH/BAS excluded from SNAP calculations",
    "🏥 TRICARE provides comprehensive coverage",
    "💰 No state tax on military income",
    "📍 Use duty station state for benefits",
    "🏠 Maintain home of record for taxes",
  ],
  nextSteps: [
    "Apply for VA SNAP (BAH excluded)",
    "Maintain TRICARE enrollment",
    "Use commissary and exchange privileges",
    "File taxes as TX resident",
    "Access military family support services",
  ],
};

/**
 * Interactive State Selector Configuration
 */
export interface StateOption {
  code: string;
  name: string;
  expanded: boolean;
  snapLimit: number;
  medicaidLimit: number;
  chipLimit: number;
  hasStateTax: boolean;
}

export const stateOptions: StateOption[] = [
  { code: "MD", name: "Maryland", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 322, hasStateTax: true },
  { code: "PA", name: "Pennsylvania", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 319, hasStateTax: true },
  { code: "NJ", name: "New Jersey", expanded: true, snapLimit: 185, medicaidLimit: 138, chipLimit: 355, hasStateTax: true },
  { code: "NY", name: "New York", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 405, hasStateTax: true },
  { code: "VA", name: "Virginia", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 148, hasStateTax: true },
  { code: "DC", name: "Washington DC", expanded: true, snapLimit: 200, medicaidLimit: 215, chipLimit: 324, hasStateTax: true },
  { code: "DE", name: "Delaware", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 217, hasStateTax: true },
  { code: "CA", name: "California", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 266, hasStateTax: true },
  { code: "TX", name: "Texas", expanded: false, snapLimit: 165, medicaidLimit: 17, chipLimit: 201, hasStateTax: false },
  { code: "FL", name: "Florida", expanded: false, snapLimit: 200, medicaidLimit: 32, chipLimit: 215, hasStateTax: false },
  { code: "OH", name: "Ohio", expanded: true, snapLimit: 130, medicaidLimit: 138, chipLimit: 206, hasStateTax: true },
  { code: "GA", name: "Georgia", expanded: false, snapLimit: 200, medicaidLimit: 38, chipLimit: 318, hasStateTax: true },
  { code: "NC", name: "North Carolina", expanded: true, snapLimit: 130, medicaidLimit: 138, chipLimit: 200, hasStateTax: true },
  { code: "MI", name: "Michigan", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 212, hasStateTax: true },
  { code: "IL", name: "Illinois", expanded: true, snapLimit: 165, medicaidLimit: 138, chipLimit: 318, hasStateTax: true },
  { code: "WV", name: "West Virginia", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 305, hasStateTax: true },
  { code: "KY", name: "Kentucky", expanded: true, snapLimit: 200, medicaidLimit: 138, chipLimit: 218, hasStateTax: true },
  { code: "TN", name: "Tennessee", expanded: false, snapLimit: 130, medicaidLimit: 100, chipLimit: 250, hasStateTax: false },
  { code: "SC", name: "South Carolina", expanded: false, snapLimit: 200, medicaidLimit: 67, chipLimit: 212, hasStateTax: true },
];

/**
 * Quick Comparison Tool
 */
export function compareStates(state1: string, state2: string, income: number, householdSize: number): any {
  const s1 = stateOptions.find(s => s.code === state1);
  const s2 = stateOptions.find(s => s.code === state2);
  
  if (!s1 || !s2) return null;
  
  // Calculate FPL percentage
  const fpl = calculateFPL(householdSize);
  const fplPercentage = Math.round((income / fpl) * 100);
  
  return {
    fplPercentage,
    state1: {
      name: s1.name,
      snapEligible: fplPercentage <= s1.snapLimit,
      medicaidEligible: fplPercentage <= s1.medicaidLimit,
      chipEligible: fplPercentage <= s1.chipLimit,
      hasStateTax: s1.hasStateTax,
    },
    state2: {
      name: s2.name,
      snapEligible: fplPercentage <= s2.snapLimit,
      medicaidEligible: fplPercentage <= s2.medicaidLimit,
      chipEligible: fplPercentage <= s2.chipLimit,
      hasStateTax: s2.hasStateTax,
    },
    recommendations: generateRecommendations(s1, s2, fplPercentage),
  };
}

function calculateFPL(householdSize: number): number {
  const fplLevels: Record<number, number> = {
    1: 16035,
    2: 21745,
    3: 27455,
    4: 33165,
    5: 38875,
    6: 44585,
    7: 50295,
    8: 56005,
  };
  
  if (householdSize <= 8) {
    return fplLevels[householdSize];
  }
  return fplLevels[8] + (householdSize - 8) * 5710;
}

function generateRecommendations(s1: StateOption, s2: StateOption, fpl: number): string[] {
  const recs: string[] = [];
  
  // Medicaid expansion difference
  if (s1.expanded !== s2.expanded) {
    if (!s2.expanded && fpl > 100 && fpl <= 138) {
      recs.push("⚠️ CRITICAL: You will lose Medicaid coverage moving to " + s2.name);
    }
  }
  
  // SNAP differences
  if (s1.snapLimit !== s2.snapLimit) {
    if (fpl > s2.snapLimit && fpl <= s1.snapLimit) {
      recs.push("❌ You may lose SNAP eligibility moving to " + s2.name);
    }
  }
  
  // Tax implications
  if (s1.hasStateTax !== s2.hasStateTax) {
    if (!s2.hasStateTax) {
      recs.push("💰 No state income tax in " + s2.name);
    } else {
      recs.push("📋 New state income tax requirements in " + s2.name);
    }
  }
  
  // CHIP for families
  if (Math.abs(s1.chipLimit - s2.chipLimit) > 50) {
    if (s1.chipLimit > s2.chipLimit) {
      recs.push("👶 Lower children's Medicaid threshold in " + s2.name);
    } else {
      recs.push("✅ Higher children's Medicaid threshold in " + s2.name);
    }
  }
  
  return recs;
}

/**
 * Export all demo scenarios
 */
export const allDemoScenarios: DemoHousehold[] = [
  relocationDemo,
  federalEmployeeDemo,
  borderWorkerDemo,
  expansionLossDemo,
  collegeStudentDemo,
  militaryDemo,
];

export default {
  scenarios: allDemoScenarios,
  stateOptions,
  compareStates,
  calculateFPL,
};