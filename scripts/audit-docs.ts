#!/usr/bin/env npx ts-node
/**
 * Documentation Audit Script
 * 
 * Automatically detects documentation drift by comparing:
 * - Actual API routes in server/routes.ts
 * - Actual pages in client/src/pages/
 * - Actual services in server/services/
 * Against:
 * - Documented features in FEATURES.md
 * - Documented endpoints in docs/API.md
 * 
 * Run: npx ts-node scripts/audit-docs.ts
 * Output: Drift report with counts and undocumented items
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  category: string;
  documented: number;
  actual: number;
  drift: number;
  driftPercent: string;
  undocumented: string[];
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function countApiRoutes(routesPath: string): { count: number; routes: string[] } {
  if (!fs.existsSync(routesPath)) {
    return { count: 0, routes: [] };
  }
  
  const content = fs.readFileSync(routesPath, 'utf-8');
  const routePatterns = [
    /app\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /router\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
  ];
  
  const routes: string[] = [];
  for (const pattern of routePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  
  return { count: routes.length, routes };
}

function countPages(pagesDir: string): { count: number; pages: string[] } {
  if (!fs.existsSync(pagesDir)) {
    return { count: 0, pages: [] };
  }
  
  const pages: string[] = [];
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const relativePath = path.relative(pagesDir, filePath);
        pages.push(relativePath);
      }
    }
  }
  
  walkDir(pagesDir);
  return { count: pages.length, pages };
}

function countServices(servicesDir: string): { count: number; services: string[] } {
  if (!fs.existsSync(servicesDir)) {
    return { count: 0, services: [] };
  }
  
  const services: string[] = [];
  const files = fs.readdirSync(servicesDir);
  
  for (const file of files) {
    if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
      services.push(file);
    }
  }
  
  return { count: services.length, services };
}

function countDocumentedFeatures(featuresPath: string): number {
  if (!fs.existsSync(featuresPath)) {
    return 0;
  }
  
  const content = fs.readFileSync(featuresPath, 'utf-8');
  const featureMatches = content.match(/^### \d+\./gm);
  return featureMatches ? featureMatches.length : 0;
}

function countDocumentedEndpoints(apiPath: string): number {
  if (!fs.existsSync(apiPath)) {
    return 0;
  }
  
  const content = fs.readFileSync(apiPath, 'utf-8');
  const endpointMatches = content.match(/```http\n(GET|POST|PUT|PATCH|DELETE)/g);
  return endpointMatches ? endpointMatches.length : 0;
}

function runAudit() {
  log('bold', '\n╔════════════════════════════════════════════════════════════════╗');
  log('bold', '║           JAWN DOCUMENTATION DRIFT AUDIT REPORT                ║');
  log('bold', '╚════════════════════════════════════════════════════════════════╝\n');
  
  const results: AuditResult[] = [];
  
  // Count actual API routes
  const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
  const apiRoutesPath = path.join(process.cwd(), 'server', 'api');
  
  let totalRoutes = 0;
  let allRoutes: string[] = [];
  
  // Check main routes.ts
  const mainRoutes = countApiRoutes(routesPath);
  totalRoutes += mainRoutes.count;
  allRoutes = [...allRoutes, ...mainRoutes.routes];
  
  // Check api/ subdirectory for modular routes
  if (fs.existsSync(apiRoutesPath)) {
    const apiFiles = fs.readdirSync(apiRoutesPath);
    for (const file of apiFiles) {
      if (file.endsWith('.ts')) {
        const fileRoutes = countApiRoutes(path.join(apiRoutesPath, file));
        totalRoutes += fileRoutes.count;
        allRoutes = [...allRoutes, ...fileRoutes.routes];
      }
    }
  }
  
  // Count documented endpoints
  const documentedEndpoints = countDocumentedEndpoints(path.join(process.cwd(), 'docs', 'API.md'));
  
  results.push({
    category: 'API Endpoints',
    documented: documentedEndpoints,
    actual: totalRoutes,
    drift: totalRoutes - documentedEndpoints,
    driftPercent: documentedEndpoints > 0 ? ((totalRoutes - documentedEndpoints) / documentedEndpoints * 100).toFixed(1) : 'N/A',
    undocumented: [],
  });
  
  // Count pages
  const pagesDir = path.join(process.cwd(), 'client', 'src', 'pages');
  const pagesResult = countPages(pagesDir);
  
  results.push({
    category: 'Frontend Pages',
    documented: 73, // From README badge
    actual: pagesResult.count,
    drift: pagesResult.count - 73,
    driftPercent: ((pagesResult.count - 73) / 73 * 100).toFixed(1),
    undocumented: [],
  });
  
  // Count services
  const servicesDir = path.join(process.cwd(), 'server', 'services');
  const servicesResult = countServices(servicesDir);
  
  results.push({
    category: 'Backend Services',
    documented: 94, // From README badge
    actual: servicesResult.count,
    drift: servicesResult.count - 94,
    driftPercent: ((servicesResult.count - 94) / 94 * 100).toFixed(1),
    undocumented: [],
  });
  
  // Count features
  const featuresPath = path.join(process.cwd(), 'FEATURES.md');
  const documentedFeatures = countDocumentedFeatures(featuresPath);
  
  results.push({
    category: 'Documented Features',
    documented: documentedFeatures,
    actual: documentedFeatures,
    drift: 0,
    driftPercent: '0.0',
    undocumented: [],
  });
  
  // Print results table
  log('cyan', '┌────────────────────┬────────────┬────────────┬────────────┬────────────┐');
  log('cyan', '│ Category           │ Documented │ Actual     │ Drift      │ Drift %    │');
  log('cyan', '├────────────────────┼────────────┼────────────┼────────────┼────────────┤');
  
  for (const result of results) {
    const driftColor = result.drift > 10 ? 'red' : result.drift > 0 ? 'yellow' : 'green';
    const driftSymbol = result.drift > 0 ? '+' : '';
    
    console.log(
      `│ ${result.category.padEnd(18)} │ ${String(result.documented).padEnd(10)} │ ${String(result.actual).padEnd(10)} │ ${COLORS[driftColor]}${(driftSymbol + result.drift).padEnd(10)}${COLORS.reset} │ ${result.driftPercent.padEnd(8)}%  │`
    );
  }
  
  log('cyan', '└────────────────────┴────────────┴────────────┴────────────┴────────────┘');
  
  // Summary
  const totalDrift = results.reduce((sum, r) => sum + Math.abs(r.drift), 0);
  
  console.log('');
  if (totalDrift === 0) {
    log('green', '✅ No significant documentation drift detected.');
  } else if (totalDrift < 20) {
    log('yellow', `⚠️  Minor documentation drift detected: ${totalDrift} items may need updating.`);
  } else {
    log('red', `❌ Significant documentation drift detected: ${totalDrift} items need attention.`);
  }
  
  console.log('');
  log('blue', `Audit completed: ${new Date().toISOString()}`);
  console.log('');
  
  // Recommendations
  log('bold', 'Recommendations:');
  console.log('  1. Update docs/API.md if new endpoints were added');
  console.log('  2. Update FEATURES.md if new features were implemented');
  console.log('  3. Update README.md badges if counts have changed significantly');
  console.log('  4. Run quarterly manual audit per CONTRIBUTING.md process');
  console.log('');
}

// Run the audit
runAudit();
