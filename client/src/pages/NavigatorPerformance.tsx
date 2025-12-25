import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, TrendingUp, Target, Award, Clock, DollarSign, CheckCircle, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface NavigatorKpi {
  id: string;
  navigatorId: string;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  casesClosed: number;
  casesApproved: number;
  casesDenied: number;
  successRate: number;
  totalBenefitsSecured: number;
  avgBenefitPerCase: number;
  highValueCases: number;
  avgResponseTime: number;
  avgCaseCompletionTime: number;
  documentsProcessed: number;
  documentsVerified: number;
  avgDocumentQuality: number;
  crossEnrollmentsIdentified: number;
  aiRecommendationsAccepted: number;
  performanceScore: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  iconName: string;
  iconColor: string;
  pointsAwarded: number;
  earnedAt: Date;
}

interface LeaderboardRank {
  rank: number;
  totalParticipants: number;
}

export default function NavigatorPerformance() {
  const { user } = useAuth();
  const [periodType, setPeriodType] = useState<string>('monthly');
  const [leaderboardType, setLeaderboardType] = useState<string>('performance_score');

  // Fetch navigator KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery<NavigatorKpi[]>({
    queryKey: ['/api/navigators', user?.id, 'kpis'],
    enabled: !!user?.id,
  });

  // Fetch current period KPI
  const currentKpi = kpis?.find(k => k.periodType === periodType);

  // Fetch navigator achievements
  const { data: achievements, isLoading: achievementsLoading } = useQuery<Achievement[]>({
    queryKey: ['/api/navigators', user?.id, 'achievements'],
    enabled: !!user?.id,
  });

  // Fetch navigator rank
  const { data: rank } = useQuery<LeaderboardRank>({
    queryKey: ['/api/navigators', user?.id, 'rank'],
    enabled: !!user?.id,
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-gray-500';
    }
  };

  if (kpisLoading || achievementsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">My Performance</h1>
          <p className="text-muted-foreground">Track your KPIs, achievements, and rankings</p>
        </div>
        <Select value={periodType} onValueChange={setPeriodType}>
          <SelectTrigger className="w-[180px]" data-testid="select-period">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily" data-testid="select-item-period-daily">Daily</SelectItem>
            <SelectItem value="weekly" data-testid="select-item-period-weekly">Weekly</SelectItem>
            <SelectItem value="monthly" data-testid="select-item-period-monthly">Monthly</SelectItem>
            <SelectItem value="all_time" data-testid="select-item-period-all-time">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(currentKpi?.performanceScore || 0)}`} data-testid="text-performance-score">
              {currentKpi?.performanceScore?.toFixed(1) || '0.0'}
            </div>
            <Progress value={currentKpi?.performanceScore || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Out of 100 points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cases Closed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cases-closed">{currentKpi?.casesClosed || 0}</div>
            <p className="text-xs text-muted-foreground">
              {currentKpi?.successRate?.toFixed(1) || '0'}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benefits Secured</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-benefits-secured">
              ${(currentKpi?.totalBenefitsSecured || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg ${(currentKpi?.avgBenefitPerCase || 0).toFixed(0)} per case
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Rank</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rank">
              #{rank?.rank || '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Out of {rank?.totalParticipants || '-'} navigators
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">Achievements</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">Detailed Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics</CardTitle>
                <CardDescription>Document quality and accuracy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Success Rate</span>
                  <div className="flex items-center gap-2">
                    <Progress value={currentKpi?.successRate || 0} className="w-24" />
                    <span className="text-sm font-medium">{currentKpi?.successRate?.toFixed(1) || '0'}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Document Quality</span>
                  <div className="flex items-center gap-2">
                    <Progress value={(currentKpi?.avgDocumentQuality || 0) * 100} className="w-24" />
                    <span className="text-sm font-medium">{((currentKpi?.avgDocumentQuality || 0) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Speed Metrics</CardTitle>
                <CardDescription>Response and completion times</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Avg Response Time</span>
                  </div>
                  <span className="text-sm font-medium">
                    {currentKpi?.avgResponseTime?.toFixed(1) || '0'}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Avg Completion Time</span>
                  </div>
                  <span className="text-sm font-medium">
                    {currentKpi?.avgCaseCompletionTime?.toFixed(1) || '0'} days
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cross-Enrollment Impact</CardTitle>
              <CardDescription>Proactive benefit identification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Opportunities Identified</p>
                  <p className="text-2xl font-bold" data-testid="text-cross-enrollments">
                    {currentKpi?.crossEnrollmentsIdentified || 0}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">High-Value Cases</p>
                  <p className="text-2xl font-bold" data-testid="text-high-value-cases">
                    {currentKpi?.highValueCases || 0}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">AI Recommendations Accepted</p>
                  <p className="text-2xl font-bold" data-testid="text-ai-recommendations">
                    {currentKpi?.aiRecommendationsAccepted || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Achievements</CardTitle>
              <CardDescription>
                {achievements?.length || 0} achievements earned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {achievements?.map((achievement) => (
                  <Card key={achievement.id} className="border-2" data-testid={`card-achievement-${achievement.id}`}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-full ${getTierColor(achievement.tier)} flex items-center justify-center`}>
                          <Award className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-sm">{achievement.name}</CardTitle>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {achievement.tier}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground capitalize">{achievement.category}</span>
                        <span className="text-sm font-medium">+{achievement.pointsAwarded} pts</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {(!achievements || achievements.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No achievements yet. Keep up the great work!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Case Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Cases Closed</span>
                  <span className="font-medium">{currentKpi?.casesClosed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Cases Approved</span>
                  <span className="font-medium text-green-600">{currentKpi?.casesApproved || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Cases Denied</span>
                  <span className="font-medium text-red-600">{currentKpi?.casesDenied || 0}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-sm font-medium">Success Rate</span>
                  <span className="font-bold">{currentKpi?.successRate?.toFixed(1) || '0'}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Document Processing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Documents Processed</span>
                  <span className="font-medium">{currentKpi?.documentsProcessed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Documents Verified</span>
                  <span className="font-medium">{currentKpi?.documentsVerified || 0}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-sm font-medium">Avg Quality Score</span>
                  <span className="font-bold">{((currentKpi?.avgDocumentQuality || 0) * 100).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Financial Impact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Total Benefits Secured</span>
                  <span className="font-medium">${(currentKpi?.totalBenefitsSecured || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Average Benefit Per Case</span>
                  <span className="font-medium">${(currentKpi?.avgBenefitPerCase || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">High-Value Cases ($1000+)</span>
                  <span className="font-medium">{currentKpi?.highValueCases || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
