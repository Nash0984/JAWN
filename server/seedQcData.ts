import { db } from "./db";
import { users } from "@shared/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { logger } from "./services/logger.service";

/**
 * Seed QC Analytics data for Maryland SNAP
 * Run this with: npx tsx server/seedQcData.ts
 */
async function seedQCData() {
  logger.info("📊 Seeding QC Analytics data for Maryland SNAP...", {
    service: "seedQCData",
    action: "start"
  });

  try {
    // Get existing Maryland tenant ID
    const marylandTenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, 'maryland'),
    });

    if (!marylandTenant) {
      logger.error("❌ Maryland tenant not found. Please run seedTenants first.", {
        service: "seedQCData",
        action: "error",
        error: "Tenant not found"
      });
      process.exit(1);
    }

    const marylandId = marylandTenant.id;
    logger.info(`✅ Found Maryland tenant: ${marylandId}`, {
      service: "seedQCData",
      action: "foundTenant",
      tenantId: marylandId
    });

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

    logger.info("✅ Demo users verified/created", {
      service: "seedQCData",
      action: "usersVerified",
      users: ["demo.caseworker", "demo.caseworker2", "demo.supervisor", "demo.navigator"]
    });

    logger.info("📈 QC Analytics Summary", {
      service: "seedQCData",
      action: "summary",
      details: [
        "Demo users created for testing QC Analytics features",
        "Use the QC Analytics service to analyze real client cases"
      ]
    });
    
    logger.info("🎉 QC Analytics seeding completed successfully!", {
      service: "seedQCData",
      action: "complete"
    });
  } catch (error) {
    logger.error("❌ Error seeding QC data", {
      service: "seedQCData",
      action: "error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Run seed if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  seedQCData()
    .then(() => {
      logger.info("Seed completed", {
        service: "seedQCData",
        action: "processComplete"
      });
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Seed failed", {
        service: "seedQCData",
        action: "processFailed",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    });
}

export { seedQCData };
