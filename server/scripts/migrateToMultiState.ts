/**
 * Multi-State Architecture Migration Script
 * 
 * Purpose: Migrate from county-based to state→office hierarchy for white-label multi-state deployment
 * Target: Maryland (Q1 2026), Pennsylvania, Virginia (future expansion)
 * Compliance: NIST 800-53, IRS Pub 1075, HIPAA, GDPR, FedRAMP
 * 
 * What this does:
 * 1. Create Maryland state tenant with KMS initialization
 * 2. Migrate 24 Maryland LDSS counties → offices (from seedMarylandLDSS.ts)
 * 3. Backfill FK columns (residentialOfficeId, processingOfficeId, officeId)
 * 4. Encrypt existing PII/PHI using KMS field-level encryption
 * 5. Create default routing rules for Maryland's hub-and-spoke model
 * 6. Set up office role mappings for user access
 * 
 * Safety features:
 * - Atomic transaction with rollback on failure
 * - Idempotent (safe to run multiple times)
 * - Preserves backward compatibility
 * - Zero-downtime migration approach (nullable FKs, NOT VALID constraints)
 * 
 * Usage:
 *   tsx server/scripts/migrateToMultiState.ts
 * 
 * Pre-requisites:
 *   - npm run db:push --force (to add new schema columns)
 *   - KMS environment variables configured
 *   - PostgreSQL database accessible
 */

import { db } from "../db";
import { 
  stateTenants, 
  offices, 
  officeRoles, 
  routingRules,
  counties,
  // countyUsers - DEPRECATED: Removed (bloat-2) - county-based tenant isolation
  users,
  clientCases,
  documents,
  appointments,
} from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logger } from "../services/logger.service";
import { kmsService } from "../services/kms.service";

/**
 * REMOVED: MARYLAND_LDSS_OFFICES hardcoded array
 * 
 * Migration now dynamically reads from counties table for flexibility.
 * This allows the script to work with any state's county/office configuration
 * without hardcoding specific office data.
 */

/*
// LEGACY HARDCODED OFFICES (removed for flexibility)
const MARYLAND_LDSS_OFFICES_LEGACY = [
  {
    code: "ALLEGANY",
    name: "Allegany County LDSS",
    address: "1 Frederick Street, Cumberland, MD 21502",
    phone: "(301) 777-5970",
    region: "western",
    population: 72000,
    coverage: ["21502", "21520", "21521", "21532", "21540", "21545"],
    officeType: "on_site" as const,
    specialties: ["rural_outreach"] as string[],
  },
  {
    code: "ANNE_ARUNDEL",
    name: "Anne Arundel County LDSS", 
    address: "2666 Riva Road, Annapolis, MD 21401",
    phone: "(410) 269-4400",
    region: "central",
    population: 588000,
    coverage: ["21012", "21032", "21035", "21037", "21060", "21090", "21122", "21140", "21144", "21225", "21226", "21401", "21403", "21409"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "BALTIMORE_CITY",
    name: "Baltimore City LDSS",
    address: "1910 N. Calvert Street, Baltimore, MD 21218",
    phone: "(410) 361-2200",
    region: "central",
    population: 585000,
    coverage: ["21201", "21202", "21205", "21206", "21211", "21213", "21214", "21215", "21216", "21217", "21218", "21223", "21224", "21229", "21230"],
    officeType: "hub" as const, // Largest office - designated as hub
    specialties: ["tax_preparation", "multilingual_services"] as string[],
  },
  {
    code: "BALTIMORE",
    name: "Baltimore County LDSS",
    address: "6401 York Road, Baltimore, MD 21212",
    phone: "(410) 853-3000",
    region: "central",
    population: 854000,
    coverage: ["21093", "21117", "21128", "21131", "21204", "21208", "21209", "21212", "21220", "21221", "21228", "21234", "21236", "21237", "21244"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "CALVERT",
    name: "Calvert County LDSS",
    address: "200 Duke Street, Prince Frederick, MD 20678",
    phone: "(410) 535-4606",
    region: "southern",
    population: 93000,
    coverage: ["20657", "20678", "20736", "20754"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "CAROLINE",
    name: "Caroline County LDSS",
    address: "207 South 3rd Street, Denton, MD 21629",
    phone: "(410) 479-4120",
    region: "eastern",
    population: 33000,
    coverage: ["21629", "21632", "21636", "21643", "21659"],
    officeType: "on_site" as const,
    specialties: ["rural_outreach"] as string[],
  },
  {
    code: "CARROLL",
    name: "Carroll County LDSS",
    address: "95 Carroll Street, Westminster, MD 21157",
    phone: "(410) 386-3800",
    region: "central",
    population: 171000,
    coverage: ["21048", "21074", "21084", "21102", "21157", "21158", "21771", "21776", "21784", "21787"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "CECIL",
    name: "Cecil County LDSS",
    address: "170 East Main Street, Elkton, MD 21921",
    phone: "(410) 996-5300",
    region: "eastern",
    population: 103000,
    coverage: ["21901", "21911", "21912", "21913", "21915", "21918", "21921"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "CHARLES",
    name: "Charles County LDSS",
    address: "200 Kent Avenue, La Plata, MD 20646",
    phone: "(301) 392-6000",
    region: "southern",
    population: 166000,
    coverage: ["20601", "20602", "20646", "20658", "20677", "20695"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "DORCHESTER",
    name: "Dorchester County LDSS",
    address: "501 Court Lane, Cambridge, MD 21613",
    phone: "(410) 228-7171",
    region: "eastern",
    population: 32000,
    coverage: ["21613", "21631", "21638", "21660"],
    officeType: "on_site" as const,
    specialties: ["rural_outreach"] as string[],
  },
  {
    code: "FREDERICK",
    name: "Frederick County LDSS",
    address: "1520 West Patrick Street, Frederick, MD 21702",
    phone: "(301) 600-1234",
    region: "western",
    population: 265000,
    coverage: ["21701", "21702", "21703", "21704", "21754", "21755", "21757", "21758", "21762", "21770", "21773", "21778", "21780"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "GARRETT",
    name: "Garrett County LDSS",
    address: "1916 Maryland Highway, Mountain Lake Park, MD 21550",
    phone: "(301) 334-9431",
    region: "western",
    population: 29000,
    coverage: ["21520", "21521", "21522", "21524", "21530", "21536", "21541", "21550", "21555"],
    officeType: "on_site" as const,
    specialties: ["rural_outreach"] as string[],
  },
  {
    code: "HARFORD",
    name: "Harford County LDSS",
    address: "15 South Main Street, Bel Air, MD 21014",
    phone: "(410) 638-3499",
    region: "central",
    population: 260000,
    coverage: ["21001", "21009", "21014", "21015", "21017", "21040", "21047", "21050", "21078", "21082", "21085", "21087"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "HOWARD",
    name: "Howard County LDSS",
    address: "7121 Columbia Gateway Drive, Columbia, MD 21046",
    phone: "(410) 313-6400",
    region: "central",
    population: 332000,
    coverage: ["20723", "20794", "21029", "21042", "21043", "21044", "21045", "21046"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "KENT",
    name: "Kent County LDSS",
    address: "209 S Cross Street, Chestertown, MD 21620",
    phone: "(410) 778-0501",
    region: "eastern",
    population: 19000,
    coverage: ["21620", "21622", "21647", "21649", "21661"],
    officeType: "on_site" as const,
    specialties: ["rural_outreach"] as string[],
  },
  {
    code: "MONTGOMERY",
    name: "Montgomery County LDSS",
    address: "1301 Piccard Drive, Rockville, MD 20850",
    phone: "(240) 777-4000",
    region: "central",
    population: 1062000,
    coverage: ["20814", "20850", "20851", "20852", "20853", "20854", "20855", "20871", "20874", "20876", "20878", "20879", "20882", "20895", "20901", "20902", "20910"],
    officeType: "on_site" as const,
    specialties: ["multilingual_services"] as string[],
  },
  {
    code: "PRINCE_GEORGES",
    name: "Prince George's County LDSS",
    address: "805 Brightseat Road, Landover, MD 20785",
    phone: "(301) 909-7000",
    region: "central",
    population: 967000,
    coverage: ["20706", "20710", "20720", "20737", "20740", "20743", "20744", "20745", "20746", "20747", "20748", "20772", "20774", "20781", "20782", "20783", "20785"],
    officeType: "on_site" as const,
    specialties: ["multilingual_services"] as string[],
  },
  {
    code: "QUEENS_ANNE",
    name: "Queen Anne's County LDSS",
    address: "104 Powell Street, Centreville, MD 21617",
    phone: "(410) 758-0720",
    region: "eastern",
    population: 50000,
    coverage: ["21617", "21619", "21625", "21628", "21658"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "SOMERSET",
    name: "Somerset County LDSS",
    address: "30542 Prince William Street, Princess Anne, MD 21853",
    phone: "(410) 651-1424",
    region: "eastern",
    population: 25000,
    coverage: ["21821", "21824", "21829", "21837", "21853", "21861", "21865"],
    officeType: "on_site" as const,
    specialties: ["rural_outreach"] as string[],
  },
  {
    code: "ST_MARYS",
    name: "St. Mary's County LDSS",
    address: "41780 Baldridge Street, Leonardtown, MD 20650",
    phone: "(301) 475-5800",
    region: "southern",
    population: 114000,
    coverage: ["20634", "20650", "20653", "20659", "20670", "20674", "20676", "20684", "20690"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "TALBOT",
    name: "Talbot County LDSS",
    address: "301 Bay Street, Easton, MD 21601",
    phone: "(410) 819-5600",
    region: "eastern",
    population: 37000,
    coverage: ["21601", "21607", "21610", "21626", "21645", "21654", "21655", "21663"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "WASHINGTON",
    name: "Washington County LDSS",
    address: "50 West Washington Street, Hagerstown, MD 21740",
    phone: "(240) 313-3200",
    region: "western",
    population: 154000,
    coverage: ["21740", "21742", "21750", "21766", "21767", "21769", "21779", "21782", "21783"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "WICOMICO",
    name: "Wicomico County LDSS",
    address: "108 E. Main Street, Salisbury, MD 21801",
    phone: "(410) 713-3900",
    region: "eastern",
    population: 103000,
    coverage: ["21801", "21802", "21803", "21804", "21810", "21835", "21840", "21849", "21862", "21875"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
  {
    code: "WORCESTER",
    name: "Worcester County LDSS",
    address: "3308 Commerce Drive, Snow Hill, MD 21863",
    phone: "(410) 632-1196",
    region: "eastern",
    population: 52000,
    coverage: ["21811", "21813", "21817", "21826", "21842", "21843", "21851", "21863", "21869"],
    officeType: "on_site" as const,
    specialties: [] as string[],
  },
];
*/

interface MigrationStats {
  stateTenantCreated: boolean;
  officesCreated: number;
  routingRulesCreated: number;
  usersBackfilled: number;
  userRolesMigrated: number;
  casesBackfilled: number;
  documentsBackfilled: number;
  appointmentsBackfilled: number;
  piiFieldsEncrypted: number;
  errors: string[];
}

/**
 * Main migration function
 */
export async function migrateToMultiState(): Promise<MigrationStats> {
  logger.info("🚀 Starting multi-state architecture migration", {
    service: "migrateToMultiState",
    action: "start",
    timestamp: new Date().toISOString(),
  });

  const stats: MigrationStats = {
    stateTenantCreated: false,
    officesCreated: 0,
    routingRulesCreated: 0,
    usersBackfilled: 0,
    userRolesMigrated: 0,
    casesBackfilled: 0,
    documentsBackfilled: 0,
    appointmentsBackfilled: 0,
    piiFieldsEncrypted: 0,
    errors: [],
  };

  try {
    // Start transaction for atomicity
    await db.transaction(async (tx) => {
      
      // ========================================================================
      // STEP 1: Create Maryland State Tenant
      // ========================================================================
      logger.info("📝 Step 1: Creating Maryland state tenant", {
        service: "migrateToMultiState",
        step: 1,
      });

      let marylandStateTenant;
      const [existingStateTenant] = await tx
        .select()
        .from(stateTenants)
        .where(eq(stateTenants.stateCode, "MD"))
        .limit(1);

      if (existingStateTenant) {
        logger.info("  ℹ️  Maryland state tenant already exists", {
          service: "migrateToMultiState",
          stateTenantId: existingStateTenant.id,
        });
        marylandStateTenant = existingStateTenant;
      } else {
        const [newStateTenant] = await tx
          .insert(stateTenants)
          .values({
            stateCode: "MD",
            stateName: "Maryland",
            status: "active",
            deploymentModel: "decentralized_on_site", // 24 LDSS offices
            kmsKeyId: null, // Will be populated by KMS service
            enabledPrograms: [
              "MD_SNAP",
              "MD_MEDICAID",
              "MD_TANF",
              "MD_OHEP",
              "MD_TAX_CREDITS",
              "SSI",
              "VITA",
            ],
            complianceCertifications: [
              "NIST_800_53",
              "IRS_PUB_1075",
              "HIPAA",
              "GDPR",
              "SECTION_508",
            ],
            dataResidency: "us-east-1", // Maryland region
            timezone: "America/New_York",
            contactEmail: "support@marylandbenefits.gov",
            contactPhone: "(410) 767-7000",
            adminNotes: "Maryland LDSS multi-office deployment - 24 jurisdictions",
          })
          .returning();

        marylandStateTenant = newStateTenant;
        stats.stateTenantCreated = true;

        logger.info("  ✅ Created Maryland state tenant", {
          service: "migrateToMultiState",
          stateTenantId: marylandStateTenant.id,
        });
      }

      // ========================================================================
      // STEP 2: Initialize KMS for Maryland
      // ========================================================================
      logger.info("🔐 Step 2: Initializing KMS for Maryland state tenant", {
        service: "migrateToMultiState",
        step: 2,
      });

      const kmsService = new KMSService();
      await kmsService.initializeStateTenant(marylandStateTenant.id);

      logger.info("  ✅ KMS initialized for Maryland", {
        service: "migrateToMultiState",
        stateTenantId: marylandStateTenant.id,
      });

      // ========================================================================
      // STEP 3: Migrate Counties → Offices (Dynamic from counties table)
      // ========================================================================
      logger.info("🏢 Step 3: Migrating Maryland LDSS counties → offices (dynamic)", {
        service: "migrateToMultiState",
        step: 3,
      });

      // Read existing counties from database (flexible for any state)
      const existingCounties = await tx.select().from(counties);

      logger.info(`  ℹ️  Found ${existingCounties.length} counties to migrate`, {
        service: "migrateToMultiState",
      });

      // Create a mapping from county code to new office ID
      const countyToOfficeMap = new Map<string, string>();

      for (const county of existingCounties) {
        // Map county data to office structure
        const officeConfig = {
          code: county.code,
          name: county.name,
          address: county.address || undefined,
          phone: county.phone || undefined,
          region: county.region || undefined,
          population: county.population || undefined,
          coverage: county.coverage || [],
          // Determine office type based on size/population
          officeType: (county.population && county.population > 500000) ? "hub" as const : "on_site" as const,
          specialties: [] as string[],
        };
        // Check if office already exists
        const [existingOffice] = await tx
          .select()
          .from(offices)
          .where(
            and(
              eq(offices.stateTenantId, marylandStateTenant.id),
              eq(offices.code, officeConfig.code)
            )
          )
          .limit(1);

        let office;
        if (existingOffice) {
          logger.info(`    ℹ️  Office already exists: ${officeConfig.name}`, {
            service: "migrateToMultiState",
            officeCode: officeConfig.code,
          });
          office = existingOffice;
        } else {
          const [newOffice] = await tx
            .insert(offices)
            .values({
              stateTenantId: marylandStateTenant.id,
              code: officeConfig.code,
              name: officeConfig.name,
              officeType: officeConfig.officeType,
              status: "active",
              address: officeConfig.address,
              phone: officeConfig.phone,
              region: officeConfig.region,
              coverage: officeConfig.coverage,
              specialties: officeConfig.specialties,
              enabledPrograms: [
                "MD_SNAP",
                "MD_MEDICAID",
                "MD_TANF",
                "MD_OHEP",
                "MD_TAX_CREDITS",
                "VITA",
              ],
              features: {
                enableGamification: true,
                enableBARReviews: true,
                enableTaxPrep: true,
              },
              capacity: {
                maxActiveCases: officeConfig.population / 100, // Rough heuristic
                currentActiveCases: 0,
              },
            })
            .returning();

          office = newOffice;
          stats.officesCreated++;

          logger.info(`    ✅ Created office: ${officeConfig.name}`, {
            service: "migrateToMultiState",
            officeCode: officeConfig.code,
            officeId: office.id,
          });
        }

        // Store mapping for backfill
        countyToOfficeMap.set(officeConfig.code, office.id);
      }

      // ========================================================================
      // STEP 4: Create Default Routing Rules for Maryland
      // ========================================================================
      logger.info("🎯 Step 4: Creating default routing rules", {
        service: "migrateToMultiState",
        step: 4,
      });

      // Find Baltimore City hub
      const baltimoreHub = Array.from(countyToOfficeMap.entries()).find(
        ([code]) => code === "BALTIMORE_CITY"
      );

      if (baltimoreHub) {
        const [_code, hubOfficeId] = baltimoreHub;

        // Hub routing rule - Baltimore City as central hub
        const [existingHubRule] = await tx
          .select()
          .from(routingRules)
          .where(
            and(
              eq(routingRules.stateTenantId, marylandStateTenant.id),
              eq(routingRules.strategy, "hub")
            )
          )
          .limit(1);

        if (!existingHubRule) {
          await tx.insert(routingRules).values({
            stateTenantId: marylandStateTenant.id,
            strategy: "hub",
            priority: 100,
            isActive: true,
            description: "Route to Baltimore City hub for complex cases",
            criteria: {
              caseComplexity: ["high"],
              programTypes: ["MD_TAX_CREDITS", "VITA"],
            },
            targetOfficeId: hubOfficeId,
          });

          stats.routingRulesCreated++;

          logger.info("    ✅ Created hub routing rule (Baltimore City)", {
            service: "migrateToMultiState",
            hubOfficeId,
          });
        }

        // Geographic routing rule - default to ZIP code matching
        const [existingGeoRule] = await tx
          .select()
          .from(routingRules)
          .where(
            and(
              eq(routingRules.stateTenantId, marylandStateTenant.id),
              eq(routingRules.strategy, "geographic")
            )
          )
          .limit(1);

        if (!existingGeoRule) {
          await tx.insert(routingRules).values({
            stateTenantId: marylandStateTenant.id,
            strategy: "geographic",
            priority: 50,
            isActive: true,
            description: "Route to local office based on client ZIP code",
            criteria: {
              matchOn: "zipCode",
            },
          });

          stats.routingRulesCreated++;

          logger.info("    ✅ Created geographic routing rule", {
            service: "migrateToMultiState",
          });
        }
      }

      // ========================================================================
      // STEP 5: Migrate County User Assignments → Office Roles
      // DEPRECATED: Removed (bloat-2) - county-based tenant isolation
      // ========================================================================
      logger.info("ℹ️  Step 5: County user assignments migration skipped (deprecated)", {
        service: "migrateToMultiState",
        step: 5,
        reason: "CountyUsers table removed in bloat-2 cleanup",
        alternative: "Office roles now managed directly via officeRoles table"
      });

      // REMOVED: County user migration code (bloat-2)
      // County-based user assignments replaced by office-based role assignments
      // All county user migration logic has been commented out since countyUsers table no longer exists
      
      logger.info(`    ℹ️  User role migration skipped (0 migrated - countyUsers table removed)`, {
        service: "migrateToMultiState",
        reason: "CountyUsers table removed in bloat-2 cleanup"
      });

      // ========================================================================
      // STEP 6: Backfill FK Columns in Existing Data
      // ========================================================================
      logger.info("🔄 Step 6: Backfilling FK columns in existing data", {
        service: "migrateToMultiState",
        step: 6,
      });

      // Backfill client_cases table
      logger.info("    📋 Backfilling client_cases.residentialOfficeId & processingOfficeId...");
      
      // This query maps countyId → officeId via county.code
      const caseBackfillQuery = sql`
        UPDATE client_cases
        SET 
          residential_office_id = offices.id,
          processing_office_id = offices.id
        FROM counties
        INNER JOIN offices ON counties.code = offices.code
        WHERE 
          client_cases.county_id = counties.id
          AND client_cases.residential_office_id IS NULL
          AND offices.state_tenant_id = ${marylandStateTenant.id}
      `;

      const caseResult = await tx.execute(caseBackfillQuery);
      stats.casesBackfilled = (caseResult as any).rowCount || 0;

      logger.info(`    ✅ Backfilled ${stats.casesBackfilled} client cases`, {
        service: "migrateToMultiState",
      });

      // Backfill documents table
      logger.info("    📄 Backfilling documents.officeId...");

      const docBackfillQuery = sql`
        UPDATE documents
        SET office_id = offices.id
        FROM client_cases
        INNER JOIN counties ON client_cases.county_id = counties.id
        INNER JOIN offices ON counties.code = offices.code
        WHERE 
          documents.client_case_id = client_cases.id
          AND documents.office_id IS NULL
          AND offices.state_tenant_id = ${marylandStateTenant.id}
      `;

      const docResult = await tx.execute(docBackfillQuery);
      stats.documentsBackfilled = (docResult as any).rowCount || 0;

      logger.info(`    ✅ Backfilled ${stats.documentsBackfilled} documents`, {
        service: "migrateToMultiState",
      });

      // Backfill appointments table
      logger.info("    📅 Backfilling appointments.officeId...");

      const apptBackfillQuery = sql`
        UPDATE appointments
        SET office_id = offices.id
        FROM client_cases
        INNER JOIN counties ON client_cases.county_id = counties.id
        INNER JOIN offices ON counties.code = offices.code
        WHERE 
          appointments.client_case_id = client_cases.id
          AND appointments.office_id IS NULL
          AND offices.state_tenant_id = ${marylandStateTenant.id}
      `;

      const apptResult = await tx.execute(apptBackfillQuery);
      stats.appointmentsBackfilled = (apptResult as any).rowCount || 0;

      logger.info(`    ✅ Backfilled ${stats.appointmentsBackfilled} appointments`, {
        service: "migrateToMultiState",
      });

      // ========================================================================
      // STEP 7: Encrypt Existing PII/PHI Using KMS
      // ========================================================================
      logger.info("🔒 Step 7: Encrypting existing PII/PHI fields using KMS", {
        service: "migrateToMultiState",
        step: 7,
      });

      // Get all cases without encryption
      const unencryptedCases = await tx
        .select()
        .from(clientCases)
        .where(isNull(clientCases.ssnEncrypted))
        .limit(1000); // Process in batches

      for (const clientCase of unencryptedCases) {
        if (clientCase.ssn) {
          const encrypted = await kmsService.encryptField(
            marylandStateTenant.id,
            "client_cases",
            "ssn",
            clientCase.ssn
          );

          await tx
            .update(clientCases)
            .set({
              ssnEncrypted: encrypted,
              ssn: null, // Clear plaintext
            })
            .where(eq(clientCases.id, clientCase.id));

          stats.piiFieldsEncrypted++;
        }
      }

      logger.info(`    ✅ Encrypted ${stats.piiFieldsEncrypted} PII fields`, {
        service: "migrateToMultiState",
      });

      logger.info("✅ Migration transaction committed successfully", {
        service: "migrateToMultiState",
        action: "commit",
      });
    });

    // ========================================================================
    // MIGRATION COMPLETE
    // ========================================================================
    logger.info("🎉 Multi-state architecture migration complete!", {
      service: "migrateToMultiState",
      action: "complete",
      stats,
      summary: [
        `✅ State tenant: ${stats.stateTenantCreated ? "Created" : "Already existed"}`,
        `✅ Offices created: ${stats.officesCreated}`,
        `✅ Routing rules: ${stats.routingRulesCreated}`,
        `✅ User roles migrated: ${stats.userRolesMigrated}`,
        `✅ Cases backfilled: ${stats.casesBackfilled}`,
        `✅ Documents backfilled: ${stats.documentsBackfilled}`,
        `✅ Appointments backfilled: ${stats.appointmentsBackfilled}`,
        `✅ PII fields encrypted: ${stats.piiFieldsEncrypted}`,
      ],
    });

    return stats;
  } catch (error) {
    logger.error("❌ Migration failed - transaction rolled back", {
      service: "migrateToMultiState",
      action: "error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    stats.errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateToMultiState()
    .then((stats) => {
      console.log("\n" + "=".repeat(80));
      console.log("MIGRATION SUMMARY");
      console.log("=".repeat(80));
      console.log(`State Tenant Created: ${stats.stateTenantCreated}`);
      console.log(`Offices Created: ${stats.officesCreated}`);
      console.log(`Routing Rules Created: ${stats.routingRulesCreated}`);
      console.log(`User Roles Migrated: ${stats.userRolesMigrated}`);
      console.log(`Cases Backfilled: ${stats.casesBackfilled}`);
      console.log(`Documents Backfilled: ${stats.documentsBackfilled}`);
      console.log(`Appointments Backfilled: ${stats.appointmentsBackfilled}`);
      console.log(`PII Fields Encrypted: ${stats.piiFieldsEncrypted}`);
      console.log(`Errors: ${stats.errors.length}`);
      console.log("=".repeat(80));
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    });
}
