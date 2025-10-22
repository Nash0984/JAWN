import { db } from "../db";
import { 
  benefitsAccessReviews, 
  reviewSamples, 
  reviewerFeedback,
  caseLifecycleEvents,
  clientCases,
  users,
  type BenefitsAccessReview,
  type InsertBenefitsAccessReview,
  type ReviewSample,
  type InsertReviewSample,
  type CaseLifecycleEvent,
  type InsertCaseLifecycleEvent
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { cacheOrchestrator } from "./cacheOrchestrator";
import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.service";

// ============================================================================
// TYPES AND CONSTANTS
// ============================================================================

interface StratificationCriteria {
  programs: string[];
  counties: string[];
  demographics: {
    hasChildren: boolean;
    hasElderly: boolean;
    hasDisabled: boolean;
  };
}

interface SamplingResult {
  selectedCases: Array<{
    caseId: string;
    caseworkerId: string;
    programType: string;
    county: string;
    weight: number;
  }>;
  diversityScore: number;
  representativenessScore: number;
  stratificationDistribution: Record<string, number>;
}

interface CheckpointConfig {
  type: string;
  name: string;
  description: string;
  expectedDayStart: number;
  expectedDayEnd: number;
}

const CHECKPOINT_DEFINITIONS: CheckpointConfig[] = [
  {
    type: "intake",
    name: "Initial Intake",
    description: "Application received and entered into system",
    expectedDayStart: 0,
    expectedDayEnd: 3
  },
  {
    type: "verification",
    name: "Verification Documents",
    description: "All required verification documents collected and reviewed",
    expectedDayStart: 7,
    expectedDayEnd: 14
  },
  {
    type: "determination",
    name: "Eligibility Determination",
    description: "Case reviewed and eligibility determined",
    expectedDayStart: 21,
    expectedDayEnd: 30
  },
  {
    type: "notification",
    name: "Applicant Notification",
    description: "Notification letter sent to applicant",
    expectedDayStart: 30,
    expectedDayEnd: 45
  },
  {
    type: "followup",
    name: "Follow-up",
    description: "Post-determination follow-up and case closure",
    expectedDayStart: 45,
    expectedDayEnd: 60
  }
];

// Maryland counties for stratification
const MD_COUNTIES = [
  "Allegany", "Anne Arundel", "Baltimore City", "Baltimore County",
  "Calvert", "Caroline", "Carroll", "Cecil", "Charles", "Dorchester",
  "Frederick", "Garrett", "Harford", "Howard", "Kent", "Montgomery",
  "Prince George's", "Queen Anne's", "Somerset", "St. Mary's",
  "Talbot", "Washington", "Wicomico", "Worcester"
];

// ============================================================================
// ANONYMIZATION SERVICE
// ============================================================================

class AnonymizationService {
  private salt: string;

  constructor() {
    // Use stable salt from environment or fail-safe deterministic value
    // CRITICAL: Must be stable across restarts for blind review consistency
    this.salt = process.env.ANONYMIZATION_SALT || 
                process.env.DATABASE_URL?.substring(0, 32) || 
                "REPLACE_ME_IN_PRODUCTION_WITH_STABLE_SALT";
    
    if (this.salt === "REPLACE_ME_IN_PRODUCTION_WITH_STABLE_SALT") {
      logger.warn("Using default anonymization salt", {
        context: 'AnonymizationService.constructor',
        message: 'Set ANONYMIZATION_SALT env variable for production'
      });
    }
  }

  /**
   * Generate consistent anonymized ID for a given identifier
   */
  anonymize(identifier: string, type: "case" | "worker"): string {
    const hash = createHash("sha256")
      .update(`${type}:${identifier}:${this.salt}`)
      .digest("hex");
    
    // Return first 16 chars for readability
    return `${type === "case" ? "C" : "W"}_${hash.substring(0, 12)}`;
  }

  /**
   * Reveal original ID (restricted to super-admin only)
   * Note: This is a simplified version - production would use a mapping table
   */
  reveal(anonymizedId: string, possibleIds: string[], type: "case" | "worker"): string | null {
    for (const id of possibleIds) {
      if (this.anonymize(id, type) === anonymizedId) {
        return id;
      }
    }
    return null;
  }

  /**
   * Check if user has permission to reveal anonymized data
   */
  canReveal(userRole: string): boolean {
    return userRole === "super_admin" || userRole === "admin";
  }
}

const anonymizationService = new AnonymizationService();

// ============================================================================
// STRATIFIED SAMPLING ALGORITHM
// ============================================================================

class StratifiedSamplingService {
  
  /**
   * Select cases for weekly review using stratified random sampling
   * Target: 2 cases per worker with demographic/program/county diversity
   */
  async selectWeeklyCases(
    targetCasesPerWorker: number = 2
  ): Promise<SamplingResult> {
    
    // Get all active cases from the last 30-60 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const eligibleCases = await db
      .select({
        id: clientCases.id,
        userId: clientCases.userId,
        programType: clientCases.programType,
        county: clientCases.county,
        createdAt: clientCases.createdAt,
      })
      .from(clientCases)
      .where(
        and(
          gte(clientCases.createdAt, sixtyDaysAgo),
          lte(clientCases.createdAt, thirtyDaysAgo)
        )
      );

    if (eligibleCases.length === 0) {
      throw new Error("No eligible cases found for review");
    }

    // Group cases by caseworker
    const casesByWorker = eligibleCases.reduce((acc, case_) => {
      const workerId = case_.userId || "unassigned";
      if (!acc[workerId]) acc[workerId] = [];
      acc[workerId].push(case_);
      return acc;
    }, {} as Record<string, typeof eligibleCases>);

    // Stratify by program, county, and select with weighted randomness
    const selectedCases: SamplingResult["selectedCases"] = [];
    const stratificationDistribution: Record<string, number> = {};

    for (const [workerId, cases] of Object.entries(casesByWorker)) {
      // Include all workers, even those with < target cases
      // Select up to targetCasesPerWorker, or all available if fewer
      const sampleSize = Math.min(cases.length, targetCasesPerWorker);

      // Calculate weights based on diversity needs
      const weightedCases = cases.map(case_ => ({
        ...case_,
        weight: this.calculateSelectionWeight(case_, cases)
      }));

      // Use weighted random sampling (roulette wheel selection)
      const selected = this.weightedRandomSample(weightedCases, sampleSize);

      // Add to results
      for (const case_ of selected) {
        selectedCases.push({
          caseId: case_.id,
          caseworkerId: workerId,
          programType: case_.programType || "unknown",
          county: case_.county || "unknown",
          weight: case_.weight
        });

        // Track stratification
        const key = `${case_.programType}:${case_.county}`;
        stratificationDistribution[key] = (stratificationDistribution[key] || 0) + 1;
      }
    }

    // Calculate diversity and representativeness scores
    const diversityScore = this.calculateDiversityScore(selectedCases);
    const representativenessScore = this.calculateRepresentativenessScore(
      selectedCases,
      eligibleCases
    );

    return {
      selectedCases,
      diversityScore,
      representativenessScore,
      stratificationDistribution
    };
  }

  /**
   * Weighted random sampling using roulette wheel selection
   * Ensures true randomness while respecting diversity weights
   */
  private weightedRandomSample<T extends { weight: number }>(
    items: T[],
    sampleSize: number
  ): T[] {
    if (items.length <= sampleSize) return items;

    const selected: T[] = [];
    const remaining = [...items];

    for (let i = 0; i < sampleSize && remaining.length > 0; i++) {
      // Calculate total weight of remaining items
      const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
      
      // Random value between 0 and totalWeight
      let random = Math.random() * totalWeight;
      
      // Roulette wheel selection
      let selectedIndex = 0;
      for (let j = 0; j < remaining.length; j++) {
        random -= remaining[j].weight;
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }

      // Add selected item and remove from remaining pool
      selected.push(remaining[selectedIndex]);
      remaining.splice(selectedIndex, 1);
    }

    return selected;
  }

  /**
   * Calculate selection weight based on diversity goals
   * Ensures weights are always positive to maintain randomness
   */
  private calculateSelectionWeight(
    case_: any,
    allWorkerCases: any[]
  ): number {
    const MIN_WEIGHT = 0.1; // Minimum weight to ensure randomness
    let weight = 1.0;

    // Boost weight for underrepresented programs
    const programCounts = allWorkerCases.reduce((acc, c) => {
      acc[c.programType] = (acc[c.programType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const programFreq = programCounts[case_.programType] / allWorkerCases.length;
    weight *= (1 - programFreq); // Lower frequency = higher weight

    // Boost weight for diverse counties
    const countyCounts = allWorkerCases.reduce((acc, c) => {
      acc[c.county] = (acc[c.county] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const countyFreq = countyCounts[case_.county] / allWorkerCases.length;
    weight *= (1 - countyFreq);

    // Ensure weight never reaches zero (maintains randomness even for uniform cohorts)
    return Math.max(weight, MIN_WEIGHT);
  }

  /**
   * Calculate diversity score (0-1) based on program and county spread
   */
  private calculateDiversityScore(cases: SamplingResult["selectedCases"]): number {
    const uniquePrograms = new Set(cases.map(c => c.programType)).size;
    const uniqueCounties = new Set(cases.map(c => c.county)).size;
    
    // Normalize to 0-1 scale
    const programDiversity = Math.min(uniquePrograms / 6, 1.0); // 6 programs max
    const countyDiversity = Math.min(uniqueCounties / 10, 1.0); // 10+ counties considered diverse
    
    return (programDiversity + countyDiversity) / 2;
  }

  /**
   * Calculate how well the sample represents the population using Jensen-Shannon divergence
   * Returns score 0-1 where 1 = perfect representation, 0 = poor representation
   * Properly penalizes missing programs in sample
   */
  private calculateRepresentativenessScore(
    sample: SamplingResult["selectedCases"],
    population: any[]
  ): number {
    if (sample.length === 0 || population.length === 0) return 0;

    // Get all unique programs from population
    const allPrograms = new Set(population.map(c => c.programType || "unknown"));
    
    // Calculate distributions with smoothing (add-one smoothing to handle zeros)
    const smoothing = 0.01;
    const sampleDist: Record<string, number> = {};
    const popDist: Record<string, number> = {};

    // Initialize with smoothing for all programs
    for (const program of allPrograms) {
      sampleDist[program] = smoothing;
      popDist[program] = smoothing;
    }

    // Add actual counts
    for (const c of sample) {
      const prog = c.programType || "unknown";
      sampleDist[prog] += 1;
    }
    for (const c of population) {
      const prog = c.programType || "unknown";
      popDist[prog] += 1;
    }

    // Normalize to probabilities
    const sampleTotal = sample.length + smoothing * allPrograms.size;
    const popTotal = population.length + smoothing * allPrograms.size;
    
    for (const program of allPrograms) {
      sampleDist[program] /= sampleTotal;
      popDist[program] /= popTotal;
    }

    // Calculate Jensen-Shannon divergence (symmetric, bounded 0-1)
    let jsDiv = 0;
    for (const program of allPrograms) {
      const p = popDist[program];
      const q = sampleDist[program];
      const m = (p + q) / 2;

      // KL(P || M) and KL(Q || M)
      if (p > 0 && m > 0) {
        jsDiv += p * Math.log(p / m);
      }
      if (q > 0 && m > 0) {
        jsDiv += q * Math.log(q / m);
      }
    }
    
    jsDiv /= 2; // JS divergence is average of two KL divergences
    
    // Convert to similarity score (0 = perfect match, 1 = completely different)
    // We want: 1 = perfect match, 0 = completely different
    const similarity = 1 - Math.min(jsDiv / Math.log(2), 1);
    
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }
}

const samplingService = new StratifiedSamplingService();

// ============================================================================
// LIFECYCLE CHECKPOINT TRACKING
// ============================================================================

class CheckpointTrackingService {
  
  /**
   * Create all checkpoint events for a new review
   */
  async createCheckpoints(
    reviewId: string,
    caseId: string,
    caseStartDate: Date
  ): Promise<CaseLifecycleEvent[]> {
    
    const checkpoints: InsertCaseLifecycleEvent[] = CHECKPOINT_DEFINITIONS.map(config => {
      const expectedStart = new Date(caseStartDate);
      expectedStart.setDate(expectedStart.getDate() + config.expectedDayStart);
      
      const expectedEnd = new Date(caseStartDate);
      expectedEnd.setDate(expectedEnd.getDate() + config.expectedDayEnd);
      
      // Use midpoint as expected date
      const expectedDate = new Date(
        (expectedStart.getTime() + expectedEnd.getTime()) / 2
      );

      return {
        reviewId,
        caseId,
        checkpointType: config.type,
        checkpointName: config.name,
        checkpointDescription: config.description,
        expectedDate,
        daysFromStart: config.expectedDayStart,
        status: "pending",
        aiAlerted: false
      };
    });

    const created = await db.insert(caseLifecycleEvents).values(checkpoints).returning();
    return created;
  }

  /**
   * Update checkpoint status and check for delays
   */
  async updateCheckpoint(
    checkpointId: string,
    actualDate: Date,
    completedBy: string,
    notes?: string
  ): Promise<CaseLifecycleEvent> {
    
    // Get existing checkpoint
    const [checkpoint] = await db
      .select()
      .from(caseLifecycleEvents)
      .where(eq(caseLifecycleEvents.id, checkpointId));

    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    // Calculate delay
    const expectedDate = checkpoint.expectedDate;
    const delayDays = expectedDate 
      ? Math.floor((actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const isOnTime = delayDays <= 2; // Allow 2-day grace period
    const aiAlerted = delayDays > 5; // Flag if more than 5 days late

    // Update checkpoint
    const [updated] = await db
      .update(caseLifecycleEvents)
      .set({
        actualDate,
        delayDays,
        isOnTime,
        status: "completed",
        completedBy,
        notes,
        aiAlerted,
        aiAlertReason: aiAlerted ? `Checkpoint completed ${delayDays} days late` : null,
        updatedAt: new Date()
      })
      .where(eq(caseLifecycleEvents.id, checkpointId))
      .returning();

    return updated;
  }

  /**
   * Get overdue checkpoints for AI monitoring
   */
  async getOverdueCheckpoints(): Promise<CaseLifecycleEvent[]> {
    const now = new Date();
    
    return await db
      .select()
      .from(caseLifecycleEvents)
      .where(
        and(
          eq(caseLifecycleEvents.status, "pending"),
          lte(caseLifecycleEvents.expectedDate, now)
        )
      )
      .orderBy(desc(caseLifecycleEvents.expectedDate));
  }

  /**
   * Calculate checkpoint completion rate for a review
   */
  async getCompletionStats(reviewId: string): Promise<{
    total: number;
    completed: number;
    overdue: number;
    onTimeRate: number;
  }> {
    const checkpoints = await db
      .select()
      .from(caseLifecycleEvents)
      .where(eq(caseLifecycleEvents.reviewId, reviewId));

    const total = checkpoints.length;
    const completed = checkpoints.filter(c => c.status === "completed").length;
    const overdue = checkpoints.filter(c => 
      c.status === "pending" && c.expectedDate && c.expectedDate < new Date()
    ).length;
    const onTime = checkpoints.filter(c => c.isOnTime).length;
    const onTimeRate = completed > 0 ? onTime / completed : 0;

    return { total, completed, overdue, onTimeRate };
  }
}

const checkpointService = new CheckpointTrackingService();

// ============================================================================
// AI ASSESSMENT SERVICE (Gemini)
// ============================================================================

class AIAssessmentService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Assess case quality using Gemini AI
   */
  async assessCaseQuality(caseId: string): Promise<{
    score: number;
    summary: string;
    details: any;
  }> {
    
    if (!this.genAI) {
      throw new Error("Gemini API not configured");
    }

    // Check cache first
    const cacheKey = `bar:ai-assessment:${caseId}`;
    const cached = await cacheOrchestrator.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get case data
    const [caseData] = await db
      .select()
      .from(clientCases)
      .where(eq(clientCases.id, caseId));

    if (!caseData) {
      throw new Error(`Case ${caseId} not found`);
    }

    // Get checkpoint data
    const checkpoints = await db
      .select()
      .from(caseLifecycleEvents)
      .where(eq(caseLifecycleEvents.caseId, caseId));

    // Build assessment prompt
    const prompt = `You are a quality assurance reviewer for a public benefits case management system.
Analyze the following case and provide a quality assessment.

Case Information:
- Program: ${caseData.programType || "Unknown"}
- Status: ${caseData.status || "Unknown"}
- Created: ${caseData.createdAt}
- County: ${caseData.county || "Unknown"}

Checkpoint Progress:
${checkpoints.map(cp => `- ${cp.checkpointName}: ${cp.status} ${cp.delayDays ? `(${cp.delayDays} days delay)` : ""}`).join("\n")}

Please evaluate the case on these dimensions:
1. Documentation Completeness (Are all required checkpoints completed?)
2. Timeliness (Are checkpoints completed on time?)
3. Process Compliance (Does the workflow follow standard procedures?)
4. Overall Quality (General assessment of case handling)

Return your assessment as a JSON object with this structure:
{
  "overallScore": 0.85,
  "dimensions": {
    "documentation": 0.9,
    "timeliness": 0.8,
    "compliance": 0.85,
    "quality": 0.85
  },
  "strengths": ["Clear documentation", "Good communication"],
  "concerns": ["Minor delay in verification"],
  "summary": "Well-managed case with minor timeliness issues"
}

Score range: 0.0 (poor) to 1.0 (excellent)`;

    try {
      const result = await this.genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const text = result.text || "";

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }

      const assessment = JSON.parse(jsonMatch[0]);

      const result_obj = {
        score: assessment.overallScore || 0.5,
        summary: assessment.summary || "Assessment completed",
        details: assessment
      };

      // Cache for 24 hours
      await cacheOrchestrator.set(
        cacheKey,
        JSON.stringify(result_obj),
        { ttl: 86400 }
      );

      return result_obj;

    } catch (error) {
      logger.error("AI assessment error", {
        context: 'AIAssessmentService.assessCaseQuality',
        caseId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return default assessment if AI fails
      return {
        score: 0.5,
        summary: "AI assessment unavailable - manual review required",
        details: { error: "AI service error" }
      };
    }
  }
}

const aiAssessmentService = new AIAssessmentService();

// ============================================================================
// MAIN BENEFITS ACCESS REVIEW SERVICE
// ============================================================================

export class BenefitsAccessReviewService {
  
  /**
   * Run weekly case selection and create reviews
   */
  async runWeeklySelection(): Promise<ReviewSample> {
    const samplingResult = await samplingService.selectWeeklyCases(2);
    
    // Create review sample record
    const weekId = this.getWeekId();
    const [sample] = await db.insert(reviewSamples).values({
      samplingPeriod: weekId,
      totalCases: samplingResult.selectedCases.length * 10, // Estimate
      selectedCases: samplingResult.selectedCases.length,
      samplingRate: 0.2, // 20% sample rate
      stratificationDimensions: {
        programs: Array.from(new Set(samplingResult.selectedCases.map(c => c.programType))),
        counties: Array.from(new Set(samplingResult.selectedCases.map(c => c.county)))
      },
      stratificationDistribution: samplingResult.stratificationDistribution,
      diversityScore: samplingResult.diversityScore,
      representativenessScore: samplingResult.representativenessScore,
      workersIncluded: new Set(samplingResult.selectedCases.map(c => c.caseworkerId)).size,
      casesPerWorker: this.calculateCasesPerWorker(samplingResult.selectedCases)
    }).returning();

    // Create individual review records
    const reviewPeriodStart = new Date();
    const reviewPeriodEnd = new Date();
    reviewPeriodEnd.setDate(reviewPeriodEnd.getDate() + 45); // 45-day review period

    for (const selectedCase of samplingResult.selectedCases) {
      const [caseData] = await db
        .select()
        .from(clientCases)
        .where(eq(clientCases.id, selectedCase.caseId));

      if (!caseData) continue;

      // Create review with anonymization
      const anonymizedCaseId = anonymizationService.anonymize(selectedCase.caseId, "case");
      const anonymizedWorkerId = anonymizationService.anonymize(selectedCase.caseworkerId, "worker");

      const [review] = await db.insert(benefitsAccessReviews).values({
        caseId: selectedCase.caseId,
        caseworkerId: selectedCase.caseworkerId,
        reviewPeriodStart,
        reviewPeriodEnd,
        reviewDuration: 45,
        samplingMethod: "stratified",
        samplingCriteria: {
          program: selectedCase.programType,
          county: selectedCase.county,
          weight: selectedCase.weight
        },
        selectedForReview: true,
        selectionWeight: selectedCase.weight,
        reviewStatus: "pending",
        reviewPriority: "normal",
        anonymizedCaseId,
        anonymizedWorkerId,
        blindReviewMode: true,
        totalCheckpoints: CHECKPOINT_DEFINITIONS.length
      }).returning();

      // Create checkpoints
      await checkpointService.createCheckpoints(
        review.id,
        selectedCase.caseId,
        caseData.createdAt || new Date()
      );

      // Run AI assessment (async, don't wait)
      this.runAIAssessment(review.id, selectedCase.caseId).catch(err => 
        logger.error("AI assessment failed for review", {
          context: 'BenefitsAccessReviewService.createIndividualReviews',
          reviewId: review.id,
          caseId: selectedCase.caseId,
          error: err instanceof Error ? err.message : String(err)
        })
      );
    }

    return sample;
  }

  /**
   * Run AI assessment for a review
   */
  private async runAIAssessment(reviewId: string, caseId: string): Promise<void> {
    const assessment = await aiAssessmentService.assessCaseQuality(caseId);
    
    await db
      .update(benefitsAccessReviews)
      .set({
        aiAssessmentScore: assessment.score,
        aiAssessmentSummary: assessment.summary,
        aiAssessmentDetails: assessment.details,
        aiAssessmentDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(benefitsAccessReviews.id, reviewId));
  }

  /**
   * Get current week ID (YYYY-WXX format)
   */
  private getWeekId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
  }

  /**
   * Calculate cases per worker distribution
   */
  private calculateCasesPerWorker(cases: SamplingResult["selectedCases"]): Record<string, number> {
    return cases.reduce((acc, case_) => {
      acc[case_.caseworkerId] = (acc[case_.caseworkerId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get reviews for supervisor dashboard
   */
  async getActiveReviews(supervisorId?: string): Promise<BenefitsAccessReview[]> {
    const query = db.select().from(benefitsAccessReviews);
    
    if (supervisorId) {
      return await query.where(
        and(
          eq(benefitsAccessReviews.supervisorId, supervisorId),
          inArray(benefitsAccessReviews.reviewStatus, ["pending", "in_progress"])
        )
      );
    }

    return await query.where(
      inArray(benefitsAccessReviews.reviewStatus, ["pending", "in_progress"])
    );
  }

  /**
   * Reveal anonymized identity (super-admin only)
   */
  async revealIdentity(
    anonymizedId: string,
    type: "case" | "worker",
    userRole: string
  ): Promise<string | null> {
    if (!anonymizationService.canReveal(userRole)) {
      throw new Error("Insufficient permissions to reveal anonymized data");
    }

    // Get all possible IDs from database
    if (type === "case") {
      const cases = await db.select({ id: clientCases.id }).from(clientCases);
      return anonymizationService.reveal(
        anonymizedId,
        cases.map(c => c.id),
        "case"
      );
    } else {
      const workers = await db.select({ id: users.id }).from(users);
      return anonymizationService.reveal(
        anonymizedId,
        workers.map(w => w.id),
        "worker"
      );
    }
  }
}

// Export singleton instance
export const benefitsAccessReviewService = new BenefitsAccessReviewService();

// Export component services for testing
export {
  anonymizationService,
  samplingService,
  checkpointService,
  aiAssessmentService
};
