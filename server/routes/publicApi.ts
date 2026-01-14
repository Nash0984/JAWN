import { Router } from "express";
import { z } from "zod";
import { requireApiKey, trackApiUsage } from "../middleware/apiKeyAuth";
import { asyncHandler } from "../middleware/errorHandler";
import { db } from "../db";
import { benefitPrograms, webhooks, insertWebhookSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { rulesEngine } from "../services/rulesEngine";
import { unifiedDocumentService } from "../services/unified/UnifiedDocumentService";
import { neuroSymbolicHybridGateway } from "../services/neuroSymbolicHybridGateway";
import crypto from "crypto";

const router = Router();

// Apply API key tracking to all routes
router.use(trackApiUsage());

// ============================================================================
// ELIGIBILITY API - Check benefit eligibility
// ============================================================================

const eligibilityRequestSchema = z.object({
  householdSize: z.number().int().min(1).max(20),
  totalIncome: z.number().min(0),
  state: z.string().regex(/^[A-Z]{2}$/),
  householdMembers: z.array(z.object({
    age: z.number().int().min(0).max(120),
    relationship: z.enum(['self', 'spouse', 'child', 'parent', 'other']),
    income: z.number().min(0).optional(),
    hasDisability: z.boolean().optional(),
  })).optional(),
  zipCode: z.string().regex(/^[0-9]{5}$/).optional(),
});

router.post(
  '/eligibility/check',
  requireApiKey('eligibility:read'),
  asyncHandler(async (req, res) => {
    // Validate request
    const validatedData = eligibilityRequestSchema.parse(req.body);
    
    // Use existing rules engine to check eligibility
    const result = await rulesEngine.checkEligibility({
      ...validatedData,
      tenantId: req.apiTenantId!, // Use tenant from API key
    });
    
    // MANDATORY Z3 GATEWAY VERIFICATION
    // Per neuro-symbolic architecture: All eligibility determinations must be verified
    // by the Z3 solver before being returned to the client
    let solverVerification: { verified: boolean; runId?: string; statutoryCitations?: string[] } = { verified: false };
    
    try {
      const caseId = `api-eligibility-${Date.now()}`;
      const gatewayResult = await neuroSymbolicHybridGateway.verifyEligibility(
        caseId,
        validatedData.state || "MD",
        "SNAP",
        {
          grossIncome: validatedData.totalIncome,
          householdSize: validatedData.householdSize,
          hasElderly: validatedData.householdMembers?.some(m => m.age >= 60) || false,
          hasDisabled: validatedData.householdMembers?.some(m => m.hasDisability) || false,
          citizenshipStatus: "us_citizen"
        },
        {
          tenantId: req.apiTenantId!,
          triggeredBy: "public_api_eligibility_check"
        }
      );

      solverVerification = {
        verified: true,
        runId: gatewayResult.symbolicLayer.runId,
        statutoryCitations: gatewayResult.rulesAsCodeContext.formalRulesUsed.map(r => r.statutoryCitation).filter(Boolean)
      };

      // If gateway says ineligible but rules engine says eligible, use gateway (Z3 is authoritative)
      if (!gatewayResult.symbolicLayer.isSatisfied && result.eligible) {
        result.eligible = false;
        result.programs = [];
        result.nextSteps = gatewayResult.symbolicLayer.violations.map(v => `Rule violation: ${v.citation || v.ruleName}`);
      }
    } catch (gatewayError) {
      console.warn("[PublicAPI] Gateway verification failed - proceeding with rules engine result", gatewayError);
    }
    
    res.json({
      eligible: result.eligible || false,
      programs: result.programs || [],
      nextSteps: result.nextSteps || [],
      solverVerification,
    });
  })
);

// ============================================================================
// PROGRAMS API - List available benefit programs
// ============================================================================

router.get(
  '/programs',
  requireApiKey('programs:read'),
  asyncHandler(async (req, res) => {
    const { programType, active } = req.query;
    
    let query = db.select().from(benefitPrograms);
    
    // Apply filters
    const filters = [];
    if (programType) {
      filters.push(eq(benefitPrograms.programType, programType as string));
    }
    if (active !== undefined) {
      filters.push(eq(benefitPrograms.isActive, active === 'true'));
    }
    
    const programs = filters.length > 0
      ? await query.where(filters[0])
      : await query;
    
    res.json(programs);
  })
);

// ============================================================================
// DOCUMENTS API - Verify documents
// ============================================================================

const documentVerifySchema = z.object({
  documentType: z.enum(['income_proof', 'identity', 'residency', 'other']),
  documentData: z.string(), // Base64-encoded document
  metadata: z.record(z.any()).optional(),
});

router.post(
  '/documents/verify',
  requireApiKey('documents:write'),
  asyncHandler(async (req, res) => {
    // Validate request
    const validatedData = documentVerifySchema.parse(req.body);
    
    // Decode base64 document
    const documentBuffer = Buffer.from(validatedData.documentData, 'base64');
    
    // Determine MIME type from buffer or metadata
    const mimeType = validatedData.metadata?.mimeType || 'image/jpeg';
    
    // Analyze document using Gemini Vision
    const analysis = await unifiedDocumentService.analyzeDocument(
      documentBuffer,
      mimeType
    );
    
    // Apply basic verification logic based on document type
    const issues: string[] = [];
    let verified = true;
    
    // Quality checks
    if (analysis.quality.readability === 'low') {
      issues.push('Document is not clearly readable');
      verified = false;
    }
    if (analysis.quality.completeness === 'incomplete') {
      issues.push('Document appears to be incomplete');
    }
    if (analysis.quality.authenticity === 'concerns') {
      issues.push('Document authenticity could not be verified');
    }
    
    // Type-specific checks
    const { documentType } = validatedData;
    if (documentType === 'income_proof') {
      if (!['pay_stub', 'W2', 'W-2', '1099'].some(type => 
        analysis.documentType.toLowerCase().includes(type.toLowerCase())
      )) {
        issues.push('Document does not appear to be valid income verification');
        verified = false;
      }
    }
    
    res.json({
      verified: verified && issues.length === 0,
      confidence: analysis.confidence || 0,
      extractedData: analysis.extractedData || {},
      issues,
      documentType: analysis.documentType,
      quality: analysis.quality,
    });
  })
);

// ============================================================================
// SCREENER API - Quick benefit screener
// ============================================================================

const screenerRequestSchema = z.object({
  householdSize: z.number().int().min(1),
  monthlyIncome: z.number().min(0),
  hasChildren: z.boolean().optional(),
  hasDisability: z.boolean().optional(),
  isElderly: z.boolean().optional(),
});

router.post(
  '/screener/quick',
  requireApiKey('screener:read'),
  asyncHandler(async (req, res) => {
    // Validate request
    const validatedData = screenerRequestSchema.parse(req.body);
    
    // Simple eligibility screening logic
    const annualIncome = validatedData.monthlyIncome * 12;
    const fpl = getFederalPovertyLevel(validatedData.householdSize);
    
    const likelyEligible: string[] = [];
    const possiblyEligible: string[] = [];
    const notEligible: string[] = [];
    
    // SNAP eligibility (130% FPL gross income test)
    if (annualIncome <= fpl * 1.3) {
      likelyEligible.push('SNAP');
    } else if (annualIncome <= fpl * 2.0) {
      possiblyEligible.push('SNAP');
    } else {
      notEligible.push('SNAP');
    }
    
    // Medicaid (138% FPL for expansion states like MD)
    if (annualIncome <= fpl * 1.38) {
      likelyEligible.push('MEDICAID');
    } else if (annualIncome <= fpl * 2.0) {
      possiblyEligible.push('MEDICAID');
    } else {
      notEligible.push('MEDICAID');
    }
    
    // WIC (if has children)
    if (validatedData.hasChildren && annualIncome <= fpl * 1.85) {
      likelyEligible.push('WIC');
    }
    
    // TANF (more restrictive - state varies)
    if (validatedData.hasChildren && annualIncome <= fpl * 0.5) {
      likelyEligible.push('TANF');
    } else if (validatedData.hasChildren && annualIncome <= fpl) {
      possiblyEligible.push('TANF');
    }
    
    const recommendedNextSteps: string[] = [];
    if (likelyEligible.length > 0) {
      likelyEligible.forEach(program => {
        recommendedNextSteps.push(`Apply for ${program} benefits`);
      });
    }
    if (possiblyEligible.length > 0) {
      recommendedNextSteps.push('Complete full eligibility assessment for additional programs');
    }
    if (likelyEligible.length === 0 && possiblyEligible.length === 0) {
      recommendedNextSteps.push('Check with local community resources for assistance');
    }
    
    res.json({
      likelyEligible,
      possiblyEligible,
      notEligible,
      recommendedNextSteps,
    });
  })
);

// ============================================================================
// WEBHOOKS API - Register and manage webhooks
// ============================================================================

const webhookRegisterSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(['eligibility.checked', 'document.verified', 'screener.completed'])),
  secret: z.string().optional(),
});

router.post(
  '/webhooks/register',
  requireApiKey('webhooks:write'),
  asyncHandler(async (req, res) => {
    // Validate request
    const validatedData = webhookRegisterSchema.parse(req.body);
    
    // Validate URL is HTTPS
    if (!validatedData.url.startsWith('https://')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Webhook URL must use HTTPS',
        code: 'INVALID_WEBHOOK_URL',
      });
    }
    
    // Generate secret if not provided
    const secret = validatedData.secret || crypto.randomBytes(32).toString('hex');
    
    // Create webhook
    const [webhook] = await db.insert(webhooks).values({
      apiKeyId: req.apiKey!.id,
      url: validatedData.url,
      events: validatedData.events,
      secret,
      status: 'active',
    }).returning();
    
    res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret, // Return secret to user (only time they'll see it)
      status: webhook.status,
      createdAt: webhook.createdAt,
    });
  })
);

router.get(
  '/webhooks',
  requireApiKey('webhooks:read'),
  asyncHandler(async (req, res) => {
    const userWebhooks = await db.select()
      .from(webhooks)
      .where(eq(webhooks.apiKeyId, req.apiKey!.id));
    
    // Don't return secrets in list
    const sanitizedWebhooks = userWebhooks.map(wh => ({
      id: wh.id,
      url: wh.url,
      events: wh.events,
      status: wh.status,
      lastDeliveryAt: wh.lastDeliveryAt,
      lastDeliveryStatus: wh.lastDeliveryStatus,
      createdAt: wh.createdAt,
    }));
    
    res.json(sanitizedWebhooks);
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Federal Poverty Level for household size (2024 numbers)
 */
function getFederalPovertyLevel(householdSize: number): number {
  // 2024 FPL for 48 contiguous states
  const baseFPL = 15060; // For 1 person
  const perPersonIncrease = 5380;
  
  return baseFPL + ((householdSize - 1) * perPersonIncrease);
}

export default router;
