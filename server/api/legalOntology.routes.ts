import { Router, Request, Response } from "express";
import { legalOntologyService, OntologyDomain, RelationshipType } from "../services/legalOntologyService";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { logger } from "../services/logger.service";

const router = Router();

router.get("/terms", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { stateCode, programCode, domain, search, limit } = req.query;
  
  if (search) {
    const terms = await legalOntologyService.searchTermsByText(
      search as string,
      stateCode as string,
      programCode as string,
      domain as OntologyDomain,
      parseInt(limit as string) || 10
    );
    return res.json({ terms, count: terms.length });
  }
  
  if (domain) {
    const terms = await legalOntologyService.getTermsByDomain(
      domain as OntologyDomain,
      stateCode as string,
      programCode as string
    );
    return res.json({ terms, count: terms.length });
  }
  
  if (stateCode && programCode) {
    const terms = await legalOntologyService.getTermsByProgram(
      stateCode as string,
      programCode as string
    );
    return res.json({ terms, count: terms.length });
  }
  
  res.json({ terms: [], count: 0, message: "Provide stateCode and programCode, domain, or search query" });
}));

router.get("/terms/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const term = await legalOntologyService.getTermById(req.params.id);
  
  if (!term) {
    return res.status(404).json({ error: "Term not found" });
  }
  
  res.json({ term });
}));

router.post("/terms", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { 
    stateCode, 
    programCode, 
    termName, 
    domain, 
    definition, 
    statutoryCitation,
    statutorySourceId,
    parentTermId,
    synonyms 
  } = req.body;
  
  if (!stateCode || !programCode || !termName || !domain) {
    return res.status(400).json({ 
      error: "Missing required fields: stateCode, programCode, termName, domain" 
    });
  }
  
  const term = await legalOntologyService.createTerm({
    stateCode,
    programCode,
    termName,
    domain,
    definition,
    statutoryCitation,
    statutorySourceId,
    parentTermId,
    synonyms,
    createdBy: (req as any).user?.id || "system"
  });
  
  res.status(201).json({ term });
}));

router.patch("/terms/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { termName, definition, domain, synonyms, statutoryCitation } = req.body;
  
  const term = await legalOntologyService.updateTerm(req.params.id, {
    termName,
    definition,
    domain,
    synonyms,
    statutoryCitation
  });
  
  if (!term) {
    return res.status(404).json({ error: "Term not found" });
  }
  
  res.json({ term });
}));

router.delete("/terms/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const success = await legalOntologyService.deactivateTerm(req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: "Term not found" });
  }
  
  res.json({ success: true, message: "Term deactivated" });
}));

router.post("/terms/similar", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { text, stateCode, programCode, threshold, limit } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text is required for similarity search" });
  }
  
  const similarTerms = await legalOntologyService.findSimilarTerms(
    text,
    stateCode,
    programCode,
    parseFloat(threshold) || 0.85,
    parseInt(limit) || 10
  );
  
  res.json({ 
    query: text,
    results: similarTerms.map(({ term, similarity }) => ({
      term,
      similarity: Math.round(similarity * 1000) / 1000
    })),
    count: similarTerms.length
  });
}));

router.get("/relationships", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { termId, direction, type } = req.query;
  
  if (!termId) {
    return res.status(400).json({ error: "termId is required" });
  }
  
  if (direction === "to") {
    const relationships = await legalOntologyService.getRelationshipsTo(
      termId as string,
      type as RelationshipType
    );
    return res.json({ relationships, direction: "to", count: relationships.length });
  }
  
  const relationships = await legalOntologyService.getRelationshipsFrom(
    termId as string,
    type as RelationshipType
  );
  res.json({ relationships, direction: "from", count: relationships.length });
}));

router.post("/relationships", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { fromTermId, toTermId, relationshipType, statutoryCitation, description, weight } = req.body;
  
  if (!fromTermId || !toTermId || !relationshipType) {
    return res.status(400).json({ 
      error: "Missing required fields: fromTermId, toTermId, relationshipType" 
    });
  }
  
  const validTypes: RelationshipType[] = [
    "is_a", "has_property", "requires", "implies", "excludes", 
    "depends_on", "constrains", "part_of", "equivalent_to"
  ];
  
  if (!validTypes.includes(relationshipType)) {
    return res.status(400).json({ 
      error: `Invalid relationshipType. Must be one of: ${validTypes.join(", ")}` 
    });
  }
  
  const relationship = await legalOntologyService.createRelationship({
    fromTermId,
    toTermId,
    relationshipType,
    statutoryCitation,
    description,
    weight
  });
  
  res.status(201).json({ relationship });
}));

router.get("/graph/traverse", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { startTermId, relationshipTypes, maxDepth } = req.query;
  
  if (!startTermId) {
    return res.status(400).json({ error: "startTermId is required" });
  }
  
  const types = relationshipTypes 
    ? (relationshipTypes as string).split(",") as RelationshipType[]
    : ["requires", "implies", "depends_on"] as RelationshipType[];
  
  const graphMap = await legalOntologyService.traverseGraph(
    startTermId as string,
    types,
    parseInt(maxDepth as string) || 3
  );
  
  const nodes = Array.from(graphMap.entries()).map(([id, data]) => ({
    id,
    term: data.term,
    depth: data.depth
  }));
  
  res.json({ 
    startTermId,
    relationshipTypes: types,
    maxDepth: parseInt(maxDepth as string) || 3,
    nodes,
    nodeCount: nodes.length
  });
}));

router.get("/stats", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { stateCode, programCode } = req.query;
  
  const stats = await legalOntologyService.getStats(
    stateCode as string,
    programCode as string
  );
  
  res.json(stats);
}));

router.post("/seed", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { stateCode, programCode } = req.body;
  
  if (!stateCode || !programCode) {
    return res.status(400).json({ 
      error: "stateCode and programCode are required" 
    });
  }
  
  logger.info("Seeding ontology terms", { stateCode, programCode });
  
  const { seedOntologyTerms } = await import("../seeds/ontologySeeds");
  const result = await seedOntologyTerms(stateCode, programCode);
  
  res.json(result);
}));

export default router;
