/**
 * Standalone WCAG 2.1 AAA Accessibility Audit Script
 * Uses Playwright + axe-core to scan all 30 priority pages
 */

import { chromium, Browser, Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

interface ViolationDetails {
  page: string;
  url: string;
  violations: any[];
  timestamp: string;
}

interface AuditSummary {
  totalPages: number;
  totalViolations: number;
  violationsBySeverity: Record<string, number>;
  violationsByWCAGLevel: Record<string, number>;
  violationsByImpactArea: Record<string, number>;
  topViolations: { id: string; count: number; description: string; helpUrl: string }[];
  pagesByViolationCount: { page: string; count: number }[];
  criticalBlockers: any[];
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Define all 30 pages across 4 priority tiers
const TEST_PAGES = {
  P1_PUBLIC: [
    { name: 'Home', url: '/' },
    { name: 'Document Checklist', url: '/public/documents' },
    { name: 'Notice Explainer', url: '/public/notices' },
    { name: 'Simplified Search', url: '/public/search' },
    { name: 'Quick Screener', url: '/public/quick-screener' },
    { name: 'FSA Landing', url: '/public/fsa' },
  ],
  P1_AUTH: [
    { name: 'Login', url: '/login' },
    { name: 'Signup', url: '/signup' },
  ],
  P1_LEGAL: [
    { name: 'Legal Hub', url: '/legal' },
    { name: 'Privacy Policy', url: '/legal/privacy' },
    { name: 'Terms of Service', url: '/legal/terms' },
    { name: 'License', url: '/legal/license' },
    { name: 'Accessibility Statement', url: '/legal/accessibility' },
    { name: 'Data Security Policy', url: '/legal/security' },
    { name: 'Breach Notification', url: '/legal/breach-notification' },
    { name: 'Disclaimer', url: '/legal/disclaimer' },
  ],
  P2_TAXPAYER: [
    { name: 'Taxpayer Dashboard', url: '/taxpayer', requiresAuth: 'client' },
    { name: 'Taxpayer Documents', url: '/taxpayer/documents', requiresAuth: 'client' },
    { name: 'Taxpayer Messages', url: '/taxpayer/messages', requiresAuth: 'client' },
    { name: 'Taxpayer E-Signature', url: '/taxpayer/signature', requiresAuth: 'client' },
  ],
  P3_STAFF: [
    { name: 'Navigator Dashboard', url: '/dashboard/navigator', requiresAuth: 'navigator' },
    { name: 'Caseworker Cockpit', url: '/caseworker/cockpit', requiresAuth: 'navigator' },
    { name: 'VITA Intake', url: '/vita-intake', requiresAuth: 'navigator' },
    { name: 'Appointments', url: '/appointments', requiresAuth: 'navigator' },
    { name: 'Document Review Queue', url: '/navigator/document-review', requiresAuth: 'navigator' },
  ],
  P4_ADMIN: [
    { name: 'Admin Dashboard', url: '/dashboard/admin', requiresAuth: 'admin' },
    { name: 'Admin Monitoring', url: '/admin/monitoring', requiresAuth: 'admin' },
    { name: 'Security Monitoring', url: '/admin/security-monitoring', requiresAuth: 'admin' },
    { name: 'Audit Logs', url: '/admin/audit-logs', requiresAuth: 'admin' },
    { name: 'API Documentation', url: '/admin/api-docs', requiresAuth: 'admin' },
  ],
};

const AUTH_CREDENTIALS = {
  client: { username: 'demo.applicant', password: 'Demo2024!' },
  navigator: { username: 'demo.navigator', password: 'Demo2024!' },
  admin: { username: 'demo.admin', password: 'Demo2024!' },
};

async function login(page: Page, role: 'client' | 'navigator' | 'admin') {
  console.log(`  Logging in as ${role}...`);
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('[data-testid="input-username"]', AUTH_CREDENTIALS[role].username);
  await page.fill('[data-testid="input-password"]', AUTH_CREDENTIALS[role].password);
  await page.click('[data-testid="button-login"]');
  
  // Wait for redirect after login
  await page.waitForTimeout(2000);
}

async function scanPage(
  page: Page,
  pageName: string,
  url: string,
  tier: string
): Promise<ViolationDetails> {
  console.log(`\nScanning: ${tier} > ${pageName} (${url})`);
  
  await page.goto(`${BASE_URL}${url}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Give dynamic content time to render
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'])
    .analyze();
  
  console.log(`  Found ${results.violations.length} violation types affecting ${results.violations.reduce((sum, v) => sum + v.nodes.length, 0)} elements`);
  
  return {
    page: pageName,
    url,
    violations: results.violations,
    timestamp: new Date().toISOString(),
  };
}

function categorizeImpactArea(violationId: string): string {
  if (violationId.includes('color-contrast')) return 'Color contrast';
  if (violationId.includes('aria') || violationId.includes('role')) return 'ARIA';
  if (violationId.includes('keyboard') || violationId.includes('focus')) return 'Keyboard navigation';
  if (violationId.includes('label') || violationId.includes('input')) return 'Forms';
  if (violationId.includes('image') || violationId.includes('img-alt')) return 'Images';
  if (violationId.includes('heading') || violationId.includes('landmark')) return 'Screen readers';
  return 'Other';
}

function getWCAGLevel(tags: string[]): string {
  if (tags.some(t => t.includes('wcag2aaa') || t.includes('wcag21aaa'))) return 'AAA';
  if (tags.some(t => t.includes('wcag2aa') || t.includes('wcag21aa'))) return 'AA';
  if (tags.some(t => t.includes('wcag2a') || t.includes('wcag21a'))) return 'A';
  return 'Unknown';
}

function generateSummary(allResults: ViolationDetails[]): AuditSummary {
  const violationsBySeverity: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  
  const violationsByWCAGLevel: Record<string, number> = {
    A: 0,
    AA: 0,
    AAA: 0,
  };
  
  const violationsByImpactArea: Record<string, number> = {};
  const violationCounts: Record<string, { count: number; description: string; helpUrl: string }> = {};
  const pageViolationCounts: { page: string; count: number }[] = [];
  const criticalBlockers: any[] = [];
  
  allResults.forEach(result => {
    let pageViolationCount = 0;
    
    result.violations.forEach(violation => {
      const elementCount = violation.nodes.length;
      pageViolationCount += elementCount;
      
      // Count by severity
      const severity = violation.impact || 'minor';
      violationsBySeverity[severity] = (violationsBySeverity[severity] || 0) + elementCount;
      
      // Count by WCAG level
      const wcagLevel = getWCAGLevel(violation.tags);
      violationsByWCAGLevel[wcagLevel] = (violationsByWCAGLevel[wcagLevel] || 0) + elementCount;
      
      // Count by impact area
      const impactArea = categorizeImpactArea(violation.id);
      violationsByImpactArea[impactArea] = (violationsByImpactArea[impactArea] || 0) + elementCount;
      
      // Track violation types
      if (!violationCounts[violation.id]) {
        violationCounts[violation.id] = {
          count: 0,
          description: violation.description,
          helpUrl: violation.helpUrl,
        };
      }
      violationCounts[violation.id].count += elementCount;
      
      // Collect critical blockers
      if (violation.impact === 'critical') {
        criticalBlockers.push({
          page: result.page,
          url: result.url,
          violation: violation.id,
          description: violation.description,
          helpUrl: violation.helpUrl,
          elementsAffected: elementCount,
        });
      }
    });
    
    pageViolationCounts.push({
      page: result.page,
      count: pageViolationCount,
    });
  });
  
  // Get top 10 most common violations
  const topViolations = Object.entries(violationCounts)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Sort pages by violation count
  pageViolationCounts.sort((a, b) => b.count - a.count);
  
  const totalViolations = Object.values(violationsBySeverity).reduce((sum, count) => sum + count, 0);
  
  return {
    totalPages: allResults.length,
    totalViolations,
    violationsBySeverity,
    violationsByWCAGLevel,
    violationsByImpactArea,
    topViolations,
    pagesByViolationCount: pageViolationCounts,
    criticalBlockers,
  };
}

function generateDetailedReport(allResults: ViolationDetails[], summary: AuditSummary): string {
  let report = `# WCAG 2.1 AAA Accessibility Audit Report
**Generated:** ${new Date().toISOString()}
**Pages Scanned:** ${summary.totalPages}
**Total Violations:** ${summary.totalViolations}

---

## Executive Summary

### Violations by Severity
- **Critical:** ${summary.violationsBySeverity.critical}
- **Serious:** ${summary.violationsBySeverity.serious}
- **Moderate:** ${summary.violationsBySeverity.moderate}
- **Minor:** ${summary.violationsBySeverity.minor}

### Violations by WCAG Level
- **Level A:** ${summary.violationsByWCAGLevel.A}
- **Level AA:** ${summary.violationsByWCAGLevel.AA}
- **Level AAA:** ${summary.violationsByWCAGLevel.AAA}

### Violations by Impact Area
${Object.entries(summary.violationsByImpactArea)
  .sort(([,a], [,b]) => b - a)
  .map(([area, count]) => `- **${area}:** ${count}`)
  .join('\n')}

---

## Top 10 Most Common Violations

${summary.topViolations.map((v, idx) => `
### ${idx + 1}. ${v.id}
**Occurrences:** ${v.count}
**Description:** ${v.description}
**Remediation:** ${v.helpUrl}
`).join('\n')}

---

## Pages with Highest Violation Counts

${summary.pagesByViolationCount.slice(0, 10).map((p, idx) => `${idx + 1}. **${p.page}** - ${p.count} violations`).join('\n')}

---

## Critical Blockers Requiring Immediate Attention

${summary.criticalBlockers.length === 0 ? 'No critical blockers found! ✅' : summary.criticalBlockers.map(blocker => `
### ${blocker.page} (${blocker.url})
- **Violation:** ${blocker.violation}
- **Description:** ${blocker.description}
- **Elements Affected:** ${blocker.elementsAffected}
- **Help:** ${blocker.helpUrl}
`).join('\n')}

---

## Detailed Violations by Page

`;
  
  allResults.forEach(result => {
    report += `\n### ${result.page} (${result.url})\n`;
    
    if (result.violations.length === 0) {
      report += `✅ No violations found!\n`;
    } else {
      result.violations.forEach(violation => {
        const wcagLevel = getWCAGLevel(violation.tags);
        const impactArea = categorizeImpactArea(violation.id);
        
        report += `
#### ${violation.id}
- **Severity:** ${violation.impact?.toUpperCase() || 'UNKNOWN'}
- **WCAG Level:** ${wcagLevel}
- **Impact Area:** ${impactArea}
- **Description:** ${violation.description}
- **Elements Affected:** ${violation.nodes.length}
- **WCAG Criteria:** ${violation.tags.filter(t => t.startsWith('wcag')).join(', ')}
- **Help:** ${violation.helpUrl}

**Affected Elements:**
${violation.nodes.slice(0, 5).map((node: any, idx: number) => `
${idx + 1}. \`\`\`html
${node.html}
\`\`\`
   **Issue:** ${node.failureSummary}
`).join('\n')}
${violation.nodes.length > 5 ? `\n*...and ${violation.nodes.length - 5} more elements*\n` : ''}
`;
      });
    }
  });
  
  report += `\n---

## Recommendations for Manual Testing

While automated testing found ${summary.totalViolations} violations, manual testing is still required for:

1. **Keyboard Navigation:** Ensure all interactive elements are reachable via keyboard and have a logical tab order
2. **Screen Reader Testing:** Test with NVDA, JAWS, or VoiceOver to ensure proper announcements
3. **Color Contrast:** Verify contrast ratios in different lighting conditions and with colorblindness filters
4. **Form Validation:** Test error messaging and field labeling with assistive technology
5. **Dynamic Content:** Verify ARIA live regions properly announce updates
6. **Mobile Accessibility:** Test with mobile screen readers (TalkBack, VoiceOver)
7. **Cognitive Load:** Assess readability, plain language, and information architecture
8. **Time Limits:** Verify timeout warnings and extension mechanisms
9. **Media Content:** Test video captions, audio descriptions, and transcripts
10. **Custom Components:** Manually test any custom-built UI components

---

## Priority Action Items

1. **Immediate (Critical):** Fix all ${summary.violationsBySeverity.critical} critical violations
2. **High Priority (Serious):** Address ${summary.violationsBySeverity.serious} serious violations within 2 weeks
3. **Medium Priority (Moderate):** Resolve ${summary.violationsBySeverity.moderate} moderate violations within 1 month
4. **Low Priority (Minor):** Plan for ${summary.violationsBySeverity.minor} minor violations in next quarter

**Focus Areas:**
${Object.entries(summary.violationsByImpactArea).slice(0, 3).map(([area, count]) => `- ${area} (${count} violations)`).join('\n')}
`;
  
  return report;
}

async function main() {
  console.log('🔍 Starting WCAG 2.1 AAA Accessibility Audit...\n');
  
  let browser: Browser | null = null;
  const allResults: ViolationDetails[] = [];
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let currentAuth: string | null = null;
    
    // Scan all page tiers
    for (const [tier, pages] of Object.entries(TEST_PAGES)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`TIER: ${tier}`);
      console.log('='.repeat(60));
      
      for (const pageConfig of pages as any[]) {
        try {
          // Handle authentication if needed
          if (pageConfig.requiresAuth && pageConfig.requiresAuth !== currentAuth) {
            await login(page, pageConfig.requiresAuth);
            currentAuth = pageConfig.requiresAuth;
          } else if (!pageConfig.requiresAuth && currentAuth) {
            // Logout if we need to access public pages after being authenticated
            currentAuth = null;
            await page.goto(`${BASE_URL}/login`);
          }
          
          const result = await scanPage(page, pageConfig.name, pageConfig.url, tier);
          allResults.push(result);
        } catch (error) {
          console.error(`  ❌ Error scanning ${pageConfig.name}:`, error);
        }
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('GENERATING AUDIT REPORT...');
    console.log('='.repeat(60));
    
    // Generate summary and report
    const summary = generateSummary(allResults);
    const report = generateDetailedReport(allResults, summary);
    
    // Save results
    const outputDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const reportPath = path.join(outputDir, 'accessibility-audit-report.md');
    const jsonPath = path.join(outputDir, 'accessibility-audit-results.json');
    
    fs.writeFileSync(reportPath, report);
    fs.writeFileSync(jsonPath, JSON.stringify({ summary, allResults }, null, 2));
    
    console.log(`\n✅ Audit Complete!`);
    console.log(`📊 Report saved to: ${reportPath}`);
    console.log(`📄 JSON data saved to: ${jsonPath}`);
    console.log(`\n📈 Summary:`);
    console.log(`   - Total Pages Scanned: ${summary.totalPages}`);
    console.log(`   - Total Violations: ${summary.totalViolations}`);
    console.log(`   - Critical: ${summary.violationsBySeverity.critical}`);
    console.log(`   - Serious: ${summary.violationsBySeverity.serious}`);
    console.log(`   - Moderate: ${summary.violationsBySeverity.moderate}`);
    console.log(`   - Minor: ${summary.violationsBySeverity.minor}`);
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
