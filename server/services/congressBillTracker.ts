import { congressGovClient, CongressBill, BillDetailsResponse } from './congressGovClient';
import { db } from '../db';
import { federalBills, documents, benefitPrograms } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Congress Bill Tracker
 * 
 * Service for tracking federal bills using Congress.gov API
 * Searches for policy-relevant bills, retrieves detailed information,
 * and syncs data to federalBills table
 */

interface BillTrackingResult {
  success: boolean;
  billsFound?: number;
  billsTracked?: number;
  billsUpdated?: number;
  errors: string[];
}

interface BillSyncResult {
  success: boolean;
  billId: string;
  billNumber: string;
  updated: boolean;
  error?: string;
}

export class CongressBillTracker {
  private readonly POLICY_KEYWORDS = [
    'SNAP',
    'food stamp',
    'food assistance',
    'supplemental nutrition',
    'TANF',
    'temporary assistance for needy families',
    'Medicaid',
    'EITC',
    'earned income tax credit',
    'CTC',
    'child tax credit',
    'WIC',
    'women infants children',
    'poverty',
    'low-income',
    'welfare',
    'public assistance',
  ];

  /**
   * Search for policy-relevant bills by keywords
   * 
   * Uses Congress.gov API for keyword-based bill discovery.
   * For authoritative bill status, use GovInfo Bill Status XML API.
   */
  async searchBills(
    keywords: string[],
    congress: number = 119,
    billType?: string,
    limit: number = 100
  ): Promise<BillTrackingResult> {
    console.log(`\n🔍 Searching Congress.gov for bills - Congress ${congress}`);
    console.log(`   Keywords: ${keywords.join(', ')}`);
    console.log();
    
    const result: BillTrackingResult = {
      success: true,
      billsFound: 0,
      billsTracked: 0,
      billsUpdated: 0,
      errors: [],
    };

    try {
      // Search bills with Congress.gov API - keyword-based discovery
      const searchResponse = await congressGovClient.searchBills({
        keywords,
        congress,
        billType,
        limit,
        sort: 'updateDate+desc',
      });

      console.log(`📥 Found ${searchResponse.bills.length} bills from API`);
      result.billsFound = searchResponse.bills.length;

      const billsToTrack = searchResponse.bills;

      console.log(`🎯 Tracking ${billsToTrack.length} bills\n`);

      // Track each bill
      for (const bill of billsToTrack) {
        try {
          const syncResult = await this.trackBill(
            congress,
            bill.type,
            bill.number
          );

          if (syncResult.success) {
            if (syncResult.updated) {
              result.billsUpdated!++;
            } else {
              result.billsTracked!++;
            }
          }
        } catch (error) {
          const errorMsg = `Error tracking ${bill.type} ${bill.number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`\n✅ Search Complete:`);
      console.log(`   Found: ${result.billsFound}`);
      console.log(`   Tracked: ${result.billsTracked}`);
      console.log(`   Updated: ${result.billsUpdated}`);
      console.log(`   Errors: ${result.errors.length}`);

    } catch (error) {
      result.success = false;
      const errorMsg = `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Track a specific bill by bill number
   * 
   * @param congress - Congress number (e.g., 119)
   * @param billType - Bill type (hr, s, hjres, sjres, etc.)
   * @param billNumber - Bill number (e.g., "5376")
   */
  async trackBill(
    congress: number,
    billType: string,
    billNumber: string | number
  ): Promise<BillSyncResult> {
    const formattedBillNumber = `${billType.toUpperCase()} ${billNumber}`;
    
    try {
      console.log(`📥 Tracking ${formattedBillNumber}...`);

      // Fetch bill details from Congress.gov
      const billDetails = await congressGovClient.getBillDetails(
        congress,
        billType,
        billNumber
      );

      // Fetch actions (limited to latest)
      const actionsResponse = await congressGovClient.getBillActions(
        congress,
        billType,
        billNumber,
        50 // Get latest 50 actions
      );

      // Fetch cosponsors (limited)
      const cosponsorsResponse = await congressGovClient.getBillCosponsors(
        congress,
        billType,
        billNumber,
        50 // Get first 50 cosponsors
      );

      // Fetch committees
      const committeesResponse = await congressGovClient.getBillCommittees(
        congress,
        billType,
        billNumber
      );

      // Map to federalBills structure
      const billData = this.mapBillData(
        billDetails,
        actionsResponse.actions,
        cosponsorsResponse.cosponsors,
        committeesResponse.committees
      );

      // Check if bill exists
      const existingBills = await db.select()
        .from(federalBills)
        .where(
          and(
            eq(federalBills.billNumber, formattedBillNumber),
            eq(federalBills.congress, congress)
          )
        )
        .limit(1);

      const existingBill = existingBills[0];
      let billId: string;
      let updated = false;

      if (existingBill) {
        // Update existing bill
        await db.update(federalBills)
          .set({
            ...billData,
            sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${billType.toLowerCase()}-bill/${billNumber}`,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(federalBills.id, existingBill.id));

        billId = existingBill.id;
        updated = true;
        console.log(`🔄 Updated ${formattedBillNumber}`);
      } else {
        // Insert new bill
        const insertResult = await db.insert(federalBills).values({
          ...billData,
          sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${billType.toLowerCase()}-bill/${billNumber}`,
          lastSyncedAt: new Date(),
        }).returning({ id: federalBills.id });

        billId = insertResult[0].id;
        console.log(`✨ Created ${formattedBillNumber}`);
      }

      return {
        success: true,
        billId,
        billNumber: formattedBillNumber,
        updated,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to track ${formattedBillNumber}: ${errorMsg}`);
      
      return {
        success: false,
        billId: '',
        billNumber: formattedBillNumber,
        updated: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Sync all bills currently in the database
   */
  async syncTrackedBills(): Promise<BillTrackingResult> {
    console.log(`\n🔄 Syncing all tracked bills...\n`);

    const result: BillTrackingResult = {
      success: true,
      billsFound: 0,
      billsTracked: 0,
      billsUpdated: 0,
      errors: [],
    };

    try {
      // Get all bills from database
      const allBills = await db.select({
        id: federalBills.id,
        billNumber: federalBills.billNumber,
        congress: federalBills.congress,
        billType: federalBills.billType,
      }).from(federalBills);

      result.billsFound = allBills.length;
      console.log(`📥 Found ${allBills.length} bills to sync\n`);

      // Sync each bill
      for (const bill of allBills) {
        try {
          // Extract bill number from formatted string (e.g., "HR 5376" -> "5376")
          const billNumMatch = bill.billNumber.match(/\d+/);
          if (!billNumMatch) {
            throw new Error(`Invalid bill number format: ${bill.billNumber}`);
          }

          const syncResult = await this.trackBill(
            bill.congress,
            bill.billType,
            billNumMatch[0]
          );

          if (syncResult.success) {
            result.billsUpdated!++;
          }
        } catch (error) {
          const errorMsg = `Error syncing ${bill.billNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`\n✅ Sync Complete:`);
      console.log(`   Total Bills: ${result.billsFound}`);
      console.log(`   Updated: ${result.billsUpdated}`);
      console.log(`   Errors: ${result.errors.length}`);

    } catch (error) {
      result.success = false;
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Check if bill is policy-relevant based on keywords
   */
  private isPolicyRelevant(bill: CongressBill, additionalKeywords: string[] = []): boolean {
    const keywords = [...this.POLICY_KEYWORDS, ...additionalKeywords];
    const searchText = `${bill.title || ''} ${bill.latestAction?.text || ''}`.toLowerCase();
    
    return keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Map Congress.gov API response to federalBills table structure
   */
  private mapBillData(
    details: BillDetailsResponse,
    actions: any[],
    cosponsors: any[],
    committees: any[]
  ): any {
    const bill = details.bill;
    
    // Determine bill status from latest action and laws
    let status = 'introduced';
    if (bill.laws && bill.laws.length > 0) {
      status = 'enacted';
    } else if (bill.latestAction?.text) {
      const actionText = bill.latestAction.text.toLowerCase();
      if (actionText.includes('passed senate')) {
        status = 'passed_senate';
      } else if (actionText.includes('passed house')) {
        status = 'passed_house';
      } else if (actionText.includes('vetoed')) {
        status = 'vetoed';
      }
    }

    // Extract summary
    let summary = '';
    if (bill.summaries?.summaries && bill.summaries.summaries.length > 0) {
      const latestSummary = bill.summaries.summaries[bill.summaries.summaries.length - 1];
      summary = latestSummary.text || '';
    }

    // Detect related programs from title and summary
    const relatedPrograms = this.detectRelatedPrograms(bill.title + ' ' + summary);

    // Format bill number
    const formattedBillNumber = `${bill.type.toUpperCase()} ${bill.number}`;

    return {
      billNumber: formattedBillNumber,
      congress: bill.congress,
      billType: bill.type.toLowerCase(),
      title: bill.title,
      summary,
      introducedDate: bill.introducedDate ? new Date(bill.introducedDate) : null,
      latestActionDate: bill.latestAction?.actionDate ? new Date(bill.latestAction.actionDate) : null,
      latestActionText: bill.latestAction?.text || '',
      status,
      sponsors: bill.sponsors || [],
      cosponsors: cosponsors || [],
      committees: committees || [],
      relatedPrograms,
      policyChanges: {
        congressGovData: {
          policyArea: bill.policyArea?.name,
          subjects: bill.subjects?.legislativeSubjects?.map(s => s.name) || [],
          constitutionalAuthority: bill.constitutionalAuthorityStatementText,
          laws: bill.laws || [],
        },
        actions: actions.slice(0, 10), // Store latest 10 actions
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  /**
   * Detect related benefit programs from bill text
   */
  private detectRelatedPrograms(text: string): string[] {
    const programs: string[] = [];
    const lowerText = text.toLowerCase();

    const programKeywords: Record<string, string[]> = {
      'SNAP': ['snap', 'food stamp', 'supplemental nutrition assistance'],
      'MEDICAID': ['medicaid'],
      'TANF': ['tanf', 'temporary assistance for needy families'],
      'EITC': ['eitc', 'earned income tax credit'],
      'CTC': ['ctc', 'child tax credit'],
      'WIC': ['wic', 'women infants children', 'women, infants, and children'],
    };

    for (const [program, keywords] of Object.entries(programKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        programs.push(program);
      }
    }

    return programs;
  }
}

// Export singleton instance
export const congressBillTracker = new CongressBillTracker();
