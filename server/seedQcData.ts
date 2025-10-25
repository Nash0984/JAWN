import { db } from "./db";
import { users } from "@shared/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

/**
 * Seed QC Analytics data for Maryland SNAP
 * Run this with: npx tsx server/seedQcData.ts
 */
async function seedQCData() {
  console.log("📊 Seeding QC Analytics data for Maryland SNAP...");

  try {
    // Get existing Maryland tenant ID
    const marylandTenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, 'maryland'),
    });

    if (!marylandTenant) {
      console.error("❌ Maryland tenant not found. Please run seedTenants first.");
      process.exit(1);
    }

    const marylandId = marylandTenant.id;
    console.log(`✅ Found Maryland tenant: ${marylandId}`);

    // Get existing demo users or create new ones
    let demoCaseworker1 = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'demo.caseworker'),
    });

    if (!demoCaseworker1) {
      const newId = nanoid();
      await db.insert(users).values({
        id: newId,
        username: "demo.caseworker",
        password: await bcrypt.hash("demo123", 10),
        email: "caseworker@demo.maryland.gov",
        fullName: "Demo Caseworker",
        role: "caseworker",
        tenantId: marylandId,
        dhsEmployeeId: "CW-12345",
        officeLocation: "Baltimore City DSS",
        isActive: true,
      });
      demoCaseworker1 = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, newId),
      });
    }

    let demoCaseworker2 = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'demo.caseworker2'),
    });

    if (!demoCaseworker2) {
      const newId = nanoid();
      await db.insert(users).values({
        id: newId,
        username: "demo.caseworker2",
        password: await bcrypt.hash("demo123", 10),
        email: "caseworker2@demo.maryland.gov",
        fullName: "Sarah Johnson",
        role: "caseworker",
        tenantId: marylandId,
        dhsEmployeeId: "CW-23456",
        officeLocation: "Baltimore County DSS",
        isActive: true,
      });
      demoCaseworker2 = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, newId),
      });
    }

    let demoSupervisor = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'demo.supervisor'),
    });

    if (!demoSupervisor) {
      const newId = nanoid();
      await db.insert(users).values({
        id: newId,
        username: "demo.supervisor",
        password: await bcrypt.hash("demo123", 10),
        email: "supervisor@demo.maryland.gov",
        fullName: "Michael Chen",
        role: "admin",
        tenantId: marylandId,
        dhsEmployeeId: "SV-34567",
        officeLocation: "Baltimore City DSS",
        isActive: true,
      });
      demoSupervisor = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, newId),
      });
    }

    let demoNavigator = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'demo.navigator'),
    });

    if (!demoNavigator) {
      const newId = nanoid();
      await db.insert(users).values({
        id: newId,
        username: "demo.navigator",
        password: await bcrypt.hash("demo123", 10),
        email: "navigator@demo.maryland.gov",
        fullName: "Emily Rodriguez",
        role: "navigator",
        tenantId: marylandId,
        dhsEmployeeId: "NV-45678",
        officeLocation: "Baltimore City Community Center",
        isActive: true,
      });
      demoNavigator = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, newId),
      });
    }

    console.log("✅ Demo users verified/created");

    console.log("\n📈 QC Analytics Summary:");
    console.log("   • Demo users created for testing QC Analytics features");
    console.log("   • Use the QC Analytics service to analyze real client cases");
    
    console.log("\n🎉 QC Analytics seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding QC data:", error);
    throw error;
  }
}

// Run seed if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  seedQCData()
    .then(() => {
      console.log("Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedQCData };
