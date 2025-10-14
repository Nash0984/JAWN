import { db } from "./db";
import { tenants, tenantBranding, apiKeys } from "@shared/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

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

    console.log("🎉 Tenant and API key seeding completed successfully!");
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
