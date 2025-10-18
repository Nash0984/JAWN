import { db } from "../db";
import { eq, and, desc, sql, inArray, gte, count, avg, isNull, or } from "drizzle-orm";
import {
  feedbackEntries,
  feedbackVotes,
  feedbackComments,
  feedbackStatusHistory,
  feedbackAssignments,
  feedbackAttachments,
  feedbackFeatures,
  users,
  type InsertFeedbackEntry,
  type InsertFeedbackVote,
  type InsertFeedbackComment,
  type InsertFeedbackStatusHistory,
  type InsertFeedbackAssignment,
} from "@shared/schema";
import { GoogleGenAI } from "@google/genai";

// Simple async queue for sentiment analysis to avoid blocking requests
const sentimentQueue: Array<{ entryId: string; description: string }> = [];
let processingQueue = false;

async function analyzeSentiment(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key not configured for sentiment analysis");
    return "neutral";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analyze the sentiment of the following feedback text and classify it as either "positive", "negative", or "neutral". Return only one word as the classification.

Feedback: ${text}

Sentiment:`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    const result = (response.text || "neutral").trim().toLowerCase();
    if (["positive", "negative", "neutral"].includes(result)) {
      return result;
    }
    return "neutral";
  } catch (error) {
    console.error("Sentiment analysis failed:", error);
    return "neutral";
  }
}

async function processSentimentQueue() {
  if (processingQueue || sentimentQueue.length === 0) return;
  
  processingQueue = true;
  
  while (sentimentQueue.length > 0) {
    const item = sentimentQueue.shift();
    if (!item) continue;
    
    const sentiment = await analyzeSentiment(item.description);
    
    await db
      .update(feedbackEntries)
      .set({ sentiment })
      .where(eq(feedbackEntries.id, item.entryId));
  }
  
  processingQueue = false;
}

export const feedbackService = {
  async createEntry(data: InsertFeedbackEntry) {
    const [entry] = await db.insert(feedbackEntries).values({
      ...data,
      sentiment: "neutral", // Set initial sentiment, will be updated async
    }).returning();

    // Create initial status history
    await db.insert(feedbackStatusHistory).values({
      entryId: entry.id,
      fromStatus: null,
      toStatus: "submitted",
      changedBy: data.userId || null,
      notes: "Feedback submitted",
    });

    // Queue sentiment analysis (async, non-blocking)
    sentimentQueue.push({ entryId: entry.id, description: data.description });
    processSentimentQueue().catch(console.error);

    return entry;
  },

  async getEntries(filters: {
    featureId?: string;
    status?: string;
    type?: string;
    assignedTo?: string;
    tenantId?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db
      .select({
        id: feedbackEntries.id,
        featureId: feedbackEntries.featureId,
        userId: feedbackEntries.userId,
        tenantId: feedbackEntries.tenantId,
        type: feedbackEntries.type,
        title: feedbackEntries.title,
        description: feedbackEntries.description,
        sentiment: feedbackEntries.sentiment,
        priority: feedbackEntries.priority,
        status: feedbackEntries.status,
        upvotes: feedbackEntries.upvotes,
        downvotes: feedbackEntries.downvotes,
        viewCount: feedbackEntries.viewCount,
        commentCount: feedbackEntries.commentCount,
        createdAt: feedbackEntries.createdAt,
        updatedAt: feedbackEntries.updatedAt,
        featureName: feedbackFeatures.name,
        featureCode: feedbackFeatures.code,
      })
      .from(feedbackEntries)
      .leftJoin(feedbackFeatures, eq(feedbackEntries.featureId, feedbackFeatures.id))
      .$dynamic();

    if (filters.featureId) {
      query = query.where(eq(feedbackEntries.featureId, filters.featureId));
    }
    if (filters.status) {
      query = query.where(eq(feedbackEntries.status, filters.status));
    }
    if (filters.type) {
      query = query.where(eq(feedbackEntries.type, filters.type));
    }
    if (filters.tenantId) {
      query = query.where(eq(feedbackEntries.tenantId, filters.tenantId));
    }
    if (filters.assignedTo) {
      const assignedEntryIds = await db
        .select({ entryId: feedbackAssignments.entryId })
        .from(feedbackAssignments)
        .where(
          and(
            eq(feedbackAssignments.assignedTo, filters.assignedTo),
            eq(feedbackAssignments.status, "active")
          )
        );
      
      const ids = assignedEntryIds.map(a => a.entryId);
      if (ids.length > 0) {
        query = query.where(inArray(feedbackEntries.id, ids));
      } else {
        // No entries assigned to this user
        return [];
      }
    }

    query = query
      .orderBy(desc(feedbackEntries.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return await query;
  },

  async getEntryById(id: string, tenantId?: string) {
    const conditions = tenantId
      ? and(eq(feedbackEntries.id, id), eq(feedbackEntries.tenantId, tenantId))
      : eq(feedbackEntries.id, id);

    const [entry] = await db
      .select()
      .from(feedbackEntries)
      .where(conditions)
      .leftJoin(feedbackFeatures, eq(feedbackEntries.featureId, feedbackFeatures.id))
      .leftJoin(users, eq(feedbackEntries.userId, users.id));

    if (!entry) return null;

    // Increment view count
    await db
      .update(feedbackEntries)
      .set({ viewCount: sql`${feedbackEntries.viewCount} + 1` })
      .where(eq(feedbackEntries.id, id));

    // Get votes, comments, assignments, history, attachments
    const [votes, comments, assignments, history, attachments] = await Promise.all([
      db.select().from(feedbackVotes).where(eq(feedbackVotes.entryId, id)),
      db
        .select({
          id: feedbackComments.id,
          entryId: feedbackComments.entryId,
          parentId: feedbackComments.parentId,
          userId: feedbackComments.userId,
          commentText: feedbackComments.commentText,
          isStaffResponse: feedbackComments.isStaffResponse,
          upvotes: feedbackComments.upvotes,
          createdAt: feedbackComments.createdAt,
          updatedAt: feedbackComments.updatedAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(feedbackComments)
        .leftJoin(users, eq(feedbackComments.userId, users.id))
        .where(eq(feedbackComments.entryId, id))
        .orderBy(feedbackComments.createdAt),
      db
        .select({
          id: feedbackAssignments.id,
          assignedTo: feedbackAssignments.assignedTo,
          assignedBy: feedbackAssignments.assignedBy,
          status: feedbackAssignments.status,
          notes: feedbackAssignments.notes,
          createdAt: feedbackAssignments.createdAt,
          assignedToName: users.fullName,
        })
        .from(feedbackAssignments)
        .leftJoin(users, eq(feedbackAssignments.assignedTo, users.id))
        .where(eq(feedbackAssignments.entryId, id)),
      db.select().from(feedbackStatusHistory).where(eq(feedbackStatusHistory.entryId, id)).orderBy(feedbackStatusHistory.createdAt),
      db.select().from(feedbackAttachments).where(eq(feedbackAttachments.entryId, id)),
    ]);

    return {
      ...entry.feedback_entries,
      feature: entry.feedback_features,
      submitter: entry.users ? {
        id: entry.users.id,
        fullName: entry.users.fullName,
        role: entry.users.role,
      } : null,
      votes,
      comments,
      assignments,
      history,
      attachments,
    };
  },

  async voteOnEntry(entryId: string, userId: string | null, voteValue: number, voterRole: string, anonymousSessionHash?: string) {
    // Vote weight calculation: residents 1x, staff/admin 2x
    const weight = ["navigator", "caseworker", "admin", "super_admin"].includes(voterRole) ? 2 : 1;

    // Check for existing vote
    let existingVote;
    if (userId) {
      [existingVote] = await db
        .select()
        .from(feedbackVotes)
        .where(and(eq(feedbackVotes.entryId, entryId), eq(feedbackVotes.voterId, userId)));
    } else if (anonymousSessionHash) {
      [existingVote] = await db
        .select()
        .from(feedbackVotes)
        .where(and(eq(feedbackVotes.entryId, entryId), eq(feedbackVotes.anonymousSessionHash, anonymousSessionHash)));
    }

    if (existingVote) {
      // Update existing vote
      const oldWeight = ["navigator", "caseworker", "admin", "super_admin"].includes(existingVote.voterRole || "client") ? 2 : 1;
      const oldValue = existingVote.voteValue;
      
      await db
        .update(feedbackVotes)
        .set({ voteValue, voterRole })
        .where(eq(feedbackVotes.id, existingVote.id));

      // Update entry counters
      const upvoteDelta = (voteValue > 0 ? weight : 0) - (oldValue > 0 ? oldWeight : 0);
      const downvoteDelta = (voteValue < 0 ? weight : 0) - (oldValue < 0 ? oldWeight : 0);

      await db
        .update(feedbackEntries)
        .set({
          upvotes: sql`${feedbackEntries.upvotes} + ${upvoteDelta}`,
          downvotes: sql`${feedbackEntries.downvotes} + ${downvoteDelta}`,
        })
        .where(eq(feedbackEntries.id, entryId));
    } else {
      // Create new vote
      await db.insert(feedbackVotes).values({
        entryId,
        voterId: userId,
        anonymousSessionHash: anonymousSessionHash || null,
        voteValue,
        voterRole,
      });

      // Update entry counters
      await db
        .update(feedbackEntries)
        .set({
          upvotes: voteValue > 0 ? sql`${feedbackEntries.upvotes} + ${weight}` : feedbackEntries.upvotes,
          downvotes: voteValue < 0 ? sql`${feedbackEntries.downvotes} + ${weight}` : feedbackEntries.downvotes,
        })
        .where(eq(feedbackEntries.id, entryId));
    }

    return true;
  },

  async addComment(entryId: string, userId: string | null, commentText: string, isStaffResponse: boolean, parentId?: string) {
    const [comment] = await db.insert(feedbackComments).values({
      entryId,
      parentId: parentId || null,
      userId,
      commentText,
      isStaffResponse,
    }).returning();

    // Update comment count
    await db
      .update(feedbackEntries)
      .set({ commentCount: sql`${feedbackEntries.commentCount} + 1` })
      .where(eq(feedbackEntries.id, entryId));

    return comment;
  },

  async updateStatus(entryId: string, fromStatus: string, toStatus: string, changedBy: string, notes?: string) {
    await db
      .update(feedbackEntries)
      .set({ 
        status: toStatus,
        resolvedAt: toStatus === "resolved" ? new Date() : null,
        resolvedBy: toStatus === "resolved" ? changedBy : null,
      })
      .where(eq(feedbackEntries.id, entryId));

    await db.insert(feedbackStatusHistory).values({
      entryId,
      fromStatus,
      toStatus,
      changedBy,
      notes,
    });

    return true;
  },

  async assignToStaff(entryId: string, assignedTo: string, assignedBy: string, notes?: string) {
    // Deactivate previous assignments
    await db
      .update(feedbackAssignments)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(eq(feedbackAssignments.entryId, entryId), eq(feedbackAssignments.status, "active")));

    // Create new assignment
    const [assignment] = await db.insert(feedbackAssignments).values({
      entryId,
      assignedTo,
      assignedBy,
      status: "active",
      notes,
    }).returning();

    return assignment;
  },

  async getTrending(limit: number = 10, filters?: { featureId?: string; type?: string; tenantId?: string }) {
    const daysSinceCreation = sql<number>`EXTRACT(EPOCH FROM (NOW() - ${feedbackEntries.createdAt})) / 86400`;
    const recencyScore = sql<number>`EXP(-0.1 * ${daysSinceCreation})`;
    const voteScore = sql<number>`${feedbackEntries.upvotes} - ${feedbackEntries.downvotes}`;
    const trendScore = sql<number>`(1.0 * 0.4) + (${voteScore} * 0.3) + (${recencyScore} * 0.3)`;

    let query = db
      .select({
        id: feedbackEntries.id,
        featureId: feedbackEntries.featureId,
        type: feedbackEntries.type,
        title: feedbackEntries.title,
        description: feedbackEntries.description,
        status: feedbackEntries.status,
        priority: feedbackEntries.priority,
        upvotes: feedbackEntries.upvotes,
        downvotes: feedbackEntries.downvotes,
        commentCount: feedbackEntries.commentCount,
        viewCount: feedbackEntries.viewCount,
        createdAt: feedbackEntries.createdAt,
        featureName: feedbackFeatures.name,
        trendScore,
      })
      .from(feedbackEntries)
      .leftJoin(feedbackFeatures, eq(feedbackEntries.featureId, feedbackFeatures.id))
      .$dynamic();

    if (filters?.featureId) {
      query = query.where(eq(feedbackEntries.featureId, filters.featureId));
    }
    if (filters?.type) {
      query = query.where(eq(feedbackEntries.type, filters.type));
    }
    if (filters?.tenantId) {
      query = query.where(eq(feedbackEntries.tenantId, filters.tenantId));
    }

    return await query
      .orderBy(desc(trendScore))
      .limit(limit);
  },

  async getMetrics(filters?: { featureId?: string; tenantId?: string; startDate?: Date; endDate?: Date }) {
    const conditions = [];
    if (filters?.featureId) conditions.push(eq(feedbackEntries.featureId, filters.featureId));
    if (filters?.tenantId) conditions.push(eq(feedbackEntries.tenantId, filters.tenantId));
    if (filters?.startDate) conditions.push(gte(feedbackEntries.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(sql`${feedbackEntries.createdAt} <= ${filters.endDate}`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get submission counts by status
    const statusCounts = await db
      .select({
        status: feedbackEntries.status,
        count: count(),
      })
      .from(feedbackEntries)
      .where(whereClause)
      .groupBy(feedbackEntries.status);

    // Get sentiment distribution
    const sentimentCounts = await db
      .select({
        sentiment: feedbackEntries.sentiment,
        count: count(),
      })
      .from(feedbackEntries)
      .where(whereClause)
      .groupBy(feedbackEntries.sentiment);

    // Get average resolution time
    const resolutionTimes = await db
      .select({
        avgHours: avg(sql<number>`EXTRACT(EPOCH FROM (${feedbackEntries.resolvedAt} - ${feedbackEntries.createdAt})) / 3600`),
      })
      .from(feedbackEntries)
      .where(and(whereClause, sql`${feedbackEntries.resolvedAt} IS NOT NULL`));

    // Get top features by volume
    const topFeatures = await db
      .select({
        featureId: feedbackEntries.featureId,
        featureName: feedbackFeatures.name,
        count: count(),
      })
      .from(feedbackEntries)
      .leftJoin(feedbackFeatures, eq(feedbackEntries.featureId, feedbackFeatures.id))
      .where(whereClause)
      .groupBy(feedbackEntries.featureId, feedbackFeatures.name)
      .orderBy(desc(count()))
      .limit(10);

    // Calculate totals
    const totalSubmissions = statusCounts.reduce((sum, s) => sum + Number(s.count), 0);
    const resolvedCount = statusCounts.find(s => s.status === "resolved")?.count || 0;
    const backlogCount = statusCounts
      .filter(s => ["submitted", "under_review", "in_progress"].includes(s.status || ""))
      .reduce((sum, s) => sum + Number(s.count), 0);

    return {
      totalSubmissions,
      resolvedCount,
      backlogCount,
      resolutionRate: totalSubmissions > 0 ? Number(resolvedCount) / totalSubmissions : 0,
      avgResolutionTimeHours: Number(resolutionTimes[0]?.avgHours || 0),
      statusDistribution: statusCounts.map(s => ({ status: s.status || "unknown", count: Number(s.count) })),
      sentimentDistribution: sentimentCounts.map(s => ({ sentiment: s.sentiment || "neutral", count: Number(s.count) })),
      topFeatures: topFeatures.map(f => ({ featureId: f.featureId || "", featureName: f.featureName || "Unknown", count: Number(f.count) })),
    };
  },
};
