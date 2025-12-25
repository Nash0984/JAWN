import { storage } from '../storage';
import type { User } from '../../shared/schema';

/**
 * VITA Certification Validation Service
 * 
 * Enforces IRS VITA program certification requirements for tax return review
 * Ensures reviewers have appropriate certification level for return complexity
 * 
 * IRS VITA Certification Levels:
 * - Basic: Standard tax returns (W-2 income, standard deduction, basic credits)
 * - Advanced: Complex returns (Schedule C, rental income, itemized deductions, education credits)
 * - Military: Military-specific tax situations
 */

export interface TaxReturnComplexity {
  requiresAdvanced: boolean;
  requiresMilitary: boolean;
  complexityFactors: string[];
  minimumCertification: 'basic' | 'advanced' | 'military';
}

export interface CertificationValidationResult {
  isValid: boolean;
  reviewerCertification: string | null;
  requiredCertification: string;
  certificationExpired: boolean;
  errorMessage?: string;
  warnings?: string[];
}

class VitaCertificationValidationService {
  
  /**
   * Determine minimum certification level required for a tax return
   */
  determineCertificationRequirement(taxReturnData: any): TaxReturnComplexity {
    const complexityFactors: string[] = [];
    let requiresAdvanced = false;
    let requiresMilitary = false;
    
    // Check for advanced certification triggers
    if (taxReturnData.hasSelfEmploymentIncome || taxReturnData.hasScheduleC) {
      complexityFactors.push('Self-employment income (Schedule C)');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.hasRentalIncome || taxReturnData.hasScheduleE) {
      complexityFactors.push('Rental income (Schedule E)');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.hasCapitalGains || taxReturnData.hasScheduleD) {
      complexityFactors.push('Capital gains/losses (Schedule D)');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.hasEducationCredits || taxReturnData.hasForm8863) {
      complexityFactors.push('Education credits (Form 8863)');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.hasStudentLoanInterest || taxReturnData.hasForm1098E) {
      complexityFactors.push('Student loan interest deduction');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.hasRetirementContributions || taxReturnData.hasForm5498) {
      complexityFactors.push('Retirement contributions (IRA, 401k)');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.itemizesDeductions || taxReturnData.hasScheduleA) {
      complexityFactors.push('Itemized deductions (Schedule A)');
      requiresAdvanced = true;
    }
    
    if (taxReturnData.hasForeignIncome || taxReturnData.hasForm2555) {
      complexityFactors.push('Foreign income (Form 2555)');
      requiresAdvanced = true;
    }
    
    // Check for military certification requirement
    if (taxReturnData.isMilitaryFiler || taxReturnData.hasMilitaryIncome) {
      complexityFactors.push('Military income or tax situation');
      requiresMilitary = true;
    }
    
    // Determine minimum certification
    let minimumCertification: 'basic' | 'advanced' | 'military' = 'basic';
    
    if (requiresMilitary) {
      minimumCertification = 'military';
    } else if (requiresAdvanced) {
      minimumCertification = 'advanced';
    }
    
    return {
      requiresAdvanced,
      requiresMilitary,
      complexityFactors,
      minimumCertification,
    };
  }
  
  /**
   * Check if reviewer's certification level is sufficient
   */
  isCertificationSufficient(
    reviewerLevel: string | null | undefined,
    requiredLevel: 'basic' | 'advanced' | 'military'
  ): boolean {
    if (!reviewerLevel) return false;
    
    // Certification hierarchy
    const certificationHierarchy: Record<string, number> = {
      'none': 0,
      'basic': 1,
      'advanced': 2,
      'military': 2, // Military is equivalent to advanced in hierarchy
    };
    
    const reviewerRank = certificationHierarchy[reviewerLevel.toLowerCase()] || 0;
    const requiredRank = certificationHierarchy[requiredLevel.toLowerCase()] || 0;
    
    // Special case: military returns require military certification specifically
    if (requiredLevel === 'military' && reviewerLevel.toLowerCase() !== 'military') {
      return false;
    }
    
    return reviewerRank >= requiredRank;
  }
  
  /**
   * Check if certification is expired
   */
  isCertificationExpired(expiryDate: Date | null | undefined): boolean {
    if (!expiryDate) return true;
    
    const now = new Date();
    return now > expiryDate;
  }
  
  /**
   * Validate reviewer's certification against tax return requirements
   */
  async validateReviewerCertification(
    reviewerId: string,
    taxReturnData: any
  ): Promise<CertificationValidationResult> {
    
    // Get reviewer information
    const reviewer = await storage.getUser(reviewerId);
    
    if (!reviewer) {
      return {
        isValid: false,
        reviewerCertification: null,
        requiredCertification: 'unknown',
        certificationExpired: true,
        errorMessage: 'Reviewer not found',
      };
    }
    
    // Determine required certification
    const complexity = this.determineCertificationRequirement(taxReturnData);
    
    // Check certification level
    const certificationLevel = reviewer.vitaCertificationLevel;
    const certificationExpiry = reviewer.vitaCertificationExpiry;
    
    // Check if certification is expired
    const isExpired = this.isCertificationExpired(certificationExpiry);
    
    // Check if certification level is sufficient
    const isSufficient = this.isCertificationSufficient(
      certificationLevel,
      complexity.minimumCertification
    );
    
    const warnings: string[] = [];
    let errorMessage: string | undefined;
    
    // Build validation result
    if (isExpired) {
      errorMessage = `Reviewer's VITA certification expired on ${certificationExpiry?.toLocaleDateString() || 'unknown date'}. Please renew certification before reviewing tax returns.`;
    } else if (!isSufficient) {
      const complexityList = complexity.complexityFactors.join(', ');
      errorMessage = `This tax return requires ${complexity.minimumCertification.toUpperCase()} certification due to: ${complexityList}. Reviewer has ${certificationLevel || 'no'} certification.`;
    }
    
    // Add warnings for approaching expiration
    if (!isExpired && certificationExpiry) {
      const daysUntilExpiry = Math.ceil(
        (certificationExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilExpiry <= 30) {
        warnings.push(`Certification expires in ${daysUntilExpiry} days on ${certificationExpiry.toLocaleDateString()}`);
      }
    }
    
    return {
      isValid: !isExpired && isSufficient,
      reviewerCertification: certificationLevel,
      requiredCertification: complexity.minimumCertification,
      certificationExpired: isExpired,
      errorMessage,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  
  /**
   * Get certification status for a user
   */
  async getCertificationStatus(userId: string): Promise<{
    hasCertification: boolean;
    level: string | null;
    isExpired: boolean;
    expiryDate: Date | null;
    daysUntilExpiry: number | null;
  }> {
    const user = await storage.getUser(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const hasCertification = !!user.vitaCertificationLevel && user.vitaCertificationLevel !== 'none';
    const isExpired = this.isCertificationExpired(user.vitaCertificationExpiry);
    
    let daysUntilExpiry: number | null = null;
    if (user.vitaCertificationExpiry && !isExpired) {
      daysUntilExpiry = Math.ceil(
        (user.vitaCertificationExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    }
    
    return {
      hasCertification,
      level: user.vitaCertificationLevel,
      isExpired,
      expiryDate: user.vitaCertificationExpiry,
      daysUntilExpiry,
    };
  }
  
  /**
   * Update user's VITA certification
   */
  async updateCertification(
    userId: string,
    certificationData: {
      level: 'basic' | 'advanced' | 'military' | 'none';
      certificationDate: Date;
      expiryDate: Date;
      certificationNumber?: string;
    }
  ): Promise<void> {
    await storage.updateUser(userId, {
      vitaCertificationLevel: certificationData.level,
      vitaCertificationDate: certificationData.certificationDate,
      vitaCertificationExpiry: certificationData.expiryDate,
      vitaCertificationNumber: certificationData.certificationNumber,
    });
  }
  
  /**
   * Get all users with expiring certifications (within specified days)
   */
  async getUsersWithExpiringCertifications(daysThreshold: number = 30): Promise<User[]> {
    const users = await storage.getUsers();
    const now = Date.now();
    const threshold = now + (daysThreshold * 24 * 60 * 60 * 1000);
    
    return users.filter(user => {
      if (!user.vitaCertificationExpiry || !user.vitaCertificationLevel) {
        return false;
      }
      
      const expiryTime = user.vitaCertificationExpiry.getTime();
      return expiryTime > now && expiryTime <= threshold;
    });
  }
}

export const vitaCertificationValidationService = new VitaCertificationValidationService();
