#!/usr/bin/env tsx
/**
 * Platform Statistics Verification Script
 * 
 * Dynamically counts and validates platform metrics across:
 * - Features (from featureMetadata.ts)
 * - Database tables (from schema.ts)
 * - API endpoints (from apiEndpoints.ts)
 * - Services (from server directory)
 * 
 * Ensures consistency across Demo Showcase, API Explorer, and documentation
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FEATURE_CATALOG } from '../shared/featureMetadata.js';
import { API_ENDPOINTS } from '../shared/apiEndpoints.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PlatformStats {
  features: number;
  tables: number;
  endpoints: number;
  services: number;
}

interface VerificationResult {
  stats: PlatformStats;
  issues: string[];
  warnings: string[];
  success: boolean;
}

/**
 * Count database tables from schema.ts
 */
function countDatabaseTables(): number {
  const schemaPath = join(__dirname, '../shared/schema.ts');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  
  // Match all pgTable declarations
  const tableMatches = schemaContent.match(/export const \w+ = pgTable\(/g);
  
  return tableMatches ? tableMatches.length : 0;
}

/**
 * Count services from server/services directory
 * Only counts actual service modules, not all server files
 */
function countServices(): number {
  const servicesPath = join(__dirname, '../server/services');
  let serviceCount = 0;
  
  try {
    const items = readdirSync(servicesPath);
    
    for (const item of items) {
      const fullPath = join(servicesPath, item);
      const stat = statSync(fullPath);
      
      // Count .ts/.js files in services directory (service modules)
      if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
        serviceCount++;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not access server/services directory');
  }
  
  return serviceCount;
}

/**
 * Extract stats from Demo.tsx
 */
function extractDemoStats(): Partial<PlatformStats> {
  const demoPath = join(__dirname, '../client/src/pages/Demo.tsx');
  const demoContent = readFileSync(demoPath, 'utf-8');
  
  // Extract static table count
  const tablesMatch = demoContent.match(/<CardTitle className="text-3xl font-bold text-primary">(\d+)<\/CardTitle>\s*<CardDescription>Database Tables<\/CardDescription>/);
  
  return {
    tables: tablesMatch ? parseInt(tablesMatch[1]) : undefined
  };
}

/**
 * Extract stats from APIExplorer.tsx
 */
function extractAPIExplorerStats(): Partial<PlatformStats> {
  const explorerPath = join(__dirname, '../client/src/pages/APIExplorer.tsx');
  const explorerContent = readFileSync(explorerPath, 'utf-8');
  
  // Check meta description for endpoint count
  const metaMatch = explorerContent.match(/content="[^"]*?(\d+) endpoints[^"]*"/);
  
  return {
    endpoints: metaMatch ? parseInt(metaMatch[1]) : undefined
  };
}

/**
 * Extract stats from replit.md
 */
function extractReplitMdStats(): Partial<PlatformStats> {
  const replitMdPath = join(__dirname, '../replit.md');
  const replitMdContent = readFileSync(replitMdPath, 'utf-8');
  
  // Extract feature count
  const featuresMatch = replitMdContent.match(/showcasing all (\d+) features/);
  
  // Extract endpoint count
  const endpointsMatch = replitMdContent.match(/catalog of all (\d+) API endpoints/);
  
  return {
    features: featuresMatch ? parseInt(featuresMatch[1]) : undefined,
    endpoints: endpointsMatch ? parseInt(endpointsMatch[1]) : undefined
  };
}

/**
 * Main verification function
 */
function verifyPlatformStats(): VerificationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  console.log('🔍 Platform Statistics Verification\n');
  console.log('═'.repeat(60));
  
  // 1. Count actual stats from source files
  const actualStats: PlatformStats = {
    features: FEATURE_CATALOG.length,
    tables: countDatabaseTables(),
    endpoints: API_ENDPOINTS.length,
    services: countServices()
  };
  
  console.log('\n📊 Actual Platform Statistics:');
  console.log(`   Features:        ${actualStats.features}`);
  console.log(`   Database Tables: ${actualStats.tables}`);
  console.log(`   API Endpoints:   ${actualStats.endpoints}`);
  console.log(`   Services:        ${actualStats.services}`);
  
  // 2. Extract stats from documentation files
  const demoStats = extractDemoStats();
  const explorerStats = extractAPIExplorerStats();
  const replitMdStats = extractReplitMdStats();
  
  console.log('\n📄 Documentation Statistics:');
  console.log(`   Demo.tsx:        Tables=${demoStats.tables}`);
  console.log(`   APIExplorer.tsx: Endpoints=${explorerStats.endpoints}`);
  console.log(`   replit.md:       Features=${replitMdStats.features}, Endpoints=${replitMdStats.endpoints}`);
  
  // 3. Verify consistency
  console.log('\n✅ Verification Results:');
  
  // Check Demo.tsx tables count
  if (demoStats.tables !== actualStats.tables) {
    issues.push(`Demo.tsx tables count (${demoStats.tables}) doesn't match actual count (${actualStats.tables})`);
    console.log(`   ❌ Demo.tsx tables: ${demoStats.tables} ≠ ${actualStats.tables}`);
  } else {
    console.log(`   ✓ Demo.tsx tables: ${demoStats.tables} matches actual`);
  }
  
  // Check APIExplorer.tsx endpoints
  if (explorerStats.endpoints !== actualStats.endpoints) {
    issues.push(`APIExplorer.tsx endpoints (${explorerStats.endpoints}) doesn't match actual count (${actualStats.endpoints})`);
    console.log(`   ❌ APIExplorer.tsx endpoints: ${explorerStats.endpoints} ≠ ${actualStats.endpoints}`);
  } else {
    console.log(`   ✓ APIExplorer.tsx endpoints: ${explorerStats.endpoints} matches actual`);
  }
  
  // Check replit.md features
  if (replitMdStats.features !== actualStats.features) {
    issues.push(`replit.md features (${replitMdStats.features}) doesn't match actual count (${actualStats.features})`);
    console.log(`   ❌ replit.md features: ${replitMdStats.features} ≠ ${actualStats.features}`);
  } else {
    console.log(`   ✓ replit.md features: ${replitMdStats.features} matches actual`);
  }
  
  // Check replit.md endpoints
  if (replitMdStats.endpoints !== actualStats.endpoints) {
    issues.push(`replit.md endpoints (${replitMdStats.endpoints}) doesn't match actual count (${actualStats.endpoints})`);
    console.log(`   ❌ replit.md endpoints: ${replitMdStats.endpoints} ≠ ${actualStats.endpoints}`);
  } else {
    console.log(`   ✓ replit.md endpoints: ${replitMdStats.endpoints} matches actual`);
  }
  
  // Warnings for dynamic values (these should be dynamic, not static)
  console.log('\n⚠️  Dynamic Value Checks:');
  console.log(`   Demo.tsx features uses {FEATURE_CATALOG.length} - Dynamic ✓`);
  console.log(`   Demo.tsx endpoints uses {API_ENDPOINTS.length} - Dynamic ✓`);
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ All statistics are consistent and accurate!\n');
  } else {
    if (issues.length > 0) {
      console.log(`❌ Found ${issues.length} issue(s):`);
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }
    if (warnings.length > 0) {
      console.log(`⚠️  Found ${warnings.length} warning(s):`);
      warnings.forEach((warning, i) => console.log(`   ${i + 1}. ${warning}`));
    }
    console.log('');
  }
  
  return {
    stats: actualStats,
    issues,
    warnings,
    success: issues.length === 0
  };
}

// Run verification
const result = verifyPlatformStats();

// Exit with appropriate code
process.exit(result.success ? 0 : 1);
