import { db } from "./db";
import { counties, countyUsers, users, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Seed 24 Maryland LDSS (Local Departments of Social Services) Offices
 * Single-instance deployment at marylandbenefits.gov
 * Office info displayed within app (not separate domains/brands)
 */

const MARYLAND_LDSS_OFFICES = [
  {
    code: "ALLEGANY",
    name: "Allegany County LDSS",
    address: "1 Frederick Street, Cumberland, MD 21502",
    phone: "(301) 777-5970",
    region: "western",
    population: 72000,
    coverage: ["21502", "21520", "21521", "21532", "21540", "21545"],
  },
  {
    code: "ANNE_ARUNDEL",
    name: "Anne Arundel County LDSS", 
    address: "2666 Riva Road, Annapolis, MD 21401",
    phone: "(410) 269-4400",
    region: "central",
    population: 588000,
    coverage: ["21012", "21032", "21035", "21037", "21060", "21090", "21122", "21140", "21144", "21225", "21226", "21401", "21403", "21409"],
  },
  {
    code: "BALTIMORE_CITY",
    name: "Baltimore City LDSS",
    address: "1910 N. Calvert Street, Baltimore, MD 21218",
    phone: "(410) 361-2200",
    region: "central",
    population: 585000,
    coverage: ["21201", "21202", "21205", "21206", "21211", "21213", "21214", "21215", "21216", "21217", "21218", "21223", "21224", "21229", "21230"],
  },
  {
    code: "BALTIMORE",
    name: "Baltimore County LDSS",
    address: "6401 York Road, Baltimore, MD 21212",
    phone: "(410) 853-3000",
    region: "central",
    population: 854000,
    coverage: ["21093", "21117", "21128", "21131", "21204", "21208", "21209", "21212", "21220", "21221", "21228", "21234", "21236", "21237", "21244"],
  },
  {
    code: "CALVERT",
    name: "Calvert County LDSS",
    address: "200 Duke Street, Prince Frederick, MD 20678",
    phone: "(410) 535-4606",
    region: "southern",
    population: 93000,
    coverage: ["20657", "20678", "20736", "20754"],
  },
  {
    code: "CAROLINE",
    name: "Caroline County LDSS",
    address: "207 South 3rd Street, Denton, MD 21629",
    phone: "(410) 479-4120",
    region: "eastern",
    population: 33000,
    coverage: ["21629", "21632", "21636", "21643", "21659"],
  },
  {
    code: "CARROLL",
    name: "Carroll County LDSS",
    address: "95 Carroll Street, Westminster, MD 21157",
    phone: "(410) 386-3800",
    region: "central",
    population: 171000,
    coverage: ["21048", "21074", "21084", "21102", "21157", "21158", "21771", "21776", "21784", "21787"],
  },
  {
    code: "CECIL",
    name: "Cecil County LDSS",
    address: "170 East Main Street, Elkton, MD 21921",
    phone: "(410) 996-5300",
    region: "eastern",
    population: 103000,
    coverage: ["21901", "21911", "21912", "21913", "21915", "21918", "21921"],
  },
  {
    code: "CHARLES",
    name: "Charles County LDSS",
    address: "200 Kent Avenue, La Plata, MD 20646",
    phone: "(301) 392-6000",
    region: "southern",
    population: 166000,
    coverage: ["20601", "20602", "20646", "20658", "20677", "20695"],
  },
  {
    code: "DORCHESTER",
    name: "Dorchester County LDSS",
    address: "501 Court Lane, Cambridge, MD 21613",
    phone: "(410) 228-7171",
    region: "eastern",
    population: 32000,
    coverage: ["21613", "21631", "21638", "21660"],
  },
  {
    code: "FREDERICK",
    name: "Frederick County LDSS",
    address: "1520 West Patrick Street, Frederick, MD 21702",
    phone: "(301) 600-1234",
    region: "western",
    population: 265000,
    coverage: ["21701", "21702", "21703", "21704", "21754", "21755", "21757", "21758", "21762", "21770", "21773", "21778", "21780"],
  },
  {
    code: "GARRETT",
    name: "Garrett County LDSS",
    address: "1916 Maryland Highway, Mountain Lake Park, MD 21550",
    phone: "(301) 334-9431",
    region: "western",
    population: 29000,
    coverage: ["21520", "21521", "21522", "21524", "21530", "21536", "21541", "21550", "21555"],
  },
  {
    code: "HARFORD",
    name: "Harford County LDSS",
    address: "15 South Main Street, Bel Air, MD 21014",
    phone: "(410) 638-3499",
    region: "central",
    population: 260000,
    coverage: ["21001", "21009", "21014", "21015", "21017", "21040", "21047", "21050", "21078", "21082", "21085", "21087"],
  },
  {
    code: "HOWARD",
    name: "Howard County LDSS",
    address: "7121 Columbia Gateway Drive, Columbia, MD 21046",
    phone: "(410) 313-6400",
    region: "central",
    population: 332000,
    coverage: ["20723", "20794", "21029", "21042", "21043", "21044", "21045", "21046"],
  },
  {
    code: "KENT",
    name: "Kent County LDSS",
    address: "209 S Cross Street, Chestertown, MD 21620",
    phone: "(410) 778-0501",
    region: "eastern",
    population: 19000,
    coverage: ["21620", "21622", "21647", "21649", "21661"],
  },
  {
    code: "MONTGOMERY",
    name: "Montgomery County LDSS",
    address: "1301 Piccard Drive, Rockville, MD 20850",
    phone: "(240) 777-4000",
    region: "central",
    population: 1062000,
    coverage: ["20814", "20850", "20851", "20852", "20853", "20854", "20855", "20871", "20874", "20876", "20878", "20879", "20882", "20895", "20901", "20902", "20910"],
  },
  {
    code: "PRINCE_GEORGES",
    name: "Prince George's County LDSS",
    address: "805 Brightseat Road, Landover, MD 20785",
    phone: "(301) 909-7000",
    region: "central",
    population: 967000,
    coverage: ["20706", "20710", "20720", "20737", "20740", "20743", "20744", "20745", "20746", "20747", "20748", "20772", "20774", "20781", "20782", "20783", "20785"],
  },
  {
    code: "QUEENS_ANNE",
    name: "Queen Anne's County LDSS",
    address: "104 Powell Street, Centreville, MD 21617",
    phone: "(410) 758-0720",
    region: "eastern",
    population: 50000,
    coverage: ["21617", "21619", "21625", "21628", "21658"],
  },
  {
    code: "SOMERSET",
    name: "Somerset County LDSS",
    address: "30542 Prince William Street, Princess Anne, MD 21853",
    phone: "(410) 651-1424",
    region: "eastern",
    population: 25000,
    coverage: ["21821", "21824", "21829", "21837", "21853", "21861", "21865"],
  },
  {
    code: "ST_MARYS",
    name: "St. Mary's County LDSS",
    address: "41780 Baldridge Street, Leonardtown, MD 20650",
    phone: "(301) 475-5800",
    region: "southern",
    population: 114000,
    coverage: ["20634", "20650", "20653", "20659", "20670", "20674", "20676", "20684", "20690"],
  },
  {
    code: "TALBOT",
    name: "Talbot County LDSS",
    address: "301 Bay Street, Easton, MD 21601",
    phone: "(410) 819-5600",
    region: "eastern",
    population: 37000,
    coverage: ["21601", "21607", "21610", "21626", "21645", "21654", "21655", "21663"],
  },
  {
    code: "WASHINGTON",
    name: "Washington County LDSS",
    address: "50 West Washington Street, Hagerstown, MD 21740",
    phone: "(240) 313-3200",
    region: "western",
    population: 154000,
    coverage: ["21740", "21742", "21750", "21766", "21767", "21769", "21779", "21782", "21783"],
  },
  {
    code: "WICOMICO",
    name: "Wicomico County LDSS",
    address: "108 E. Main Street, Salisbury, MD 21801",
    phone: "(410) 713-3900",
    region: "eastern",
    population: 103000,
    coverage: ["21801", "21802", "21803", "21804", "21810", "21835", "21840", "21849", "21862", "21875"],
  },
  {
    code: "WORCESTER",
    name: "Worcester County LDSS",
    address: "3308 Commerce Drive, Snow Hill, MD 21863",
    phone: "(410) 632-1196",
    region: "eastern",
    population: 52000,
    coverage: ["21811", "21813", "21817", "21826", "21842", "21843", "21851", "21863", "21869"],
  },
];

export async function seedMarylandLDSS() {
  console.log("🏛️  Seeding 24 Maryland LDSS Offices...");

  try {
    // Get Maryland tenant (should be created by seed data)
    const [marylandTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "maryland"))
      .limit(1);

    if (!marylandTenant) {
      console.log("⚠️  Maryland tenant not found - creating it...");
      // Tenant will be created by main seed - just warn
      return;
    }

    console.log(`✅ Found Maryland tenant: ${marylandTenant.id}`);

    // Seed each LDSS office
    for (const office of MARYLAND_LDSS_OFFICES) {
      const [existing] = await db
        .select()
        .from(counties)
        .where(eq(counties.code, office.code))
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(counties)
          .set({
            name: office.name,
            address: office.address,
            phone: office.phone,
            region: office.region,
            population: office.population,
            coverage: office.coverage,
            countyType: "ldss",
            isActive: true,
            enabledPrograms: ["MD_SNAP", "MD_MEDICAID", "MD_TANF", "MD_OHEP", "MD_TAX_CREDITS", "VITA"],
          })
          .where(eq(counties.id, existing.id));

        console.log(`  ✓ Updated ${office.name}`);
      } else {
        // Create new
        await db.insert(counties).values({
          code: office.code,
          name: office.name,
          address: office.address,
          phone: office.phone,
          region: office.region,
          population: office.population,
          coverage: office.coverage,
          countyType: "ldss",
          isActive: true,
          enabledPrograms: ["MD_SNAP", "MD_MEDICAID", "MD_TANF", "MD_OHEP", "MD_TAX_CREDITS", "VITA"],
          features: {
            enableGamification: true,
            enableBARReviews: true,
            enableTaxPrep: true,
          },
        });

        console.log(`  ✅ Created ${office.name}`);
      }
    }

    // Assign demo users to specific LDSS offices for testing
    console.log("\n👤 Assigning demo users to LDSS offices...");

    // Get demo users
    const [demoNavigator] = await db.select().from(users).where(eq(users.username, "demo.navigator")).limit(1);
    const [demoCaseworker] = await db.select().from(users).where(eq(users.username, "demo.caseworker")).limit(1);
    const [demoAdmin] = await db.select().from(users).where(eq(users.username, "demo.admin")).limit(1);

    // Get Baltimore City office (largest office)
    const [baltimoreCity] = await db.select().from(counties).where(eq(counties.code, "BALTIMORE_CITY")).limit(1);

    if (baltimoreCity && demoNavigator) {
      // Check if assignment exists
      const [existingAssignment] = await db
        .select()
        .from(countyUsers)
        .where(eq(countyUsers.userId, demoNavigator.id))
        .limit(1);

      if (!existingAssignment) {
        await db.insert(countyUsers).values({
          countyId: baltimoreCity.id,
          userId: demoNavigator.id,
          role: "navigator",
          isPrimary: true,
          accessLevel: "full",
        });
        console.log("  ✓ Assigned demo.navigator to Baltimore City LDSS");
      }
    }

    if (baltimoreCity && demoCaseworker) {
      const [existingAssignment] = await db
        .select()
        .from(countyUsers)
        .where(eq(countyUsers.userId, demoCaseworker.id))
        .limit(1);

      if (!existingAssignment) {
        await db.insert(countyUsers).values({
          countyId: baltimoreCity.id,
          userId: demoCaseworker.id,
          role: "caseworker",
          isPrimary: true,
          accessLevel: "full",
        });
        console.log("  ✓ Assigned demo.caseworker to Baltimore City LDSS");
      }
    }

    if (baltimoreCity && demoAdmin) {
      const [existingAssignment] = await db
        .select()
        .from(countyUsers)
        .where(eq(countyUsers.userId, demoAdmin.id))
        .limit(1);

      if (!existingAssignment) {
        await db.insert(countyUsers).values({
          countyId: baltimoreCity.id,
          userId: demoAdmin.id,
          role: "supervisor",
          isPrimary: true,
          accessLevel: "full",
        });
        console.log("  ✓ Assigned demo.admin to Baltimore City LDSS (supervisor role)");
      }
    }

    console.log("\n✅ LDSS seeding complete!");
    console.log(`   📊 24 Maryland LDSS offices configured`);
    console.log(`   👥 Demo users assigned to Baltimore City LDSS`);
  } catch (error) {
    console.error("❌ Error seeding LDSS offices:", error);
    throw error;
  }
}
