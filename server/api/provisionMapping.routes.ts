import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  lawProvisions, provisionOntologyMappings, ontologyTerms, publicLaws,
  formalRules, users
} from "@shared/schema";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { provisionExtractorService } from "../services/provisionExtractor.service";
import { ontologyMatcherService } from "../services/ontologyMatcher.service";
import { z3SolverService } from "../services/z3SolverService";
import { logger } from "../services/logger.service";

const router = Router();

router.get("/pending", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const priority = req.query.priority as string;

    let query = db.select({
      mapping: provisionOntologyMappings,
      provision: {
        id: lawProvisions.id,
        sectionNumber: lawProvisions.sectionNumber,
        sectionTitle: lawProvisions.sectionTitle,
        provisionType: lawProvisions.provisionType,
        provisionText: lawProvisions.provisionText,
        provisionSummary: lawProvisions.provisionSummary,
        usCodeCitation: lawProvisions.usCodeCitation,
        affectedPrograms: lawProvisions.affectedPrograms,
        effectiveDate: lawProvisions.effectiveDate,
        publicLawId: lawProvisions.publicLawId
      },
      term: {
        id: ontologyTerms.id,
        termName: ontologyTerms.termName,
        canonicalName: ontologyTerms.canonicalName,
        domain: ontologyTerms.domain,
        definition: ontologyTerms.definition,
        statutoryCitation: ontologyTerms.statutoryCitation,
        programCode: ontologyTerms.programCode
      }
    })
      .from(provisionOntologyMappings)
      .innerJoin(lawProvisions, eq(provisionOntologyMappings.lawProvisionId, lawProvisions.id))
      .innerJoin(ontologyTerms, eq(provisionOntologyMappings.ontologyTermId, ontologyTerms.id))
      .where(
        priority 
          ? and(
              eq(provisionOntologyMappings.reviewStatus, "pending_review"),
              eq(provisionOntologyMappings.priorityLevel, priority)
            )
          : eq(provisionOntologyMappings.reviewStatus, "pending_review")
      )
      .orderBy(
        sql`CASE ${provisionOntologyMappings.priorityLevel} 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 END`,
        desc(provisionOntologyMappings.createdAt)
      )
      .limit(limit)
      .offset(offset);

    const mappings = await query;

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(provisionOntologyMappings)
      .where(eq(provisionOntologyMappings.reviewStatus, "pending_review"));

    res.json({
      mappings,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset
    });
  } catch (error) {
    logger.error("Failed to fetch pending mappings", { error });
    res.status(500).json({ error: "Failed to fetch pending mappings" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await ontologyMatcherService.getMappingStats();
    res.json(stats);
  } catch (error) {
    logger.error("Failed to fetch mapping stats", { error });
    res.status(500).json({ error: "Failed to fetch mapping stats" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [result] = await db.select({
      mapping: provisionOntologyMappings,
      provision: lawProvisions,
      term: ontologyTerms
    })
      .from(provisionOntologyMappings)
      .innerJoin(lawProvisions, eq(provisionOntologyMappings.lawProvisionId, lawProvisions.id))
      .innerJoin(ontologyTerms, eq(provisionOntologyMappings.ontologyTermId, ontologyTerms.id))
      .where(eq(provisionOntologyMappings.id, id));

    if (!result) {
      return res.status(404).json({ error: "Mapping not found" });
    }

    const [publicLaw] = await db.select()
      .from(publicLaws)
      .where(eq(publicLaws.id, result.provision.publicLawId));

    const relatedRules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.status, "approved"),
        sql`${result.term.canonicalName} = ANY(${formalRules.ontologyTermsUsed})`
      ))
      .limit(5);

    res.json({
      ...result,
      publicLaw: publicLaw || null,
      relatedRules
    });
  } catch (error) {
    logger.error("Failed to fetch mapping details", { error });
    res.status(500).json({ error: "Failed to fetch mapping details" });
  }
});

router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewNotes, skipRuleVerification } = req.body;
    const reviewerId = (req as any).user?.id || "system";

    const [mapping] = await db.select()
      .from(provisionOntologyMappings)
      .where(eq(provisionOntologyMappings.id, id));

    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }

    if (mapping.reviewStatus !== "pending_review") {
      return res.status(400).json({ error: "Mapping has already been reviewed" });
    }

    const [term] = await db.select()
      .from(ontologyTerms)
      .where(eq(ontologyTerms.id, mapping.ontologyTermId));

    if (!term) {
      logger.warn("Ontology term not found for mapping", { mappingId: id, ontologyTermId: mapping.ontologyTermId });
    }

    let affectedRules: typeof formalRules.$inferSelect[] = [];
    if (term?.canonicalName) {
      affectedRules = await db.select()
        .from(formalRules)
        .where(and(
          eq(formalRules.status, "approved"),
          eq(formalRules.isValid, true),
          sql`${term.canonicalName} = ANY(${formalRules.ontologyTermsUsed})`
        ));
    }

    if (term?.id) {
      const rulesByTermId = await db.select()
        .from(formalRules)
        .where(and(
          eq(formalRules.status, "approved"),
          eq(formalRules.isValid, true),
          sql`${term.id} = ANY(${formalRules.ontologyTermsUsed})`
        ));
      
      const existingIds = new Set(affectedRules.map(r => r.id));
      for (const rule of rulesByTermId) {
        if (!existingIds.has(rule.id)) {
          affectedRules.push(rule);
        }
      }
    }

    const requiresRuleVerification = !skipRuleVerification && affectedRules.length > 0;
    const verificationBatchId = requiresRuleVerification ? `prov-map-${id}-${Date.now()}` : null;

    const [updated] = await db.update(provisionOntologyMappings)
      .set({
        reviewStatus: "approved",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        appliedAt: requiresRuleVerification ? null : new Date(),
        z3VerificationRunId: verificationBatchId,
        updatedAt: new Date()
      })
      .where(eq(provisionOntologyMappings.id, id))
      .returning();

    await db.update(lawProvisions)
      .set({ 
        processingStatus: requiresRuleVerification ? "pending_rule_verification" : "applied", 
        updatedAt: new Date() 
      })
      .where(eq(lawProvisions.id, mapping.lawProvisionId));

    let z3VerificationResults: any[] = [];
    if (requiresRuleVerification) {
      logger.info("Queuing affected rules for re-verification", {
        mappingId: id,
        verificationBatchId,
        affectedRulesCount: affectedRules.length
      });

      for (const rule of affectedRules) {
        try {
          await db.update(formalRules)
            .set({
              status: "pending_review",
              updatedAt: new Date()
            })
            .where(eq(formalRules.id, rule.id));

          z3VerificationResults.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            programCode: rule.programCode,
            status: "queued_for_reverification",
            verificationBatchId
          });
        } catch (ruleError) {
          logger.warn("Failed to queue rule for re-verification", {
            ruleId: rule.id,
            error: ruleError
          });
          z3VerificationResults.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            status: "queue_failed",
            error: String(ruleError)
          });
        }
      }
    }

    logger.info("Mapping approved", {
      mappingId: id,
      reviewedBy: reviewerId,
      ontologyTermId: mapping.ontologyTermId,
      termCanonicalName: term?.canonicalName,
      affectedRulesCount: affectedRules.length,
      requiresRuleVerification,
      verificationBatchId,
      appliedImmediately: !requiresRuleVerification
    });

    res.json({
      success: true,
      mapping: updated,
      affectedRules: affectedRules.length,
      requiresRuleVerification,
      verificationBatchId,
      z3VerificationResults,
      message: requiresRuleVerification 
        ? `Mapping approved. ${affectedRules.length} formal rules queued for re-verification. Mapping will be applied after rules are verified.`
        : "Mapping approved and applied successfully"
    });
  } catch (error) {
    logger.error("Failed to approve mapping", { error });
    res.status(500).json({ error: "Failed to approve mapping" });
  }
});

router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason, reviewNotes } = req.body;
    const reviewerId = (req as any).user?.id || "system";

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const [mapping] = await db.select()
      .from(provisionOntologyMappings)
      .where(eq(provisionOntologyMappings.id, id));

    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }

    if (mapping.reviewStatus !== "pending_review") {
      return res.status(400).json({ error: "Mapping has already been reviewed" });
    }

    const [updated] = await db.update(provisionOntologyMappings)
      .set({
        reviewStatus: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        rejectionReason,
        updatedAt: new Date()
      })
      .where(eq(provisionOntologyMappings.id, id))
      .returning();

    logger.info("Mapping rejected", {
      mappingId: id,
      reviewedBy: reviewerId,
      reason: rejectionReason
    });

    res.json({
      success: true,
      mapping: updated,
      message: "Mapping rejected"
    });
  } catch (error) {
    logger.error("Failed to reject mapping", { error });
    res.status(500).json({ error: "Failed to reject mapping" });
  }
});

router.post("/bulk-approve", async (req: Request, res: Response) => {
  try {
    const { mappingIds, skipRuleVerification } = req.body;
    const reviewerId = (req as any).user?.id || "system";

    if (!Array.isArray(mappingIds) || mappingIds.length === 0) {
      return res.status(400).json({ error: "mappingIds array is required" });
    }

    const bulkBatchId = `bulk-${Date.now()}`;
    const results: { approved: number; queuedForVerification: number; skipped: number } = {
      approved: 0,
      queuedForVerification: 0,
      skipped: 0
    };

    for (const mappingId of mappingIds) {
      try {
        const [mapping] = await db.select()
          .from(provisionOntologyMappings)
          .where(eq(provisionOntologyMappings.id, mappingId));

        if (!mapping || mapping.reviewStatus !== "pending_review") {
          results.skipped++;
          continue;
        }

        const [term] = await db.select()
          .from(ontologyTerms)
          .where(eq(ontologyTerms.id, mapping.ontologyTermId));

        let affectedRulesCount = 0;
        if (!skipRuleVerification && term?.canonicalName) {
          const affectedRules = await db.select({ id: formalRules.id })
            .from(formalRules)
            .where(and(
              eq(formalRules.status, "approved"),
              eq(formalRules.isValid, true),
              sql`${term.canonicalName} = ANY(${formalRules.ontologyTermsUsed})`
            ));

          affectedRulesCount = affectedRules.length;

          if (affectedRulesCount > 0) {
            for (const rule of affectedRules) {
              await db.update(formalRules)
                .set({ status: "pending_review", updatedAt: new Date() })
                .where(eq(formalRules.id, rule.id));
            }
          }
        }

        const requiresVerification = !skipRuleVerification && affectedRulesCount > 0;

        await db.update(provisionOntologyMappings)
          .set({
            reviewStatus: "approved",
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            appliedAt: requiresVerification ? null : new Date(),
            z3VerificationRunId: requiresVerification ? bulkBatchId : null,
            updatedAt: new Date()
          })
          .where(eq(provisionOntologyMappings.id, mappingId));

        await db.update(lawProvisions)
          .set({
            processingStatus: requiresVerification ? "pending_rule_verification" : "applied",
            updatedAt: new Date()
          })
          .where(eq(lawProvisions.id, mapping.lawProvisionId));

        if (requiresVerification) {
          results.queuedForVerification++;
        } else {
          results.approved++;
        }
      } catch (itemError) {
        logger.warn("Failed to process bulk approve item", { mappingId, error: itemError });
        results.skipped++;
      }
    }

    logger.info("Bulk approval completed with rule verification", {
      requestedCount: mappingIds.length,
      ...results,
      bulkBatchId,
      reviewedBy: reviewerId
    });

    res.json({
      success: true,
      approvedCount: results.approved + results.queuedForVerification,
      appliedImmediately: results.approved,
      queuedForVerification: results.queuedForVerification,
      skipped: results.skipped,
      bulkBatchId,
      message: results.queuedForVerification > 0
        ? `${results.approved + results.queuedForVerification} mappings approved. ${results.queuedForVerification} require rule verification.`
        : `${results.approved} mappings approved and applied`
    });
  } catch (error) {
    logger.error("Failed to bulk approve", { error });
    res.status(500).json({ error: "Failed to bulk approve mappings" });
  }
});

router.post("/extract/:publicLawId", async (req: Request, res: Response) => {
  try {
    const { publicLawId } = req.params;

    const result = await provisionExtractorService.extractProvisionsFromLaw(publicLawId);

    if (!result.success && result.provisionsExtracted === 0) {
      return res.status(400).json({
        error: "No provisions extracted",
        details: result.errors
      });
    }

    res.json(result);
  } catch (error) {
    logger.error("Failed to extract provisions", { error });
    res.status(500).json({ error: "Failed to extract provisions" });
  }
});

router.post("/match/:provisionId", async (req: Request, res: Response) => {
  try {
    const { provisionId } = req.params;

    const result = await ontologyMatcherService.matchProvisionToOntology(provisionId);

    res.json(result);
  } catch (error) {
    logger.error("Failed to match provision", { error });
    res.status(500).json({ error: "Failed to match provision" });
  }
});

router.post("/process-law/:publicLawId", async (req: Request, res: Response) => {
  try {
    const { publicLawId } = req.params;

    const extractResult = await provisionExtractorService.extractProvisionsFromLaw(publicLawId);
    
    if (!extractResult.success) {
      return res.status(400).json({
        error: "Extraction failed",
        extractResult
      });
    }

    const matchResults = [];
    for (const provisionId of extractResult.provisionIds) {
      const matchResult = await ontologyMatcherService.matchProvisionToOntology(provisionId);
      matchResults.push(matchResult);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const totalMappings = matchResults.reduce((sum, r) => sum + r.mappingsProposed, 0);

    res.json({
      success: true,
      publicLawId,
      provisionsExtracted: extractResult.provisionsExtracted,
      mappingsProposed: totalMappings,
      extractResult,
      matchResults
    });
  } catch (error) {
    logger.error("Failed to process law", { error });
    res.status(500).json({ error: "Failed to process law" });
  }
});

router.get("/provisions/:publicLawId", async (req: Request, res: Response) => {
  try {
    const { publicLawId } = req.params;

    const provisions = await provisionExtractorService.getProvisionsForLaw(publicLawId);

    res.json({ provisions });
  } catch (error) {
    logger.error("Failed to fetch provisions", { error });
    res.status(500).json({ error: "Failed to fetch provisions" });
  }
});

router.get("/history/approved", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const mappings = await db.select({
      mapping: provisionOntologyMappings,
      provision: {
        id: lawProvisions.id,
        sectionNumber: lawProvisions.sectionNumber,
        provisionSummary: lawProvisions.provisionSummary,
        usCodeCitation: lawProvisions.usCodeCitation
      },
      term: {
        id: ontologyTerms.id,
        termName: ontologyTerms.termName,
        canonicalName: ontologyTerms.canonicalName
      }
    })
      .from(provisionOntologyMappings)
      .innerJoin(lawProvisions, eq(provisionOntologyMappings.lawProvisionId, lawProvisions.id))
      .innerJoin(ontologyTerms, eq(provisionOntologyMappings.ontologyTermId, ontologyTerms.id))
      .where(eq(provisionOntologyMappings.reviewStatus, "approved"))
      .orderBy(desc(provisionOntologyMappings.reviewedAt))
      .limit(limit)
      .offset(offset);

    res.json({ mappings });
  } catch (error) {
    logger.error("Failed to fetch approved history", { error });
    res.status(500).json({ error: "Failed to fetch approved history" });
  }
});

export default router;
