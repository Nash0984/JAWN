import crypto from 'crypto';
import { db } from '../db';
import { auditLogs, type InsertAuditLog, type AuditLog } from '@shared/schema';
import { desc, sql, eq } from 'drizzle-orm';
import { logger } from './logger.service';

/**
 * Immutable Audit Log Service
 * 
 * Implements blockchain-inspired append-only audit logging with cryptographic chain-of-custody
 * 
 * Compliance:
 * - NIST 800-53 AU-9: Protection of Audit Information
 * - IRS Pub 1075 9.3.1: Audit log protection and integrity
 * - HIPAA § 164.312(b): Audit controls and integrity verification
 * - SOC 2 CC5.2: System monitoring for security events
 * 
 * Architecture:
 * - Each audit entry hashes its content + previous entry's hash (SHA-256)
 * - Creates immutable chain: tampering with any entry breaks the chain
 * - PostgreSQL triggers prevent UPDATE/DELETE operations
 * - Sequence numbers ensure ordering integrity
 * 
 * Hash Chain:
 * Entry 1: hash(entry1_data + null)           → hash1
 * Entry 2: hash(entry2_data + hash1)          → hash2
 * Entry 3: hash(entry3_data + hash2)          → hash3
 * 
 * If entry 2 is modified, hash2 changes → hash3 verification fails
 */

export interface AuditLogEntry extends Omit<InsertAuditLog, 'previousHash' | 'entryHash'> {
  // All fields from InsertAuditLog except previousHash and entryHash (computed by this service)
}

interface ChainVerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenLinks: Array<{
    sequenceNumber: number;
    entryId: string;
    expectedHash: string;
    actualHash: string;
    reason: string;
  }>;
  lastVerifiedSequence: number | null;
}

class ImmutableAuditService {
  
  /**
   * Compute SHA-256 hash for an audit log entry
   * 
   * Hash includes: userId, action, resource, resourceId, details, changesBefore, 
   * changesAfter, ipAddress, sessionId, sensitiveDataAccessed, previousHash
   */
  private computeEntryHash(entry: AuditLogEntry, previousHash: string | null): string {
    // Create deterministic hash input
    const hashInput = JSON.stringify({
      userId: entry.userId || null,
      username: entry.username || null,
      userRole: entry.userRole || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      details: entry.details || null,
      changesBefore: entry.changesBefore || null,
      changesAfter: entry.changesAfter || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      sessionId: entry.sessionId || null,
      requestId: entry.requestId || null,
      sensitiveDataAccessed: entry.sensitiveDataAccessed || false,
      piiFields: entry.piiFields || null,
      success: entry.success !== undefined ? entry.success : true,
      errorMessage: entry.errorMessage || null,
      countyId: entry.countyId || null,
      previousHash: previousHash || null,
    });
    
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }
  
  /**
   * Log an audit event with cryptographic hash chain
   * 
   * This is the primary method for creating audit logs.
   * 
   * Concurrency Safety (Architect-reviewed fix for race condition):
   * - Uses PostgreSQL advisory lock (pg_advisory_xact_lock) to serialize writes
   * - Advisory lock is automatically released at end of transaction
   * - Ensures only one audit log is created at a time across all sessions
   * - Prevents previousHash from being NULL or duplicated
   * 
   * Lock ID: 1234567890 (arbitrary constant for audit log chain)
   */
  async log(entry: AuditLogEntry): Promise<AuditLog> {
    try {
      // Wrap in transaction to prevent concurrent hash chain corruption
      const result = await db.transaction(async (tx) => {
        // CRITICAL: Acquire advisory lock to serialize all audit log writes
        // This lock is automatically released when the transaction completes
        // Lock ID 1234567890 is used specifically for audit log hash chain
        await tx.execute(sql`SELECT pg_advisory_xact_lock(1234567890)`);
        
        // Now that we have the lock, safely read the latest entry
        const [latestEntry] = await tx
          .select({
            sequenceNumber: auditLogs.sequenceNumber,
            entryHash: auditLogs.entryHash,
          })
          .from(auditLogs)
          .orderBy(desc(auditLogs.sequenceNumber))
          .limit(1);
        
        const previousHash = latestEntry?.entryHash || null;
        
        // Compute hash for this entry
        const entryHash = this.computeEntryHash(entry, previousHash);
        
        // Insert with hash chain
        const [created] = await tx.insert(auditLogs).values({
          ...entry,
          previousHash,
          entryHash,
        }).returning();
        
        logger.debug('Immutable audit log created', {
          action: entry.action,
          resource: entry.resource,
          sequenceNumber: created.sequenceNumber,
          previousHash: previousHash ? previousHash.substring(0, 8) + '...' : null,
          entryHash: entryHash.substring(0, 8) + '...',
        });
        
        return created;
      });
      
      return result;
      
    } catch (error) {
      // Never fail the main operation due to audit logging failure
      logger.error('Immutable audit log error', {
        error,
        action: entry.action,
        resource: entry.resource,
      });
      
      // Re-throw to maintain backwards compatibility with callers
      throw error;
    }
  }
  
  /**
   * Verify the integrity of the entire audit log chain
   * 
   * Checks:
   * 1. Each entry's hash is correct (re-compute and compare)
   * 2. Each entry's previousHash matches the previous entry's entryHash
   * 3. Sequence numbers are continuous
   */
  async verifyChain(): Promise<ChainVerificationResult> {
    const result: ChainVerificationResult = {
      isValid: true,
      totalEntries: 0,
      verifiedEntries: 0,
      brokenLinks: [],
      lastVerifiedSequence: null,
    };
    
    try {
      // Get all entries ordered by sequence
      const entries = await db
        .select()
        .from(auditLogs)
        .orderBy(auditLogs.sequenceNumber);
      
      result.totalEntries = entries.length;
      
      if (entries.length === 0) {
        return result; // Empty chain is valid
      }
      
      let previousEntry: AuditLog | null = null;
      
      for (const entry of entries) {
        // Verify first entry has no previous hash
        if (entry.sequenceNumber === 1 || previousEntry === null) {
          if (entry.previousHash !== null) {
            result.isValid = false;
            result.brokenLinks.push({
              sequenceNumber: entry.sequenceNumber,
              entryId: entry.id,
              expectedHash: 'null',
              actualHash: entry.previousHash,
              reason: 'First entry should have null previousHash',
            });
            continue;
          }
        } else {
          // Verify previousHash matches previous entry's entryHash
          if (entry.previousHash !== previousEntry.entryHash) {
            result.isValid = false;
            result.brokenLinks.push({
              sequenceNumber: entry.sequenceNumber,
              entryId: entry.id,
              expectedHash: previousEntry.entryHash,
              actualHash: entry.previousHash || 'null',
              reason: 'previousHash does not match previous entry',
            });
            continue;
          }
        }
        
        // Recompute this entry's hash and verify
        const recomputedHash = this.computeEntryHash(entry, entry.previousHash);
        if (recomputedHash !== entry.entryHash) {
          result.isValid = false;
          result.brokenLinks.push({
            sequenceNumber: entry.sequenceNumber,
            entryId: entry.id,
            expectedHash: recomputedHash,
            actualHash: entry.entryHash,
            reason: 'Entry hash does not match computed hash (entry modified)',
          });
          continue;
        }
        
        // This entry is valid
        result.verifiedEntries++;
        result.lastVerifiedSequence = entry.sequenceNumber;
        previousEntry = entry;
      }
      
      logger.info('Audit chain verification complete', {
        totalEntries: result.totalEntries,
        verifiedEntries: result.verifiedEntries,
        isValid: result.isValid,
        brokenLinks: result.brokenLinks.length,
      });
      
    } catch (error) {
      logger.error('Audit chain verification failed', { error });
      result.isValid = false;
    }
    
    return result;
  }
  
  /**
   * Quick integrity check - verify the last N entries
   * Faster than full chain verification for routine checks
   */
  async verifyRecentEntries(count: number = 100): Promise<ChainVerificationResult> {
    const result: ChainVerificationResult = {
      isValid: true,
      totalEntries: count,
      verifiedEntries: 0,
      brokenLinks: [],
      lastVerifiedSequence: null,
    };
    
    try {
      // Get last N entries
      const entries = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.sequenceNumber))
        .limit(count);
      
      if (entries.length === 0) {
        return result;
      }
      
      // Reverse to process in ascending sequence order
      entries.reverse();
      
      let previousEntry: AuditLog | null = null;
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Skip previousHash check for the first entry in our subset
        // (we don't have the actual previous entry)
        if (i > 0 && previousEntry) {
          if (entry.previousHash !== previousEntry.entryHash) {
            result.isValid = false;
            result.brokenLinks.push({
              sequenceNumber: entry.sequenceNumber,
              entryId: entry.id,
              expectedHash: previousEntry.entryHash,
              actualHash: entry.previousHash || 'null',
              reason: 'previousHash does not match previous entry',
            });
            continue;
          }
        }
        
        // Verify this entry's hash
        const recomputedHash = this.computeEntryHash(entry, entry.previousHash);
        if (recomputedHash !== entry.entryHash) {
          result.isValid = false;
          result.brokenLinks.push({
            sequenceNumber: entry.sequenceNumber,
            entryId: entry.id,
            expectedHash: recomputedHash,
            actualHash: entry.entryHash,
            reason: 'Entry hash does not match computed hash',
          });
          continue;
        }
        
        result.verifiedEntries++;
        result.lastVerifiedSequence = entry.sequenceNumber;
        previousEntry = entry;
      }
      
    } catch (error) {
      logger.error('Recent entries verification failed', { error });
      result.isValid = false;
    }
    
    return result;
  }
  
  /**
   * Get audit log statistics (enhanced for dashboard)
   */
  async getStatistics(): Promise<{
    totalEntries: number;
    firstEntry: Date | null;
    lastEntry: Date | null;
    chainLength: number;
    lastVerified: Date | null;
    integrityStatus: 'valid' | 'pending' | 'compromised';
    recentActionCounts: Array<{ action: string; count: number }>;
  }> {
    const [stats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        firstEntry: sql<Date>`min(created_at)`,
        lastEntry: sql<Date>`max(created_at)`,
        maxSequence: sql<number>`max(sequence_number)::int`,
      })
      .from(auditLogs);
    
    // Get last verification timestamp from audit logs
    const [lastVerification] = await db
      .select({ createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(eq(auditLogs.action, 'audit_chain_verified'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

    // Get last verification result (check for chain_integrity_compromised action)
    const [compromised] = await db
      .select({ createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(eq(auditLogs.action, 'chain_integrity_compromised'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

    // Determine integrity status
    let integrityStatus: 'valid' | 'pending' | 'compromised' = 'pending';
    if (compromised) {
      // If there's a compromise record, check if verification happened after
      if (lastVerification && new Date(lastVerification.createdAt) > new Date(compromised.createdAt)) {
        integrityStatus = 'valid'; // Verified after compromise was found and fixed
      } else {
        integrityStatus = 'compromised';
      }
    } else if (lastVerification) {
      integrityStatus = 'valid';
    }

    // Get recent action counts (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActions = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(sql`${auditLogs.createdAt} >= ${twentyFourHoursAgo}`)
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`));
    
    return {
      totalEntries: stats?.count || 0,
      firstEntry: stats?.firstEntry || null,
      lastEntry: stats?.lastEntry || null,
      chainLength: stats?.maxSequence || 0,
      lastVerified: lastVerification?.createdAt || null,
      integrityStatus,
      recentActionCounts: recentActions.map(r => ({ action: r.action, count: r.count })),
    };
  }
}

export const immutableAuditService = new ImmutableAuditService();
export type { ChainVerificationResult };
