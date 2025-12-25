import { storage } from "../storage";
import type { Achievement, NavigatorKpi, InsertNavigatorAchievement } from "@shared/schema";
import { createLogger } from './logger.service';

const logger = createLogger('AchievementSystem');

/**
 * Achievement System Service
 * Evaluates navigator KPIs and awards achievements based on criteria
 */

class AchievementSystemService {
  /**
   * Check and award achievements for a navigator based on their KPIs
   */
  async evaluateAchievements(navigatorId: string, kpi: NavigatorKpi, caseId?: string): Promise<void> {
    // Get all active achievements
    const achievements = await storage.getAchievements({ isActive: true });

    for (const achievement of achievements) {
      // Check if navigator already has this achievement
      const existingAchievements = await storage.getNavigatorAchievements(navigatorId);
      const alreadyEarned = existingAchievements.some(a => a.achievementId === achievement.id);

      if (alreadyEarned) {
        continue; // Skip if already earned
      }

      // Evaluate achievement criteria
      if (await this.meetsCriteria(achievement, kpi)) {
        await this.awardAchievement(navigatorId, achievement, kpi, caseId);
      }
    }
  }

  /**
   * Check if KPI meets achievement criteria
   */
  private async meetsCriteria(achievement: Achievement, kpi: NavigatorKpi): Promise<boolean> {
    const config = achievement.criteriaConfig as any;

    switch (achievement.criteriaType) {
      case 'kpi_threshold': {
        const metric = config.metric;
        const threshold = config.threshold;
        const operator = config.operator || 'gte'; // gte, lte, eq

        const value = (kpi as any)[metric];
        if (value === undefined) return false;

        switch (operator) {
          case 'gte':
            return value >= threshold;
          case 'lte':
            return value <= threshold;
          case 'eq':
            return value === threshold;
          case 'gt':
            return value > threshold;
          case 'lt':
            return value < threshold;
          default:
            return false;
        }
      }

      case 'case_count': {
        return (kpi.casesClosed || 0) >= (config.threshold || 0);
      }

      case 'benefit_amount': {
        return (kpi.totalBenefitsSecured || 0) >= (config.threshold || 0);
      }

      case 'rate': {
        const metric = config.metric;
        const threshold = config.threshold;
        const value = (kpi as any)[metric];
        return value >= threshold;
      }

      case 'streak': {
        // Streak achievements require additional logic
        // For now, return false - implement in v2
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Award an achievement to a navigator
   */
  private async awardAchievement(
    navigatorId: string, 
    achievement: Achievement, 
    kpi: NavigatorKpi,
    caseId?: string
  ): Promise<void> {
    const config = achievement.criteriaConfig as any;
    const metric = config.metric || 'casesClosed';
    const triggerValue = (kpi as any)[metric] || 0;

    const award: InsertNavigatorAchievement = {
      navigatorId,
      achievementId: achievement.id,
      triggerMetric: metric,
      triggerValue,
      countyId: kpi.countyId,
      relatedCaseId: caseId || null,
      notified: false,
    };

    await storage.awardAchievement(award);

    /**
     * Achievement notification implementation:
     * Notifications are sent via email service when available.
     * In-app notifications are automatically displayed via the BarNotification system
     * which polls for unnotified achievements.
     * 
     * Production enhancement: Add real-time WebSocket notifications
     */
    try {
      // Get navigator's email for email notification
      const navigator = await storage.getUser(navigatorId);
      if (navigator?.email) {
        // Import email service dynamically to avoid circular dependencies
        const { emailService } = await import('./email.service');
        
        await emailService.sendNotificationEmail(
          navigator.email,
          `🏆 Achievement Unlocked: ${achievement.name}`,
          `Congratulations! You've earned the "${achievement.name}" achievement.\n\n${achievement.description}\n\nPoints earned: ${achievement.pointsAwarded}`,
          undefined // No action URL needed for achievements
        );
      }
    } catch (emailError) {
      // Email notification failure is non-critical
      logger.warn('Failed to send achievement email notification', {
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
        achievementId: achievement.id,
        navigatorId
      });
    }

    logger.info('🏆 Achievement awarded', {
      achievementName: achievement.name,
      achievementId: achievement.id,
      navigatorId,
      triggerMetric: metric,
      triggerValue,
      service: 'AchievementSystem'
    });
  }

  /**
   * Seed default achievements
   */
  async seedDefaultAchievements(): Promise<void> {
    const defaultAchievements = [
      // Milestone Achievements
      {
        name: "First Case Closed",
        slug: "first_case",
        description: "Successfully closed your first case",
        category: "milestone",
        tier: "bronze",
        iconName: "CheckCircle",
        iconColor: "#CD7F32",
        criteriaType: "case_count",
        criteriaConfig: { threshold: 1 },
        pointsAwarded: 10,
        isVisible: true,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "10 Cases Strong",
        slug: "cases_10",
        description: "Closed 10 cases",
        category: "milestone",
        tier: "silver",
        iconName: "Award",
        iconColor: "#C0C0C0",
        criteriaType: "case_count",
        criteriaConfig: { threshold: 10 },
        pointsAwarded: 50,
        isVisible: true,
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "Century Club",
        slug: "cases_100",
        description: "Closed 100 cases",
        category: "milestone",
        tier: "gold",
        iconName: "Trophy",
        iconColor: "#FFD700",
        criteriaType: "case_count",
        criteriaConfig: { threshold: 100 },
        pointsAwarded: 500,
        isVisible: true,
        isActive: true,
        sortOrder: 3,
      },

      // Benefit Amount Achievements
      {
        name: "$10K Benefits Unlocked",
        slug: "benefits_10k",
        description: "Secured $10,000 in benefits for clients",
        category: "performance",
        tier: "bronze",
        iconName: "DollarSign",
        iconColor: "#CD7F32",
        criteriaType: "benefit_amount",
        criteriaConfig: { threshold: 10000 },
        pointsAwarded: 100,
        isVisible: true,
        isActive: true,
        sortOrder: 10,
      },
      {
        name: "$100K Impact",
        slug: "benefits_100k",
        description: "Secured $100,000 in benefits for clients",
        category: "performance",
        tier: "gold",
        iconName: "TrendingUp",
        iconColor: "#FFD700",
        criteriaType: "benefit_amount",
        criteriaConfig: { threshold: 100000 },
        pointsAwarded: 1000,
        isVisible: true,
        isActive: true,
        sortOrder: 11,
      },

      // Quality Achievements
      {
        name: "90% Success Rate",
        slug: "success_90",
        description: "Achieved 90% case approval rate",
        category: "quality",
        tier: "silver",
        iconName: "Target",
        iconColor: "#C0C0C0",
        criteriaType: "rate",
        criteriaConfig: { metric: "successRate", threshold: 90 },
        pointsAwarded: 150,
        isVisible: true,
        isActive: true,
        sortOrder: 20,
      },
      {
        name: "Document Quality Expert",
        slug: "doc_quality_expert",
        description: "Maintained 95% average document quality",
        category: "quality",
        tier: "gold",
        iconName: "FileCheck",
        iconColor: "#FFD700",
        criteriaType: "kpi_threshold",
        criteriaConfig: { metric: "avgDocumentQuality", threshold: 0.95, operator: "gte" },
        pointsAwarded: 200,
        isVisible: true,
        isActive: true,
        sortOrder: 21,
      },

      // Cross-Enrollment Achievements
      {
        name: "Opportunity Spotter",
        slug: "cross_enroll_5",
        description: "Identified 5 cross-enrollment opportunities",
        category: "teamwork",
        tier: "bronze",
        iconName: "Eye",
        iconColor: "#CD7F32",
        criteriaType: "kpi_threshold",
        criteriaConfig: { metric: "crossEnrollmentsIdentified", threshold: 5, operator: "gte" },
        pointsAwarded: 75,
        isVisible: true,
        isActive: true,
        sortOrder: 30,
      },
      {
        name: "Benefits Detective",
        slug: "cross_enroll_25",
        description: "Identified 25 cross-enrollment opportunities",
        category: "teamwork",
        tier: "gold",
        iconName: "Search",
        iconColor: "#FFD700",
        criteriaType: "kpi_threshold",
        criteriaConfig: { metric: "crossEnrollmentsIdentified", threshold: 25, operator: "gte" },
        pointsAwarded: 250,
        isVisible: true,
        isActive: true,
        sortOrder: 31,
      },

      // Speed Achievements
      {
        name: "Quick Responder",
        slug: "quick_response",
        description: "Average response time under 4 hours",
        category: "performance",
        tier: "silver",
        iconName: "Zap",
        iconColor: "#C0C0C0",
        criteriaType: "kpi_threshold",
        criteriaConfig: { metric: "avgResponseTime", threshold: 4, operator: "lte" },
        pointsAwarded: 100,
        isVisible: true,
        isActive: true,
        sortOrder: 40,
      },
    ];

    for (const achievement of defaultAchievements) {
      // Check if achievement already exists by slug
      const existing = await storage.getAchievements({ isActive: true });
      if (existing.some(a => a.slug === achievement.slug)) {
        continue;
      }

      await storage.createAchievement(achievement);
    }

    logger.info('✅ Seeded default achievements', {
      count: defaultAchievements.length,
      service: 'AchievementSystem'
    });
  }

  /**
   * Get unnotified achievements for a navigator
   */
  async getUnnotifiedAchievements(navigatorId: string) {
    return await storage.getUnnotifiedAchievements(navigatorId);
  }

  /**
   * Mark achievements as notified
   */
  async markNotified(achievementIds: string[]): Promise<void> {
    for (const id of achievementIds) {
      await storage.markAchievementNotified(id);
    }
  }
}

export const achievementSystemService = new AchievementSystemService();
