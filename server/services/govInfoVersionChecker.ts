import axios from 'axios';
import { db } from '../db';
import { documents, federalBills, publicLaws, versionCheckLogs } from '@shared/schema';
import type { InsertVersionCheckLog } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { govInfoClient } from './govInfoClient';

/**
 * GovInfo Version Checker Service
 * 
 * Detects when new versions of regulations and publications are published
 * from GovInfo.gov, enabling automatic sync scheduling without duplicate downloads.
 * 
 * Checks:
 * - eCFR Title 7 (SNAP regulations) via HTTP HEAD request
 * - Bill Status updates via GovInfo API package metadata
 * - Public Laws updates via GovInfo API package metadata
 */

export interface VersionCheckResult {
  source: 'ecfr' | 'bill_status' | 'public_laws';
  hasUpdate: boolean;
  hasError: boolean;
  currentVersion?: Date;
  latestVersion?: Date;
  needsSync: boolean;
  packagesChecked?: number;
  packagesNeedingUpdate?: number;
  errorMessage?: string;
}

export interface VersionCheckSummary {
  timestamp: Date;
  results: VersionCheckResult[];
  totalUpdatesDetected: number;
  overallNeedsSync: boolean;
}

export class GovInfoVersionChecker {
  private readonly ECFR_TITLE_7_URL = 'https://www.govinfo.gov/bulkdata/ECFR/title-7/ECFR-title7.xml';
  private readonly DEFAULT_CONGRESS = 119;
  
  /**
   * Check eCFR Title 7 version using HEAD request
   */
  async checkECFRVersion(): Promise<VersionCheckResult> {
    console.log('\n🔍 Checking eCFR Title 7 version...');
    
    const result: VersionCheckResult = {
      source: 'ecfr',
      hasUpdate: false,
      hasError: false,
      needsSync: false,
    };

    try {
      // Get latest version from GovInfo via HEAD request
      const headResponse = await axios.head(this.ECFR_TITLE_7_URL, {
        timeout: 10000,
      });
      
      const lastModifiedHeader = headResponse.headers['last-modified'];
      if (!lastModifiedHeader) {
        throw new Error('No last-modified header found in eCFR response');
      }
      
      const latestVersion = new Date(lastModifiedHeader);
      result.latestVersion = latestVersion;
      
      // Get current version from our documents table (most recent eCFR document)
      const currentDocs = await db.select()
        .from(documents)
        .where(
          and(
            eq(documents.isGoldenSource, true),
            sql`${documents.metadata}->>'part' = '273'`
          )
        )
        .orderBy(desc(documents.lastModifiedAt))
        .limit(1);
      
      if (currentDocs.length > 0 && currentDocs[0].lastModifiedAt) {
        result.currentVersion = currentDocs[0].lastModifiedAt;
        
        // Compare timestamps
        if (latestVersion > currentDocs[0].lastModifiedAt) {
          result.hasUpdate = true;
          result.needsSync = true;
          console.log(`✅ eCFR update detected!`);
          console.log(`   Current: ${currentDocs[0].lastModifiedAt.toISOString()}`);
          console.log(`   Latest:  ${latestVersion.toISOString()}`);
        } else {
          console.log(`✅ eCFR is up-to-date (${latestVersion.toISOString()})`);
        }
      } else {
        // No current version - first sync needed
        result.hasUpdate = true;
        result.needsSync = true;
        console.log(`✅ No eCFR data found - initial sync needed`);
      }
      
      // Log the check
      await this.logVersionCheck({
        checkType: 'ecfr',
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        updateDetected: result.hasUpdate,
        metadata: {
          url: this.ECFR_TITLE_7_URL,
        },
      });
      
    } catch (error) {
      result.hasError = true;
      result.errorMessage = `eCFR version check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${result.errorMessage}`);
      
      // Log the failed check
      await this.logVersionCheck({
        checkType: 'ecfr',
        updateDetected: false,
        errorMessage: result.errorMessage,
      });
    }
    
    return result;
  }

  /**
   * Check Bill Status updates for policy-relevant bills
   */
  async checkBillStatusUpdates(congress: number = this.DEFAULT_CONGRESS, maxPages?: number): Promise<VersionCheckResult> {
    console.log(`\n🔍 Checking Bill Status updates for Congress ${congress}...`);
    
    const result: VersionCheckResult = {
      source: 'bill_status',
      hasUpdate: false,
      hasError: false,
      needsSync: false,
      packagesChecked: 0,
      packagesNeedingUpdate: 0,
    };

    try {
      // Get recent bill packages from GovInfo API using rolling 30-day window
      console.log('📥 Fetching recent bills from GovInfo API (last 30 days)...');
      
      // Calculate rolling 30-day window
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Format dates as YYYY-MM-DDTHH:MM:SSZ (no milliseconds) like working downloaders
      const startDate = thirtyDaysAgo.toISOString().split('.')[0] + 'Z';
      const endDate = now.toISOString().split('.')[0] + 'Z';
      
      console.log(`   Date range: ${startDate} to ${endDate}`);
      
      const packages = await govInfoClient.getAllPackages(
        'BILLSTATUS',
        startDate,
        endDate,
        { congress: congress.toString() },
        100,
        maxPages
      );
      result.packagesChecked = packages.length;
      
      // Filter to policy-relevant bills
      const relevantPackages = packages.filter(pkg => 
        this.isPolicyRelevant(pkg.title)
      );
      
      console.log(`   Found ${packages.length} total bills, ${relevantPackages.length} policy-relevant`);
      
      // Check each relevant bill for updates
      let updatesFound = 0;
      for (const pkg of relevantPackages) {
        const lastModified = new Date(pkg.lastModified);
        const billNumber = this.extractBillNumber(pkg.packageId);
        
        // Check if we have this bill and if it's up-to-date
        const existingBills = await db.select()
          .from(federalBills)
          .where(
            and(
              eq(federalBills.billNumber, billNumber),
              eq(federalBills.congress, congress)
            )
          )
          .limit(1);
        
        const existingBill = existingBills[0];
        
        if (!existingBill || !existingBill.lastSyncedAt || existingBill.lastSyncedAt < lastModified) {
          updatesFound++;
        }
      }
      
      result.packagesNeedingUpdate = updatesFound;
      
      if (updatesFound > 0) {
        result.hasUpdate = true;
        result.needsSync = true;
        console.log(`✅ ${updatesFound} bill(s) need updating`);
      } else {
        console.log(`✅ All bills are up-to-date`);
      }
      
      // Get most recent bill modified date as "latest version"
      if (relevantPackages.length > 0) {
        const latestModified = relevantPackages.reduce((latest, pkg) => {
          const pkgDate = new Date(pkg.lastModified);
          return pkgDate > latest ? pkgDate : latest;
        }, new Date(0));
        result.latestVersion = latestModified;
      }
      
      // Get our most recent bill sync as "current version"
      const recentBills = await db.select()
        .from(federalBills)
        .where(eq(federalBills.congress, congress))
        .orderBy(desc(federalBills.lastSyncedAt))
        .limit(1);
      
      if (recentBills.length > 0 && recentBills[0].lastSyncedAt) {
        result.currentVersion = recentBills[0].lastSyncedAt;
      }
      
      // Log the check
      await this.logVersionCheck({
        checkType: 'bill_status',
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        updateDetected: result.hasUpdate,
        metadata: {
          congress,
          packagesChecked: result.packagesChecked,
          packagesNeedingUpdate: result.packagesNeedingUpdate,
          relevantPackages: relevantPackages.length,
        },
      });
      
    } catch (error) {
      result.hasError = true;
      result.errorMessage = `Bill Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${result.errorMessage}`);
      
      // Log the failed check
      await this.logVersionCheck({
        checkType: 'bill_status',
        updateDetected: false,
        errorMessage: result.errorMessage,
        metadata: { congress },
      });
    }
    
    return result;
  }

  /**
   * Check Public Laws updates
   */
  async checkPublicLawsUpdates(congress: number = this.DEFAULT_CONGRESS, maxPages?: number): Promise<VersionCheckResult> {
    console.log(`\n🔍 Checking Public Laws updates for Congress ${congress}...`);
    
    const result: VersionCheckResult = {
      source: 'public_laws',
      hasUpdate: false,
      hasError: false,
      needsSync: false,
      packagesChecked: 0,
      packagesNeedingUpdate: 0,
    };

    try {
      // Get recent public law packages from GovInfo API using rolling 30-day window
      console.log('📥 Fetching recent public laws from GovInfo API (last 30 days)...');
      
      // Calculate rolling 30-day window
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Format dates as YYYY-MM-DDTHH:MM:SSZ (no milliseconds) like working downloaders
      const startDate = thirtyDaysAgo.toISOString().split('.')[0] + 'Z';
      const endDate = now.toISOString().split('.')[0] + 'Z';
      
      console.log(`   Date range: ${startDate} to ${endDate}`);
      
      const packages = await govInfoClient.getAllPackages(
        'PLAW',
        startDate,
        endDate,
        { congress: congress.toString() },
        100,
        maxPages
      );
      result.packagesChecked = packages.length;
      
      // Filter to policy-relevant laws
      const relevantPackages = packages.filter(pkg => 
        this.isPolicyRelevant(pkg.title)
      );
      
      console.log(`   Found ${packages.length} total laws, ${relevantPackages.length} policy-relevant`);
      
      // Check each relevant law for updates
      let updatesFound = 0;
      for (const pkg of relevantPackages) {
        const lastModified = new Date(pkg.lastModified);
        const publicLawNumber = this.extractPublicLawNumber(pkg.packageId);
        
        // Check if we have this law and if it's up-to-date
        const existingLaws = await db.select()
          .from(publicLaws)
          .where(
            and(
              eq(publicLaws.publicLawNumber, publicLawNumber),
              eq(publicLaws.congress, congress)
            )
          )
          .limit(1);
        
        const existingLaw = existingLaws[0];
        
        if (!existingLaw || !existingLaw.downloadedAt || existingLaw.downloadedAt < lastModified) {
          updatesFound++;
        }
      }
      
      result.packagesNeedingUpdate = updatesFound;
      
      if (updatesFound > 0) {
        result.hasUpdate = true;
        result.needsSync = true;
        console.log(`✅ ${updatesFound} public law(s) need updating`);
      } else {
        console.log(`✅ All public laws are up-to-date`);
      }
      
      // Get most recent law modified date as "latest version"
      if (relevantPackages.length > 0) {
        const latestModified = relevantPackages.reduce((latest, pkg) => {
          const pkgDate = new Date(pkg.lastModified);
          return pkgDate > latest ? pkgDate : latest;
        }, new Date(0));
        result.latestVersion = latestModified;
      }
      
      // Get our most recent law download as "current version"
      const recentLaws = await db.select()
        .from(publicLaws)
        .where(eq(publicLaws.congress, congress))
        .orderBy(desc(publicLaws.downloadedAt))
        .limit(1);
      
      if (recentLaws.length > 0 && recentLaws[0].downloadedAt) {
        result.currentVersion = recentLaws[0].downloadedAt;
      }
      
      // Log the check
      await this.logVersionCheck({
        checkType: 'public_laws',
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        updateDetected: result.hasUpdate,
        metadata: {
          congress,
          packagesChecked: result.packagesChecked,
          packagesNeedingUpdate: result.packagesNeedingUpdate,
          relevantPackages: relevantPackages.length,
        },
      });
      
    } catch (error) {
      result.hasError = true;
      result.errorMessage = `Public Laws check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${result.errorMessage}`);
      
      // Log the failed check
      await this.logVersionCheck({
        checkType: 'public_laws',
        updateDetected: false,
        errorMessage: result.errorMessage,
        metadata: { congress },
      });
    }
    
    return result;
  }

  /**
   * Run all version checks and return summary
   * 
   * @param congress - Congress number to check (default: 119)
   * @param maxPages - Maximum pages to fetch per check (optional, for faster version checks)
   */
  async checkAllVersions(congress: number = this.DEFAULT_CONGRESS, maxPages?: number): Promise<VersionCheckSummary> {
    console.log('\n🔍 GovInfo Version Checker - Running all checks...\n');
    console.log('═'.repeat(60));
    
    const results: VersionCheckResult[] = [];
    
    // Run all checks in parallel for efficiency
    const [ecfrResult, billStatusResult, publicLawsResult] = await Promise.all([
      this.checkECFRVersion(),
      this.checkBillStatusUpdates(congress, maxPages),
      this.checkPublicLawsUpdates(congress, maxPages),
    ]);
    
    results.push(ecfrResult, billStatusResult, publicLawsResult);
    
    const totalUpdatesDetected = results.filter(r => r.hasUpdate).length;
    const overallNeedsSync = results.some(r => r.needsSync);
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Version Check Summary:');
    
    // Helper function to format status
    const formatStatus = (result: VersionCheckResult): string => {
      if (result.hasError) {
        return `⚠️ Error Checking: ${result.errorMessage}`;
      }
      if (result.hasUpdate) {
        if (result.packagesNeedingUpdate !== undefined) {
          return `🔄 ${result.packagesNeedingUpdate} updates available`;
        }
        return '🔄 Update Available';
      }
      return '✅ Up-to-date';
    };
    
    console.log(`   eCFR:         ${formatStatus(ecfrResult)}`);
    console.log(`   Bill Status:  ${formatStatus(billStatusResult)}`);
    console.log(`   Public Laws:  ${formatStatus(publicLawsResult)}`);
    console.log(`   Total Updates: ${totalUpdatesDetected}`);
    console.log(`   Sync Needed:  ${overallNeedsSync ? 'YES' : 'NO'}`);
    console.log('═'.repeat(60) + '\n');
    
    return {
      timestamp: new Date(),
      results,
      totalUpdatesDetected,
      overallNeedsSync,
    };
  }

  /**
   * Schedule periodic version checks (every 6 hours)
   */
  scheduleVersionChecks(intervalHours: number = 6): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`📅 Scheduling version checks every ${intervalHours} hours`);
    
    // Run initial check immediately with a page limit to avoid API overload
    // Limit to 5 pages (500 packages) for version checks - enough to detect updates
    this.checkAllVersions(this.DEFAULT_CONGRESS, 5).catch(error => {
      console.error('❌ Initial version check failed:', error);
    });
    
    // Schedule periodic checks
    const interval = setInterval(async () => {
      try {
        await this.checkAllVersions(this.DEFAULT_CONGRESS, 5);
      } catch (error) {
        console.error('❌ Scheduled version check failed:', error);
      }
    }, intervalMs);
    
    return interval;
  }

  /**
   * Helper: Check if bill/law title contains policy-relevant keywords
   */
  private isPolicyRelevant(title: string): boolean {
    // Handle null/undefined titles
    if (!title) return false;
    
    const POLICY_KEYWORDS = [
      'SNAP',
      'food stamp',
      'food assistance',
      'TANF',
      'temporary assistance',
      'Medicaid',
      'EITC',
      'earned income tax credit',
      'CTC',
      'child tax credit',
      'WIC',
      'women infants children',
      'supplemental nutrition',
      'poverty',
      'low-income',
    ];
    
    const lowerTitle = title.toLowerCase();
    return POLICY_KEYWORDS.some(keyword => 
      lowerTitle.includes(keyword.toLowerCase())
    );
  }

  /**
   * Helper: Extract bill number from package ID
   * Example: "BILLS-119hr5376ih" -> "HR 5376"
   */
  private extractBillNumber(packageId: string): string {
    const match = packageId.match(/BILLS-\d+([a-z]+)(\d+)/i);
    if (!match) return packageId;
    
    const billType = match[1].toUpperCase();
    const billNum = match[2];
    return `${billType} ${billNum}`;
  }

  /**
   * Helper: Extract public law number from package ID
   * Example: "PLAW-119publ4" -> "119-4"
   */
  private extractPublicLawNumber(packageId: string): string {
    const match = packageId.match(/PLAW-(\d+)publ(\d+)/i);
    if (!match) return packageId;
    
    return `${match[1]}-${match[2]}`;
  }

  /**
   * Helper: Log version check to database
   */
  private async logVersionCheck(log: Partial<InsertVersionCheckLog>): Promise<void> {
    try {
      await db.insert(versionCheckLogs).values(log as InsertVersionCheckLog);
    } catch (error) {
      console.error('Failed to log version check:', error);
    }
  }

  /**
   * Get recent version check history
   */
  async getVersionCheckHistory(checkType?: string, limit: number = 10) {
    const query = db.select()
      .from(versionCheckLogs)
      .orderBy(desc(versionCheckLogs.checkedAt))
      .limit(limit);
    
    if (checkType) {
      return query.where(eq(versionCheckLogs.checkType, checkType));
    }
    
    return query;
  }

  /**
   * Get current version status (latest check for each source)
   */
  async getCurrentVersionStatus() {
    const sources = ['ecfr', 'bill_status', 'public_laws'];
    const status = [];
    
    for (const source of sources) {
      const latestChecks = await db.select()
        .from(versionCheckLogs)
        .where(eq(versionCheckLogs.checkType, source))
        .orderBy(desc(versionCheckLogs.checkedAt))
        .limit(1);
      
      if (latestChecks.length > 0) {
        status.push({
          source,
          ...latestChecks[0],
        });
      }
    }
    
    return status;
  }
}

// Export singleton instance
export const govInfoVersionChecker = new GovInfoVersionChecker();
