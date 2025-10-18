# Database Setup Instructions
## Living Policy Manual & Dynamic Notification System

**Version:** 1.0  
**Last Updated:** October 18, 2025

---

## Overview

The Living Policy Manual and Dynamic Notification Engine require 8 new database tables to be created. This document provides step-by-step instructions for the one-time database migration.

---

## Tables to Create

The following 8 tables are defined in `shared/schema.ts` and need to be created in your PostgreSQL database:

### Living Policy Manual (4 tables)
1. **policy_manual_chapters** - Program-based chapter organization
2. **policy_manual_sections** - Sections with page numbers, citations, RaC references
3. **policy_glossary_terms** - Centralized term definitions across all programs
4. **policy_manual_versions** - Version history with diffs

### Dynamic Notification System (4 tables)
5. **dynamic_notification_templates** - Policy-driven notification templates
6. **form_components** - Modular document building blocks
7. **content_rules_mapping** - Auto-regeneration triggers when RaC changes
8. **generated_notifications** - Complete audit trail of all generated notices

---

## Migration Options

### Option 1: Automated Migration via Drizzle (Recommended)

**Steps:**

1. **Run the migration command:**
   ```bash
   npm run db:push
   ```

2. **Respond to interactive prompts:**
   
   Drizzle will detect the 8 new tables and ask for confirmation:
   
   ```
   Is content_rules_mapping table created or renamed from another table?
   ❯ + content_rules_mapping           create table
     ~ session › content_rules_mapping rename table
   ```
   
   **Action:** Use arrow keys to select **`create table`** and press Enter.
   
   **Repeat this for all 8 tables:**
   - content_rules_mapping → **create table**
   - dynamic_notification_templates → **create table**
   - form_components → **create table**
   - generated_notifications → **create table**
   - policy_glossary_terms → **create table**
   - policy_manual_chapters → **create table**
   - policy_manual_sections → **create table**
   - policy_manual_versions → **create table**

3. **Verify success:**
   
   You should see:
   ```
   ✓ Successfully pushed schema to database
   ```

4. **Restart the application:**
   
   The system will automatically seed the 6 chapters, sections from 25 policy sources, 10 glossary terms, and 2 notification templates.

---

### Option 2: Force Migration (If Interactive Prompts Fail)

If the interactive migration hangs or fails:

1. **Use force flag:**
   ```bash
   npm run db:push --force
   ```

2. **Alternative - Automated response script:**
   
   Create a script to provide automated responses:
   
   ```bash
   printf "create table\ncreate table\ncreate table\ncreate table\ncreate table\ncreate table\ncreate table\ncreate table\n" | npm run db:push
   ```

---

### Option 3: Manual SQL (Last Resort - Not Recommended)

**⚠️ WARNING:** This approach is NOT recommended as it may create schema mismatches with Drizzle ORM. Only use if Options 1 & 2 fail.

**Why not recommended:**
- Drizzle expects specific column names, types, and defaults
- Manual SQL can create subtle type mismatches (e.g., `SERIAL` vs `VARCHAR` with UUID)
- Future schema changes may not sync correctly

**If you must proceed manually:**

See `docs/MANUAL_SQL_MIGRATION.sql` for the complete SQL script.

---

## Post-Migration Verification

### 1. Verify Tables Exist

**Via SQL:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'policy_manual_chapters',
  'policy_manual_sections',
  'policy_glossary_terms',
  'policy_manual_versions',
  'dynamic_notification_templates',
  'form_components',
  'content_rules_mapping',
  'generated_notifications'
)
ORDER BY table_name;
```

**Expected Output:** 8 table names listed

### 2. Verify Data Seeded

After restarting the application, check that data was populated:

**Via SQL:**
```sql
-- Check chapters (should have 6)
SELECT COUNT(*) as chapter_count FROM policy_manual_chapters;

-- Check sections (should have multiple from 25 policy sources)
SELECT COUNT(*) as section_count FROM policy_manual_sections;

-- Check glossary (should have 10 core terms)
SELECT COUNT(*) as term_count FROM policy_glossary_terms;

-- Check templates (should have 2: SNAP_APPROVAL, SNAP_DENIAL)
SELECT template_code, template_name FROM dynamic_notification_templates;
```

**Expected Results:**
- 6 chapters
- Multiple sections (varies based on policy sources)
- 10 glossary terms
- 2 notification templates

### 3. Verify Frontend Access

1. Navigate to `/policy-manual` in your browser
2. You should see 6 chapters listed in the left sidebar
3. Click on a chapter to expand sections
4. Search functionality should work
5. "View in RaC" links should display

---

## Troubleshooting

### Issue: "relation 'policy_manual_chapters' does not exist"

**Cause:** Tables were not created successfully

**Solution:**
1. Check your database connection (verify DATABASE_URL environment variable)
2. Run `npm run db:push` again
3. Ensure you selected "create table" for all prompts
4. Check database logs for errors

### Issue: "column 'title' does not exist"

**Cause:** Schema mismatch - manual SQL created different column names than Drizzle expects

**Solution:**
1. Drop manually created tables:
   ```sql
   DROP TABLE IF EXISTS generated_notifications CASCADE;
   DROP TABLE IF EXISTS content_rules_mapping CASCADE;
   DROP TABLE IF EXISTS form_components CASCADE;
   DROP TABLE IF EXISTS policy_manual_sections CASCADE;
   DROP TABLE IF EXISTS policy_glossary_terms CASCADE;
   DROP TABLE IF EXISTS policy_manual_versions CASCADE;
   DROP TABLE IF EXISTS policy_manual_chapters CASCADE;
   ```

2. Re-run `npm run db:push` and select "create table" for all

### Issue: "foreign key constraint cannot be implemented"

**Cause:** Type mismatch between foreign key and referenced column

**Solution:**
- This indicates manual SQL was used with incorrect types
- Always use `npm run db:push` to avoid this
- Drop tables and let Drizzle recreate them

### Issue: Migration hangs indefinitely

**Cause:** Database connection pool exhausted or network timeout

**Solution:**
1. Restart your database service (if using local PostgreSQL)
2. Check network connectivity
3. Kill the hung process and retry
4. Try `npm run db:push --force`

### Issue: Application crashes on startup after migration

**Cause:** Seeding failed due to missing data dependencies

**Check logs:**
```bash
npm run dev 2>&1 | grep -A 10 "Error seeding"
```

**Common causes:**
- Policy sources not seeded (run policy source seeding first)
- Benefit programs not configured
- Missing required foreign key references

**Solution:**
1. Verify all prerequisite data exists (benefit programs, policy sources)
2. Check `server/seedData.ts` for dependency order
3. Restart application to retry seeding

---

## Schema Details

### policy_manual_chapters

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| chapter_number | INTEGER | Unique chapter number (1-6) |
| title | TEXT | Chapter title |
| program | TEXT | Program code (SNAP, Medicaid, TANF, etc.) |
| description | TEXT | Chapter overview |
| sort_order | INTEGER | Display order |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- program_idx on program
- chapter_number_idx on chapter_number

### policy_manual_sections

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| chapter_id | VARCHAR | Foreign key → policy_manual_chapters.id |
| policy_source_id | VARCHAR | Foreign key → policy_sources.id |
| section_number | VARCHAR | Section identifier (e.g., "1.2") |
| section_title | TEXT | Section title |
| content | TEXT | Full section content (Markdown) |
| page_number | INTEGER | Starting page number |
| page_number_end | INTEGER | Ending page number |
| legal_citation | TEXT | Legal citation (e.g., "7 CFR § 273.9") |
| source_url | TEXT | Source URL |
| effective_date | DATE | Effective date |
| keywords | TEXT[] | Search keywords |
| related_section_ids | VARCHAR[] | Related section IDs |
| rules_as_code_reference | TEXT | RaC code file path |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- chapter_idx on chapter_id
- policy_source_idx on policy_source_id
- section_number_idx on section_number

### policy_glossary_terms

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| term | VARCHAR | Term name (unique) |
| definition | TEXT | Term definition |
| program | TEXT | Program code (null = universal) |
| legal_citation | TEXT | Legal citation |
| related_terms | TEXT[] | Related term names |
| acronym | VARCHAR | Acronym (if applicable) |
| usage_example | TEXT | Usage example |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- term_idx on term (unique)
- program_idx on program

### policy_manual_versions

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| version_number | VARCHAR | Version identifier (e.g., "1.0") |
| description | TEXT | Version description |
| changes_summary | TEXT | Summary of changes |
| effective_date | DATE | Effective date |
| created_by_user_id | INTEGER | User who created version |
| diff_content | JSONB | Content diff |
| created_at | TIMESTAMP | Creation timestamp |

### dynamic_notification_templates

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| template_code | VARCHAR | Unique template code (e.g., "SNAP_APPROVAL") |
| template_name | TEXT | Display name |
| description | TEXT | Template description |
| program | TEXT | Program code |
| content_template | TEXT | Template with {{variables}} |
| content_rules | JSONB | Rules for variable resolution |
| delivery_channels | TEXT[] | Supported channels (email, SMS, etc.) |
| required_context_fields | TEXT[] | Required context data |
| legal_disclaimers | TEXT | Required legal text |
| version | VARCHAR | Template version |
| effective_date | DATE | Effective date |
| status | VARCHAR | active/inactive |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- template_code_idx on template_code (unique)
- program_idx on program

### form_components

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| component_code | VARCHAR | Unique component code |
| component_name | TEXT | Display name |
| description | TEXT | Component description |
| content_template | TEXT | Template content |
| content_rules | JSONB | Rules for variable resolution |
| program_codes | TEXT[] | Applicable programs |
| component_type | VARCHAR | Component type |
| print_formatting | JSONB | Print formatting metadata |
| usage_count | INTEGER | Usage tracking |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### content_rules_mapping

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| rules_engine_table | VARCHAR | RaC table name |
| rules_engine_field | VARCHAR | RaC field name |
| affected_content_type | VARCHAR | Content type (template/component) |
| affected_content_id | VARCHAR | Content ID |
| mapping_path | TEXT | JSONB path to variable |
| auto_regenerate | BOOLEAN | Auto-regenerate on change |
| last_sync_at | TIMESTAMP | Last sync timestamp |
| sync_status | VARCHAR | Sync status |
| created_at | TIMESTAMP | Creation timestamp |

### generated_notifications

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| template_id | VARCHAR | Foreign key → dynamic_notification_templates.id |
| recipient_id | INTEGER | Recipient user ID |
| household_id | INTEGER | Household ID |
| generated_content | TEXT | Final generated content |
| generated_format | VARCHAR | Format (text, HTML, PDF) |
| context_data | JSONB | Input context |
| rac_version | VARCHAR | RaC version used |
| policy_source_versions | JSONB | Policy source versions |
| delivery_channel | VARCHAR | Delivery channel |
| delivery_status | VARCHAR | Delivery status |
| sent_at | TIMESTAMP | Send timestamp |
| delivered_at | TIMESTAMP | Delivery timestamp |
| generated_by | INTEGER | Generator user ID |
| generated_at | TIMESTAMP | Generation timestamp |
| approved_by | INTEGER | Approver user ID |
| approved_at | TIMESTAMP | Approval timestamp |
| created_at | TIMESTAMP | Creation timestamp |

**Indexes:**
- template_idx on template_id
- recipient_idx on recipient_id
- household_idx on household_id

---

## Seed Data Summary

After successful migration and application restart, the following data will be auto-seeded:

### Policy Manual Chapters (6)
1. Chapter 1: SNAP (Food Supplement Program)
2. Chapter 2: Medicaid Coverage
3. Chapter 3: TCA/TANF Cash Assistance
4. Chapter 4: OHEP Energy Assistance
5. Chapter 5: Tax Credits and Property Tax Relief
6. Chapter 6: VITA Tax Preparation

### Policy Sources Used (25)
- Federal SNAP regulations (7 CFR Part 273)
- FNS memos and handbooks
- Maryland SNAP regulations (COMAR 07.03.17)
- Maryland SNAP policy manual
- OHEP manuals
- Medicaid regulations
- TCA/TANF policy
- Tax credit programs
- IRS VITA publications

### Glossary Terms (10 Core Terms)
- Gross Income
- Net Income
- Federal Poverty Level (FPL)
- Categorical Eligibility
- Standard Deduction
- Shelter Deduction
- MAGI (Modified Adjusted Gross Income)
- EITC (Earned Income Tax Credit)
- SNAP
- TANF

### Notification Templates (2)
- **SNAP_APPROVAL** - Benefit approval with auto-calculated amounts
- **SNAP_DENIAL** - Denial notice with eligibility explanation

---

## Next Steps

After completing the database migration:

1. **Verify the Manual:**
   - Navigate to `/policy-manual`
   - Browse chapters and sections
   - Test search functionality

2. **Test Notifications:**
   - Call `POST /api/notifications/preview` with test data
   - Verify dynamic data resolution
   - Check RaC integration

3. **Review Glossary:**
   - Call `GET /api/policy-manual/glossary`
   - Verify 10 core terms exist
   - Test term lookup by name

4. **Monitor Logs:**
   - Check for seeding success messages
   - Verify no errors in Policy Manual Assembly Service
   - Confirm 6 chapters, multiple sections created

---

## Support

**Documentation:**
- `docs/LIVING_POLICY_MANUAL.md` - Full system documentation
- `shared/schema.ts` - Database schema definitions
- `server/services/policyManualAssemblyService.ts` - Manual assembly logic
- `server/services/dynamicNotificationService.ts` - Notification generation

**Troubleshooting:**
If you encounter issues not covered in this guide, check:
1. Application logs during startup
2. Database connection settings (DATABASE_URL)
3. Policy source data (should have 25 sources)
4. Benefit program configuration (should have 6 programs)

**Contact:**
- Technical questions: Review documentation in `/docs`
- Database issues: Check PostgreSQL logs
- Schema mismatches: Always use `npm run db:push`, never manual SQL

---

**Maryland Universal Financial Navigator** - Database Setup Guide  
**Version 1.0** | October 2025 | Production Ready
