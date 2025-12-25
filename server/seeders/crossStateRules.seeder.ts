import { db } from "../db";
import {
  crossStateRules,
  jurisdictionHierarchies,
  stateReciprocityAgreements,
  type InsertCrossStateRule,
  type InsertJurisdictionHierarchy,
  type InsertStateReciprocityAgreement,
} from "@shared/schema";
import { nanoid } from "nanoid";
import { logger } from "../services/logger.service";

/**
 * Cross-State Rules Seeder
 * Seeds initial data for cross-state benefit coordination
 */

async function seedCrossStateRules() {
  logger.info("🌱 Seeding cross-state rules...", {
    service: "seedCrossStateRules",
    action: "start"
  });

  // ============================================================================
  // Jurisdiction Hierarchies - Mid-Atlantic Corridor & Federal Special Cases
  // ============================================================================
  const jurisdictions: InsertJurisdictionHierarchy[] = [
    // Federal jurisdiction (highest priority)
    {
      id: nanoid(),
      state: "FEDERAL",
      level: "federal",
      hierarchy: 0,
      metadata: {
        description: "Federal level jurisdiction - overrides all state and local rules",
        specialCases: ["DC federal employees", "Military", "Federal contractors"]
      }
    },
    // DC - Special jurisdiction with federal considerations
    {
      id: nanoid(),
      state: "DC",
      level: "state",
      hierarchy: 100,
      metadata: {
        description: "District of Columbia - Federal district with unique rules",
        federalEmployeePercentage: 0.28,
        specialPrograms: ["DC Healthcare Alliance", "DC SNAP Match"],
        notes: "High percentage of federal employees affects benefit calculations"
      }
    },
    // New York State
    {
      id: nanoid(),
      state: "NY",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "New York State level jurisdiction",
        hasLocalJurisdictions: true,
        majorCities: ["New York City", "Buffalo", "Rochester", "Albany"]
      }
    },
    // New York City - Local jurisdiction
    {
      id: nanoid(),
      state: "NY",
      county: "New York County",
      city: "New York",
      level: "local",
      hierarchy: 201,
      metadata: {
        description: "NYC - Uses NY State rules but separate administration",
        population: 8335897,
        boroughs: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
        specialPrograms: ["NYC Care", "Fair Fares NYC"],
        notes: "Despite being separate jurisdiction, follows NY State benefit rules"
      }
    },
    // Pennsylvania
    {
      id: nanoid(),
      state: "PA",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "Pennsylvania state jurisdiction",
        borderStates: ["NY", "NJ", "DE", "MD", "WV", "OH"],
        majorCities: ["Philadelphia", "Pittsburgh", "Harrisburg"]
      }
    },
    // New Jersey
    {
      id: nanoid(),
      state: "NJ",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "New Jersey state jurisdiction",
        borderStates: ["NY", "PA", "DE"],
        highCommuters: true,
        commuterCities: ["Newark", "Jersey City", "Hoboken"]
      }
    },
    // Maryland
    {
      id: nanoid(),
      state: "MD",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "Maryland state jurisdiction",
        borderStates: ["PA", "WV", "VA", "DE", "DC"],
        dcSuburbs: ["Montgomery County", "Prince George's County"]
      }
    },
    // Virginia
    {
      id: nanoid(),
      state: "VA",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "Virginia state jurisdiction",
        borderStates: ["MD", "DC", "WV", "KY", "TN", "NC"],
        dcSuburbs: ["Arlington", "Alexandria", "Fairfax County"]
      }
    },
    // Delaware
    {
      id: nanoid(),
      state: "DE",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "Delaware state jurisdiction",
        borderStates: ["PA", "NJ", "MD"],
        noSalesTax: true
      }
    },
    // California
    {
      id: nanoid(),
      state: "CA",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "California state jurisdiction",
        medicaidExpanded: true,
        calfreshProgram: true,
        highCostOfLiving: true
      }
    },
    // Texas
    {
      id: nanoid(),
      state: "TX",
      level: "state",
      hierarchy: 200,
      metadata: {
        description: "Texas state jurisdiction",
        medicaidExpanded: false,
        noStateTax: true,
        limitedBenefits: true
      }
    }
  ];

  await db.insert(jurisdictionHierarchies).values(jurisdictions);
  logger.info(`✅ Inserted ${jurisdictions.length} jurisdiction hierarchies`, {
    service: "seedCrossStateRules",
    action: "insertJurisdictions",
    count: jurisdictions.length
  });

  // ============================================================================
  // State Reciprocity Agreements - Mid-Atlantic Focus
  // ============================================================================
  const reciprocityAgreements: InsertStateReciprocityAgreement[] = [
    // NY-NJ Reciprocity (common commuter scenario)
    {
      id: nanoid(),
      stateA: "NY",
      stateB: "NJ",
      agreementType: "tax_reciprocity",
      programs: ["Income Tax"],
      startDate: new Date("2000-01-01"),
      metadata: {
        description: "Tax reciprocity for cross-border workers",
        affectedCounties: {
          NY: ["New York County", "Westchester", "Rockland"],
          NJ: ["Bergen", "Hudson", "Essex"]
        }
      }
    },
    // PA-NJ Reciprocity
    {
      id: nanoid(),
      stateA: "PA",
      stateB: "NJ",
      agreementType: "tax_reciprocity",
      programs: ["Income Tax"],
      startDate: new Date("1977-01-01"),
      metadata: {
        description: "Historic tax reciprocity agreement",
        terminatedDate: "2017-01-01",
        status: "terminated",
        notes: "Workers now need to file in both states"
      }
    },
    // MD-DC Reciprocity
    {
      id: nanoid(),
      stateA: "MD",
      stateB: "DC",
      agreementType: "tax_reciprocity",
      programs: ["Income Tax"],
      startDate: new Date("1982-01-01"),
      metadata: {
        description: "Tax reciprocity for DC-MD workers",
        highUsage: true
      }
    },
    // VA-DC Reciprocity
    {
      id: nanoid(),
      stateA: "VA",
      stateB: "DC",
      agreementType: "tax_reciprocity",
      programs: ["Income Tax"],
      startDate: new Date("1982-01-01"),
      metadata: {
        description: "Tax reciprocity for DC-VA workers",
        highUsage: true
      }
    },
    // MD-PA Reciprocity
    {
      id: nanoid(),
      stateA: "MD",
      stateB: "PA",
      agreementType: "tax_reciprocity",
      programs: ["Income Tax"],
      startDate: new Date("1978-01-01"),
      metadata: {
        description: "Tax reciprocity between MD and PA",
        affectedCounties: {
          MD: ["Cecil", "Harford", "Baltimore County"],
          PA: ["York", "Lancaster", "Chester"]
        }
      }
    },
    // MD-VA Healthcare Compact
    {
      id: nanoid(),
      stateA: "MD",
      stateB: "VA",
      agreementType: "healthcare_compact",
      programs: ["Medicaid", "Emergency Services"],
      startDate: new Date("2010-01-01"),
      metadata: {
        description: "Interstate healthcare compact for emergency services",
        includesDC: true
      }
    }
  ];

  await db.insert(stateReciprocityAgreements).values(reciprocityAgreements);
  logger.info(`✅ Inserted ${reciprocityAgreements.length} reciprocity agreements`, {
    service: "seedCrossStateRules",
    action: "insertReciprocity",
    count: reciprocityAgreements.length
  });

  // ============================================================================
  // Cross-State Rules - Conflict Resolution Rules
  // ============================================================================
  const rules: InsertCrossStateRule[] = [
    // NYC vs NY State Resolution
    {
      id: nanoid(),
      ruleCode: "NYC_NY_UNIFIED",
      ruleName: "NYC follows NY State benefit rules",
      ruleType: "jurisdiction_resolution",
      primaryState: "NY",
      secondaryStates: ["NYC"],
      conflictType: "administrative_boundary",
      resolutionStrategy: "unified_rules",
      priority: 1000,
      description: "NYC uses NY State benefit eligibility rules despite separate administration",
      metadata: {
        programs: ["SNAP", "Medicaid", "TANF", "HEAP"],
        exceptions: ["NYC Care", "Fair Fares NYC"],
        notes: "NYC-specific programs are additions to state benefits, not replacements"
      }
    },
    // DC Federal Employee Override
    {
      id: nanoid(),
      ruleCode: "DC_FED_EMPLOYEE",
      ruleName: "DC Federal Employee Special Rules",
      ruleType: "federal_override",
      primaryState: "DC",
      conflictType: "federal_employment",
      resolutionStrategy: "federal_override",
      priority: 900,
      description: "Federal employees in DC may have different eligibility rules",
      metadata: {
        affectedPrograms: ["Healthcare", "Childcare Subsidies"],
        federalHealthPlans: ["FEHB", "FEDVIP"],
        notes: "Federal benefits may reduce or eliminate eligibility for DC programs"
      }
    },
    // Border Worker - Live NJ, Work NY
    {
      id: nanoid(),
      ruleCode: "BORDER_NJ_NY",
      ruleName: "NJ-NY Border Worker Rules",
      ruleType: "border_worker",
      primaryState: "NJ",
      secondaryStates: ["NY"],
      conflictType: "cross_border_employment",
      resolutionStrategy: "primary_residence",
      priority: 800,
      description: "Benefits follow state of residence for NJ-NY commuters",
      metadata: {
        programs: ["SNAP", "Medicaid", "TANF"],
        exceptions: ["Unemployment Insurance", "Workers Compensation"],
        commonScenario: true,
        estimatedAffected: 425000
      }
    },
    // Border Worker - Live PA, Work NJ
    {
      id: nanoid(),
      ruleCode: "BORDER_PA_NJ",
      ruleName: "PA-NJ Border Worker Rules",
      ruleType: "border_worker",
      primaryState: "PA",
      secondaryStates: ["NJ"],
      conflictType: "cross_border_employment",
      resolutionStrategy: "primary_residence",
      priority: 800,
      description: "Benefits follow state of residence for PA-NJ commuters",
      metadata: {
        programs: ["SNAP", "Medicaid", "TANF"],
        taxNote: "No longer has tax reciprocity as of 2017"
      }
    },
    // MD to PA Relocation
    {
      id: nanoid(),
      ruleCode: "RELOCATE_MD_PA",
      ruleName: "Maryland to Pennsylvania Relocation",
      ruleType: "interstate_move",
      primaryState: "MD",
      secondaryStates: ["PA"],
      conflictType: "benefit_portability",
      resolutionStrategy: "transition_period",
      priority: 700,
      description: "Benefit transition rules for MD to PA movers",
      metadata: {
        transitionPeriod: 90,
        programs: {
          SNAP: "Reapply in PA immediately",
          Medicaid: "90-day continuation, then reapply",
          TANF: "Close MD case, reapply in PA",
          WIC: "Transfer case between states"
        }
      }
    },
    // CA to TX Move - Medicaid Expansion Difference
    {
      id: nanoid(),
      ruleCode: "RELOCATE_CA_TX",
      ruleName: "California to Texas Relocation - Medicaid Gap",
      ruleType: "interstate_move",
      primaryState: "CA",
      secondaryStates: ["TX"],
      conflictType: "medicaid_expansion_difference",
      resolutionStrategy: "coverage_gap_warning",
      priority: 900,
      description: "Warning about Medicaid coverage loss when moving from expansion to non-expansion state",
      metadata: {
        medicaidExpansion: {
          CA: true,
          TX: false
        },
        warning: "Adults may lose Medicaid eligibility in Texas",
        alternatives: ["ACA Marketplace", "County indigent care programs"]
      }
    },
    // Multi-State Household - College Student
    {
      id: nanoid(),
      ruleCode: "MULTI_COLLEGE_STUDENT",
      ruleName: "College Student Out-of-State",
      ruleType: "multi_state_household",
      primaryState: "ALL",
      conflictType: "split_household",
      resolutionStrategy: "primary_household",
      priority: 600,
      description: "Students away at college remain part of parent's household for benefits",
      metadata: {
        programs: ["SNAP", "Medicaid"],
        conditions: [
          "Student under 22",
          "Enrolled at least half-time",
          "Expected to return home"
        ],
        exceptions: ["Student has own children", "Student is married"]
      }
    },
    // Military Home of Record
    {
      id: nanoid(),
      ruleCode: "MILITARY_HOME_RECORD",
      ruleName: "Military Home of Record Rules",
      ruleType: "military_special",
      primaryState: "ALL",
      conflictType: "military_residency",
      resolutionStrategy: "home_of_record",
      priority: 950,
      description: "Military families maintain benefits eligibility based on home of record",
      metadata: {
        programs: ["Tax residency", "In-state tuition", "Voting rights"],
        protectedUnder: "Servicemembers Civil Relief Act",
        notes: "Spouse may choose home of record or current state"
      }
    },
    // Most Favorable Rule - SNAP Benefits
    {
      id: nanoid(),
      ruleCode: "SNAP_MOST_FAVORABLE",
      ruleName: "SNAP Most Favorable Calculation",
      ruleType: "benefit_calculation",
      primaryState: "ALL",
      conflictType: "benefit_amount_difference",
      resolutionStrategy: "most_favorable",
      priority: 500,
      description: "Apply most favorable SNAP calculation when multiple states involved",
      metadata: {
        applicableScenarios: [
          "Recent interstate move (30 days)",
          "Cross-border worker with reciprocity",
          "Split custody arrangements"
        ]
      }
    },
    // Income Threshold Conflict Resolution
    {
      id: nanoid(),
      ruleCode: "INCOME_THRESHOLD_CONFLICT",
      ruleName: "Income Threshold Conflict Resolution",
      ruleType: "eligibility_conflict",
      primaryState: "ALL",
      conflictType: "income_threshold_difference",
      resolutionStrategy: "primary_residence",
      priority: 600,
      description: "Use primary residence state's income thresholds for eligibility",
      metadata: {
        programs: ["Medicaid", "CHIP", "LIHEAP"],
        exceptions: ["Border workers with reciprocity agreements"],
        example: "NJ resident working in NY uses NJ income limits"
      }
    }
  ];

  await db.insert(crossStateRules).values(rules);
  logger.info(`✅ Inserted ${rules.length} cross-state rules`, {
    service: "seedCrossStateRules",
    action: "insertRules",
    count: rules.length
  });

  logger.info("🎉 Cross-state rules seeding completed successfully!", {
    service: "seedCrossStateRules",
    action: "complete"
  });
}

// Main seeder function
export async function seedCrossStateRulesData() {
  try {
    await seedCrossStateRules();
    logger.info("✅ All cross-state rules data seeded successfully", {
      service: "seedCrossStateRulesData",
      action: "complete"
    });
  } catch (error) {
    logger.error("❌ Error seeding cross-state rules data", {
      service: "seedCrossStateRulesData",
      action: "error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Run seeder if this file is executed directly
if (require.main === module) {
  seedCrossStateRulesData()
    .then(() => {
      logger.info("Seeding completed", {
        service: "seedCrossStateRulesData",
        action: "processComplete"
      });
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Seeding failed", {
        service: "seedCrossStateRulesData",
        action: "processFailed",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    });
}