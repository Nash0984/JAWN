import { db } from "./db";
import { countyTaxRates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Seed Maryland County Tax Rates
 * 
 * Populates county_tax_rates table with current Maryland county tax rates
 * from the hard-coded COUNTY_TAX_RATES in form502Generator.ts
 */

const MARYLAND_COUNTY_TAX_RATES = [
  { countyName: 'ALLEGANY', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'ANNE ARUNDEL', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'BALTIMORE CITY', minRate: 0.032, maxRate: 0.032 },
  { countyName: 'BALTIMORE COUNTY', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'CALVERT', minRate: 0.0225, maxRate: 0.03 },
  { countyName: 'CAROLINE', minRate: 0.0225, maxRate: 0.0285 },
  { countyName: 'CARROLL', minRate: 0.0225, maxRate: 0.03 },
  { countyName: 'CECIL', minRate: 0.0225, maxRate: 0.028 },
  { countyName: 'CHARLES', minRate: 0.0225, maxRate: 0.03 },
  { countyName: 'DORCHESTER', minRate: 0.0225, maxRate: 0.0262 },
  { countyName: 'FREDERICK', minRate: 0.0225, maxRate: 0.0296 },
  { countyName: 'GARRETT', minRate: 0.0225, maxRate: 0.0265 },
  { countyName: 'HARFORD', minRate: 0.0225, maxRate: 0.0306 },
  { countyName: 'HOWARD', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'KENT', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'MONTGOMERY', minRate: 0.0225, maxRate: 0.032 },
  { countyName: "PRINCE GEORGE'S", minRate: 0.0225, maxRate: 0.032 },
  { countyName: "QUEEN ANNE'S", minRate: 0.0225, maxRate: 0.032 },
  { countyName: "ST. MARY'S", minRate: 0.0225, maxRate: 0.03175 },
  { countyName: 'SOMERSET', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'TALBOT', minRate: 0.0225, maxRate: 0.0248 },
  { countyName: 'WASHINGTON', minRate: 0.0225, maxRate: 0.028 },
  { countyName: 'WICOMICO', minRate: 0.0225, maxRate: 0.032 },
  { countyName: 'WORCESTER', minRate: 0.0225, maxRate: 0.0125 }
];

export async function seedCountyTaxRates() {
  console.log('\n💰 Seeding Maryland County Tax Rates...\n');

  const taxYear = 2025;
  const effectiveDate = new Date();

  try {
    for (const county of MARYLAND_COUNTY_TAX_RATES) {
      const existing = await db
        .select()
        .from(countyTaxRates)
        .where(
          and(
            eq(countyTaxRates.countyName, county.countyName),
            eq(countyTaxRates.taxYear, taxYear)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`✓ ${county.countyName} (${taxYear}) - Already exists`);
      } else {
        await db.insert(countyTaxRates).values({
          countyName: county.countyName,
          taxYear: taxYear,
          minRate: county.minRate,
          maxRate: county.maxRate,
          effectiveDate: effectiveDate,
        });
        console.log(`✓ ${county.countyName} (${taxYear}) - Created (${county.minRate * 100}% - ${county.maxRate * 100}%)`);
      }
    }

    console.log(`\n✅ Successfully seeded ${MARYLAND_COUNTY_TAX_RATES.length} Maryland county tax rates for ${taxYear}\n`);
  } catch (error) {
    console.error('❌ Error seeding county tax rates:', error);
    throw error;
  }
}

// Run if this is the main module
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCountyTaxRates()
    .then(() => {
      console.log('County tax rates seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('County tax rates seeding failed:', error);
      process.exit(1);
    });
}
