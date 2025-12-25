import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Crown, TrendingUp, DollarSign, Target } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTenant } from "@/contexts/TenantContext";

interface LeaderboardEntry {
  navigatorId: string;
  navigatorName: string;
  rank: number;
  performanceScore: number;
  casesClosed: number;
  totalBenefitsSecured: number;
  successRate: number;
  avgResponseTime: number;
  countyId: string | null;
  countyName: string | null;
}

export default function Leaderboard() {
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'all_time'>('all_time');
  const [scope, setScope] = useState<'county' | 'statewide'>('statewide');
  const [selectedCounty, setSelectedCounty] = useState<string>('');
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';

  // Fetch counties for county-specific leaderboard
  const { data: counties } = useQuery<any[]>({
    queryKey: ['/api/counties'],
  });

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading } = useQuery<any>({
    queryKey: ['/api/leaderboards', { 
      type: 'performance_score', 
      scope, 
      period: periodType,
      countyId: scope === 'county' ? selectedCounty : undefined 
    }],
    enabled: scope === 'statewide' || (scope === 'county' && !!selectedCounty),
  });

  // Extract rankings from leaderboard data
  const leaderboard: LeaderboardEntry[] = leaderboardData?.rankings?.map((r: any) => ({
    navigatorId: r.navigatorId,
    navigatorName: r.navigatorName,
    rank: r.rank,
    performanceScore: r.performanceScore || r.value || 0,
    casesClosed: r.casesClosed || 0,
    totalBenefitsSecured: r.totalBenefitsSecured || 0,
    successRate: r.successRate || 0,
    avgResponseTime: r.avgResponseTime || 0,
    countyId: r.countyId,
    countyName: r.countyName,
  })) || [];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" data-testid="icon-rank-1" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" data-testid="icon-rank-2" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" data-testid="icon-rank-3" />;
      default:
        return <span className="text-sm text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank <= 3) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
    if (rank <= 10) return "bg-gradient-to-r from-blue-400 to-blue-600 text-white";
    return "bg-muted text-muted-foreground";
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Leaderboard</h1>
          <p className="text-muted-foreground">Navigator rankings and performance comparison</p>
        </div>
        <div className="flex gap-4">
          <Select value={periodType} onValueChange={(value: any) => setPeriodType(value)}>
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
      </div>

      <Tabs value={scope} onValueChange={(value: any) => setScope(value)} data-testid="tabs-scope">
        <TabsList>
          <TabsTrigger value="statewide" data-testid="tab-statewide">
            <Trophy className="mr-2 h-4 w-4" />
            Statewide
          </TabsTrigger>
          <TabsTrigger value="county" data-testid="tab-county">
            <Target className="mr-2 h-4 w-4" />
            County
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statewide" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Statewide Rankings
              </CardTitle>
              <CardDescription>
                Top performers across all {stateName} counties
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" data-testid={`skeleton-row-${i}`} />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]" data-testid="header-rank">Rank</TableHead>
                      <TableHead data-testid="header-navigator">Navigator</TableHead>
                      <TableHead data-testid="header-county">County</TableHead>
                      <TableHead className="text-right" data-testid="header-score">Score</TableHead>
                      <TableHead className="text-right" data-testid="header-cases">Cases</TableHead>
                      <TableHead className="text-right" data-testid="header-benefits">Benefits</TableHead>
                      <TableHead className="text-right" data-testid="header-success-rate">Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard?.map((entry) => (
                      <TableRow key={entry.navigatorId} data-testid={`row-navigator-${entry.navigatorId}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRankIcon(entry.rank)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{getInitials(entry.navigatorName)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium" data-testid={`text-name-${entry.navigatorId}`}>
                              {entry.navigatorName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-county-${entry.navigatorId}`}>
                          {entry.countyName || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={getRankBadgeColor(entry.rank)} data-testid={`badge-score-${entry.navigatorId}`}>
                            {entry.performanceScore.toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-cases-${entry.navigatorId}`}>
                          {entry.casesClosed}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-benefits-${entry.navigatorId}`}>
                          ${entry.totalBenefitsSecured.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-success-rate-${entry.navigatorId}`}>
                          {entry.successRate.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="county" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                County Rankings
              </CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2">
                  <span>Select a county to view rankings:</span>
                  <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                    <SelectTrigger className="w-[250px]" data-testid="select-county">
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent>
                      {counties?.map((county) => (
                        <SelectItem 
                          key={county.id} 
                          value={county.id}
                          data-testid={`select-item-county-${county.id}`}
                        >
                          {county.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedCounty ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-select-county-prompt">
                  Please select a county to view rankings
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" data-testid={`skeleton-county-row-${i}`} />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]" data-testid="header-county-rank">Rank</TableHead>
                      <TableHead data-testid="header-county-navigator">Navigator</TableHead>
                      <TableHead className="text-right" data-testid="header-county-score">Score</TableHead>
                      <TableHead className="text-right" data-testid="header-county-cases">Cases</TableHead>
                      <TableHead className="text-right" data-testid="header-county-benefits">Benefits</TableHead>
                      <TableHead className="text-right" data-testid="header-county-success-rate">Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard?.map((entry) => (
                      <TableRow key={entry.navigatorId} data-testid={`row-county-navigator-${entry.navigatorId}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRankIcon(entry.rank)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{getInitials(entry.navigatorName)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium" data-testid={`text-county-name-${entry.navigatorId}`}>
                              {entry.navigatorName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={getRankBadgeColor(entry.rank)} data-testid={`badge-county-score-${entry.navigatorId}`}>
                            {entry.performanceScore.toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-county-cases-${entry.navigatorId}`}>
                          {entry.casesClosed}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-county-benefits-${entry.navigatorId}`}>
                          ${entry.totalBenefitsSecured.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-county-success-rate-${entry.navigatorId}`}>
                          {entry.successRate.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top 3 Spotlight */}
      {!isLoading && leaderboard && leaderboard.length >= 3 && (
        <div className="grid gap-4 md:grid-cols-3">
          {leaderboard.slice(0, 3).map((entry, index) => (
            <Card 
              key={entry.navigatorId} 
              className={index === 0 ? "border-yellow-500 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950 dark:to-background" : ""}
              data-testid={`card-top-${index + 1}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getRankIcon(entry.rank)}
                    <span data-testid={`text-top-name-${index + 1}`}>{entry.navigatorName}</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Performance Score</span>
                  <span className="font-bold" data-testid={`text-top-score-${index + 1}`}>
                    {entry.performanceScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cases Closed</span>
                  <span data-testid={`text-top-cases-${index + 1}`}>{entry.casesClosed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Benefits Secured</span>
                  <span data-testid={`text-top-benefits-${index + 1}`}>
                    ${entry.totalBenefitsSecured.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
