import { logger } from "./services/logger.service";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { seedMarylandTestCases } from "./seedMarylandTestCases";
import { seedQCData } from "./seedQcData";
import { seedDhsForms } from "./seedDhsForms";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";
import { benefitPrograms } from "@shared/schema";
import { policySourceScraper } from "./services/policySourceScraper";
import { programCacheService } from "./services/programCache.service";

export async function seedDemoUsers() {
  try {
    logger.info('Seeding demo users...');
    
    const demoUsers = [
      {
        username: 'demo.applicant',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'applicant@demo.md.gov',
        fullName: 'Maria Rodriguez',
        role: 'client' as const,
        isActive: true,
      },
      {
        username: 'demo.navigator',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'navigator@demo.md.gov',
        fullName: 'James Chen',
        role: 'navigator' as const,
        dhsEmployeeId: 'NAV-2024-001',
        officeLocation: 'Baltimore City DHS Office',
        isActive: true,
      },
      {
        username: 'demo.caseworker',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'caseworker@demo.md.gov',
        fullName: 'Sarah Johnson',
        role: 'caseworker' as const,
        dhsEmployeeId: 'CW-2024-001',
        officeLocation: 'Montgomery County DHS Office',
        isActive: true,
      },
      {
        username: 'demo.admin',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'admin@demo.md.gov',
        fullName: 'Administrator',
        role: 'admin' as const,
        dhsEmployeeId: 'ADM-2024-001',
        officeLocation: 'Maryland DHS Central Office',
        isActive: true,
      },
    ];

    let createdCount = 0;
    for (const userData of demoUsers) {
      try {
        // Check if user already exists
        const existingUser = await storage.getUserByUsername(userData.username);
        if (!existingUser) {
          await storage.createUser(userData);
          createdCount++;
          logger.info(`✓ Created demo user: ${userData.username} (${userData.role})`);
        } else {
          logger.info(`  Demo user already exists: ${userData.username}`);
        }
      } catch (error) {
        logger.error(`  Error creating demo user ${userData.username}:`, error);
      }
    }

    if (createdCount > 0) {
      logger.info(`✓ Seeded ${createdCount} demo users`);
      logger.info('\n📋 Demo Credentials:');
      logger.info('  Applicant   - username: demo.applicant   | password: Demo2024!');
      logger.info('  Navigator   - username: demo.navigator   | password: Demo2024!');
      logger.info('  Caseworker  - username: demo.caseworker  | password: Demo2024!');
      logger.info('  Admin       - username: demo.admin       | password: Demo2024!\n');
    }
  } catch (error) {
    logger.error('Error seeding demo users:', error);
    throw error;
  }
}

export async function seedMarylandBenefitPrograms() {
  try {
    const programs = await storage.getBenefitPrograms();
    
    // MIGRATION STEP: Rename MD_OHEP → LIHEAP_MD if old code exists
    const oldOhepProgram = programs.find(p => p.code === 'MD_OHEP');
    if (oldOhepProgram) {
      try {
        logger.info('🔄 Attempting to migrate MD_OHEP → LIHEAP_MD...');
        await db.update(benefitPrograms)
          .set({ code: 'LIHEAP_MD' })
          .where(eq(benefitPrograms.code, 'MD_OHEP'));
        logger.info('✓ Migrated program code MD_OHEP → LIHEAP_MD');
        // Refresh programs list after migration
        const updatedPrograms = await storage.getBenefitPrograms();
        programs.length = 0;
        programs.push(...updatedPrograms);
      } catch (migrationError: any) {
        // Migration failed due to constraint - this is expected if there are dependencies
        logger.warn('⚠️  Could not migrate MD_OHEP → LIHEAP_MD (likely due to foreign key constraints)');
        logger.warn('   This is expected if there are existing references. The old code will be kept.');
        // Continue with existing data - don't fail the entire initialization
      }
    }
    
    // Define all Maryland benefit programs + VITA
    const programsToSeed = [
      {
        name: 'Maryland SNAP (Food Supplement Program)',
        code: 'MD_SNAP',
        description: 'Maryland Supplemental Nutrition Assistance Program (SNAP), also known as Food Supplement Program (FSP), administered by the Maryland Department of Human Services',
        programType: 'benefit',
        hasRulesEngine: true,
        hasPolicyEngineValidation: true,
        hasConversationalAI: true,
        primarySourceUrl: 'https://dhs.maryland.gov/supplemental-nutrition-assistance-program/food-supplement-program-manual/',
        sourceType: 'web_scraping',
        scrapingConfig: {
          type: 'expandable_sections',
          baseUrl: 'https://dhs.maryland.gov/supplemental-nutrition-assistance-program/food-supplement-program-manual/',
          sectionPattern: 'folder links with numeric identifiers'
        },
        isActive: true
      },
      {
        name: 'IRS VITA Tax Assistance',
        code: 'VITA',
        description: 'Volunteer Income Tax Assistance program providing free tax help to low-income taxpayers. Integrates IRS Publication 4012 and Form 13614-C for Maryland navigators.',
        programType: 'tax',
        hasRulesEngine: true,
        hasPolicyEngineValidation: true, // can verify EITC, CTC, etc. with PolicyEngine
        hasConversationalAI: true,
        primarySourceUrl: 'https://www.irs.gov/pub/irs-pdf/p4012.pdf',
        sourceType: 'pdf',
        scrapingConfig: {
          type: 'pdf_download',
          publicationNumber: '4012',
          relatedForms: ['13614-C', 'Form 1040']
        },
        isActive: true
      },
      {
        name: 'Maryland Medicaid',
        code: 'MD_MEDICAID',
        description: 'Maryland Medical Assistance Program providing health coverage, administered by Maryland Department of Health',
        programType: 'benefit',
        hasRulesEngine: true,
        hasPolicyEngineValidation: true,
        hasConversationalAI: true,
        primarySourceUrl: 'https://health.maryland.gov/mmcp/pages/MedicaidManual.aspx',
        sourceType: 'web_scraping',
        scrapingConfig: {
          type: 'expandable_sections',
          baseUrl: 'https://health.maryland.gov/mmcp/pages/MedicaidManual.aspx',
          sectionPattern: 'dropdown sections with document links'
        },
        isActive: true
      },
      {
        name: 'Maryland TCA (TANF)',
        code: 'MD_TANF',
        description: 'Temporary Cash Assistance program (Maryland TANF implementation), administered by Maryland DHS Family Investment Administration',
        programType: 'benefit',
        hasRulesEngine: true,
        hasPolicyEngineValidation: true,
        hasConversationalAI: true,
        primarySourceUrl: 'https://dsd.maryland.gov/pages/COMARHome.aspx',
        sourceType: 'web_scraping',
        scrapingConfig: {
          type: 'comar_regulations',
          comarTitle: '07.03.03',
          regulationName: 'Family Investment Program'
        },
        isActive: true
      },
      {
        name: 'Maryland Energy Assistance (OHEP)',
        code: 'LIHEAP_MD',
        description: 'Low Income Home Energy Assistance Program (federal), administered by Maryland DHS Office of Home Energy Programs (OHEP) providing MEAP and EUSP assistance',
        programType: 'benefit',
        hasRulesEngine: true,
        hasPolicyEngineValidation: false,
        hasConversationalAI: true,
        primarySourceUrl: 'https://dhs.maryland.gov/documents/OHEP/OHEP-MANUAL-MASTER-2015.pdf',
        sourceType: 'pdf',
        scrapingConfig: {
          type: 'pdf_download',
          supplementalRegulations: 'COMAR 14.02.01'
        },
        isActive: true
      },
      {
        name: 'Maryland Tax Credits and Property Tax Relief',
        code: 'MD_TAX_CREDITS',
        description: 'Maryland property tax credits (Renters\', Homeowners\', Homestead) and state income tax credits, administered by SDAT and Comptroller of Maryland',
        programType: 'tax',
        hasRulesEngine: true,
        hasPolicyEngineValidation: true,
        hasConversationalAI: true,
        primarySourceUrl: 'https://dat.maryland.gov/pages/tax-credit-programs.aspx',
        sourceType: 'web_scraping',
        scrapingConfig: {
          type: 'multi_source',
          sources: ['sdat_tax_credits_portal', 'renters_tax_credit', 'homeowners_tax_credit', 'comptroller_tax_credits', 'onestop_tax_forms']
        },
        isActive: true
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;
    for (const programData of programsToSeed) {
      const existing = programs.find(p => p.code === programData.code);
      if (!existing) {
        try {
          await storage.createBenefitProgram(programData);
          createdCount++;
          logger.info(`✓ Created program: ${programData.name} (${programData.code})`);
        } catch (error) {
          logger.error(`  Error creating program ${programData.code}:`, error);
        }
      } else {
        // Update existing program to match seed data
        try {
          await db.update(benefitPrograms)
            .set({
              name: programData.name,
              description: programData.description,
              programType: programData.programType,
              hasRulesEngine: programData.hasRulesEngine,
              hasPolicyEngineValidation: programData.hasPolicyEngineValidation,
              hasConversationalAI: programData.hasConversationalAI,
              primarySourceUrl: programData.primarySourceUrl,
              sourceType: programData.sourceType,
              scrapingConfig: programData.scrapingConfig,
              isActive: programData.isActive,
            })
            .where(eq(benefitPrograms.code, programData.code));
          updatedCount++;
          logger.info(`✓ Updated program: ${programData.name} (${programData.code})`);
        } catch (error) {
          logger.error(`  Error updating program ${programData.code}:`, error);
        }
      }
    }

    if (createdCount > 0) {
      logger.info(`✓ Seeded ${createdCount} benefit programs`);
    }
    if (updatedCount > 0) {
      logger.info(`✓ Updated ${updatedCount} benefit programs to match seed configuration`);
    }
    
    // Invalidate program cache after seeding/updating
    programCacheService.invalidateCache();
    logger.info('✓ Program cache invalidated after seeding');
  } catch (error) {
    logger.error('Error seeding benefit programs:', error);
    throw error;
  }
}

export async function seedProgramJargonGlossary() {
  try {
    const { programJargonGlossary } = await import('../shared/schema');
    
    const glossaryEntries = [
      // LIHEAP → State-specific energy assistance programs
      {
        federalProgram: 'LIHEAP',
        stateCode: 'MD',
        localTerm: 'OHEP',
        officialName: 'Office of Home Energy Programs',
        commonAbbreviation: 'MEAP, EUSP',
        description: 'Maryland administers LIHEAP through OHEP, providing MEAP (Maryland Energy Assistance Program) and EUSP (Electric Universal Service Program)',
        isActive: true
      },
      {
        federalProgram: 'LIHEAP',
        stateCode: 'PA',
        localTerm: 'LIHEAP',
        officialName: 'Low Income Home Energy Assistance Program',
        commonAbbreviation: 'LIHEAP',
        description: 'Pennsylvania uses the federal program name LIHEAP directly',
        isActive: true
      },
      // SNAP → Food Stamps common term
      {
        federalProgram: 'SNAP',
        stateCode: null, // National common term
        localTerm: 'Food Stamps',
        officialName: 'Supplemental Nutrition Assistance Program',
        commonAbbreviation: 'Food Stamps, EBT',
        description: 'Commonly known as "Food Stamps" despite official name change to SNAP in 2008',
        isActive: true
      },
      // TANF → State-specific cash assistance programs
      {
        federalProgram: 'TANF',
        stateCode: 'MD',
        localTerm: 'TCA',
        officialName: 'Temporary Cash Assistance',
        commonAbbreviation: 'TCA, FIP',
        description: 'Maryland implements TANF as TCA through the Family Investment Program (FIP)',
        isActive: true
      },
      {
        federalProgram: 'TANF',
        stateCode: 'PA',
        localTerm: 'TANF',
        officialName: 'Temporary Assistance for Needy Families',
        commonAbbreviation: 'Cash Assistance',
        description: 'Pennsylvania uses the federal program name TANF',
        isActive: true
      },
      // Medicaid → Medical Assistance
      {
        federalProgram: 'Medicaid',
        stateCode: 'MD',
        localTerm: 'Medical Assistance',
        officialName: 'Maryland Medical Assistance Program',
        commonAbbreviation: 'MA, HealthChoice',
        description: 'Maryland brands Medicaid as Medical Assistance, with managed care through HealthChoice',
        isActive: true
      },
      {
        federalProgram: 'Medicaid',
        stateCode: 'PA',
        localTerm: 'Medical Assistance',
        officialName: 'Pennsylvania Medical Assistance',
        commonAbbreviation: 'MA',
        description: 'Pennsylvania brands Medicaid as Medical Assistance',
        isActive: true
      },
    ];

    let createdCount = 0;
    for (const entry of glossaryEntries) {
      const existing = await db
        .select()
        .from(programJargonGlossary)
        .where(
          and(
            eq(programJargonGlossary.federalProgram, entry.federalProgram),
            entry.stateCode 
              ? eq(programJargonGlossary.stateCode, entry.stateCode)
              : isNull(programJargonGlossary.stateCode)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(programJargonGlossary).values(entry);
        createdCount++;
        logger.info(`✓ Added jargon: ${entry.federalProgram} → ${entry.localTerm} (${entry.stateCode || 'national'})`);
      }
    }

    if (createdCount > 0) {
      logger.info(`✓ Seeded ${createdCount} program jargon glossary entries`);
    } else {
      logger.info('✓ Program jargon glossary already populated');
    }
  } catch (error) {
    logger.error('Error seeding program jargon glossary:', error);
    throw error;
  }
}

export async function seedDocumentTypes() {
  try {
    const types = await storage.getDocumentTypes();
    
    // Define document types for Maryland SNAP system
    const documentTypesToSeed = [
      {
        code: 'POLICY_MANUAL',
        name: 'Policy Manual',
        description: 'Maryland SNAP Policy Manual sections',
      },
      {
        code: 'FEDERAL_REGULATION',
        name: 'Federal Regulation',
        description: 'Federal SNAP regulations (7 CFR Part 273)',
      },
      {
        code: 'STATE_REGULATION',
        name: 'State Regulation',
        description: 'Maryland state regulations (COMAR Title 10)',
      },
      {
        code: 'GUIDANCE',
        name: 'Program Guidance',
        description: 'FNS memos, action transmittals, information memos',
      },
      {
        code: 'CLIENT_DOCUMENT',
        name: 'Client Document',
        description: 'Documents uploaded by clients for verification (income, residency, etc.)',
      },
    ];

    let seededCount = 0;
    for (const docType of documentTypesToSeed) {
      const existing = types.find(t => t.code === docType.code);
      if (!existing) {
        await storage.createDocumentType(docType);
        seededCount++;
        logger.info(`✓ Seeded document type: ${docType.name}`);
      }
    }

    if (seededCount > 0) {
      logger.info(`✓ Seeded ${seededCount} new document types`);
    } else {
      logger.info('✓ Document types already exist');
    }
  } catch (error) {
    logger.error('Error seeding document types:', error);
    throw error;
  }
}

export async function seedMarylandDemoScenarios() {
  try {
    logger.info('Seeding Maryland geographic demo scenarios...');
    
    // Get demo navigator user to assign scenarios
    const demoNavigator = await storage.getUserByUsername('demo.navigator');
    if (!demoNavigator) {
      logger.info('  Skipping scenario seeding - demo navigator not found');
      return;
    }

    // Maryland geographic demo scenarios with real locations and realistic data
    const marylandScenarios = [
      {
        name: 'Baltimore City - Single Parent with 2 Children',
        description: 'East Baltimore household, single mother working part-time at minimum wage. Lives in zip 21224 (Highlandtown/Canton area). Pays high rent, receives utility assistance.',
        userId: demoNavigator.id,
        stateCode: 'MD',
        clientIdentifier: 'DEMO-BC-001',
        tags: ['baltimore-city', 'single-parent', 'employed', 'rental-assistance'],
        householdData: {
          people: {
            adult1: { age: 32 },
            child1: { age: 8 },
            child2: { age: 5 }
          },
          household: {
            state_code: 'MD',
            zip_code: '21224',
            county: 'Baltimore City',
            census_tract: '2707',
            household_size: 3,
            adults: 1,
            children: 2,
            elderly_or_disabled: false
          },
          income: {
            employment_income: 1400, // ~$16,800/year (part-time at MD min wage $15/hr)
            unearned_income: 0
          },
          expenses: {
            rent: 1200, // Baltimore City average rent for 2BR
            utilities: 150,
            childcare: 800, // Part-time childcare
            medical: 50
          },
          assets: 800
        }
      },
      {
        name: 'Baltimore County - Elderly Couple',
        description: 'Catonsville area (zip 21228), retired couple with fixed income. Homeowners with mortgage paid off. One spouse has diabetes requiring ongoing medical care.',
        userId: demoNavigator.id,
        stateCode: 'MD',
        clientIdentifier: 'DEMO-BC-002',
        tags: ['baltimore-county', 'elderly', 'homeowner', 'medical-expenses'],
        householdData: {
          people: {
            adult1: { age: 68 },
            adult2: { age: 65 }
          },
          household: {
            state_code: 'MD',
            zip_code: '21228',
            county: 'Baltimore County',
            census_tract: '4006.01',
            household_size: 2,
            adults: 2,
            children: 0,
            elderly_or_disabled: true
          },
          income: {
            employment_income: 0,
            unearned_income: 1800 // Social Security
          },
          expenses: {
            rent: 0, // Homeowner, no mortgage
            utilities: 200,
            medical: 350, // High medical costs
            childcare: 0
          },
          assets: 4500 // Below asset limit but not zero
        }
      },
      {
        name: 'Garrett County - Rural Family with Disability',
        description: 'Oakland area (zip 21550), rural Western Maryland. Family of 4 with one disabled adult unable to work. Limited public transportation, high heating costs.',
        userId: demoNavigator.id,
        stateCode: 'MD',
        clientIdentifier: 'DEMO-GC-001',
        tags: ['rural', 'garrett-county', 'disability', 'heating-costs'],
        householdData: {
          people: {
            adult1: { age: 45 },
            adult2: { age: 42 },
            child1: { age: 14 },
            child2: { age: 10 }
          },
          household: {
            state_code: 'MD',
            zip_code: '21550',
            county: 'Garrett',
            census_tract: '9701',
            household_size: 4,
            adults: 2,
            children: 2,
            elderly_or_disabled: true
          },
          income: {
            employment_income: 2100, // One working adult
            unearned_income: 950 // SSI for disabled adult
          },
          expenses: {
            rent: 900,
            utilities: 300, // High heating costs in Western MD mountains
            medical: 200,
            childcare: 0 // Teens, no childcare needed
          },
          assets: 1200
        }
      },
      {
        name: 'Montgomery County - Working Family',
        description: 'Silver Spring (zip 20910), working couple with one child. High cost of living area. Both parents employed but struggling with childcare costs.',
        userId: demoNavigator.id,
        stateCode: 'MD',
        clientIdentifier: 'DEMO-MC-001',
        tags: ['montgomery-county', 'working-family', 'high-cost-area', 'childcare'],
        householdData: {
          people: {
            adult1: { age: 35 },
            adult2: { age: 33 },
            child1: { age: 3 }
          },
          household: {
            state_code: 'MD',
            zip_code: '20910',
            county: 'Montgomery',
            census_tract: '7040.02',
            household_size: 3,
            adults: 2,
            children: 1,
            elderly_or_disabled: false
          },
          income: {
            employment_income: 3200, // Combined income but high cost of living
            unearned_income: 0
          },
          expenses: {
            rent: 1800, // Montgomery County high rents
            utilities: 150,
            childcare: 1400, // Very high childcare costs in MoCo
            medical: 100
          },
          assets: 2000
        }
      },
      {
        name: 'Prince Georges County - Large Family',
        description: 'Hyattsville (zip 20782), family of 6 with mixed income. Grandmother lives with them, receives SSI. Parents work multiple jobs.',
        userId: demoNavigator.id,
        stateCode: 'MD',
        clientIdentifier: 'DEMO-PG-001',
        tags: ['prince-georges', 'large-family', 'multi-generational', 'mixed-income'],
        householdData: {
          people: {
            adult1: { age: 38 },
            adult2: { age: 36 },
            adult3: { age: 72 },
            child1: { age: 12 },
            child2: { age: 9 },
            child3: { age: 4 }
          },
          household: {
            state_code: 'MD',
            zip_code: '20782',
            county: 'Prince George\'s',
            census_tract: '8073.04',
            household_size: 6,
            adults: 3,
            children: 3,
            elderly_or_disabled: true
          },
          income: {
            employment_income: 2800, // Two working adults
            unearned_income: 900 // Grandmother's SSI
          },
          expenses: {
            rent: 1600,
            utilities: 250,
            childcare: 600, // After-school for youngest
            medical: 150
          },
          assets: 500
        }
      }
    ];

    let createdCount = 0;
    for (const scenarioData of marylandScenarios) {
      try {
        // Check if scenario with same name already exists for demo navigator
        const existing = await storage.getHouseholdScenariosByUser(demoNavigator.id);
        const alreadyExists = existing.some(s => s.name === scenarioData.name);
        
        if (!alreadyExists) {
          await storage.createHouseholdScenario(scenarioData);
          createdCount++;
          logger.info(`  ✓ Created demo scenario: ${scenarioData.name}`);
        } else {
          logger.info(`  Demo scenario already exists: ${scenarioData.name}`);
        }
      } catch (error) {
        logger.error(`  Error creating demo scenario ${scenarioData.name}:`, error);
      }
    }

    if (createdCount > 0) {
      logger.info(`✓ Seeded ${createdCount} Maryland geographic demo scenarios`);
      logger.info('\n📍 Demo Scenarios by Location:');
      logger.info('  • Baltimore City (21224) - Single parent, part-time employment');
      logger.info('  • Baltimore County (21228) - Elderly couple, high medical costs');
      logger.info('  • Garrett County (21550) - Rural family with disability');
      logger.info('  • Montgomery County (20910) - Working family, high living costs');
      logger.info('  • Prince George\'s County (20782) - Large multi-generational family\n');
    }
  } catch (error) {
    logger.error('Error seeding Maryland demo scenarios:', error);
    throw error;
  }
}

// Initialize all required data
export async function initializeSystemData() {
  logger.info('Initializing Maryland Benefits Navigator system data...');
  
  try {
    await seedDemoUsers();
    await seedMarylandBenefitPrograms();
    await seedProgramJargonGlossary();
    await seedDocumentTypes();
    await policySourceScraper.seedPolicySources();
    await seedMarylandDemoScenarios();
    await seedMarylandTestCases();
    await seedQCData();
    await seedDhsForms();
    
    logger.info('✓ System data initialization complete');
  } catch (error) {
    logger.error('System data initialization failed:', error);
    throw error;
  }
}