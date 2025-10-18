import { db } from "../db";
import {
  translationKeys,
  translationVersions,
  translationSuggestions,
  suggestionVotes,
  translationAssignments,
  translationAuditLog,
  translationLocales,
  users,
} from "@shared/schema";
import { eq, and, or, like, desc, sql, count, ilike, inArray } from "drizzle-orm";

export interface TranslationFilters {
  namespace?: string;
  targetLocaleId?: string;
  status?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TranslationKeyWithMetadata {
  id: string;
  namespace: string;
  key: string;
  defaultText: string;
  context: string | null;
  currentVersion?: {
    id: string;
    translatedText: string;
    status: string;
    qualityScore: number | null;
    translatorId: string | null;
    translatorName: string | null;
    reviewerId: string | null;
    reviewerName: string | null;
    versionNumber: number;
  };
  assignedTranslator?: {
    id: string;
    fullName: string;
  };
  assignedReviewer?: {
    id: string;
    fullName: string;
  };
  suggestionCount: number;
  isAssignedToUser: boolean;
}

export class TranslationService {
  /**
   * Get paginated list of translations with metadata
   */
  async getTranslations(filters: TranslationFilters, userId: string) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions for base keys query
    const conditions = [];
    
    if (filters.namespace) {
      conditions.push(eq(translationKeys.namespace, filters.namespace));
    }
    
    if (filters.search) {
      conditions.push(
        or(
          ilike(translationKeys.key, `%${filters.search}%`),
          ilike(translationKeys.defaultText, `%${filters.search}%`)
        )
      );
    }

    // If status or assignedTo filters are provided, we need to filter by related tables
    let filteredKeyIds: string[] | null = null;

    // Filter by status (requires checking translationVersions)
    if (filters.status && filters.targetLocaleId) {
      const versionsWithStatus = await db.query.translationVersions.findMany({
        where: and(
          eq(translationVersions.targetLocaleId, filters.targetLocaleId),
          eq(translationVersions.status, filters.status),
          eq(translationVersions.isCurrentVersion, true)
        ),
        columns: { keyId: true },
      });
      filteredKeyIds = versionsWithStatus.map(v => v.keyId);
    }

    // Filter by assignedTo (requires checking translationAssignments)
    if (filters.assignedTo && filters.targetLocaleId) {
      const assignmentsForUser = await db.query.translationAssignments.findMany({
        where: and(
          eq(translationAssignments.userId, filters.assignedTo),
          eq(translationAssignments.targetLocaleId, filters.targetLocaleId),
          eq(translationAssignments.status, 'active')
        ),
        columns: { keyId: true },
      });
      const assignedKeyIds = assignmentsForUser.map(a => a.keyId);
      
      // Intersect with previous filter if exists
      if (filteredKeyIds !== null) {
        filteredKeyIds = filteredKeyIds.filter(id => assignedKeyIds.includes(id));
      } else {
        filteredKeyIds = assignedKeyIds;
      }
    }

    // Add filtered key IDs to conditions
    if (filteredKeyIds !== null) {
      if (filteredKeyIds.length === 0) {
        // No keys match the filters, return empty result
        return {
          data: [],
          pagination: {
            page,
            limit,
            totalCount: 0,
            totalPages: 0,
          },
        };
      }
      conditions.push(inArray(translationKeys.id, filteredKeyIds));
    }

    // Get all translation keys with metadata
    const keys = await db.query.translationKeys.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit,
      offset,
      orderBy: [desc(translationKeys.updatedAt)],
    });

    // For each key, get current version, assignments, and suggestion count
    const keysWithMetadata = await Promise.all(
      keys.map(async (key) => {
        // Get current version for target locale
        let currentVersion = null;
        if (filters.targetLocaleId) {
          const version = await db.query.translationVersions.findFirst({
            where: and(
              eq(translationVersions.keyId, key.id),
              eq(translationVersions.targetLocaleId, filters.targetLocaleId),
              eq(translationVersions.isCurrentVersion, true)
            ),
            with: {
              translator: true,
              reviewer: true,
            },
          });

          if (version) {
            currentVersion = {
              id: version.id,
              translatedText: version.translatedText,
              status: version.status,
              qualityScore: version.qualityScore,
              translatorId: version.translatorId,
              translatorName: version.translator?.fullName || version.translator?.username || null,
              reviewerId: version.reviewerId,
              reviewerName: version.reviewer?.fullName || version.reviewer?.username || null,
              versionNumber: version.versionNumber,
            };
          }
        }

        // Get assignments
        const assignments = filters.targetLocaleId
          ? await db.query.translationAssignments.findMany({
              where: and(
                eq(translationAssignments.keyId, key.id),
                eq(translationAssignments.targetLocaleId, filters.targetLocaleId),
                eq(translationAssignments.status, 'active')
              ),
              with: { user: true },
            })
          : [];

        const translatorAssignment = assignments.find((a) => a.role === 'translator');
        const reviewerAssignment = assignments.find((a) => a.role === 'reviewer');

        // Get suggestion count
        const suggestionCountResult = filters.targetLocaleId
          ? await db
              .select({ count: count() })
              .from(translationSuggestions)
              .where(
                and(
                  eq(translationSuggestions.keyId, key.id),
                  eq(translationSuggestions.targetLocaleId, filters.targetLocaleId),
                  eq(translationSuggestions.status, 'pending')
                )
              )
          : [{ count: 0 }];

        const isAssignedToUser = assignments.some((a) => a.userId === userId);

        return {
          ...key,
          currentVersion: currentVersion || undefined,
          assignedTranslator: translatorAssignment
            ? { id: translatorAssignment.userId, fullName: translatorAssignment.user.fullName || translatorAssignment.user.username }
            : undefined,
          assignedReviewer: reviewerAssignment
            ? { id: reviewerAssignment.userId, fullName: reviewerAssignment.user.fullName || reviewerAssignment.user.username }
            : undefined,
          suggestionCount: suggestionCountResult[0].count as number,
          isAssignedToUser,
        };
      })
    );

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(translationKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalCount = totalCountResult[0].count as number;

    return {
      data: keysWithMetadata,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Get detailed translation info including versions, suggestions, and audit trail
   */
  async getTranslationDetail(keyId: string, targetLocaleId?: string) {
    const key = await db.query.translationKeys.findFirst({
      where: eq(translationKeys.id, keyId),
    });

    if (!key) {
      return null;
    }

    // Get all versions
    const versions = await db.query.translationVersions.findMany({
      where: targetLocaleId
        ? and(eq(translationVersions.keyId, keyId), eq(translationVersions.targetLocaleId, targetLocaleId))
        : eq(translationVersions.keyId, keyId),
      with: {
        translator: true,
        reviewer: true,
        targetLocale: true,
      },
      orderBy: [desc(translationVersions.versionNumber)],
    });

    // Get suggestions
    const suggestions = await db.query.translationSuggestions.findMany({
      where: targetLocaleId
        ? and(eq(translationSuggestions.keyId, keyId), eq(translationSuggestions.targetLocaleId, targetLocaleId))
        : eq(translationSuggestions.keyId, keyId),
      with: {
        suggestedBy: true,
        reviewer: true,
        votes: true,
      },
      orderBy: [desc(translationSuggestions.upvotes)],
    });

    // Get audit log
    const auditLogs = await db.query.translationAuditLog.findMany({
      where: targetLocaleId
        ? sql`${translationAuditLog.details}->>'keyId' = ${keyId} AND ${translationAuditLog.details}->>'targetLocaleId' = ${targetLocaleId}`
        : sql`${translationAuditLog.details}->>'keyId' = ${keyId}`,
      with: { actor: true },
      orderBy: [desc(translationAuditLog.createdAt)],
      limit: 50,
    });

    return {
      key,
      versions,
      suggestions,
      auditLogs,
    };
  }

  /**
   * Create a new translation version
   */
  async createVersion(keyId: string, targetLocaleId: string, translatedText: string, translatorId: string) {
    // Get the next version number
    const lastVersion = await db.query.translationVersions.findFirst({
      where: and(eq(translationVersions.keyId, keyId), eq(translationVersions.targetLocaleId, targetLocaleId)),
      orderBy: [desc(translationVersions.versionNumber)],
    });

    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    // Get source locale (default locale)
    const defaultLocale = await db.query.translationLocales.findFirst({
      where: eq(translationLocales.isDefault, true),
    });

    if (!defaultLocale) {
      throw new Error("Default locale not found");
    }

    // Create new version
    const [newVersion] = await db
      .insert(translationVersions)
      .values({
        keyId,
        sourceLocaleId: defaultLocale.id,
        targetLocaleId,
        versionNumber,
        translatedText,
        status: 'draft',
        translatorId,
      })
      .returning();

    // Log audit trail
    await db.insert(translationAuditLog).values({
      action: 'version_created',
      actorId: translatorId,
      versionId: newVersion.id,
      details: { keyId, targetLocaleId, versionNumber, translatedText: translatedText.substring(0, 100) },
    });

    return newVersion;
  }

  /**
   * Update an existing draft version
   */
  async updateVersion(versionId: string, translatedText: string) {
    // Check if version is draft
    const version = await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, versionId),
    });

    if (!version) {
      throw new Error("Version not found");
    }

    if (version.status !== 'draft') {
      throw new Error("Can only update draft versions");
    }

    // Update version
    const [updated] = await db
      .update(translationVersions)
      .set({ translatedText, updatedAt: new Date() })
      .where(eq(translationVersions.id, versionId))
      .returning();

    return updated;
  }

  /**
   * Submit a version for review
   */
  async submitForReview(versionId: string) {
    const version = await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, versionId),
    });

    if (!version) {
      throw new Error("Version not found");
    }

    if (version.status !== 'draft') {
      throw new Error("Only draft versions can be submitted for review");
    }

    const [updated] = await db
      .update(translationVersions)
      .set({ status: 'pending_review', updatedAt: new Date() })
      .where(eq(translationVersions.id, versionId))
      .returning();

    // Log audit trail
    await db.insert(translationAuditLog).values({
      action: 'submitted_for_review',
      actorId: version.translatorId,
      versionId,
      details: { keyId: version.keyId, targetLocaleId: version.targetLocaleId },
    });

    return updated;
  }

  /**
   * Approve a translation version
   */
  async approveVersion(versionId: string, reviewerId: string, reviewerNotes?: string) {
    const version = await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, versionId),
    });

    if (!version) {
      throw new Error("Version not found");
    }

    // Start transaction
    await db.transaction(async (tx) => {
      // Set previous current version to not current
      await tx
        .update(translationVersions)
        .set({ isCurrentVersion: false })
        .where(
          and(
            eq(translationVersions.keyId, version.keyId),
            eq(translationVersions.targetLocaleId, version.targetLocaleId),
            eq(translationVersions.isCurrentVersion, true)
          )
        );

      // Update version
      await tx
        .update(translationVersions)
        .set({
          status: 'approved',
          reviewerId,
          reviewerNotes,
          reviewedAt: new Date(),
          isCurrentVersion: true,
          updatedAt: new Date(),
        })
        .where(eq(translationVersions.id, versionId));

      // Log audit trail
      await tx.insert(translationAuditLog).values({
        action: 'version_approved',
        actorId: reviewerId,
        versionId,
        details: { keyId: version.keyId, targetLocaleId: version.targetLocaleId, reviewerNotes },
      });
    });

    return await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, versionId),
    });
  }

  /**
   * Reject a translation version
   */
  async rejectVersion(versionId: string, reviewerId: string, reviewerNotes: string) {
    const version = await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, versionId),
    });

    if (!version) {
      throw new Error("Version not found");
    }

    const [updated] = await db
      .update(translationVersions)
      .set({
        status: 'rejected',
        reviewerId,
        reviewerNotes,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(translationVersions.id, versionId))
      .returning();

    // Log audit trail
    await db.insert(translationAuditLog).values({
      action: 'version_rejected',
      actorId: reviewerId,
      versionId,
      details: { keyId: version.keyId, targetLocaleId: version.targetLocaleId, reviewerNotes },
    });

    return updated;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackVersion(keyId: string, targetLocaleId: string, targetVersionId: string, actorId: string) {
    const targetVersion = await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, targetVersionId),
    });

    if (!targetVersion) {
      throw new Error("Target version not found");
    }

    await db.transaction(async (tx) => {
      // Get current version
      const currentVersion = await tx.query.translationVersions.findFirst({
        where: and(
          eq(translationVersions.keyId, keyId),
          eq(translationVersions.targetLocaleId, targetLocaleId),
          eq(translationVersions.isCurrentVersion, true)
        ),
      });

      // Set current version to archived
      if (currentVersion) {
        await tx
          .update(translationVersions)
          .set({ isCurrentVersion: false, status: 'archived' })
          .where(eq(translationVersions.id, currentVersion.id));
      }

      // Set target version as current
      await tx
        .update(translationVersions)
        .set({
          isCurrentVersion: true,
          status: 'approved',
          supersedesVersionId: currentVersion?.id,
          updatedAt: new Date(),
        })
        .where(eq(translationVersions.id, targetVersionId));

      // Log audit trail
      await tx.insert(translationAuditLog).values({
        action: 'version_rollback',
        actorId,
        versionId: targetVersionId,
        details: {
          keyId,
          targetLocaleId,
          fromVersionId: currentVersion?.id,
          toVersionId: targetVersionId,
        },
      });
    });

    return { success: true };
  }

  /**
   * Promote a community suggestion to an official version
   */
  async promoteSuggestion(suggestionId: string, reviewerId: string) {
    const suggestion = await db.query.translationSuggestions.findFirst({
      where: eq(translationSuggestions.id, suggestionId),
    });

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    // Create new version from suggestion
    const newVersion = await this.createVersion(
      suggestion.keyId,
      suggestion.targetLocaleId,
      suggestion.suggestedText,
      reviewerId
    );

    // Update version to reference promoted suggestion
    await db
      .update(translationVersions)
      .set({ promotedSuggestionId: suggestionId, status: 'approved', isCurrentVersion: true })
      .where(eq(translationVersions.id, newVersion.id));

    // Update suggestion status
    await db
      .update(translationSuggestions)
      .set({ status: 'promoted', promotedToVersionId: newVersion.id, reviewerId, reviewedAt: new Date() })
      .where(eq(translationSuggestions.id, suggestionId));

    // Log audit trail
    await db.insert(translationAuditLog).values({
      action: 'suggestion_promoted',
      actorId: reviewerId,
      suggestionId,
      versionId: newVersion.id,
      details: { keyId: suggestion.keyId, targetLocaleId: suggestion.targetLocaleId },
    });

    return newVersion;
  }

  /**
   * Calculate quality score for a version
   */
  async calculateQualityScore(versionId: string): Promise<number> {
    const version = await db.query.translationVersions.findFirst({
      where: eq(translationVersions.id, versionId),
      with: { promotedSuggestion: { with: { votes: true } } },
    });

    if (!version) {
      return 0;
    }

    let score = 0.5; // Base score

    // Factor in reviewer approval
    if (version.status === 'approved') {
      score += 0.3;
    }

    // Factor in community votes if promoted from suggestion
    if (version.promotedSuggestion && version.promotedSuggestion.votes.length > 0) {
      const votes = version.promotedSuggestion.votes;
      const upvoteRatio = votes.filter((v) => v.voteValue > 0).length / votes.length;
      score += upvoteRatio * 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * Create an assignment
   */
  async createAssignment(keyId: string, targetLocaleId: string, userId: string, role: 'translator' | 'reviewer', assignedBy: string) {
    const [assignment] = await db
      .insert(translationAssignments)
      .values({
        keyId,
        targetLocaleId,
        userId,
        role,
        assignedBy,
        status: 'active',
      })
      .returning();

    // Log audit trail
    await db.insert(translationAuditLog).values({
      action: 'assignment_created',
      actorId: assignedBy,
      details: { keyId, targetLocaleId, userId, role },
    });

    return assignment;
  }

  /**
   * Get assignments for a user
   */
  async getAssignments(userId: string) {
    const assignments = await db.query.translationAssignments.findMany({
      where: and(eq(translationAssignments.userId, userId), eq(translationAssignments.status, 'active')),
      with: {
        key: true,
        targetLocale: true,
        assignedBy: true,
      },
    });

    return assignments;
  }

  /**
   * Get suggestions for a translation key
   */
  async getSuggestions(keyId: string, targetLocaleId?: string) {
    const suggestions = await db.query.translationSuggestions.findMany({
      where: targetLocaleId
        ? and(eq(translationSuggestions.keyId, keyId), eq(translationSuggestions.targetLocaleId, targetLocaleId))
        : eq(translationSuggestions.keyId, keyId),
      with: {
        suggestedBy: true,
        reviewer: true,
        votes: true,
      },
      orderBy: [desc(translationSuggestions.upvotes)],
    });

    return suggestions;
  }

  /**
   * Export approved translations to i18next JSON format
   */
  async exportTranslations(targetLocaleId: string, namespaces?: string[]) {
    // Get all approved translations
    const query = db.query.translationVersions.findMany({
      where: and(
        eq(translationVersions.targetLocaleId, targetLocaleId),
        eq(translationVersions.isCurrentVersion, true),
        eq(translationVersions.status, 'approved')
      ),
      with: { key: true },
    });

    const versions = await query;

    // Group by namespace
    const result: Record<string, Record<string, string>> = {};

    for (const version of versions) {
      const namespace = version.key.namespace;

      // Filter by namespaces if provided
      if (namespaces && !namespaces.includes(namespace)) {
        continue;
      }

      if (!result[namespace]) {
        result[namespace] = {};
      }

      result[namespace][version.key.key] = version.translatedText;
    }

    return result;
  }
}

export const translationService = new TranslationService();
