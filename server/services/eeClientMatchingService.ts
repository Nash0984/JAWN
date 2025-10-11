import { storage } from '../storage';
import type { EeClient, ClientCase, InsertCrossEnrollmentOpportunity } from '@shared/schema';
import crypto from 'crypto';

interface MatchResult {
  eeClientId: string;
  matchedClientCaseId: string | null;
  matchMethod: 'deterministic' | 'fuzzy' | 'manual' | null;
  matchConfidenceScore: number;
  matchStatus: 'matched' | 'no_match' | 'needs_review';
}

interface MatchingStats {
  totalProcessed: number;
  deterministicMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  needsReview: number;
}

export class EeClientMatchingService {
  // Double Metaphone implementation (simplified phonetic algorithm)
  private doubleMetaphone(input: string): string[] {
    // Simplified implementation - in production, use a proper library like 'double-metaphone'
    // For now, use a basic phonetic hash
    const cleaned = input.toUpperCase().replace(/[^A-Z]/g, '');
    
    // Basic phonetic rules
    let primary = cleaned
      .replace(/PH/g, 'F')
      .replace(/CK/g, 'K')
      .replace(/SH/g, 'X')
      .replace(/CH/g, 'X')
      .replace(/TH/g, 'T')
      .replace(/GH/g, 'G')
      .replace(/[AEIOU]/g, ''); // Remove vowels
    
    return [primary.substring(0, 6)]; // Return first 6 chars as phonetic code
  }

  // Generate deterministic hash from SSN4 + DOB
  private generateDeterministicHash(ssnLast4: string, dateOfBirth: Date): string {
    const dobString = dateOfBirth.toISOString().split('T')[0]; // YYYY-MM-DD
    const combined = `${ssnLast4}-${dobString}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  // Generate phonetic hash for fuzzy matching
  private generatePhoneticHash(name: string): string {
    const parts = name.trim().split(/\s+/);
    const phonetics = parts.map(part => this.doubleMetaphone(part)[0]);
    return phonetics.join('-');
  }

  async matchDatasetClients(datasetId: string): Promise<MatchingStats> {
    const stats: MatchingStats = {
      totalProcessed: 0,
      deterministicMatches: 0,
      fuzzyMatches: 0,
      noMatches: 0,
      needsReview: 0,
    };

    // Get all clients from the dataset
    const eeClients = await storage.getEeClients({ datasetId });
    
    // Get all existing client cases for matching
    const clientCases = await storage.getClientCases();

    for (const eeClient of eeClients) {
      const matchResult = await this.matchSingleClient(eeClient, clientCases);
      
      // Update the EE client with match results
      await storage.updateEeClient(eeClient.id, {
        matchedClientCaseId: matchResult.matchedClientCaseId,
        matchMethod: matchResult.matchMethod,
        matchConfidenceScore: matchResult.matchConfidenceScore,
        matchStatus: matchResult.matchStatus,
        clientIdentifierHash: matchResult.matchMethod === 'deterministic' && eeClient.ssnLast4 && eeClient.dateOfBirth ? 
          this.generateDeterministicHash(eeClient.ssnLast4, eeClient.dateOfBirth) : undefined,
        clientNameHash: matchResult.matchMethod === 'fuzzy' ? 
          this.generatePhoneticHash(eeClient.clientName) : undefined,
      });

      // Update stats
      stats.totalProcessed++;
      if (matchResult.matchMethod === 'deterministic') {
        stats.deterministicMatches++;
      } else if (matchResult.matchMethod === 'fuzzy') {
        stats.fuzzyMatches++;
      }
      
      if (matchResult.matchStatus === 'no_match') {
        stats.noMatches++;
      } else if (matchResult.matchStatus === 'needs_review') {
        stats.needsReview++;
      }
    }

    return stats;
  }

  private async matchSingleClient(
    eeClient: EeClient, 
    clientCases: ClientCase[]
  ): Promise<MatchResult> {
    // Strategy 1: Deterministic matching (SSN4 via clientIdentifier)
    // Note: ClientCase.clientIdentifier may contain SSN4 or case number
    if (eeClient.ssnLast4) {
      for (const clientCase of clientCases) {
        // Check if clientIdentifier matches SSN4
        if (clientCase.clientIdentifier === eeClient.ssnLast4) {
          // Exact match on SSN4
          return {
            eeClientId: eeClient.id,
            matchedClientCaseId: clientCase.id,
            matchMethod: 'deterministic',
            matchConfidenceScore: 0.90, // High confidence for SSN4 match
            matchStatus: 'matched',
          };
        }
      }
    }

    // Strategy 2: Fuzzy matching (Phonetic name matching)
    const phoneticHash = this.generatePhoneticHash(eeClient.clientName);
    
    for (const clientCase of clientCases) {
      const casePhoneticHash = this.generatePhoneticHash(clientCase.clientName);
      
      if (phoneticHash === casePhoneticHash) {
        // Phonetic name match found
        let confidence = 0.70; // Base fuzzy confidence for phonetic match
        
        // Additional validation: check household size similarity if available
        if (eeClient.householdSize && clientCase.householdSize) {
          if (eeClient.householdSize === clientCase.householdSize) {
            confidence = 0.80; // Same household size increases confidence
          }
        }

        // All fuzzy matches need manual review
        return {
          eeClientId: eeClient.id,
          matchedClientCaseId: clientCase.id,
          matchMethod: 'fuzzy',
          matchConfidenceScore: confidence,
          matchStatus: 'needs_review', // Fuzzy matches need manual review
        };
      }
    }

    // No match found
    return {
      eeClientId: eeClient.id,
      matchedClientCaseId: null,
      matchMethod: null,
      matchConfidenceScore: 0,
      matchStatus: 'no_match',
    };
  }

  async createCrossEnrollmentOpportunities(datasetId: string, createdBy: string): Promise<number> {
    // Get all matched clients from the dataset
    const matchedClients = await storage.getEeClients({ 
      datasetId, 
      matchStatus: 'matched' 
    });

    let opportunitiesCreated = 0;

    for (const eeClient of matchedClients) {
      if (!eeClient.matchedClientCaseId) continue;

      // Get the matched client case to determine current programs
      const clientCase = await storage.getClientCase(eeClient.matchedClientCaseId);
      if (!clientCase) continue;

      // Skip if no program enrollment info
      if (!eeClient.enrolledProgramId) continue;
      if (!clientCase.clientIdentifier) continue;

      // Get client's current program enrollments
      const enrollments = await storage.getProgramEnrollmentsByClient(clientCase.clientIdentifier);
      const enrolledProgramIds = new Set(enrollments.map(e => e.benefitProgramId));

      // Get all active benefit programs
      const allPrograms = await storage.getBenefitPrograms();
      
      // Identify programs they're NOT enrolled in
      for (const program of allPrograms) {
        if (!program.isActive) continue;
        if (enrolledProgramIds.has(program.id)) continue;

        // Check if they're already enrolled in this program via E&E data
        if (eeClient.enrolledProgramId === program.id) continue;

        // Create cross-enrollment opportunity
        try {
          await storage.createCrossEnrollmentOpportunity({
            eeClientId: eeClient.id,
            clientCaseId: clientCase.id,
            currentProgramId: eeClient.enrolledProgramId,
            targetProgramId: program.id,
            eligibilityScore: 0.5, // Placeholder - will be calculated by PolicyEngine service
            eligibilityReason: `Client enrolled in ${eeClient.enrolledProgramId}, may be eligible for ${program.code}`,
            priority: 'medium',
            outreachStatus: 'identified',
            createdBy,
          } as InsertCrossEnrollmentOpportunity);
          
          opportunitiesCreated++;
        } catch (err) {
          console.error(`Error creating opportunity for client ${eeClient.id}:`, err);
        }
      }
    }

    return opportunitiesCreated;
  }

  async manualMatchApproval(eeClientId: string, clientCaseId: string, reviewedBy: string): Promise<void> {
    await storage.updateEeClient(eeClientId, {
      matchedClientCaseId: clientCaseId,
      matchMethod: 'manual',
      matchConfidenceScore: 1.0,
      matchStatus: 'matched',
      reviewedBy,
      reviewedAt: new Date(),
    });
  }

  async manualMatchRejection(eeClientId: string, reviewedBy: string): Promise<void> {
    await storage.updateEeClient(eeClientId, {
      matchedClientCaseId: null,
      matchMethod: null,
      matchConfidenceScore: 0,
      matchStatus: 'no_match',
      reviewedBy,
      reviewedAt: new Date(),
    });
  }
}

export const eeClientMatchingService = new EeClientMatchingService();
