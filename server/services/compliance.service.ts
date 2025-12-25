import { generateTextWithGemini } from "./gemini.service";
import { storage } from "../storage";
import type { ComplianceRule, InsertComplianceViolation } from "@shared/schema";
import { logger } from './logger.service';

export interface ValidationContext {
  entityType: string;
  entityId: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  violations: Array<{
    ruleCode: string;
    ruleId: string;
    severity: string;
    violationType: string;
    detectedValue?: string;
    expectedValue?: string;
    aiAnalysis: string;
    confidenceScore: number;
  }>;
  summary: string;
}

class ComplianceService {
  /**
   * Validate content against a specific compliance rule
   */
  async validateAgainstRule(
    rule: ComplianceRule,
    context: ValidationContext
  ): Promise<ValidationResult["violations"][0] | null> {
    const prompt = `${rule.validationPrompt}

CONTENT TO VALIDATE:
${context.content}

${context.metadata ? `ADDITIONAL CONTEXT:\n${JSON.stringify(context.metadata, null, 2)}` : ''}

VALIDATION CRITERIA:
${rule.validationCriteria ? JSON.stringify(rule.validationCriteria, null, 2) : 'Use the validation prompt above'}

Analyze the content for compliance with this rule. Return JSON:
{
  "isViolation": true/false,
  "violationType": "content_mismatch" | "missing_data" | "invalid_calculation" | "process_deviation",
  "detectedValue": "what was found (if violation)",
  "expectedValue": "what was expected (if violation)",
  "analysis": "detailed explanation",
  "confidenceScore": 0.0-1.0
}`;

    try {
      let result = await generateTextWithGemini(prompt);
      
      // Strip code fences if present
      result = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Try to extract JSON from response text
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('No JSON found in Gemini response', { ruleCode: rule.ruleCode });
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.isViolation) {
        return {
          ruleCode: rule.ruleCode,
          ruleId: rule.id,
          severity: rule.severityLevel,
          violationType: parsed.violationType || 'content_mismatch',
          detectedValue: parsed.detectedValue,
          expectedValue: parsed.expectedValue,
          aiAnalysis: parsed.analysis || 'Violation detected',
          confidenceScore: parsed.confidenceScore || 0.5
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to validate against rule', { ruleCode: rule.ruleCode, error });
      return null;
    }
  }

  /**
   * Validate content against all applicable compliance rules
   */
  async validateContent(
    context: ValidationContext,
    filters?: { ruleType?: string; category?: string; benefitProgramId?: string }
  ): Promise<ValidationResult> {
    // Get applicable compliance rules
    const rules = await storage.getComplianceRules({
      ...filters,
      isActive: true
    });

    if (rules.length === 0) {
      return {
        isValid: true,
        violations: [],
        summary: "No applicable compliance rules found."
      };
    }

    // Validate against each rule
    const violations: ValidationResult["violations"] = [];
    
    for (const rule of rules) {
      const violation = await this.validateAgainstRule(rule, context);
      if (violation) {
        violations.push(violation);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      summary: violations.length === 0
        ? `Content complies with all ${rules.length} applicable rules.`
        : `Found ${violations.length} violation(s) across ${rules.length} rules checked.`
    };
  }

  /**
   * Create a compliance violation record
   */
  async recordViolation(
    violation: ValidationResult["violations"][0],
    context: ValidationContext,
    detectedBy?: string
  ) {
    const violationRecord: InsertComplianceViolation = {
      complianceRuleId: violation.ruleId,
      violationType: violation.violationType,
      severity: violation.severity,
      entityType: context.entityType,
      entityId: context.entityId,
      violationContext: {
        content: context.content,
        metadata: context.metadata
      },
      detectedValue: violation.detectedValue,
      expectedValue: violation.expectedValue,
      aiAnalysis: violation.aiAnalysis,
      confidenceScore: violation.confidenceScore,
      status: "open",
      detectedBy: detectedBy || 'system',
      detectedAt: new Date()
    };

    return await storage.createComplianceViolation(violationRecord);
  }

  /**
   * Validate and record violations for content
   */
  async validateAndRecord(
    context: ValidationContext,
    filters?: { ruleType?: string; category?: string; benefitProgramId?: string },
    detectedBy?: string
  ): Promise<ValidationResult> {
    const result = await this.validateContent(context, filters);

    // Record all violations
    for (const violation of result.violations) {
      await this.recordViolation(violation, context, detectedBy);
    }

    return result;
  }

  /**
   * Validate policy content for compliance
   */
  async validatePolicyContent(
    policyText: string,
    sectionNumber: string,
    benefitProgramId: string
  ): Promise<ValidationResult> {
    return await this.validateContent(
      {
        entityType: "policy_content",
        entityId: sectionNumber,
        content: policyText,
        metadata: { sectionNumber, benefitProgramId }
      },
      {
        ruleType: "policy_content",
        benefitProgramId
      }
    );
  }

  /**
   * Validate rules extraction for compliance
   */
  async validateRulesExtraction(
    extractedRules: any,
    documentId: string,
    benefitProgramId: string
  ): Promise<ValidationResult> {
    return await this.validateContent(
      {
        entityType: "rule_extraction",
        entityId: documentId,
        content: JSON.stringify(extractedRules, null, 2),
        metadata: { documentId, benefitProgramId }
      },
      {
        ruleType: "data_quality",
        benefitProgramId
      }
    );
  }

  /**
   * Validate user input for compliance
   */
  async validateUserInput(
    inputData: any,
    inputType: string,
    benefitProgramId: string
  ): Promise<ValidationResult> {
    return await this.validateContent(
      {
        entityType: "user_input",
        entityId: inputType,
        content: JSON.stringify(inputData, null, 2),
        metadata: { inputType, benefitProgramId }
      },
      {
        ruleType: "process_compliance",
        benefitProgramId
      }
    );
  }

  /**
   * Get compliance violations with optional filters
   */
  async getViolations(filters?: {
    complianceRuleId?: string;
    status?: string;
    severity?: string;
    entityType?: string;
  }) {
    return await storage.getComplianceViolations(filters);
  }

  /**
   * Acknowledge a violation
   */
  async acknowledgeViolation(violationId: string, acknowledgedBy: string) {
    return await storage.updateComplianceViolation(violationId, {
      status: "acknowledged",
      acknowledgedBy,
      acknowledgedAt: new Date()
    });
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(
    violationId: string,
    resolution: string,
    resolvedBy: string
  ) {
    return await storage.updateComplianceViolation(violationId, {
      status: "resolved",
      resolution,
      resolvedBy,
      resolvedAt: new Date()
    });
  }

  /**
   * Dismiss a violation (false positive)
   */
  async dismissViolation(
    violationId: string,
    resolution: string,
    resolvedBy: string
  ) {
    return await storage.updateComplianceViolation(violationId, {
      status: "dismissed",
      resolution,
      resolvedBy,
      resolvedAt: new Date()
    });
  }
}

export const complianceService = new ComplianceService();
