import { storage } from "./storage";
import { achievementSystemService } from "./services/achievementSystem.service";
import { logger } from "./services/logger.service";

/**
 * Seed Multi-County and Gamification Data
 */

export async function seedCountiesAndGamification() {
  logger.info('🏛️  Seeding Multi-County and Gamification Data...', {
    service: "seedCountiesAndGamification",
    action: "start"
  });

  // Seed 4 pilot LDSS counties
  const counties = [
    {
      name: "Baltimore City",
      code: "BALTIMORE_CITY",
      countyType: "ldss" as const,
      region: "central",
      population: 585708,
      coverage: ["21201", "21202", "21205", "21206", "21213", "21215", "21217", "21218", "21223", "21224"],
      brandingConfig: {
        primaryColor: "#c8122c",
        secondaryColor: "#ffc838",
        logoUrl: null,
        headerText: "Baltimore City Department of Social Services",
      },
      contactInfo: {
        phone: "(410) 361-2000",
        email: "baltimore.dss@maryland.gov",
        address: "1910 N. Calvert Street, Baltimore, MD 21202",
        hours: "Monday-Friday 8:00 AM - 5:00 PM",
      },
      welcomeMessage: "Welcome to Baltimore City DSS Benefits Navigator",
      enabledPrograms: ["MD_SNAP", "MD_MEDICAID", "MD_TANF", "MD_OHEP", "MD_TAX_CREDITS", "VITA"],
      features: {
        enableGamification: true,
        enableCrossEnrollment: true,
        enableTaxPrep: true,
      },
      isActive: true,
      isPilot: true,
      launchDate: new Date('2025-01-15'),
    },
    {
      name: "Baltimore County",
      code: "BALTIMORE_COUNTY",
      countyType: "ldss" as const,
      region: "central",
      population: 854535,
      coverage: ["21093", "21228", "21234", "21236", "21237", "21244", "21286"],
      brandingConfig: {
        primaryColor: "#00529b",
        secondaryColor: "#ffc20e",
        logoUrl: null,
        headerText: "Baltimore County Department of Social Services",
      },
      contactInfo: {
        phone: "(410) 853-3000",
        email: "baltcounty.dss@maryland.gov",
        address: "6401 York Road, Baltimore, MD 21212",
        hours: "Monday-Friday 8:00 AM - 5:00 PM",
      },
      welcomeMessage: "Welcome to Baltimore County DSS Benefits Navigator",
      enabledPrograms: ["MD_SNAP", "MD_MEDICAID", "MD_TANF", "MD_OHEP", "MD_TAX_CREDITS", "VITA"],
      features: {
        enableGamification: true,
        enableCrossEnrollment: true,
        enableTaxPrep: true,
      },
      isActive: true,
      isPilot: true,
      launchDate: new Date('2025-01-15'),
    },
    {
      name: "Montgomery County",
      code: "MONTGOMERY",
      countyType: "ldss" as const,
      region: "central",
      population: 1062061,
      coverage: ["20850", "20851", "20852", "20853", "20854", "20855", "20871", "20874", "20876", "20877", "20878", "20879", "20882", "20886"],
      brandingConfig: {
        primaryColor: "#006633",
        secondaryColor: "#90c659",
        logoUrl: null,
        headerText: "Montgomery County Department of Health & Human Services",
      },
      contactInfo: {
        phone: "(240) 777-4000",
        email: "montgomery.dss@maryland.gov",
        address: "401 Hungerford Drive, Rockville, MD 20850",
        hours: "Monday-Friday 8:30 AM - 5:00 PM",
      },
      welcomeMessage: "Welcome to Montgomery County DHHS Benefits Navigator",
      enabledPrograms: ["MD_SNAP", "MD_MEDICAID", "MD_TANF", "MD_OHEP", "MD_TAX_CREDITS", "VITA"],
      features: {
        enableGamification: true,
        enableCrossEnrollment: true,
        enableTaxPrep: true,
      },
      isActive: true,
      isPilot: true,
      launchDate: new Date('2025-01-15'),
    },
    {
      name: "Prince George's County",
      code: "PRINCE_GEORGES",
      countyType: "ldss" as const,
      region: "central",
      population: 967201,
      coverage: ["20607", "20706", "20707", "20708", "20710", "20712", "20720", "20721", "20722", "20737", "20740", "20743", "20744", "20745", "20746", "20747", "20748"],
      brandingConfig: {
        primaryColor: "#002855",
        secondaryColor: "#d4af37",
        logoUrl: null,
        headerText: "Prince George's County Department of Social Services",
      },
      contactInfo: {
        phone: "(301) 909-7000",
        email: "pgcounty.dss@maryland.gov",
        address: "805 Southern Avenue, Capitol Heights, MD 20743",
        hours: "Monday-Friday 8:00 AM - 5:00 PM",
      },
      welcomeMessage: "Welcome to Prince George's County DSS Benefits Navigator",
      enabledPrograms: ["MD_SNAP", "MD_MEDICAID", "MD_TANF", "MD_OHEP", "MD_TAX_CREDITS", "VITA"],
      features: {
        enableGamification: true,
        enableCrossEnrollment: true,
        enableTaxPrep: true,
      },
      isActive: true,
      isPilot: true,
      launchDate: new Date('2025-01-15'),
    },
  ];

  const createdCounties = [];
  for (const countyData of counties) {
    const existing = await storage.getCountyByCode(countyData.code);
    if (existing) {
      logger.info(`  County already exists: ${countyData.name}`, {
        service: "seedCountiesAndGamification",
        action: "skip",
        countyName: countyData.name,
        countyCode: countyData.code
      });
      createdCounties.push(existing);
    } else {
      const county = await storage.createCounty(countyData);
      logger.info(`  ✓ Created county: ${countyData.name}`, {
        service: "seedCountiesAndGamification",
        action: "createCounty",
        countyName: countyData.name,
        countyCode: countyData.code
      });
      createdCounties.push(county);
    }
  }

  // Assign demo navigator to Baltimore City
  const demoNavigator = await storage.getUserByUsername('demo.navigator');
  if (demoNavigator && createdCounties[0]) {
    const existingAssignments = await storage.getUserCounties(demoNavigator.id);
    if (existingAssignments.length === 0) {
      await storage.assignUserToCounty({
        countyId: createdCounties[0].id,
        userId: demoNavigator.id,
        role: 'navigator',
        isPrimary: true,
        assignedBy: null,
      });
      logger.info(`  ✓ Assigned demo.navigator to ${createdCounties[0].name}`, {
        service: "seedCountiesAndGamification",
        action: "assignUser",
        username: "demo.navigator",
        county: createdCounties[0].name
      });
    }
  }

  // Assign demo caseworker to Montgomery County
  const demoCaseworker = await storage.getUserByUsername('demo.caseworker');
  if (demoCaseworker && createdCounties[2]) {
    const existingAssignments = await storage.getUserCounties(demoCaseworker.id);
    if (existingAssignments.length === 0) {
      await storage.assignUserToCounty({
        countyId: createdCounties[2].id,
        userId: demoCaseworker.id,
        role: 'caseworker',
        isPrimary: true,
        assignedBy: null,
      });
      logger.info(`  ✓ Assigned demo.caseworker to ${createdCounties[2].name}`, {
        service: "seedCountiesAndGamification",
        action: "assignUser",
        username: "demo.caseworker",
        county: createdCounties[2].name
      });
    }
  }

  // Seed default achievements
  await achievementSystemService.seedDefaultAchievements();

  logger.info('✅ Multi-County and Gamification data seeding complete', {
    service: "seedCountiesAndGamification",
    action: "complete",
    countiesCreated: createdCounties.length
  });
}
