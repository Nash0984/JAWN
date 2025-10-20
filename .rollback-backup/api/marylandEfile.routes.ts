import express from 'express';
import { db } from '../db';
import { marylandTaxReturns, federalTaxReturns, efileSubmissionLogs, countyTaxRates } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { marylandIFileClient } from '../services/marylandIFileClient';
import { marylandEFileQueueService } from '../services/marylandEFileQueueService';
import { Form502Generator } from '../services/form502Generator';
import { Form502XmlGenerator } from '../services/form502XmlGenerator';
import type { MarylandSubmissionRequest } from '../services/marylandIFileClient';
import { z } from 'zod';

const router = express.Router();

const form502Generator = new Form502Generator();
const form502XmlGenerator = new Form502XmlGenerator();

/**
 * Maryland E-File API Routes
 * 
 * Comprehensive API for Maryland Form 502 electronic filing with:
 * - Submission management with queue integration
 * - Status tracking and acknowledgment processing
 * - County tax rate lookup and validation
 * - Mock mode for testing without credentials
 */

// Validation schemas
const submitValidationSchema = z.object({
  returnId: z.string().uuid(),
  priority: z.number().min(0).max(5).optional(),
  requiresFederalAcceptance: z.boolean().optional(),
  notifyOnStatusChange: z.boolean().optional(),
  validateCountyTax: z.boolean().optional(),
});

const validateReturnSchema = z.object({
  returnId: z.string().uuid(),
  validateCountyTax: z.boolean().optional().default(true),
  validateCredits: z.boolean().optional().default(true),
  validateResidency: z.boolean().optional().default(true),
});

// ============================================================================
// POST /api/maryland/efile/submit/{returnId}
// Submit Maryland Form 502 to e-file queue
// ============================================================================
router.post('/submit/:returnId', requireAuth, async (req, res) => {
  try {
    const { returnId } = req.params;
    const validationResult = submitValidationSchema.safeParse({ returnId, ...req.body });
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validationResult.error.errors
      });
    }
    
    const { priority, requiresFederalAcceptance, notifyOnStatusChange, validateCountyTax } = validationResult.data;
    
    // Check if Maryland return exists
    const [marylandReturn] = await db
      .select()
      .from(marylandTaxReturns)
      .where(eq(marylandTaxReturns.id, returnId))
      .limit(1);
    
    if (!marylandReturn) {
      return res.status(404).json({
        success: false,
        error: 'Maryland tax return not found'
      });
    }
    
    // Check authorization
    if (marylandReturn.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to submit this return'
      });
    }
    
    // Submit to queue
    const result = await marylandEFileQueueService.submitToQueue(returnId, {
      priority,
      requiresFederalAcceptance,
      notifyOnStatusChange,
      validateCountyTax,
    });
    
    // Log submission attempt
    await db.insert(efileSubmissionLogs).values({
      marylandReturnId: returnId,
      returnType: 'maryland',
      action: 'submitted',
      actionDetails: result,
      submittedBy: req.user!.id,
      isMockSubmission: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    
    res.json({
      success: result.success,
      message: result.message,
      queuePosition: result.queuePosition,
      requiresFederalFirst: result.requiresFederalFirst,
      submissionId: marylandReturn.ifileTransmissionId,
    });
    
  } catch (error) {
    console.error('Maryland submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit Maryland return',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// GET /api/maryland/efile/status/{returnId}
// Get Maryland submission status
// ============================================================================
router.get('/status/:returnId', requireAuth, async (req, res) => {
  try {
    const { returnId } = req.params;
    
    // Get Maryland return
    const [marylandReturn] = await db
      .select()
      .from(marylandTaxReturns)
      .where(eq(marylandTaxReturns.id, returnId))
      .limit(1);
    
    if (!marylandReturn) {
      return res.status(404).json({
        success: false,
        error: 'Maryland tax return not found'
      });
    }
    
    // Check authorization
    if (marylandReturn.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this return'
      });
    }
    
    // Get submission logs
    const logs = await db
      .select()
      .from(efileSubmissionLogs)
      .where(eq(efileSubmissionLogs.marylandReturnId, returnId))
      .orderBy(desc(efileSubmissionLogs.createdAt))
      .limit(10);
    
    // Get federal return status if linked
    let federalStatus = null;
    if (marylandReturn.federalReturnId) {
      const [federalReturn] = await db
        .select({
          efileStatus: federalTaxReturns.efileStatus,
          dcnNumber: federalTaxReturns.dcnNumber,
          acceptedAt: federalTaxReturns.acceptedAt,
        })
        .from(federalTaxReturns)
        .where(eq(federalTaxReturns.id, marylandReturn.federalReturnId))
        .limit(1);
      
      federalStatus = federalReturn;
    }
    
    // Check if submission is in progress
    let queuePosition = null;
    if (marylandReturn.queueStatus === 'queued' || marylandReturn.queueStatus === 'processing') {
      const queueStats = await marylandEFileQueueService.getQueueStats();
      queuePosition = queueStats.queued + queueStats.processing;
    }
    
    res.json({
      success: true,
      status: {
        returnId: marylandReturn.id,
        taxYear: marylandReturn.taxYear,
        efileStatus: marylandReturn.efileStatus,
        marylandSubmissionStatus: marylandReturn.marylandSubmissionStatus,
        queueStatus: marylandReturn.queueStatus,
        queuePosition,
        
        // Confirmation numbers
        marylandConfirmationNumber: marylandReturn.marylandConfirmationNumber,
        ifileTransmissionId: marylandReturn.ifileTransmissionId,
        
        // County info
        countyCode: marylandReturn.countyCode,
        countyName: marylandReturn.countyName,
        localTaxAmount: marylandReturn.localTaxAmount,
        
        // Submission tracking
        submissionAttempts: marylandReturn.submissionAttempts,
        lastSubmissionAt: marylandReturn.lastSubmissionAt,
        nextRetryAt: marylandReturn.nextRetryAt,
        
        // Timestamps
        createdAt: marylandReturn.createdAt,
        transmittedAt: marylandReturn.transmittedAt,
        acceptedAt: marylandReturn.acceptedAt,
        rejectedAt: marylandReturn.rejectedAt,
        
        // Errors/rejections
        rejectionCode: marylandReturn.rejectionCode,
        rejectionReason: marylandReturn.rejectionReason,
        lastError: marylandReturn.lastError,
        validationErrors: marylandReturn.validationErrors,
        
        // Federal status if linked
        federalStatus,
      },
      submissionLogs: logs.map(log => ({
        action: log.action,
        details: log.actionDetails,
        errorType: log.errorType,
        errorMessage: log.errorMessage,
        timestamp: log.createdAt,
      })),
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// GET /api/maryland/counties
// Get list of Maryland counties with current tax rates
// ============================================================================
router.get('/counties', async (req, res) => {
  try {
    const taxYear = parseInt(req.query.taxYear as string) || new Date().getFullYear();
    
    // Get county tax rates from client (includes all 24 counties)
    const counties = marylandIFileClient.getCountiesWithRates();
    
    // Try to get rates from database if available
    const dbRates = await db
      .select()
      .from(countyTaxRates)
      .where(and(
        eq(countyTaxRates.taxYear, taxYear),
        eq(countyTaxRates.state, 'MD')
      ));
    
    // Merge database rates with hardcoded rates
    const mergedCounties = counties.map(county => {
      const dbRate = dbRates.find(r => r.countyCode === county.code);
      return {
        ...county,
        taxYear,
        rate: dbRate ? dbRate.rate : county.rate,
        effectiveRate: dbRate ? dbRate.rate : county.rate,
        source: dbRate ? 'database' : 'hardcoded',
      };
    });
    
    res.json({
      success: true,
      taxYear,
      counties: mergedCounties.sort((a, b) => a.name.localeCompare(b.name)),
      summary: {
        totalCounties: mergedCounties.length,
        highestRate: Math.max(...mergedCounties.map(c => c.rate)),
        lowestRate: Math.min(...mergedCounties.map(c => c.rate)),
        averageRate: mergedCounties.reduce((sum, c) => sum + c.rate, 0) / mergedCounties.length,
        specialDistricts: mergedCounties.filter(c => c.isSpecialDistrict).map(c => c.name),
      }
    });
    
  } catch (error) {
    console.error('County lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve county tax rates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// POST /api/maryland/efile/validate/{returnId}
// Validate Maryland return before submission
// ============================================================================
router.post('/validate/:returnId', requireAuth, async (req, res) => {
  try {
    const { returnId } = req.params;
    const validationResult = validateReturnSchema.safeParse({ returnId, ...req.body });
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validationResult.error.errors
      });
    }
    
    const { validateCountyTax, validateCredits, validateResidency } = validationResult.data;
    
    // Get Maryland return
    const [marylandReturn] = await db
      .select()
      .from(marylandTaxReturns)
      .where(eq(marylandTaxReturns.id, returnId))
      .limit(1);
    
    if (!marylandReturn) {
      return res.status(404).json({
        success: false,
        error: 'Maryland tax return not found'
      });
    }
    
    // Check authorization
    if (marylandReturn.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to validate this return'
      });
    }
    
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    
    // Validate required fields
    if (!marylandReturn.personalInfo) {
      errors.push({ field: 'personalInfo', message: 'Personal information is required', severity: 'error' });
    }
    
    if (!marylandReturn.countyCode) {
      errors.push({ field: 'countyCode', message: 'County code is required', severity: 'error' });
    }
    
    // Validate county tax if requested
    if (validateCountyTax && marylandReturn.countyCode) {
      const countyValidation = await marylandIFileClient.validateCountyTax(
        marylandReturn.countyCode,
        marylandReturn.marylandTaxableIncome || 0,
        marylandReturn.localTaxAmount || 0
      );
      
      if (!countyValidation.isValid) {
        countyValidation.errors?.forEach(err => {
          errors.push({ field: 'countyTax', message: err, severity: 'error' });
        });
      }
    }
    
    // Validate Maryland credits if requested
    if (validateCredits) {
      const marylandTaxResult = marylandReturn.marylandTaxResult as any;
      
      if (marylandTaxResult) {
        // Check EITC
        if (marylandTaxResult.marylandEITC && marylandTaxResult.marylandEITC < 0) {
          errors.push({ field: 'marylandEITC', message: 'Maryland EITC cannot be negative', severity: 'error' });
        }
        
        // Check poverty level credit
        if (marylandTaxResult.povertyLevelCredit && marylandTaxResult.povertyLevelCredit > 300) {
          warnings.push({ field: 'povertyLevelCredit', message: 'Poverty level credit seems unusually high' });
        }
        
        // Check property tax credit
        if (marylandTaxResult.propertyTaxCredit && marylandTaxResult.propertyTaxCredit > 1500) {
          warnings.push({ field: 'propertyTaxCredit', message: 'Property tax credit exceeds typical limits' });
        }
      }
    }
    
    // Validate residency if requested
    if (validateResidency) {
      const personalInfo = marylandReturn.personalInfo as any;
      
      if (personalInfo && !personalInfo.marylandResident) {
        warnings.push({ 
          field: 'residency', 
          message: 'Non-residents may need to file Form 502B instead of Form 502' 
        });
      }
    }
    
    // Update validation status in database
    const validationStatus = errors.filter(e => e.severity === 'error').length > 0 ? 'invalid' : 'valid';
    
    await db
      .update(marylandTaxReturns)
      .set({
        validationErrors: errors.length > 0 ? errors : null,
        validationStatus,
        validatedAt: new Date(),
      })
      .where(eq(marylandTaxReturns.id, returnId));
    
    res.json({
      success: true,
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      validationStatus,
      errors: errors.filter(e => e.severity === 'error'),
      warnings: [...errors.filter(e => e.severity === 'warning'), ...warnings],
      validatedAt: new Date(),
      summary: {
        totalErrors: errors.filter(e => e.severity === 'error').length,
        totalWarnings: errors.filter(e => e.severity === 'warning').length + warnings.length,
        validatedFields: {
          countyTax: validateCountyTax,
          credits: validateCredits,
          residency: validateResidency,
        }
      }
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate return',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// GET /api/maryland/efile/queue/stats
// Get Maryland e-file queue statistics
// ============================================================================
router.get('/queue/stats', requireAuth, async (req, res) => {
  try {
    // Check if user is admin or supervisor
    if (!['admin', 'super_admin', 'supervisor'].includes(req.user!.role)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view queue statistics'
      });
    }
    
    const stats = await marylandEFileQueueService.getQueueStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date(),
    });
    
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve queue statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// POST /api/maryland/efile/mock-ack/{returnId}
// Simulate Maryland acknowledgment (for testing)
// ============================================================================
router.post('/mock-ack/:returnId', requireAuth, async (req, res) => {
  try {
    // Only allow in development or for admins
    if (process.env.NODE_ENV === 'production' && req.user!.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Mock acknowledgments not allowed in production'
      });
    }
    
    const { returnId } = req.params;
    const { status = 'accepted', rejectionCode, rejectionReason } = req.body;
    
    // Get Maryland return
    const [marylandReturn] = await db
      .select()
      .from(marylandTaxReturns)
      .where(eq(marylandTaxReturns.id, returnId))
      .limit(1);
    
    if (!marylandReturn) {
      return res.status(404).json({
        success: false,
        error: 'Maryland tax return not found'
      });
    }
    
    // Generate mock acknowledgment
    const mockAck = {
      submissionId: marylandReturn.ifileTransmissionId || `MD-MOCK-${Date.now()}`,
      marylandConfirmationNumber: `MCF${Date.now()}`,
      status,
      processedTimestamp: new Date(),
      countyValidation: {
        countyCode: marylandReturn.countyCode,
        countyName: marylandReturn.countyName,
        taxRateApplied: 0.032,
        validationStatus: 'valid'
      }
    };
    
    // Update return based on acknowledgment
    const updates: any = {
      acknowledgmentData: mockAck,
      acknowledgmentReceivedAt: new Date(),
    };
    
    if (status === 'accepted') {
      updates.efileStatus = 'accepted';
      updates.marylandSubmissionStatus = 'accepted';
      updates.marylandConfirmationNumber = mockAck.marylandConfirmationNumber;
      updates.acceptedAt = new Date();
    } else if (status === 'rejected') {
      updates.efileStatus = 'rejected';
      updates.marylandSubmissionStatus = 'rejected';
      updates.rejectionCode = rejectionCode || 'MOCK-REJ';
      updates.rejectionReason = rejectionReason || 'Mock rejection for testing';
      updates.rejectedAt = new Date();
    }
    
    await db
      .update(marylandTaxReturns)
      .set(updates)
      .where(eq(marylandTaxReturns.id, returnId));
    
    // Log the mock acknowledgment
    await db.insert(efileSubmissionLogs).values({
      marylandReturnId: returnId,
      returnType: 'maryland',
      action: status === 'accepted' ? 'accepted' : 'rejected',
      actionDetails: mockAck,
      responseData: mockAck,
      isMockSubmission: true,
      submittedBy: req.user!.id,
    });
    
    res.json({
      success: true,
      message: `Mock ${status} acknowledgment generated`,
      acknowledgment: mockAck,
    });
    
  } catch (error) {
    console.error('Mock acknowledgment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mock acknowledgment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;