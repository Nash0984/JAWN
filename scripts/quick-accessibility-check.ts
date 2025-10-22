/**
 * Quick WCAG 2.1 AA Accessibility Check using Playwright + axe-core
 * Scans critical pages for accessibility violations
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Priority pages to test
const PAGES_TO_TEST = [
  { name: 'Home', url: '/' },
  { name: 'Login', url: '/login' },
  { name: 'Signup', url: '/signup' },
  { name: 'Document Checklist', url: '/public/documents' },
  { name: 'Notice Explainer', url: '/public/notices' },
  { name: 'Quick Screener', url: '/public/quick-screener' },
  { name: 'Privacy Policy', url: '/legal/privacy' },
  { name: 'Accessibility Statement', url: '/legal/accessibility' },
];

interface ViolationSummary {
  page: string;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
}

async function main() {
  console.log('🔍 Running WCAG 2.1 AA Accessibility Audit...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results: ViolationSummary[] = [];
  let totalViolations = 0;
  let totalCritical = 0;
  let totalSerious = 0;

  for (const testPage of PAGES_TO_TEST) {
    console.log(`Scanning: ${testPage.name} (${testPage.url})`);

    try {
      await page.goto(`${BASE_URL}${testPage.url}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for dynamic content
      await page.waitForTimeout(1500);

      // Run accessibility check using AxeBuilder
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      const violations = accessibilityScanResults.violations;

      // Categorize by impact
      const summary: ViolationSummary = {
        page: testPage.name,
        critical: violations.filter(v => v.impact === 'critical').length,
        serious: violations.filter(v => v.impact === 'serious').length,
        moderate: violations.filter(v => v.impact === 'moderate').length,
        minor: violations.filter(v => v.impact === 'minor').length,
        total: violations.length
      };

      results.push(summary);
      totalViolations += summary.total;
      totalCritical += summary.critical;
      totalSerious += summary.serious;

      if (violations.length > 0) {
        console.log(`  ⚠️  Found ${violations.length} violations`);
        console.log(`      Critical: ${summary.critical}, Serious: ${summary.serious}, Moderate: ${summary.moderate}, Minor: ${summary.minor}`);

        // Show critical violations details
        const criticalViolations = violations.filter(v => v.impact === 'critical');
        if (criticalViolations.length > 0) {
          console.log('\n  🚨 Critical Violations:');
          criticalViolations.forEach(v => {
            console.log(`      - ${v.id}: ${v.description}`);
            console.log(`        Affects ${v.nodes.length} element(s)`);
            console.log(`        Help: ${v.helpUrl}`);
          });
        }
      } else {
        console.log('  ✅ No violations found');
      }

      console.log('');
    } catch (error) {
      console.log(`  ❌ Error scanning ${testPage.name}:`, error instanceof Error ? error.message : error);
      console.log('');
    }
  }

  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 ACCESSIBILITY AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Pages Scanned: ${results.length}`);
  console.log(`Total Violations: ${totalViolations}`);
  console.log(`  🚨 Critical: ${totalCritical}`);
  console.log(`  ⚠️  Serious: ${totalSerious}`);
  
  console.log('\n📋 Violations by Page:');
  console.log('─'.repeat(80));
  console.log('Page                          Critical  Serious  Moderate  Minor   Total');
  console.log('─'.repeat(80));
  
  results.forEach(r => {
    const pageName = r.page.padEnd(30);
    const critical = String(r.critical).padStart(8);
    const serious = String(r.serious).padStart(8);
    const moderate = String(r.moderate).padStart(9);
    const minor = String(r.minor).padStart(6);
    const total = String(r.total).padStart(7);
    
    console.log(`${pageName}${critical}${serious}${moderate}${minor}${total}`);
  });

  console.log('\n' + '='.repeat(80));

  if (totalCritical > 0) {
    console.log('\n❌ WCAG 2.1 AA Compliance: FAIL');
    console.log(`   Critical violations must be fixed for government deployment.`);
    process.exit(1);
  } else if (totalSerious > 0) {
    console.log('\n⚠️  WCAG 2.1 AA Compliance: NEEDS ATTENTION');
    console.log(`   Serious violations should be fixed before production.`);
    process.exit(1);
  } else {
    console.log('\n✅ WCAG 2.1 AA Compliance: PASS');
    console.log(`   No critical or serious accessibility violations found.`);
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
