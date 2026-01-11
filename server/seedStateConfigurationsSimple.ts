import { db } from "./db";
import { sql } from "drizzle-orm";
import { logger } from "./services/logger.service";

const stateData = [
  { name: 'Maryland', code: 'MD', region: 'Mid-Atlantic', agency: 'Maryland Department of Human Services', color: '#0D4F8B' },
  { name: 'Pennsylvania', code: 'PA', region: 'Mid-Atlantic', agency: 'Pennsylvania Department of Human Services', color: '#002664' },
  { name: 'New Jersey', code: 'NJ', region: 'Mid-Atlantic', agency: 'New Jersey Department of Human Services', color: '#FFC72C' },
  { name: 'Delaware', code: 'DE', region: 'Mid-Atlantic', agency: 'Delaware Health and Social Services', color: '#00769E' },
  { name: 'Virginia', code: 'VA', region: 'Mid-Atlantic', agency: 'Virginia Department of Social Services', color: '#022D4F' },
  { name: 'New York', code: 'NY', region: 'Northeast', agency: 'New York State OTDA', color: '#002D72' },
  { name: 'New York City', code: 'NYC', region: 'Northeast', agency: 'NYC Human Resources Administration', color: '#0A2140' },
  { name: 'Washington DC', code: 'DC', region: 'Mid-Atlantic', agency: 'DC Department of Human Services', color: '#DC143C' },
  { name: 'California', code: 'CA', region: 'West', agency: 'California Department of Social Services', color: '#006BA6' },
  { name: 'Texas', code: 'TX', region: 'South', agency: 'Texas Health and Human Services', color: '#003F87' },
  { name: 'Florida', code: 'FL', region: 'South', agency: 'Florida Department of Children and Families', color: '#004B87' },
  { name: 'Ohio', code: 'OH', region: 'Midwest', agency: 'Ohio Department of Job and Family Services', color: '#C8102E' },
  { name: 'Georgia', code: 'GA', region: 'South', agency: 'Georgia Division of Family and Children Services', color: '#003366' },
  { name: 'North Carolina', code: 'NC', region: 'South', agency: 'North Carolina DHHS', color: '#0073C0' },
  { name: 'Michigan', code: 'MI', region: 'Midwest', agency: 'Michigan Department of Health and Human Services', color: '#00274C' },
  { name: 'Illinois', code: 'IL', region: 'Midwest', agency: 'Illinois Department of Human Services', color: '#17406D' },
  { name: 'Massachusetts', code: 'MA', region: 'Northeast', agency: 'Massachusetts DTA', color: '#14558F' },
  { name: 'Washington', code: 'WA', region: 'West', agency: 'Washington State DSHS', color: '#002F5D' },
  { name: 'Colorado', code: 'CO', region: 'West', agency: 'Colorado Department of Human Services', color: '#2E3192' },
  { name: 'Arizona', code: 'AZ', region: 'West', agency: 'Arizona Department of Economic Security', color: '#CE5C17' },
  { name: 'Utah', code: 'UT', region: 'West', agency: 'Utah Department of Workforce Services', color: '#BE0000' },
  { name: 'Indiana', code: 'IN', region: 'Midwest', agency: 'Indiana Family and Social Services Administration', color: '#B89D2E' }
];

async function seedSimple() {
  logger.info("🌱 Seeding state configurations (simplified)...", {
    service: "seedStateConfigurationsSimple",
    action: "start",
    statesCount: stateData.length
  });
  
  for (const state of stateData) {
    try {
      // Check if tenant exists
      const existingTenantResult = await db.execute(sql`
        SELECT id FROM tenants WHERE slug = ${state.code.toLowerCase()}
      `);
      
      let tenantId: string;
      
      if (existingTenantResult.rows && existingTenantResult.rows.length > 0) {
        tenantId = existingTenantResult.rows[0].id as string;
        logger.warn(`  ⚠️  Tenant exists for ${state.name}`, {
          service: "seedStateConfigurationsSimple",
          action: "tenantExists",
          stateName: state.name,
          stateCode: state.code
        });
      } else {
        // Create tenant
        const tenantResult = await db.execute(sql`
          INSERT INTO tenants (slug, name, type, status)
          VALUES (${state.code.toLowerCase()}, ${state.agency}, 'state', 'active')
          RETURNING id
        `);
        tenantId = tenantResult.rows[0].id as string;
        logger.info(`  ✅ Created tenant for ${state.name}`, {
          service: "seedStateConfigurationsSimple",
          action: "createTenant",
          stateName: state.name,
          stateCode: state.code,
          tenantId: tenantId
        });
      }
      
      // Check if state configuration exists
      const existingConfigResult = await db.execute(sql`
        SELECT id FROM state_configurations WHERE state_code = ${state.code}
      `);
      
      if (existingConfigResult.rows && existingConfigResult.rows.length > 0) {
        logger.warn(`  ⚠️  Configuration exists for ${state.name}`, {
          service: "seedStateConfigurationsSimple",
          action: "configExists",
          stateName: state.name,
          stateCode: state.code
        });
      } else {
        // Create state configuration
        await db.execute(sql`
          INSERT INTO state_configurations (
            tenant_id, state_name, state_code, abbreviation, 
            timezone, region, agency_name, agency_acronym,
            support_phone, support_email, support_hours,
            is_active
          ) VALUES (
            ${tenantId},
            ${state.name},
            ${state.code},
            ${state.code},
            ${state.region === 'West' ? 'America/Los_Angeles' : state.region === 'Midwest' || state.code === 'TX' ? 'America/Chicago' : 'America/New_York'},
            ${state.region},
            ${state.agency},
            ${state.code + ' DHS'},
            '1-800-BENEFITS',
            ${'help@' + state.code.toLowerCase() + '.gov'},
            'Mon-Fri 8:00 AM - 5:00 PM',
            true
          )
        `);
        logger.info(`  ✅ Created configuration for ${state.name}`, {
          service: "seedStateConfigurationsSimple",
          action: "createConfig",
          stateName: state.name,
          stateCode: state.code
        });
        
        // Create tenant branding
        const existingBrandingResult = await db.execute(sql`
          SELECT id FROM tenant_branding WHERE tenant_id = ${tenantId}
        `);
        
        if (!existingBrandingResult.rows || existingBrandingResult.rows.length === 0) {
          await db.execute(sql`
            INSERT INTO tenant_branding (tenant_id, primary_color)
            VALUES (${tenantId}, ${state.color})
          `);
          logger.info(`  ✅ Created branding for ${state.name}`, {
            service: "seedStateConfigurationsSimple",
            action: "createBranding",
            stateName: state.name,
            stateCode: state.code,
            color: state.color
          });
        }
      }
      
    } catch (error) {
      logger.error(`  ❌ Error processing ${state.name}`, {
        service: "seedStateConfigurationsSimple",
        action: "processError",
        stateName: state.name,
        stateCode: state.code,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
  
  logger.info("✅ Seeding complete!", {
    service: "seedStateConfigurationsSimple",
    action: "complete",
    statesProcessed: stateData.length
  });
}

seedSimple()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("💥 Seeding failed", {
      service: "seedStateConfigurationsSimple",
      action: "fatal",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  });