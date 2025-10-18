import { db } from "../db";
import { eq, and, desc, sql, gte, lte, count, avg } from "drizzle-orm";
import {
  feedbackMetricsDaily,
  feedbackEntries,
  feedbackFeatures,
  type InsertFeedbackMetricsDaily,
} from "@shared/schema";

export const feedbackMetricsService = {
  async aggregateDaily(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all feature/type combinations for the day
    const combinations = await db
      .select({
        featureId: feedbackEntries.featureId,
        type: feedbackEntries.type,
      })
      .from(feedbackEntries)
      .where(and(gte(feedbackEntries.createdAt, startOfDay), lte(feedbackEntries.createdAt, endOfDay)))
      .groupBy(feedbackEntries.featureId, feedbackEntries.type);

    const metrics = [];

    for (const combo of combinations) {
      // Count submissions for this feature/type
      const submissions = await db
        .select({ count: count() })
        .from(feedbackEntries)
        .where(
          and(
            gte(feedbackEntries.createdAt, startOfDay),
            lte(feedbackEntries.createdAt, endOfDay),
            eq(feedbackEntries.featureId, combo.featureId || ""),
            eq(feedbackEntries.type, combo.type || "")
          )
        );

      // Count resolutions for this feature/type
      const resolutions = await db
        .select({ count: count() })
        .from(feedbackEntries)
        .where(
          and(
            gte(feedbackEntries.resolvedAt || new Date(0), startOfDay),
            lte(feedbackEntries.resolvedAt || new Date(0), endOfDay),
            eq(feedbackEntries.featureId, combo.featureId || ""),
            eq(feedbackEntries.type, combo.type || ""),
            sql`${feedbackEntries.resolvedAt} IS NOT NULL`
          )
        );

      // Calculate average resolution time for resolved entries
      const resolutionTimes = await db
        .select({
          avgHours: avg(sql<number>`EXTRACT(EPOCH FROM (${feedbackEntries.resolvedAt} - ${feedbackEntries.createdAt})) / 3600`),
        })
        .from(feedbackEntries)
        .where(
          and(
            gte(feedbackEntries.resolvedAt || new Date(0), startOfDay),
            lte(feedbackEntries.resolvedAt || new Date(0), endOfDay),
            eq(feedbackEntries.featureId, combo.featureId || ""),
            eq(feedbackEntries.type, combo.type || ""),
            sql`${feedbackEntries.resolvedAt} IS NOT NULL`
          )
        );

      // Calculate trend score (simple formula based on submission volume and resolution rate)
      const submissionCount = Number(submissions[0]?.count || 0);
      const resolvedCount = Number(resolutions[0]?.count || 0);
      const resolutionRate = submissionCount > 0 ? resolvedCount / submissionCount : 0;
      const trendScore = submissionCount * (1 - resolutionRate * 0.5); // Higher score = more trending (unresolved issues)

      const metric: InsertFeedbackMetricsDaily = {
        date: date.toISOString().split('T')[0],
        featureId: combo.featureId,
        type: combo.type,
        submissionCount,
        resolvedCount,
        avgResolutionTimeHours: Number(resolutionTimes[0]?.avgHours || 0),
        trendScore,
      };

      // Upsert metric (delete existing and insert new)
      await db
        .delete(feedbackMetricsDaily)
        .where(
          and(
            eq(feedbackMetricsDaily.date, metric.date),
            eq(feedbackMetricsDaily.featureId, metric.featureId || ""),
            eq(feedbackMetricsDaily.type, metric.type || "")
          )
        );

      const [inserted] = await db.insert(feedbackMetricsDaily).values(metric).returning();
      metrics.push(inserted);
    }

    return metrics;
  },

  async getCurrentMetrics(filters?: {
    featureId?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [];
    if (filters?.featureId) conditions.push(eq(feedbackEntries.featureId, filters.featureId));
    if (filters?.startDate) conditions.push(gte(feedbackEntries.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(feedbackEntries.createdAt, filters.endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Submission count by status
    const statusCounts = await db
      .select({
        status: feedbackEntries.status,
        count: count(),
      })
      .from(feedbackEntries)
      .where(whereClause)
      .groupBy(feedbackEntries.status);

    // Resolution metrics
    const resolutionData = await db
      .select({
        avgHours: avg(sql<number>`EXTRACT(EPOCH FROM (${feedbackEntries.resolvedAt} - ${feedbackEntries.createdAt})) / 3600`),
      })
      .from(feedbackEntries)
      .where(and(whereClause, sql`${feedbackEntries.resolvedAt} IS NOT NULL`));

    // Sentiment distribution
    const sentimentCounts = await db
      .select({
        sentiment: feedbackEntries.sentiment,
        count: count(),
      })
      .from(feedbackEntries)
      .where(whereClause)
      .groupBy(feedbackEntries.sentiment);

    // Top features
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

    // Backlog count (submitted + under_review + in_progress)
    const backlogStatuses = ["submitted", "under_review", "in_progress"];
    const backlogCount = statusCounts
      .filter(s => backlogStatuses.includes(s.status || ""))
      .reduce((sum, s) => sum + Number(s.count), 0);

    const totalSubmissions = statusCounts.reduce((sum, s) => sum + Number(s.count), 0);
    const resolvedCount = statusCounts.find(s => s.status === "resolved")?.count || 0;

    return {
      totalSubmissions,
      resolvedCount: Number(resolvedCount),
      backlogCount,
      resolutionRate: totalSubmissions > 0 ? Number(resolvedCount) / totalSubmissions : 0,
      avgResolutionTimeHours: Number(resolutionData[0]?.avgHours || 0),
      statusDistribution: statusCounts.map(s => ({
        status: s.status || "unknown",
        count: Number(s.count),
      })),
      sentimentDistribution: sentimentCounts.map(s => ({
        sentiment: s.sentiment || "neutral",
        count: Number(s.count),
      })),
      topFeatures: topFeatures.map(f => ({
        featureId: f.featureId || "",
        featureName: f.featureName || "Unknown",
        count: Number(f.count),
      })),
    };
  },

  async getHistoricalMetrics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const metrics = await db
      .select({
        date: feedbackMetricsDaily.date,
        featureId: feedbackMetricsDaily.featureId,
        featureName: feedbackFeatures.name,
        type: feedbackMetricsDaily.type,
        submissionCount: feedbackMetricsDaily.submissionCount,
        resolvedCount: feedbackMetricsDaily.resolvedCount,
        avgResolutionTimeHours: feedbackMetricsDaily.avgResolutionTimeHours,
        trendScore: feedbackMetricsDaily.trendScore,
      })
      .from(feedbackMetricsDaily)
      .leftJoin(feedbackFeatures, eq(feedbackMetricsDaily.featureId, feedbackFeatures.id))
      .where(gte(feedbackMetricsDaily.date, startDate.toISOString().split('T')[0]))
      .orderBy(feedbackMetricsDaily.date);

    return metrics;
  },
};
