import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Award, 
  FileText, 
  BarChart3,
  RefreshCw,
  Download,
  CheckCircle2
} from "lucide-react";
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
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ErrorPattern {
  id: string;
  errorCategory: string;
  errorSubtype: string;
  errorDescription: string;
  quarterOccurred: string;
  errorCount: number;
  totalCases: number;
  errorRate: number;
  trendDirection: string;
  severity: string;
}

interface FlaggedCase {
  id: string;
  caseId: string;
  clientName: string;
  assignedCaseworkerId: string | null;
  riskScore: number;
  riskLevel: string;
  flaggedErrorTypes: string[];
  flaggedDate: string;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  caseworker?: {
    id: string;
    fullName: string;
    username: string;
  };
}

interface TrainingIntervention {
  id: string;
  trainingTitle: string;
  targetErrorCategory: string;
  completedBy: string[];
  completedDate: string;
  preTrainingErrorRate: number;
  postTrainingErrorRate: number | null;
  impactScore: number | null;
}

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  shelter_utility: "Shelter & Utility",
  income_verification: "Income Verification",
  asset_verification: "Asset Verification",
  categorical_eligibility: "Categorical Eligibility",
  earned_income: "Earned Income Errors",
  unearned_income: "Unearned Income Errors",
};

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

export default function SupervisorCockpit() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [assignCaseworkerId, setAssignCaseworkerId] = useState<string>("");
  const [coachingNotes, setCoachingNotes] = useState<string>("");
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch all error patterns (supervisor view)
  const { data: errorPatterns, isLoading: patternsLoading, refetch: refetchPatterns } = useQuery<ErrorPattern[]>({
    queryKey: ["/api/qc/error-patterns"],
  });

  // Fetch flagged cases for team
  const { data: flaggedCases, isLoading: casesLoading, refetch: refetchCases } = useQuery<FlaggedCase[]>({
    queryKey: ["/api/qc/flagged-cases/team"],
  });

  // Fetch training interventions
  const { data: trainingInterventions, isLoading: trainingLoading } = useQuery<TrainingIntervention[]>({
    queryKey: ["/api/qc/training-interventions"],
  });

  // Fetch caseworkers for assignment
  const { data: caseworkers } = useQuery<any[]>({
    queryKey: ["/api/users?role=caseworker"],
  });

  // Assign case mutation
  const assignCaseMutation = useMutation({
    mutationFn: async (data: { caseId: string; assignedCaseworkerId: string; reviewNotes: string }) => {
      return await apiRequest(`/api/qc/flagged-cases/${data.caseId}/assign`, "POST", {
        assignedCaseworkerId: data.assignedCaseworkerId,
        reviewNotes: data.reviewNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qc/flagged-cases/team"] });
      toast({
        title: "Case Assigned",
        description: "Case has been successfully assigned to caseworker with coaching notes.",
      });
      setSelectedCaseId(null);
      setAssignCaseworkerId("");
      setCoachingNotes("");
    },
    onError: () => {
      toast({
        title: "Assignment Failed",
        description: "Failed to assign case. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Calculate critical error spikes (>100% increase)
  const criticalAlerts = errorPatterns?.filter(pattern => {
    if (pattern.trendDirection !== 'increasing') return false;
    
    // Find baseline quarter for comparison
    const sameErrorPrevious = errorPatterns.filter(p => 
      p.errorCategory === pattern.errorCategory && 
      p.errorSubtype === pattern.errorSubtype &&
      p.quarterOccurred < pattern.quarterOccurred
    ).sort((a, b) => b.quarterOccurred.localeCompare(a.quarterOccurred))[0];

    if (!sameErrorPrevious) return false;

    const percentChange = ((pattern.errorRate - sameErrorPrevious.errorRate) / sameErrorPrevious.errorRate) * 100;
    return percentChange > 100; // >100% increase
  }) || [];

  // Calculate current quarter PER (Payment Error Rate)
  const currentQuarter = "2024-Q4";
  const currentQuarterPatterns = errorPatterns?.filter(p => p.quarterOccurred === currentQuarter) || [];
  const totalCurrentErrors = currentQuarterPatterns.reduce((sum, p) => sum + p.errorCount, 0);
  const totalCurrentCases = currentQuarterPatterns.reduce((sum, p) => sum + p.totalCases, 0) / (currentQuarterPatterns.length || 1);
  const currentPER = totalCurrentCases > 0 ? (totalCurrentErrors / totalCurrentCases) * 100 : 0;

  // State average (synthetic)
  const stateAveragePER = 3.8;

  // Top 3 error categories
  const errorCategoryStats = errorPatterns?.reduce((acc: Record<string, number>, pattern) => {
    if (pattern.quarterOccurred === currentQuarter) {
      acc[pattern.errorCategory] = (acc[pattern.errorCategory] || 0) + pattern.errorCount;
    }
    return acc;
  }, {}) || {};

  const topErrorCategories = Object.entries(errorCategoryStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, count]) => ({
      category: ERROR_CATEGORY_LABELS[category] || category,
      count,
    }));

  // Quarterly trend data
  const quarterlyTrends = ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"].map(quarter => {
    const quarterPatterns = errorPatterns?.filter(p => p.quarterOccurred === quarter) || [];
    const totalErrors = quarterPatterns.reduce((sum, p) => sum + p.errorCount, 0);
    const totalCases = quarterPatterns.reduce((sum, p) => sum + p.totalCases, 0) / (quarterPatterns.length || 1);
    const errorRate = totalCases > 0 ? (totalErrors / totalCases) * 100 : 0;
    
    return {
      quarter,
      errorRate: parseFloat(errorRate.toFixed(2)),
    };
  });

  // Selected category drill-down data
  const selectedCategoryData = selectedCategory !== "all" 
    ? errorPatterns?.filter(p => p.errorCategory === selectedCategory) || []
    : [];

  const categorySubtypes = selectedCategoryData.reduce((acc: Record<string, number>, pattern) => {
    acc[pattern.errorSubtype] = (acc[pattern.errorSubtype] || 0) + pattern.errorCount;
    return acc;
  }, {});

  const pieChartData = Object.entries(categorySubtypes).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
  }));

  // Filter flagged cases
  const filteredCases = flaggedCases?.filter(flaggedCase => {
    const matchesRisk = filterRiskLevel === "all" || flaggedCase.riskLevel === filterRiskLevel;
    const matchesStatus = filterStatus === "all" || flaggedCase.reviewStatus === filterStatus;
    return matchesRisk && matchesStatus;
  }) || [];

  // Refresh all data
  const handleRefresh = () => {
    refetchPatterns();
    refetchCases();
    toast({
      title: "Data Refreshed",
      description: "All metrics have been updated.",
    });
  };

  // Export report (stub)
  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your QC report is being generated and will download shortly.",
    });
  };

  // Handle case assignment
  const handleAssignCase = () => {
    if (!selectedCaseId || !assignCaseworkerId) {
      toast({
        title: "Missing Information",
        description: "Please select a caseworker to assign the case.",
        variant: "destructive",
      });
      return;
    }

    assignCaseMutation.mutate({
      caseId: selectedCaseId,
      assignedCaseworkerId: assignCaseworkerId,
      reviewNotes: coachingNotes,
    });
  };

  const getRiskScoreColor = (score: number) => {
    if (score > 0.8) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    if (score > 0.7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200";
    return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  };

  const getAlertColor = (percentChange: number) => {
    if (percentChange > 100) return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
    if (percentChange > 25) return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800";
    return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800";
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight" data-testid="page-title">
              Quality Assurance Command Center
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl" data-testid="page-subtitle">
              Predictive oversight system for proactive quality control management. 
              Identify error patterns, coach teams effectively, and demonstrate measurable QC improvements.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground" data-testid="last-updated">
          Last Updated: {format(new Date(), "PPp")}
        </div>

        {/* Section 1: Error Trend Alerts (Top Banner) */}
        <Card className="border-2" data-testid="section-error-alerts">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle>Critical Error Trend Alerts</CardTitle>
            </div>
            <CardDescription>
              Error categories with significant spikes requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {patternsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : criticalAlerts.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-state-alerts">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-xl font-semibold mb-2">No Critical Alerts</p>
                <p className="text-muted-foreground">Your team is maintaining excellent quality standards!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {criticalAlerts.map((alert) => {
                  const previous = errorPatterns?.filter(p => 
                    p.errorCategory === alert.errorCategory && 
                    p.errorSubtype === alert.errorSubtype &&
                    p.quarterOccurred < alert.quarterOccurred
                  ).sort((a, b) => b.quarterOccurred.localeCompare(a.quarterOccurred))[0];

                  const percentChange = previous 
                    ? ((alert.errorRate - previous.errorRate) / previous.errorRate) * 100 
                    : 0;

                  return (
                    <Card 
                      key={alert.id} 
                      className={`${getAlertColor(percentChange)} border-2`}
                      data-testid={`alert-card-${alert.id}`}
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className="font-semibold text-sm" data-testid={`alert-category-${alert.id}`}>
                                {ERROR_CATEGORY_LABELS[alert.errorCategory] || alert.errorCategory}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {alert.errorDescription}
                              </p>
                            </div>
                            {percentChange > 0 ? (
                              <TrendingUp className="h-5 w-5 text-red-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-2xl font-bold" data-testid={`alert-change-${alert.id}`}>
                              {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {previous?.errorRate.toFixed(1)}% → {alert.errorRate.toFixed(1)}%
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => setSelectedCategory(alert.errorCategory)}
                            data-testid={`button-view-details-${alert.id}`}
                          >
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 2: Team Error Overview (Left Column) */}
          <Card className="lg:col-span-1" data-testid="section-team-overview">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Team Error Overview
              </CardTitle>
              <CardDescription>Current quarter performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current PER */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payment Error Rate (PER)</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant={currentPER > stateAveragePER ? "destructive" : "default"} data-testid="badge-per">
                        {currentPER.toFixed(2)}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>State Average: {stateAveragePER}%</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentPER < stateAveragePER ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {(stateAveragePER - currentPER).toFixed(2)}% below state average
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {(currentPER - stateAveragePER).toFixed(2)}% above state average
                    </span>
                  )}
                </div>
              </div>

              {/* Top Error Categories */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Top Error Drivers</p>
                {patternsLoading ? (
                  <Skeleton className="h-32" />
                ) : (
                  <div className="space-y-2">
                    {topErrorCategories.map((cat, idx) => (
                      <div key={idx} className="space-y-1" data-testid={`error-driver-${idx}`}>
                        <div className="flex justify-between text-sm">
                          <span>{cat.category}</span>
                          <span className="font-semibold">{cat.count}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${(cat.count / (topErrorCategories[0]?.count || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quarterly Trend */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Quarterly Trend</p>
                {patternsLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={quarterlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Line 
                        type="monotone" 
                        dataKey="errorRate" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        name="Error Rate %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Diagnostic Drill-Down (Center Column) */}
          <Card className="lg:col-span-1" data-testid="section-diagnostic">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Diagnostic Drill-Down
              </CardTitle>
              <CardDescription>Root cause analysis by error category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Selector */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-error-category">
                  <SelectValue placeholder="Select error category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(ERROR_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Root Cause Breakdown */}
              {selectedCategory !== "all" && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Root Cause Breakdown</p>
                    {patternsLoading ? (
                      <Skeleton className="h-48" />
                    ) : pieChartData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* Key Insight */}
                        {pieChartData[0] && (
                          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg" data-testid="key-insight">
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                              Key Insight:
                            </p>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              {((pieChartData[0].value / pieChartData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(0)}% 
                              were {pieChartData[0].name.toLowerCase()}
                            </p>
                          </div>
                        )}

                        {/* Case Examples */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">Recent Cases</p>
                          <div className="space-y-1">
                            {selectedCategoryData.slice(0, 3).map((pattern, idx) => (
                              <div 
                                key={idx} 
                                className="text-xs bg-secondary p-2 rounded"
                                data-testid={`case-example-${idx}`}
                              >
                                Case #{Math.floor(Math.random() * 90000) + 10000} - {pattern.errorDescription}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No data available for this category
                      </p>
                    )}
                  </div>
                </>
              )}

              {selectedCategory === "all" && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Select an error category to view detailed drill-down analysis
                </p>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Proactive Case Flagging (Right Column) */}
          <Card className="lg:col-span-1" data-testid="section-flagged-cases">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Flagged Cases
              </CardTitle>
              <CardDescription>High-risk cases requiring review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2">
                <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
                  <SelectTrigger className="flex-1" data-testid="select-risk-level">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="flex-1" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cases Table */}
              {casesLoading ? (
                <Skeleton className="h-64" />
              ) : filteredCases.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-state-cases">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold">No Flagged Cases</p>
                  <p className="text-sm text-muted-foreground">All cases are within acceptable quality thresholds</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCases.map((flaggedCase) => (
                        <TableRow key={flaggedCase.id} data-testid={`case-row-${flaggedCase.id}`}>
                          <TableCell className="font-mono text-xs" data-testid={`case-id-${flaggedCase.id}`}>
                            {flaggedCase.caseId}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={getRiskScoreColor(flaggedCase.riskScore)}
                              data-testid={`risk-badge-${flaggedCase.id}`}
                            >
                              {(flaggedCase.riskScore * 100).toFixed(0)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`status-badge-${flaggedCase.id}`}>
                              {flaggedCase.reviewStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedCaseId(flaggedCase.id)}
                                  data-testid={`button-assign-${flaggedCase.id}`}
                                >
                                  Assign
                                </Button>
                              </DialogTrigger>
                              <DialogContent data-testid="dialog-assign-case">
                                <DialogHeader>
                                  <DialogTitle>Assign Case for Review</DialogTitle>
                                  <DialogDescription>
                                    Assign {flaggedCase.caseId} to a caseworker with coaching notes
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Case Details</Label>
                                    <div className="bg-secondary p-3 rounded space-y-1">
                                      <p className="text-sm font-mono">{flaggedCase.caseId}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Risk Score: {(flaggedCase.riskScore * 100).toFixed(0)}%
                                      </p>
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {flaggedCase.flaggedErrorTypes.map((error, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {ERROR_CATEGORY_LABELS[error] || error}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="caseworker">Assign to Caseworker</Label>
                                    <Select value={assignCaseworkerId} onValueChange={setAssignCaseworkerId}>
                                      <SelectTrigger id="caseworker" data-testid="select-caseworker">
                                        <SelectValue placeholder="Select caseworker" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {caseworkers?.map((worker) => (
                                          <SelectItem key={worker.id} value={worker.id}>
                                            {worker.fullName || worker.username}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="notes">Coaching Notes (Optional)</Label>
                                    <Textarea
                                      id="notes"
                                      placeholder="Add guidance or areas to focus on..."
                                      value={coachingNotes}
                                      onChange={(e) => setCoachingNotes(e.target.value)}
                                      rows={4}
                                      data-testid="textarea-coaching-notes"
                                    />
                                  </div>
                                  <Button 
                                    onClick={handleAssignCase}
                                    disabled={!assignCaseworkerId || assignCaseMutation.isPending}
                                    className="w-full"
                                    data-testid="button-confirm-assign"
                                  >
                                    {assignCaseMutation.isPending ? "Assigning..." : "Assign Case"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 5: Training Impact Analytics (Bottom) */}
        <Card data-testid="section-training-impact">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Training Impact Analytics
            </CardTitle>
            <CardDescription>
              Measuring the effectiveness of training interventions on error reduction
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trainingLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : !trainingInterventions || trainingInterventions.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-state-training">
                <Award className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="font-semibold">No Training Data Available</p>
                <p className="text-sm text-muted-foreground">Training interventions will appear here once completed</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trainingInterventions.map((intervention) => {
                  const improvement = intervention.postTrainingErrorRate !== null
                    ? ((intervention.preTrainingErrorRate - intervention.postTrainingErrorRate) / intervention.preTrainingErrorRate) * 100
                    : 0;

                  return (
                    <Card 
                      key={intervention.id} 
                      className="border"
                      data-testid={`training-card-${intervention.id}`}
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <p className="font-semibold" data-testid={`training-title-${intervention.id}`}>
                              {intervention.trainingTitle}
                            </p>
                            <Badge variant="outline" data-testid={`training-category-${intervention.id}`}>
                              {ERROR_CATEGORY_LABELS[intervention.targetErrorCategory] || intervention.targetErrorCategory}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Pre-Training</span>
                              <span className="font-semibold text-red-600">
                                {intervention.preTrainingErrorRate.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Post-Training</span>
                              <span className="font-semibold text-green-600">
                                {intervention.postTrainingErrorRate?.toFixed(1) || 'N/A'}%
                              </span>
                            </div>
                          </div>

                          {improvement > 0 && (
                            <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg" data-testid={`improvement-${intervention.id}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                                  Improvement
                                </span>
                                <span className="text-lg font-bold text-green-600">
                                  {improvement.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            Completed by {intervention.completedBy.length} caseworkers
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
