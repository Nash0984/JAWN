import { storage } from "../storage";
import type { InsertLeaderboard, Leaderboard } from "@shared/schema";
import { createLogger } from './logger.service';

const logger = createLogger('Leaderboard');

/**
 * Leaderboard Service
 * Generates and caches leaderboard rankings for navigators
 */

interface LeaderboardEntry {
  rank: number;
  navigatorId: string;
  navigatorName: string;
  value: number;
  countyName?: string;
  countyId?: string;
  // Full KPI breakdown for UI display
  casesClosed: number;
  totalBenefitsSecured: number;
  successRate: number;
  avgResponseTime: number;
  performanceScore: number;
}

class LeaderboardService {
  /**
   * Generate leaderboard for a specific metric and period
   */
  async generateLeaderboard(
    leaderboardType: 'cases_closed' | 'benefits_amount' | 'success_rate' | 'performance_score',
    scope: 'county' | 'statewide',
    periodType: 'daily' | 'weekly' | 'monthly' | 'all_time',
    countyId?: string
  ): Promise<Leaderboard> {
    const { periodStart, periodEnd } = this.getPeriodBounds(periodType);

    // Get KPIs for the period
    // Note: This would need a more efficient query in production
    // For now, we'll need to add a method to get KPIs by period across navigators
    const rankings: LeaderboardEntry[] = await this.calculateRankings(
      leaderboardType,
      periodType,
      scope,
      countyId
    );

    const leaderboardData: InsertLeaderboard = {
      leaderboardType,
      scope,
      countyId: countyId || null,
      periodType,
      periodStart,
      periodEnd,
      rankings: rankings as any,
      totalParticipants: rankings.length,
    };

    // Check if leaderboard already exists
    const existing = await storage.getLeaderboards({
      leaderboardType,
      scope,
      periodType,
      countyId,
    });

    if (existing.length > 0 && 
        existing[0].periodStart.getTime() === periodStart.getTime()) {
      // Update existing
      return await storage.updateLeaderboard(existing[0].id, leaderboardData);
    } else {
      // Create new
      return await storage.createLeaderboard(leaderboardData);
    }
  }

  /**
   * Calculate rankings for leaderboard
   */
  private async calculateRankings(
    leaderboardType: string,
    periodType: string,
    scope: string,
    countyId?: string
  ): Promise<LeaderboardEntry[]> {
    // Get all KPIs for the current period
    // Note: This requires a more efficient query in production with database-level aggregation
    
    // For now, get all users with navigator/caseworker role
    const navigators = await storage.getUsers();
    const relevantUsers = navigators.filter(u => 
      u.role === 'navigator' || u.role === 'caseworker'
    );

    const rankings: LeaderboardEntry[] = [];

    for (const user of relevantUsers) {
      // Note: County-based filtering removed (bloat-2)
      // Leaderboards now operate at state/office level via office-based roles
      
      // Get latest KPI for this period
      const kpi = await storage.getLatestNavigatorKpi(user.id, periodType);
      
      if (!kpi) {
        continue; // Skip if no KPI data
      }

      // Extract value based on leaderboard type
      let value = 0;
      switch (leaderboardType) {
        case 'cases_closed':
          value = kpi.casesClosed || 0;
          break;
        case 'benefits_amount':
          value = kpi.totalBenefitsSecured || 0;
          break;
        case 'success_rate':
          value = kpi.successRate || 0;
          break;
        case 'performance_score':
          value = kpi.performanceScore || 0;
          break;
        default:
          value = kpi.casesClosed || 0;
      }

      // Get county name if applicable
      let countyName: string | undefined;
      let userCountyId: string | undefined;
      
      if (kpi.countyId) {
        const county = await storage.getCountyById(kpi.countyId);
        countyName = county?.name;
        userCountyId = county?.id;
      }

      rankings.push({
        rank: 0, // Will be set after sorting
        navigatorId: user.id,
        navigatorName: user.fullName || user.username,
        value,
        countyName,
        countyId: userCountyId,
        // Include full KPI breakdown for UI display
        casesClosed: kpi.casesClosed || 0,
        totalBenefitsSecured: kpi.totalBenefitsSecured || 0,
        successRate: kpi.successRate || 0,
        avgResponseTime: kpi.avgResponseTime || 0,
        performanceScore: kpi.performanceScore || 0,
      });
    }

    // Sort by value (descending) and assign ranks
    return rankings
      .sort((a, b) => b.value - a.value)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  /**
   * Get leaderboard for display
   */
  async getLeaderboard(
    leaderboardType: string,
    scope: string,
    periodType: string,
    countyId?: string
  ): Promise<Leaderboard | null> {
    const leaderboards = await storage.getLeaderboards({
      leaderboardType: leaderboardType as any,
      scope: scope as any,
      periodType: periodType as any,
      countyId,
    });

    if (leaderboards.length === 0) {
      // Generate new leaderboard
      return await this.generateLeaderboard(
        leaderboardType as any,
        scope as any,
        periodType as any,
        countyId
      );
    }

    return leaderboards[0];
  }

  /**
   * Get navigator's rank in leaderboard
   */
  async getNavigatorRank(
    navigatorId: string,
    leaderboardType: string,
    scope: string,
    periodType: string,
    countyId?: string
  ): Promise<{ rank: number; totalParticipants: number } | null> {
    const leaderboard = await this.getLeaderboard(leaderboardType, scope, periodType, countyId);
    
    if (!leaderboard) {
      return null;
    }

    const rankings = leaderboard.rankings as any[];
    const entry = rankings.find(r => r.navigatorId === navigatorId);

    if (!entry) {
      return { rank: -1, totalParticipants: leaderboard.totalParticipants || 0 };
    }

    return {
      rank: entry.rank,
      totalParticipants: leaderboard.totalParticipants || 0,
    };
  }

  /**
   * Refresh all leaderboards for current period
   */
  async refreshAllLeaderboards(): Promise<void> {
    const types: Array<'cases_closed' | 'benefits_amount' | 'success_rate' | 'performance_score'> = [
      'cases_closed',
      'benefits_amount',
      'success_rate',
      'performance_score',
    ];

    const scopes: Array<'county' | 'statewide'> = ['county', 'statewide'];
    const periods: Array<'daily' | 'weekly' | 'monthly' | 'all_time'> = [
      'daily',
      'weekly',
      'monthly',
      'all_time',
    ];

    // Get all counties
    const counties = await storage.getCounties({ isActive: true });

    for (const type of types) {
      for (const scope of scopes) {
        for (const period of periods) {
          if (scope === 'statewide') {
            await this.generateLeaderboard(type, scope, period);
          } else {
            // Generate for each county
            for (const county of counties) {
              await this.generateLeaderboard(type, scope, period, county.id);
            }
          }
        }
      }
    }

    logger.info('✅ Refreshed all leaderboards', {
      service: 'Leaderboard'
    });
  }

  /**
   * Get period boundaries based on period type
   */
  private getPeriodBounds(periodType: 'daily' | 'weekly' | 'monthly' | 'all_time'): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (periodType) {
      case 'daily':
        return {
          periodStart: today,
          periodEnd: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        };
      
      case 'weekly': {
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { periodStart: weekStart, periodEnd: weekEnd };
      }
      
      case 'monthly': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { periodStart: monthStart, periodEnd: monthEnd };
      }
      
      case 'all_time':
        return {
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2099-12-31'),
        };
    }
  }
}

export const leaderboardService = new LeaderboardService();
