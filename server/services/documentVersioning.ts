import { DocumentVersion } from "../../shared/schema.js";
import { storage } from "../storage.js";
import crypto from "crypto";
import { logger } from "./logger.service";

export interface VersionComparisonResult {
  hasChanged: boolean;
  previousVersion?: DocumentVersion;
  changesSummary?: string;
}

export class DocumentVersioningService {
  
  /**
   * Creates a new version of a document if it has changed
   */
  async createVersionIfChanged(
    documentId: string,
    documentBuffer: Buffer,
    sourceUrl: string,
    lastModifiedAt?: Date,
    httpHeaders?: Record<string, string>
  ): Promise<{ versionId?: string; hasChanged: boolean; versionNumber: number }> {
    
    // Calculate SHA-256 hash of the document
    const documentHash = crypto.createHash('sha256').update(documentBuffer).digest('hex');
    
    // Check for existing versions
    const existingVersions = await storage.getDocumentVersions(documentId);
    
    const latestVersion = existingVersions[0];
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    
    // Check if document has changed
    if (latestVersion && latestVersion.documentHash === documentHash) {
      logger.info('Document unchanged', {
        service: 'DocumentVersioningService',
        method: 'createVersionIfChanged',
        documentId,
        hashPrefix: documentHash.substring(0, 8)
      });
      return {
        hasChanged: false,
        versionNumber: latestVersion.versionNumber
      };
    }
    
    // Generate changes summary if this is an update
    let changesSummary = "Initial version";
    if (latestVersion) {
      changesSummary = await this.generateChangesSummary(latestVersion, {
        documentHash,
        sourceUrl,
        lastModifiedAt,
        fileSize: documentBuffer.length
      });
    }
    
    // Deactivate previous version
    if (latestVersion) {
      await storage.deactivateDocumentVersions(documentId);
    }
    
    // Create new version record
    const versionData = {
      documentId,
      versionNumber: nextVersionNumber,
      documentHash,
      sourceUrl,
      downloadedAt: new Date(),
      lastModifiedAt,
      fileSize: documentBuffer.length,
      httpHeaders,
      changesSummary,
      auditTrail: {
        previousHash: latestVersion?.documentHash,
        changeType: latestVersion ? 'updated' : 'created',
        detectedChanges: {
          sizeChange: latestVersion ? documentBuffer.length - (latestVersion.fileSize || 0) : documentBuffer.length,
          hashDifference: latestVersion ? this.getHashDifference(latestVersion.documentHash, documentHash) : null
        }
      },
      objectPath: null, // Will be set after object storage upload
      isActive: true
    };
    
    const newVersion = await storage.createDocumentVersion(versionData);
    
    logger.info('Created document version', {
      service: 'DocumentVersioningService',
      method: 'createVersionIfChanged',
      documentId,
      versionNumber: nextVersionNumber,
      hashPrefix: documentHash.substring(0, 8)
    });
    
    return {
      versionId: newVersion.id,
      hasChanged: true,
      versionNumber: nextVersionNumber
    };
  }
  
  /**
   * Get all versions of a document
   */
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return await storage.getDocumentVersions(documentId);
  }
  
  /**
   * Get the active (current) version of a document
   */
  async getActiveVersion(documentId: string): Promise<DocumentVersion | null> {
    return await storage.getActiveDocumentVersion(documentId);
  }
  
  /**
   * Update object storage path for a version
   */
  async updateObjectPath(versionId: string, objectPath: string): Promise<void> {
    await storage.updateDocumentVersion(versionId, { objectPath });
  }
  
  /**
   * Check if document has changed compared to latest version
   */
  async checkForChanges(
    documentId: string,
    newDocumentBuffer: Buffer
  ): Promise<VersionComparisonResult> {
    
    const newDocumentHash = crypto.createHash('sha256').update(newDocumentBuffer).digest('hex');
    
    const activeVersion = await this.getActiveVersion(documentId);
    
    if (!activeVersion) {
      return { hasChanged: true };
    }
    
    const hasChanged = activeVersion.documentHash !== newDocumentHash;
    
    let changesSummary;
    if (hasChanged) {
      changesSummary = await this.generateChangesSummary(activeVersion, {
        documentHash: newDocumentHash,
        fileSize: newDocumentBuffer.length
      });
    }
    
    return {
      hasChanged,
      previousVersion: activeVersion,
      changesSummary
    };
  }
  
  /**
   * Generate a summary of what changed between versions
   */
  private async generateChangesSummary(
    previousVersion: DocumentVersion,
    newVersion: {
      documentHash: string;
      sourceUrl?: string;
      lastModifiedAt?: Date;
      fileSize?: number;
    }
  ): Promise<string> {
    const changes: string[] = [];
    
    // File size change
    if (previousVersion.fileSize && newVersion.fileSize) {
      const sizeDiff = newVersion.fileSize - previousVersion.fileSize;
      if (sizeDiff !== 0) {
        const sizeChange = sizeDiff > 0 ? `+${sizeDiff}` : `${sizeDiff}`;
        changes.push(`Size changed by ${sizeChange} bytes`);
      }
    }
    
    // Last modified date change
    if (previousVersion.lastModifiedAt && newVersion.lastModifiedAt) {
      const prevDate = new Date(previousVersion.lastModifiedAt);
      const newDate = new Date(newVersion.lastModifiedAt);
      if (prevDate.getTime() !== newDate.getTime()) {
        changes.push(`Last modified: ${newDate.toISOString()}`);
      }
    }
    
    // Hash difference (first 8 characters for readability)
    const prevHashShort = previousVersion.documentHash.substring(0, 8);
    const newHashShort = newVersion.documentHash.substring(0, 8);
    changes.push(`Hash: ${prevHashShort}... → ${newHashShort}...`);
    
    return changes.length > 0 ? changes.join("; ") : "Content updated";
  }
  
  /**
   * Calculate hash difference metric (for debugging)
   */
  private getHashDifference(hash1: string, hash2: string): number {
    let differences = 0;
    const minLength = Math.min(hash1.length, hash2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }
    
    return differences;
  }
  
  /**
   * Get version history summary for dashboard
   */
  async getVersionHistorySummary(documentId: string): Promise<{
    totalVersions: number;
    latestVersion: number;
    lastChanged: Date;
    changeFrequency: number; // days between changes on average
  }> {
    const versions = await this.getDocumentVersions(documentId);
    
    if (versions.length === 0) {
      return {
        totalVersions: 0,
        latestVersion: 0,
        lastChanged: new Date(),
        changeFrequency: 0
      };
    }
    
    const latestVersion = versions[0];
    const oldestVersion = versions[versions.length - 1];
    
    // Calculate average days between changes
    let changeFrequency = 0;
    if (versions.length > 1) {
      const timeSpan = latestVersion.createdAt.getTime() - oldestVersion.createdAt.getTime();
      const daySpan = timeSpan / (1000 * 60 * 60 * 24);
      changeFrequency = daySpan / (versions.length - 1);
    }
    
    return {
      totalVersions: versions.length,
      latestVersion: latestVersion.versionNumber,
      lastChanged: latestVersion.createdAt,
      changeFrequency: Math.round(changeFrequency * 10) / 10 // Round to 1 decimal
    };
  }
}