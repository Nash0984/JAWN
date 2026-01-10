/**
 * Payment Error Reduction (PER) Module
 * 
 * SNAP Payment Error Rate Reduction per Arnold Ventures/MD DHS Blueprint
 * 
 * This module provides comprehensive payment error prevention including:
 * - Income verification against W-2/wage data
 * - Pre-submission consistency checks
 * - Duplicate claim detection
 * - Explainable AI nudges for caseworkers
 * - PERM sampling and FNS reporting
 */

export { incomeVerificationService, type WageDataRecord, type IncomeDiscrepancy, type VerificationResult } from './incomeVerification.service';
export { preSubmissionValidatorService, type ValidationCheck, type ValidationResult, type CheckType } from './preSubmissionValidator.service';
export { duplicateClaimDetectorService, type PersonIdentifier, type DuplicateMatch, type DuplicateScanResult } from './duplicateClaimDetector.service';
export { explainableNudgeService, type CaseworkerNudge, type NudgeType, type RiskFactor, type NudgeGenerationResult } from './explainableNudge.service';
export { permReportingService, type PermSampleSelection, type PermReviewFinding, type PermRateReport } from './permReporting.service';
export { paymentErrorReductionService, type CaseRiskAssessment, type PerDashboardMetrics, type PerSystemHealth } from './paymentErrorReduction.service';
