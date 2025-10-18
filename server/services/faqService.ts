import { db } from "../db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  faqCandidates,
  faqArticles,
  faqReviews,
  feedbackEntries,
  type InsertFaqCandidate,
  type InsertFaqArticle,
  type InsertFaqReview,
} from "@shared/schema";
import { GoogleGenAI } from "@google/genai";

async function clusterSimilarFeedback(): Promise<Array<{ question: string; answerDraft: string; sourceEntryIds: string[]; confidenceScore: number }>> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured for FAQ generation");
  }

  // Get recent feedback entries for clustering
  const recentFeedback = await db
    .select({
      id: feedbackEntries.id,
      title: feedbackEntries.title,
      description: feedbackEntries.description,
      type: feedbackEntries.type,
    })
    .from(feedbackEntries)
    .where(sql`${feedbackEntries.createdAt} >= NOW() - INTERVAL '30 days'`)
    .orderBy(desc(feedbackEntries.createdAt))
    .limit(100);

  if (recentFeedback.length < 3) {
    return []; // Not enough data to cluster
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Prepare feedback for clustering
  const feedbackText = recentFeedback
    .map((f, i) => `${i + 1}. [${f.id}] ${f.title}: ${f.description.substring(0, 200)}`)
    .join("\n\n");

  const clusteringPrompt = `Analyze the following user feedback and identify frequently asked questions or common issues. Group similar feedback items together and generate FAQ candidates.

For each cluster of similar feedback:
1. Generate a clear, canonical question
2. Provide a concise, actionable answer
3. List the IDs of source feedback entries (in brackets [])
4. Assign a confidence score (0-1) based on how similar the entries are

Return the result as a JSON array with this structure:
[
  {
    "question": "Clear question here",
    "answerDraft": "Helpful answer here",
    "sourceEntryIds": ["id1", "id2", "id3"],
    "confidenceScore": 0.85
  }
]

Only include clusters with at least 2 similar entries and a confidence score of 0.7 or higher.

Feedback:
${feedbackText}

JSON Response:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: clusteringPrompt }] }],
    });

    const text = response.text || "";
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("No JSON found in clustering response");
      return [];
    }

    const clusters = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    return Array.isArray(clusters) ? clusters : [];
  } catch (error) {
    console.error("FAQ clustering failed:", error);
    return [];
  }
}

export const faqService = {
  async detectCandidates() {
    const clusters = await clusterSimilarFeedback();
    
    const candidates = [];
    for (const cluster of clusters) {
      const [candidate] = await db
        .insert(faqCandidates)
        .values({
          question: cluster.question,
          answerDraft: cluster.answerDraft,
          sourceEntryIds: cluster.sourceEntryIds,
          occurrenceCount: cluster.sourceEntryIds.length,
          confidenceScore: cluster.confidenceScore,
          status: "pending",
        })
        .returning();
      
      candidates.push(candidate);
    }

    return candidates;
  },

  async getCandidates(filters?: { status?: string; minConfidence?: number }) {
    let query = db.select().from(faqCandidates).$dynamic();

    if (filters?.status) {
      query = query.where(eq(faqCandidates.status, filters.status));
    }
    if (filters?.minConfidence) {
      query = query.where(sql`${faqCandidates.confidenceScore} >= ${filters.minConfidence}`);
    }

    return await query.orderBy(desc(faqCandidates.occurrenceCount), desc(faqCandidates.confidenceScore));
  },

  async approveCandidate(candidateId: string, reviewerId: string, edits?: { question?: string; answer?: string; category?: string; tags?: string[] }) {
    const [candidate] = await db
      .select()
      .from(faqCandidates)
      .where(eq(faqCandidates.id, candidateId));

    if (!candidate) {
      throw new Error("FAQ candidate not found");
    }

    // Create FAQ article
    const [article] = await db
      .insert(faqArticles)
      .values({
        candidateId,
        question: edits?.question || candidate.question,
        answer: edits?.answer || candidate.answerDraft || "",
        category: edits?.category || "general",
        tags: edits?.tags || [],
        isPublished: false, // Approved but not published yet
      })
      .returning();

    // Update candidate status
    await db
      .update(faqCandidates)
      .set({
        status: "approved",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(faqCandidates.id, candidateId));

    // Record review
    await db.insert(faqReviews).values({
      candidateId,
      articleId: article.id,
      reviewerId,
      action: "approved",
    });

    return article;
  },

  async rejectCandidate(candidateId: string, reviewerId: string, reason?: string) {
    await db
      .update(faqCandidates)
      .set({
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewerNotes: reason,
      })
      .where(eq(faqCandidates.id, candidateId));

    // Record review
    await db.insert(faqReviews).values({
      candidateId,
      articleId: null,
      reviewerId,
      action: "rejected",
      reviewerNotes: reason,
    });

    return true;
  },

  async editDraft(candidateId: string, question: string, answerDraft: string) {
    const [updated] = await db
      .update(faqCandidates)
      .set({ question, answerDraft, updatedAt: new Date() })
      .where(eq(faqCandidates.id, candidateId))
      .returning();

    return updated;
  },

  async getArticles(filters?: { category?: string; isPublished?: boolean; search?: string }) {
    let query = db.select().from(faqArticles).$dynamic();

    if (filters?.category) {
      query = query.where(eq(faqArticles.category, filters.category));
    }
    if (filters?.isPublished !== undefined) {
      query = query.where(eq(faqArticles.isPublished, filters.isPublished));
    }
    if (filters?.search) {
      query = query.where(
        sql`${faqArticles.question} ILIKE ${"%" + filters.search + "%"} OR ${faqArticles.answer} ILIKE ${"%" + filters.search + "%"}`
      );
    }

    return await query.orderBy(desc(faqArticles.viewCount), desc(faqArticles.createdAt));
  },

  async getArticleById(id: string) {
    const [article] = await db.select().from(faqArticles).where(eq(faqArticles.id, id));
    
    if (!article) return null;

    // Increment view count
    await db
      .update(faqArticles)
      .set({ viewCount: sql`${faqArticles.viewCount} + 1` })
      .where(eq(faqArticles.id, id));

    return article;
  },

  async publishArticle(articleId: string, publishedBy: string) {
    const [updated] = await db
      .update(faqArticles)
      .set({
        isPublished: true,
        publishedBy,
        publishedAt: new Date(),
      })
      .where(eq(faqArticles.id, articleId))
      .returning();

    return updated;
  },

  async unpublishArticle(articleId: string) {
    const [updated] = await db
      .update(faqArticles)
      .set({
        isPublished: false,
        publishedAt: null,
      })
      .where(eq(faqArticles.id, articleId))
      .returning();

    return updated;
  },

  async recordHelpfulness(articleId: string, isHelpful: boolean) {
    if (isHelpful) {
      await db
        .update(faqArticles)
        .set({ helpfulCount: sql`${faqArticles.helpfulCount} + 1` })
        .where(eq(faqArticles.id, articleId));
    } else {
      await db
        .update(faqArticles)
        .set({ notHelpfulCount: sql`${faqArticles.notHelpfulCount} + 1` })
        .where(eq(faqArticles.id, articleId));
    }

    return true;
  },

  async updateArticle(articleId: string, data: { question?: string; answer?: string; category?: string; tags?: string[] }) {
    const [updated] = await db
      .update(faqArticles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(faqArticles.id, articleId))
      .returning();

    return updated;
  },
};
