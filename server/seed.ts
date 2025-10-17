import { db } from "./db";
import { tenants, tenantBranding, apiKeys, users, qcErrorPatterns, flaggedCases, jobAids, trainingInterventions } from "@shared/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { 
  generateQCErrorPatterns, 
  generateFlaggedCases, 
  generateJobAids, 
  generateTrainingInterventions 
} from "./services/qcSyntheticData";
import { seedDemoMetrics } from './seeds/demoMetrics';
import { seedIRSConsentForm } from './seeds/irsConsentForm';

/**
 * Seed initial tenants and their branding
 * Run this with: npm run seed or tsx server/seed.ts
 */
async function seedTenants() {
  console.log("🌱 Seeding tenant data...");

  try {
    // Maryland State Tenant
    const marylandId = nanoid();
    await db.insert(tenants).values({
      id: marylandId,
      slug: "maryland",
      name: "Maryland Department of Human Services",
      type: "state",
      status: "active",
      domain: "benefits.maryland.gov",
      config: {
        features: {
          vitaTaxPreparation: true,
          benefitScreener: true,
          documentVerification: true,
        },
        settings: {
          maxUploadSize: 10485760, // 10MB
          allowedFileTypes: ["pdf", "jpg", "png", "docx"],
        },
      },
    }).onConflictDoNothing();

    await db.insert(tenantBranding).values({
      id: nanoid(),
      tenantId: marylandId,
      primaryColor: "#0D4F8B", // Maryland DHS Blue
      secondaryColor: "#1E88E5",
      logoUrl: null,
      faviconUrl: null,
      customCss: null,
      headerHtml: null,
      footerHtml: null,
    }).onConflictDoNothing();

    console.log("✅ Maryland tenant created");

    // Baltimore City County Tenant (under Maryland)
    const baltimoreId = nanoid();
    await db.insert(tenants).values({
      id: baltimoreId,
      slug: "baltimore-city",
      name: "Baltimore City Department of Social Services",
      type: "county",
      parentTenantId: marylandId,
      status: "active",
      domain: "benefits.baltimorecity.gov",
      config: {
        features: {
          vitaTaxPreparation: true,
          benefitScreener: true,
          documentVerification: true,
        },
      },
    }).onConflictDoNothing();

    await db.insert(tenantBranding).values({
      id: nanoid(),
      tenantId: baltimoreId,
      primaryColor: "#00539B", // Baltimore City Blue
      secondaryColor: "#FFB81C", // Baltimore Gold
      logoUrl: null,
      faviconUrl: null,
      customCss: null,
      headerHtml: null,
      footerHtml: null,
    }).onConflictDoNothing();

    console.log("✅ Baltimore City tenant created");

    // Virginia State Tenant (Demo)
    const virginiaId = nanoid();
    await db.insert(tenants).values({
      id: virginiaId,
      slug: "virginia",
      name: "Virginia Department of Social Services",
      type: "state",
      status: "demo",
      domain: "benefits.virginia.gov",
      config: {
        features: {
          vitaTaxPreparation: true,
          benefitScreener: true,
          documentVerification: false,
        },
      },
    }).onConflictDoNothing();

    await db.insert(tenantBranding).values({
      id: nanoid(),
      tenantId: virginiaId,
      primaryColor: "#003B5C", // Virginia Blue
      secondaryColor: "#E57200", // Virginia Orange
      logoUrl: null,
      faviconUrl: null,
      customCss: null,
      headerHtml: null,
      footerHtml: null,
    }).onConflictDoNothing();

    console.log("✅ Virginia tenant created");

    // Generic Template Tenant
    const templateId = nanoid();
    await db.insert(tenants).values({
      id: templateId,
      slug: "template",
      name: "Benefits Portal Template",
      type: "state",
      status: "inactive",
      domain: null,
      config: {
        features: {
          vitaTaxPreparation: true,
          benefitScreener: true,
          documentVerification: true,
        },
      },
    }).onConflictDoNothing();

    await db.insert(tenantBranding).values({
      id: nanoid(),
      tenantId: templateId,
      primaryColor: "#2563EB", // Generic Blue
      secondaryColor: "#7C3AED", // Generic Purple
      logoUrl: null,
      faviconUrl: null,
      customCss: null,
      headerHtml: null,
      footerHtml: null,
    }).onConflictDoNothing();

    console.log("✅ Template tenant created");

    // ========================================================================
    // DEMO API KEYS - For testing third-party integrations
    // ========================================================================
    
    console.log("🔑 Creating demo API keys...");
    
    // Demo API key for Maryland tenant
    const demoApiKey = `md_demo_${nanoid()}`;
    const hashedDemoKey = await bcrypt.hash(demoApiKey, 10);
    
    await db.insert(apiKeys).values({
      id: nanoid(),
      key: hashedDemoKey,
      name: "Demo Community Services Organization",
      tenantId: marylandId,
      scopes: ['eligibility:read', 'documents:write', 'screener:read', 'programs:read'],
      rateLimit: 1000,
      status: 'active',
    }).onConflictDoNothing();
    
    console.log("✅ Demo API key created for Maryland tenant");
    console.log(`   API Key: ${demoApiKey}`);
    console.log(`   Scopes: eligibility:read, documents:write, screener:read, programs:read`);
    console.log(`   Rate Limit: 1000 requests/hour`);
    console.log(`   ⚠️  Save this key - it won't be shown again!`);

    // ========================================================================
    // QC ANALYTICS - Synthetic Data for Maryland SNAP Predictive Analytics
    // ========================================================================
    
    console.log("📊 Seeding QC Analytics data...");

    // Create demo users for caseworkers and supervisors
    const demoCaseworker1 = nanoid();
    await db.insert(users).values({
      id: demoCaseworker1,
      username: "demo.caseworker",
      password: await bcrypt.hash("demo123", 10),
      email: "caseworker@demo.maryland.gov",
      fullName: "Demo Caseworker",
      role: "caseworker",
      tenantId: marylandId,
      dhsEmployeeId: "CW-12345",
      officeLocation: "Baltimore City DSS",
      isActive: true,
    }).onConflictDoNothing();

    const demoCaseworker2 = nanoid();
    await db.insert(users).values({
      id: demoCaseworker2,
      username: "demo.caseworker2",
      password: await bcrypt.hash("demo123", 10),
      email: "caseworker2@demo.maryland.gov",
      fullName: "Sarah Johnson",
      role: "caseworker",
      tenantId: marylandId,
      dhsEmployeeId: "CW-23456",
      officeLocation: "Baltimore County DSS",
      isActive: true,
    }).onConflictDoNothing();

    const demoSupervisor = nanoid();
    await db.insert(users).values({
      id: demoSupervisor,
      username: "demo.supervisor",
      password: await bcrypt.hash("demo123", 10),
      email: "supervisor@demo.maryland.gov",
      fullName: "Michael Chen",
      role: "admin",
      tenantId: marylandId,
      dhsEmployeeId: "SV-34567",
      officeLocation: "Baltimore City DSS",
      isActive: true,
    }).onConflictDoNothing();

    const demoNavigator = nanoid();
    await db.insert(users).values({
      id: demoNavigator,
      username: "demo.navigator",
      password: await bcrypt.hash("demo123", 10),
      email: "navigator@demo.maryland.gov",
      fullName: "Emily Rodriguez",
      role: "navigator",
      tenantId: marylandId,
      dhsEmployeeId: "NV-45678",
      officeLocation: "Baltimore City Community Center",
      isActive: true,
    }).onConflictDoNothing();

    console.log("✅ Demo users created");

    // Generate and insert QC Error Patterns
    const errorPatterns = generateQCErrorPatterns();
    for (const pattern of errorPatterns) {
      await db.insert(qcErrorPatterns).values(pattern).onConflictDoNothing();
    }
    console.log(`✅ Created ${errorPatterns.length} QC error patterns`);

    // Generate and insert Flagged Cases
    const flaggedCases1 = generateFlaggedCases(demoCaseworker1, 12);
    const flaggedCases2 = generateFlaggedCases(demoCaseworker2, 8);
    const flaggedCasesNavigator = generateFlaggedCases(demoNavigator, 6);

    for (const flaggedCase of [...flaggedCases1, ...flaggedCases2, ...flaggedCasesNavigator]) {
      await db.insert(flaggedCases).values(flaggedCase).onConflictDoNothing();
    }
    console.log(`✅ Created ${flaggedCases1.length + flaggedCases2.length + flaggedCasesNavigator.length} flagged cases`);

    // Generate and insert Job Aids
    const jobAidsList = generateJobAids();
    for (const jobAid of jobAidsList) {
      await db.insert(jobAids).values(jobAid).onConflictDoNothing();
    }
    console.log(`✅ Created ${jobAidsList.length} job aids`);

    // Generate and insert Training Interventions
    const allUserIds = [demoCaseworker1, demoCaseworker2, demoNavigator, demoSupervisor];
    const interventions = generateTrainingInterventions(allUserIds);
    for (const intervention of interventions) {
      await db.insert(trainingInterventions).values(intervention).onConflictDoNothing();
    }
    console.log(`✅ Created ${interventions.length} training interventions`);

    console.log("\n📈 QC Analytics Summary:");
    console.log("   • Error Patterns: Showing 500% spike in Shelter & Utility errors (Q4 2024)");
    console.log("   • Flagged Cases: High-risk cases ready for supervisor review");
    console.log("   • Job Aids: Comprehensive training materials for caseworkers");
    console.log("   • Training Impact: Demonstrating measurable error rate improvements");
    
    // Seed demo metrics for monitoring dashboard
    await seedDemoMetrics();
    
    // Seed IRS Use & Disclosure consent form
    await seedIRSConsentForm();
    
    console.log("\n🎉 Tenant, API key, QC Analytics, Demo Metrics, and IRS Consent Form seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding tenants:", error);
    throw error;
  }
}

// Run seed if this file is executed directly
// For ES modules, we check if this is the main module using import.meta.url
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  seedTenants()
    .then(() => {
      console.log("Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedTenants };
