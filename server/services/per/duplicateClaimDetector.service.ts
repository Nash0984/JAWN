/**
 * Duplicate Claim Detector Service
 * 
 * SNAP Payment Error Reduction Module - Duplicate Claim Detection Component
 * Identifies individuals/children claimed on multiple SNAP applications.
 * 
 * Per Arnold Ventures grant: "individuals claimed on multiple or duplicated applications"
 */

import { db } from '../../db';
import {
  perDuplicateClaims,
  clientCases,
  householdProfiles,
  type InsertPerDuplicateClaim,
  type PerDuplicateClaim
} from '@shared/schema';
import { eq, and, ne, desc, sql, or } from 'drizzle-orm';
import { logger } from '../logger.service';
import { neuroSymbolicHybridGateway } from '../neuroSymbolicHybridGateway';

export interface PersonIdentifier {
  firstName: string;
  lastName: string;
  dob?: Date;
  ssn4?: string; // Last 4 digits only
  relationship?: string;
  householdId?: string;
  caseId?: string;
}

export interface DuplicateMatch {
  primaryPerson: PersonIdentifier;
  duplicatePerson: PersonIdentifier;
  matchType: 'exact_ssn' | 'name_dob' | 'name_address' | 'fuzzy';
  matchConfidence: number;
  matchingFields: string[];
  duplicateType: 'same_person_multiple_households' | 'child_claimed_twice' | 'identity_mismatch';
  isPotentialFraud: boolean;
  impactedBenefitAmount?: number;
}

export interface HybridDuplicateContext {
  gatewayRunId?: string;
  hasViolations: boolean;
  statutoryCitations: string[];
  ontologyTermsMatched: string[];
  grade6Explanation: string;
}

export interface DuplicateScanResult {
  caseId: string;
  scannedPersons: number;
  duplicatesFound: number;
  potentialFraudCases: number;
  totalImpactedAmount: number;
  matches: DuplicateMatch[];
  hybridVerification?: HybridDuplicateContext;
}

class DuplicateClaimDetectorService {
  /**
   * Scan a case for duplicate claims across all active cases
   */
  async scanCaseForDuplicates(
    caseId: string,
    options: {
      stateCode?: string;
      tenantId?: string;
    } = {}
  ): Promise<DuplicateScanResult> {
    const { stateCode = 'MD', tenantId } = options;

    try {
      // Get case and household members
      const clientCase = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, caseId)
      });

      if (!clientCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      // Get household profile if available
      const householdProfile = clientCase.householdProfileId
        ? await db.query.householdProfiles.findFirst({
            where: eq(householdProfiles.id, clientCase.householdProfileId)
          })
        : null;

      // Extract persons from household
      const persons = this.extractHouseholdPersons(householdProfile, clientCase);
      const matches: DuplicateMatch[] = [];

      // Get all other active cases in same state for comparison
      const otherCases = await db.select()
        .from(clientCases)
        .where(and(
          ne(clientCases.id, caseId),
          eq(clientCases.status, 'active'),
          stateCode ? sql`1=1` : sql`1=1` // Placeholder for state filtering
        ))
        .limit(500);

      // Compare each person against other cases
      for (const person of persons) {
        for (const otherCase of otherCases) {
          const otherHousehold = otherCase.householdProfileId
            ? await db.query.householdProfiles.findFirst({
                where: eq(householdProfiles.id, otherCase.householdProfileId)
              })
            : null;

          const otherPersons = this.extractHouseholdPersons(otherHousehold, otherCase);

          for (const otherPerson of otherPersons) {
            const match = this.checkForMatch(person, otherPerson);
            if (match) {
              matches.push(match);

              // Store in database
              await this.storeDuplicateClaim(
                caseId,
                clientCase.householdProfileId || undefined,
                otherCase.id,
                otherCase.householdProfileId || undefined,
                person,
                match,
                stateCode,
                tenantId
              );
            }
          }
        }
      }

      let hybridVerification: HybridDuplicateContext | undefined;

      if (matches.length > 0) {
        try {
          const hybridResult = await neuroSymbolicHybridGateway.validateConsistency(
            {
              caseId,
              checkType: 'household_composition',
              fieldValues: {
                duplicatesFound: matches.length,
                potentialFraud: matches.filter(m => m.isPotentialFraud).length,
                matchTypes: [...new Set(matches.map(m => m.matchType))],
                duplicateTypes: [...new Set(matches.map(m => m.duplicateType))]
              }
            },
            stateCode,
            'SNAP'
          );

          hybridVerification = {
            hasViolations: !hybridResult.isConsistent || matches.length > 0,
            statutoryCitations: hybridResult.statutoryCitations.length > 0 
              ? hybridResult.statutoryCitations 
              : [
                  '7 CFR 273.2(f)(1)(x) - Household Composition Verification',
                  '7 CFR 273.18 - Claims Against Households',
                  'COMAR 07.03.17.04 - Household Definition'
                ],
            ontologyTermsMatched: hybridResult.ontologyTermsViolated.map(t => t.termName),
            grade6Explanation: hybridResult.grade6Explanation || 
              `We found ${matches.length} case(s) where the same person may be getting benefits twice. ` +
              `This needs to be checked before approving the benefits.`
          };

          logger.info('Hybrid gateway duplicate verification completed', {
            service: 'DuplicateClaimDetectorService',
            caseId,
            hasViolations: hybridVerification.hasViolations,
            statutoryCitationsCount: hybridVerification.statutoryCitations.length
          });
        } catch (error) {
          logger.warn('Hybrid gateway duplicate verification failed, continuing without', {
            service: 'DuplicateClaimDetectorService',
            caseId,
            error: error instanceof Error ? error.message : 'Unknown'
          });
          
          hybridVerification = {
            hasViolations: matches.length > 0,
            statutoryCitations: [
              '7 CFR 273.2(f)(1)(x) - Household Composition Verification',
              '7 CFR 273.18 - Claims Against Households',
              'COMAR 07.03.17.04 - Household Definition'
            ],
            ontologyTermsMatched: ['household_composition', 'duplicate_claim'],
            grade6Explanation: `We found ${matches.length} case(s) where the same person may be getting benefits twice. ` +
              `This needs to be checked before approving the benefits.`
          };
        }
      }

      const result: DuplicateScanResult = {
        caseId,
        scannedPersons: persons.length,
        duplicatesFound: matches.length,
        potentialFraudCases: matches.filter(m => m.isPotentialFraud).length,
        totalImpactedAmount: matches.reduce((sum, m) => sum + (m.impactedBenefitAmount || 0), 0),
        matches,
        hybridVerification
      };

      logger.info('Duplicate claim scan completed', {
        service: 'DuplicateClaimDetectorService',
        caseId,
        duplicatesFound: result.duplicatesFound,
        hasHybridVerification: !!hybridVerification
      });

      return result;

    } catch (error) {
      logger.error('Duplicate claim scan failed', {
        service: 'DuplicateClaimDetectorService',
        method: 'scanCaseForDuplicates',
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Batch scan for duplicates across all active cases
   */
  async batchScanForDuplicates(
    stateCode: string = 'MD',
    limit: number = 100
  ): Promise<{
    casesScanned: number;
    totalDuplicatesFound: number;
    potentialFraudCases: number;
    resultsByCaseId: Map<string, DuplicateScanResult>;
  }> {
    const activeCases = await db.select()
      .from(clientCases)
      .where(eq(clientCases.status, 'active'))
      .limit(limit);

    const resultsByCaseId = new Map<string, DuplicateScanResult>();
    let totalDuplicatesFound = 0;
    let potentialFraudCases = 0;

    for (const clientCase of activeCases) {
      try {
        const result = await this.scanCaseForDuplicates(clientCase.id, { stateCode });
        resultsByCaseId.set(clientCase.id, result);
        totalDuplicatesFound += result.duplicatesFound;
        potentialFraudCases += result.potentialFraudCases;
      } catch (error) {
        logger.error('Batch scan failed for case', {
          service: 'DuplicateClaimDetectorService',
          caseId: clientCase.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      casesScanned: activeCases.length,
      totalDuplicatesFound,
      potentialFraudCases,
      resultsByCaseId
    };
  }

  /**
   * Get pending duplicate claims for resolution
   */
  async getPendingDuplicates(
    stateCode: string = 'MD',
    limit: number = 50
  ): Promise<PerDuplicateClaim[]> {
    return db.select()
      .from(perDuplicateClaims)
      .where(and(
        eq(perDuplicateClaims.stateCode, stateCode),
        eq(perDuplicateClaims.resolutionStatus, 'pending')
      ))
      .orderBy(desc(perDuplicateClaims.createdAt))
      .limit(limit);
  }

  /**
   * Resolve a duplicate claim finding
   */
  async resolveDuplicateClaim(
    claimId: string,
    resolution: {
      status: 'confirmed_duplicate' | 'false_positive' | 'resolved';
      action?: string;
      resolvedBy: string;
      notes?: string;
    }
  ): Promise<PerDuplicateClaim | null> {
    const [updated] = await db.update(perDuplicateClaims)
      .set({
        resolutionStatus: resolution.status,
        resolutionAction: resolution.action,
        resolvedBy: resolution.resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: resolution.notes,
        updatedAt: new Date()
      })
      .where(eq(perDuplicateClaims.id, claimId))
      .returning();

    return updated || null;
  }

  /**
   * Get duplicate statistics for reporting
   */
  async getDuplicateStats(stateCode: string = 'MD'): Promise<{
    totalDuplicatesDetected: number;
    pending: number;
    confirmed: number;
    falsePositives: number;
    resolved: number;
    potentialFraudCases: number;
    byDuplicateType: Record<string, number>;
    byMatchType: Record<string, number>;
  }> {
    const duplicates = await db.select()
      .from(perDuplicateClaims)
      .where(eq(perDuplicateClaims.stateCode, stateCode));

    const byDuplicateType: Record<string, number> = {};
    const byMatchType: Record<string, number> = {};
    let pending = 0, confirmed = 0, falsePositives = 0, resolved = 0, potentialFraud = 0;

    for (const d of duplicates) {
      // Count by status
      switch (d.resolutionStatus) {
        case 'pending': pending++; break;
        case 'confirmed_duplicate': confirmed++; break;
        case 'false_positive': falsePositives++; break;
        case 'resolved': resolved++; break;
      }

      // Count by type
      if (d.duplicateType) {
        byDuplicateType[d.duplicateType] = (byDuplicateType[d.duplicateType] || 0) + 1;
      }
      if (d.matchType) {
        byMatchType[d.matchType] = (byMatchType[d.matchType] || 0) + 1;
      }
      if (d.isPotentialFraud) potentialFraud++;
    }

    return {
      totalDuplicatesDetected: duplicates.length,
      pending,
      confirmed,
      falsePositives,
      resolved,
      potentialFraudCases: potentialFraud,
      byDuplicateType,
      byMatchType
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private extractHouseholdPersons(
    householdProfile: any,
    clientCase: any
  ): PersonIdentifier[] {
    const persons: PersonIdentifier[] = [];

    // Extract from client case name
    if (clientCase.clientName) {
      const nameParts = clientCase.clientName.split(' ');
      persons.push({
        firstName: nameParts[0] || '',
        lastName: nameParts[nameParts.length - 1] || '',
        relationship: 'head_of_household',
        caseId: clientCase.id,
        householdId: clientCase.householdProfileId
      });
    }

    // Extract from household profile if available
    if (householdProfile?.householdData) {
      const data = householdProfile.householdData;
      
      // Head of household
      if (data.headOfHousehold) {
        const head = data.headOfHousehold;
        persons.push({
          firstName: head.firstName || '',
          lastName: head.lastName || '',
          dob: head.dateOfBirth ? new Date(head.dateOfBirth) : undefined,
          ssn4: head.ssn ? head.ssn.slice(-4) : undefined,
          relationship: 'head_of_household',
          caseId: clientCase.id,
          householdId: householdProfile.id
        });
      }

      // Other household members
      if (Array.isArray(data.members)) {
        for (const member of data.members) {
          persons.push({
            firstName: member.firstName || '',
            lastName: member.lastName || '',
            dob: member.dateOfBirth ? new Date(member.dateOfBirth) : undefined,
            ssn4: member.ssn ? member.ssn.slice(-4) : undefined,
            relationship: member.relationship || 'other',
            caseId: clientCase.id,
            householdId: householdProfile.id
          });
        }
      }

      // Children specifically
      if (Array.isArray(data.children)) {
        for (const child of data.children) {
          persons.push({
            firstName: child.firstName || '',
            lastName: child.lastName || '',
            dob: child.dateOfBirth ? new Date(child.dateOfBirth) : undefined,
            relationship: 'child',
            caseId: clientCase.id,
            householdId: householdProfile.id
          });
        }
      }
    }

    return persons.filter(p => p.firstName || p.lastName);
  }

  private checkForMatch(
    person1: PersonIdentifier,
    person2: PersonIdentifier
  ): DuplicateMatch | null {
    // Skip if same case
    if (person1.caseId === person2.caseId) {
      return null;
    }

    const matchingFields: string[] = [];
    let matchConfidence = 0;

    // Check SSN (last 4)
    if (person1.ssn4 && person2.ssn4 && person1.ssn4 === person2.ssn4) {
      matchingFields.push('ssn4');
      matchConfidence += 0.5;
    }

    // Check name
    const nameMatch = this.checkNameMatch(person1, person2);
    if (nameMatch) {
      matchingFields.push('name');
      matchConfidence += 0.3;
    }

    // Check DOB
    if (person1.dob && person2.dob) {
      const dob1 = person1.dob.toISOString().split('T')[0];
      const dob2 = person2.dob.toISOString().split('T')[0];
      if (dob1 === dob2) {
        matchingFields.push('dob');
        matchConfidence += 0.2;
      }
    }

    // Minimum threshold for match
    if (matchConfidence < 0.5) {
      return null;
    }

    // Determine match type
    let matchType: 'exact_ssn' | 'name_dob' | 'name_address' | 'fuzzy';
    if (matchingFields.includes('ssn4')) {
      matchType = 'exact_ssn';
    } else if (matchingFields.includes('name') && matchingFields.includes('dob')) {
      matchType = 'name_dob';
    } else {
      matchType = 'fuzzy';
    }

    // Determine duplicate type
    let duplicateType: 'same_person_multiple_households' | 'child_claimed_twice' | 'identity_mismatch';
    if (person1.relationship === 'child' || person2.relationship === 'child') {
      duplicateType = 'child_claimed_twice';
    } else if (matchType === 'exact_ssn') {
      duplicateType = 'same_person_multiple_households';
    } else {
      duplicateType = 'identity_mismatch';
    }

    // High confidence duplicates may indicate fraud
    const isPotentialFraud = matchConfidence > 0.8 && matchType === 'exact_ssn';

    return {
      primaryPerson: person1,
      duplicatePerson: person2,
      matchType,
      matchConfidence,
      matchingFields,
      duplicateType,
      isPotentialFraud,
      impactedBenefitAmount: 200 // Estimated per-person SNAP impact
    };
  }

  private checkNameMatch(person1: PersonIdentifier, person2: PersonIdentifier): boolean {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z]/g, '');
    
    const fn1 = normalize(person1.firstName);
    const fn2 = normalize(person2.firstName);
    const ln1 = normalize(person1.lastName);
    const ln2 = normalize(person2.lastName);

    // Exact match
    if (fn1 === fn2 && ln1 === ln2) {
      return true;
    }

    // First initial + full last name
    if (fn1[0] === fn2[0] && ln1 === ln2) {
      return true;
    }

    // Fuzzy last name match with exact first name
    if (fn1 === fn2 && this.similarityScore(ln1, ln2) > 0.8) {
      return true;
    }

    return false;
  }

  private similarityScore(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }

    return matches / longer.length;
  }

  private async storeDuplicateClaim(
    primaryCaseId: string,
    primaryHouseholdId: string | undefined,
    duplicateCaseId: string,
    duplicateHouseholdId: string | undefined,
    person: PersonIdentifier,
    match: DuplicateMatch,
    stateCode: string,
    tenantId?: string
  ): Promise<void> {
    const claim: InsertPerDuplicateClaim = {
      primaryCaseId,
      primaryHouseholdId,
      duplicateCaseId,
      duplicateHouseholdId,
      personFirstName: person.firstName,
      personLastName: person.lastName,
      personDob: person.dob?.toISOString().split('T')[0],
      personSsn4: person.ssn4,
      personRelationship: person.relationship,
      matchType: match.matchType,
      matchConfidence: match.matchConfidence,
      matchingFields: match.matchingFields,
      duplicateType: match.duplicateType,
      isPotentialFraud: match.isPotentialFraud,
      impactedBenefitAmount: match.impactedBenefitAmount,
      detectedBy: 'pre_submission',
      stateCode,
      tenantId
    };

    await db.insert(perDuplicateClaims).values(claim);
  }
}

export const duplicateClaimDetectorService = new DuplicateClaimDetectorService();
