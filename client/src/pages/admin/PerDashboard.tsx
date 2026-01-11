import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShieldCheck,
  FileSearch,
  Bell,
  RefreshCw,
  Activity,
  Target,
  AlertCircle,
  Gauge,
  ListOrdered,
  Brain,
  Scale,
} from "lucide-react";
import { format } from "date-fns";

interface DashboardMetrics {
  totalCasesScanned: number;
  errorsPreventedCount: number;
  errorsPreventedAmount: number;
  pendingIncomeVerifications: number;
  pendingConsistencyChecks: number;
  pendingDuplicateClaims: number;
  activeNudges: number;
  currentErrorRate: number;
  errorRateTrend: "improving" | "stable" | "worsening";
  targetErrorRate: number;
  errorsByType: Record<string, number>;
  errorsByCategory: Record<string, number>;
  permCompliant: boolean;
  lastPermReportPeriod?: string;
  lastPermErrorRate?: number;
}

interface HighPriorityNudge {
  id: string;
  caseId: string;
  nudgeTitle: string;
  nudgeDescription: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  nudgeType: string;
  createdAt: string;
}

interface SystemHealth {
  servicesOperational: {
    incomeVerification: boolean;
    preSubmissionValidator: boolean;
    duplicateDetection: boolean;
    nudgeGeneration: boolean;
    permReporting: boolean;
  };
  lastActivityTime: string;
  processingBacklog: number;
  systemStatus: "healthy" | "degraded" | "offline";
}

interface RiskQueueItem {
  caseId: string;
  clientName?: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  predictedErrorAmount?: number;
  predictedErrorProbability?: number;
  priority: number;
  primaryRiskFactor?: string;
  daysSinceLastReview?: number;
  assignedCaseworker?: string;
}

interface RiskQueueResponse {
  cases: RiskQueueItem[];
  totalCases: number;
  byRiskLevel: Record<string, number>;
  avgRiskScore: number;
}

interface RiskStats {
  totalAssessments: number;
  avgRiskScore: number;
  highRiskCount: number;
  criticalRiskCount: number;
  byRiskLevel: Record<string, number>;
  modelVersion: string;
}

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function PerDashboard() {
  const [stateCode, setStateCode] = useState("MD");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: metrics, isLoading: metricsLoading } = useQuery<{ success: boolean; data: DashboardMetrics }>({
    queryKey: ["/api/per/dashboard", stateCode, refreshKey],
  });

  const { data: highPriorityNudges, isLoading: nudgesLoading } = useQuery<{ success: boolean; data: HighPriorityNudge[] }>({
    queryKey: ["/api/per/nudges/high-priority", stateCode, refreshKey],
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery<{ success: boolean; data: SystemHealth }>({
    queryKey: ["/api/per/health", refreshKey],
  });

  const { data: riskQueue, isLoading: riskQueueLoading } = useQuery<{ success: boolean; data: RiskQueueResponse }>({
    queryKey: ["/api/per/risk-scores/queue", stateCode, refreshKey],
  });

  const { data: riskStats, isLoading: riskStatsLoading } = useQuery<{ success: boolean; data: RiskStats }>({
    queryKey: ["/api/per/risk-scores/stats", stateCode, refreshKey],
  });

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const dashboardData = metrics?.data;
  const nudges = highPriorityNudges?.data || [];
  const health = systemHealth?.data;
  const riskQueueData = riskQueue?.data;
  const riskStatsData = riskStats?.data;

  const errorTypeData = dashboardData?.errorsByType 
    ? Object.entries(dashboardData.errorsByType).map(([name, value]) => ({ name, value }))
    : [];

  const errorCategoryData = dashboardData?.errorsByCategory
    ? Object.entries(dashboardData.errorsByCategory).map(([name, value]) => ({ name, value }))
    : [];

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === undefined) return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    return status 
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment Error Reduction</h1>
            <p className="text-muted-foreground mt-1">
              SNAP Payment Error Prevention Module - Arnold Ventures/MD DHS Blueprint
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MD">Maryland</SelectItem>
                <SelectItem value="PA">Pennsylvania</SelectItem>
                <SelectItem value="VA">Virginia</SelectItem>
                <SelectItem value="MI">Michigan</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Status Bar */}
        <Card className={health?.systemStatus === "healthy" ? "border-green-500/50" : health?.systemStatus === "degraded" ? "border-yellow-500/50" : "border-red-500/50"}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Activity className={`h-5 w-5 ${health?.systemStatus === "healthy" ? "text-green-500" : health?.systemStatus === "degraded" ? "text-yellow-500" : "text-red-500"}`} />
                  <span className="font-medium">System Status:</span>
                  <Badge variant={health?.systemStatus === "healthy" ? "default" : "destructive"}>
                    {health?.systemStatus?.toUpperCase() || "LOADING"}
                  </Badge>
                </div>
                {health && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Services:</span>
                      {getStatusIcon(health.servicesOperational?.incomeVerification)}
                      {getStatusIcon(health.servicesOperational?.preSubmissionValidator)}
                      {getStatusIcon(health.servicesOperational?.duplicateDetection)}
                      {getStatusIcon(health.servicesOperational?.nudgeGeneration)}
                      {getStatusIcon(health.servicesOperational?.permReporting)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Backlog: {health.processingBacklog} items
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-5 w-5 ${dashboardData?.permCompliant ? "text-green-500" : "text-red-500"}`} />
                <span className="text-sm font-medium">
                  PERM: {dashboardData?.permCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cases Scanned
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{dashboardData?.totalCasesScanned || 0}</span>
                  <FileSearch className="h-8 w-8 text-blue-500" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Errors Prevented
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-bold text-green-600">{dashboardData?.errorsPreventedCount || 0}</span>
                    <p className="text-sm text-muted-foreground">
                      ${(dashboardData?.errorsPreventedAmount || 0).toLocaleString()} saved
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={dashboardData?.currentErrorRate && dashboardData.currentErrorRate > 6 ? "border-red-500/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Error Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-bold">
                      {(dashboardData?.currentErrorRate || 0).toFixed(1)}%
                    </span>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Target: {dashboardData?.targetErrorRate}%
                      {dashboardData?.errorRateTrend === "improving" && <TrendingDown className="h-3 w-3 text-green-500" />}
                      {dashboardData?.errorRateTrend === "worsening" && <TrendingUp className="h-3 w-3 text-red-500" />}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-500" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Nudges
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{dashboardData?.activeNudges || 0}</span>
                  <Bell className="h-8 w-8 text-orange-500" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Issues Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Income Verifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold">{dashboardData?.pendingIncomeVerifications || 0}</div>
                <Progress value={Math.min((dashboardData?.pendingIncomeVerifications || 0) / 10 * 100, 100)} className="flex-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Consistency Checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold">{dashboardData?.pendingConsistencyChecks || 0}</div>
                <Progress value={Math.min((dashboardData?.pendingConsistencyChecks || 0) / 10 * 100, 100)} className="flex-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Duplicate Claims</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold">{dashboardData?.pendingDuplicateClaims || 0}</div>
                <Progress value={Math.min((dashboardData?.pendingDuplicateClaims || 0) / 5 * 100, 100)} className="flex-1" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="riskQueue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="riskQueue">Risk Queue</TabsTrigger>
            <TabsTrigger value="nudges">High Priority Nudges</TabsTrigger>
            <TabsTrigger value="errors">Error Breakdown</TabsTrigger>
            <TabsTrigger value="perm">PERM Compliance</TabsTrigger>
          </TabsList>

          {/* Risk Queue Tab - ML-Based Case Prioritization */}
          <TabsContent value="riskQueue">
            <div className="space-y-6">
              {/* Risk Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Brain className="h-4 w-4" /> ML Model Version
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">
                      {riskStatsData?.modelVersion || "PER-LR-v2.1.0"}
                    </div>
                    <p className="text-xs text-muted-foreground">10-feature weighted scoring</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Gauge className="h-4 w-4" /> Avg Risk Score
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(riskStatsData?.avgRiskScore || riskQueueData?.avgRiskScore || 0).toFixed(1)}
                    </div>
                    <Progress 
                      value={(riskStatsData?.avgRiskScore || riskQueueData?.avgRiskScore || 0)} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card className="border-orange-500/50">
                  <CardHeader className="pb-2">
                    <CardDescription>High Risk Cases</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {riskStatsData?.highRiskCount || riskQueueData?.byRiskLevel?.high || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-500/50">
                  <CardHeader className="pb-2">
                    <CardDescription>Critical Risk Cases</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {riskStatsData?.criticalRiskCount || riskQueueData?.byRiskLevel?.critical || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Prioritized Case Queue */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListOrdered className="h-5 w-5 text-blue-500" />
                    Prioritized Case Review Queue
                  </CardTitle>
                  <CardDescription>
                    Cases ranked by ML-predicted error risk. Higher priority = higher likelihood of payment error.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {riskQueueLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : !riskQueueData?.cases?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No cases in the risk queue</p>
                      <p className="text-sm">Run case assessments to populate the queue</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {riskQueueData.cases.map((item, index) => (
                          <Card key={item.caseId} className={`border-l-4 ${
                            item.riskLevel === 'critical' ? 'border-l-red-500' :
                            item.riskLevel === 'high' ? 'border-l-orange-500' :
                            item.riskLevel === 'medium' ? 'border-l-yellow-500' :
                            'border-l-green-500'
                          }`}>
                            <CardContent className="py-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="text-2xl font-bold text-muted-foreground w-8">
                                    #{index + 1}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">Case: {item.caseId}</span>
                                      <Badge variant={getRiskBadgeVariant(item.riskLevel)}>
                                        {item.riskLevel.toUpperCase()}
                                      </Badge>
                                    </div>
                                    {item.clientName && (
                                      <p className="text-sm text-muted-foreground">{item.clientName}</p>
                                    )}
                                    {item.primaryRiskFactor && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        <Badge variant="outline" className="text-xs">
                                          {item.primaryRiskFactor}
                                        </Badge>
                                        {item.predictedErrorProbability !== undefined && (
                                          <Badge variant="secondary" className="text-xs">
                                            {(item.predictedErrorProbability * 100).toFixed(0)}% error prob.
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                    {item.assignedCaseworker && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Assigned: {item.assignedCaseworker}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <Gauge className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-2xl font-bold">{item.riskScore.toFixed(0)}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">Risk Score</div>
                                  {item.predictedErrorAmount !== undefined && item.predictedErrorAmount > 0 && (
                                    <div className="text-sm text-red-600 mt-1">
                                      Est. Error: ${item.predictedErrorAmount.toLocaleString()}
                                    </div>
                                  )}
                                  {item.daysSinceLastReview !== undefined && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {item.daysSinceLastReview} days since review
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <Button size="sm" variant="default">
                                  <Scale className="h-3 w-3 mr-1" />
                                  Review Case
                                </Button>
                                <Button size="sm" variant="outline">Generate Nudge</Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* High Priority Nudges Tab */}
          <TabsContent value="nudges">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  High Priority Cases Requiring Attention
                </CardTitle>
                <CardDescription>
                  AI-generated nudges for cases with potential payment errors
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nudgesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : nudges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No high priority nudges at this time</p>
                    <p className="text-sm">All cases are within acceptable risk thresholds</p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {nudges.map((nudge) => (
                        <Card key={nudge.id} className="border-l-4 border-l-orange-500">
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{nudge.nudgeTitle}</span>
                                  <Badge variant={getRiskBadgeVariant(nudge.riskLevel)}>
                                    {nudge.riskLevel.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline">{nudge.nudgeType}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Case ID: {nudge.caseId}
                                </p>
                                <p className="text-sm">{nudge.nudgeDescription}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold">{nudge.riskScore}</div>
                                <div className="text-xs text-muted-foreground">Risk Score</div>
                              </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                              <Button size="sm" variant="default">Review Case</Button>
                              <Button size="sm" variant="outline">Mark Viewed</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Error Breakdown Tab */}
          <TabsContent value="errors">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Type</CardTitle>
                  <CardDescription>Distribution of payment error types detected</CardDescription>
                </CardHeader>
                <CardContent>
                  {errorTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={errorTypeData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {errorTypeData.map((entry, index) => (
                            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No error data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Errors by Category</CardTitle>
                  <CardDescription>Detection source breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {errorCategoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={errorCategoryData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No category data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PERM Compliance Tab */}
          <TabsContent value="perm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className={dashboardData?.permCompliant ? "text-green-500" : "text-red-500"} />
                    PERM Compliance Status
                  </CardTitle>
                  <CardDescription>
                    Federal Payment Error Rate Measurement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Compliance Status</p>
                      <p className="text-2xl font-bold">
                        {dashboardData?.permCompliant ? (
                          <span className="text-green-600">COMPLIANT</span>
                        ) : (
                          <span className="text-red-600">NON-COMPLIANT</span>
                        )}
                      </p>
                    </div>
                    {dashboardData?.permCompliant ? (
                      <CheckCircle className="h-12 w-12 text-green-500" />
                    ) : (
                      <XCircle className="h-12 w-12 text-red-500" />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Current Error Rate</span>
                      <span className="font-bold">{(dashboardData?.currentErrorRate || 0).toFixed(2)}%</span>
                    </div>
                    <Progress 
                      value={(dashboardData?.currentErrorRate || 0) / 10 * 100} 
                      className={dashboardData && dashboardData.currentErrorRate > 6 ? "bg-red-200" : ""}
                    />
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>0%</span>
                      <span className="text-orange-500">6% FNS Threshold</span>
                      <span>10%</span>
                    </div>
                  </div>

                  {dashboardData?.lastPermReportPeriod && (
                    <div className="text-sm text-muted-foreground">
                      Last PERM Report: {dashboardData.lastPermReportPeriod}
                      {dashboardData.lastPermErrorRate !== undefined && (
                        <span className="ml-2">
                          (Error Rate: {dashboardData.lastPermErrorRate.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>FNS Sampling Requirements</CardTitle>
                  <CardDescription>Quarterly PERM sample sizes per FNS guidelines</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Active Case Samples</span>
                      <Badge>Required: 180</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Random stratified sample of active SNAP cases for payment accuracy review
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Negative Case Samples</span>
                      <Badge>Required: 80</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sample of denied applications to verify denial accuracy
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-muted">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Error Threshold</span>
                      <Badge variant="destructive">6.0%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      States exceeding this threshold may face FNS corrective action requirements
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
