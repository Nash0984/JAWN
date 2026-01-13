import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Building2,
  MapPin,
  FileText,
  Download,
  BarChart3,
  FileSpreadsheet,
  ClipboardCheck,
  UserCheck,
  GraduationCap,
  MessageSquareWarning,
  ArrowUpRight,
  Eye,
  Trophy,
  Medal,
  Award,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import TrainingImpactTracing from "@/components/per/TrainingImpactTracing";

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

interface LdssMetrics {
  ldssId: string;
  ldssName: string;
  ldssCode: string;
  region?: string;
  metrics: {
    incomeVerification: {
      total: number;
      errorCount: number;
      errorRate: number;
      avgDiscrepancy: number;
      resolvedCount: number;
    };
    consistencyChecks: {
      total: number;
      failedCount: number;
      warningCount: number;
      criticalCount: number;
    };
    caseworkerNudges: {
      total: number;
      acknowledgedCount: number;
      acknowledgeRate: number;
      errorsPreventedCount: number;
      avgRating: number;
    };
    duplicateClaims: {
      total: number;
      confirmedCount: number;
      resolvedCount: number;
    };
  };
}

interface LdssComparisonResponse {
  stateCode: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
    days: number;
  };
  statewideKPIs: {
    overallErrorRate: number;
    totalVerifications: number;
    totalErrors: number;
    totalNudgesGenerated: number;
    errorsPreventedByNudges: number;
    confirmedDuplicates: number;
    ldssCount: number;
  };
  ldssComparison: LdssMetrics[];
  highestRiskOffices: { name: string; errorRate: string; region?: string }[];
  generatedAt: string;
}

interface ExecutiveSummaryResponse {
  stateCode: string;
  reportMonth: string;
  keyMetrics: {
    currentErrorRate: string;
    errorRateChange: string;
    errorRateTrend: "improving" | "stable" | "worsening";
    totalVerificationsThisMonth: number;
    errorsDetectedThisMonth: number;
    estimatedErrorAmount: number;
  };
  nudgeImpact: {
    nudgesGeneratedThisMonth: number;
    errorsPreventedThisMonth: number;
    estimatedSavings: number;
  };
  permCompliance: {
    currentPeriod: string;
    totalSamples: number;
    completedReviews: number;
    completionRate: string;
    errorsFound: number;
    errorRate: string;
  } | null;
  generatedAt: string;
}

interface TrendDataPoint {
  period: string;
  totalVerifications?: number;
  errorCount?: number;
  errorRate?: number;
  avgDiscrepancy?: number;
  totalNudges?: number;
  acknowledgedNudges?: number;
  acknowledgeRate?: number;
  errorsPrevented?: number;
  totalChecks?: number;
  failedChecks?: number;
  failureRate?: number;
  criticalIssues?: number;
}

interface TrendAlert {
  checkType: string;
  currentWeek: number;
  previousWeek: number;
  percentChange: number;
  severity: "warning" | "critical";
}

interface PreCaseCoachingItem {
  id: string;
  caseId: string;
  nudgeTitle: string;
  nudgeDescription: string;
  riskScore: number;
  riskLevel: string;
  nudgeType: string;
  caseworkerId: string | null;
  createdAt: string;
  statutoryCitations: string[] | null;
  reasoningTrace: string | null;
}

interface ErrorCategoryAnalysis {
  category: string;
  totalChecks: number;
  failedChecks: number;
  criticalIssues: number;
  errorRate: number;
  avgImpact: number;
}

interface NudgeComplianceByWorker {
  caseworkerId: string;
  totalNudges: number;
  acknowledged: number;
  complianceRate: number;
  errorsPrevented: number;
  ignored: number;
}

interface SupervisorDashboardData {
  stateCode: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  pendingReview: {
    totalCases: number;
    highRiskCases: number;
    unacknowledgedNudges: number;
  };
  trendAlerts: TrendAlert[];
  preCaseCoachingQueue: PreCaseCoachingItem[];
  errorCategoryAnalysis: ErrorCategoryAnalysis[];
  nudgeComplianceByWorker: NudgeComplianceByWorker[];
  generatedAt: string;
}

interface ErrorDrillDownData {
  checkType: string;
  stateCode: string;
  period: {
    startDate: string;
    endDate: string;
    months: number;
  };
  weeklyTrend: {
    week: string;
    totalChecks: number;
    failedChecks: number;
    errorRate: number;
    criticalCount: number;
    avgImpact: number;
  }[];
  rootCauseBreakdown: Record<string, number>;
  recentExamples: {
    id: string;
    anonymizedCaseId: string;
    severity: string;
    message: string;
    details: string;
    fieldName: string;
    expectedValue: string;
    actualValue: string;
    impactAmount: number;
    createdAt: string;
  }[];
  generatedAt: string;
}

interface PermTrendDataPoint {
  samplePeriod: string;
  totalSamples: number;
  completedReviews: number;
  errorsFound: number;
  errorRate: number;
  overpaymentAmount: number;
  underpaymentAmount: number;
}

interface TrendsResponse {
  stateCode: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
    months: number;
    granularity: string;
  };
  trends: {
    incomeVerification: TrendDataPoint[];
    caseworkerNudges: TrendDataPoint[];
    permCompliance: PermTrendDataPoint[];
    consistencyChecks: TrendDataPoint[];
  };
  summary: {
    latestErrorRate: number;
    errorRateTrend: number;
    totalErrorsPrevented: number;
    currentPermErrorRate: number;
  };
  generatedAt: string;
}

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function PerDashboard() {
  const [stateCode, setStateCode] = useState("MD");
  const [ldssId, setLdssId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);
  const [coachingNudgeId, setCoachingNudgeId] = useState<string | null>(null);
  const [coachingNotes, setCoachingNotes] = useState("");
  const [coachingAction, setCoachingAction] = useState<string>("coached");
  const { toast } = useToast();

  // Fetch LDSS offices for the selector
  const { data: ldssOffices } = useQuery<{ success: boolean; data: { id: string; name: string; code: string }[] }>({
    queryKey: [`/api/per/ldss-offices?stateCode=${stateCode}`],
  });

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

  const { data: ldssComparison, isLoading: ldssComparisonLoading } = useQuery<{ success: boolean; data: LdssComparisonResponse }>({
    queryKey: ["/api/per/admin/ldss-comparison", stateCode, refreshKey],
  });

  const { data: executiveSummary, isLoading: executiveSummaryLoading } = useQuery<{ success: boolean; data: ExecutiveSummaryResponse }>({
    queryKey: ["/api/per/admin/executive-summary", stateCode, refreshKey],
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery<{ success: boolean; data: TrendsResponse }>({
    queryKey: ["/api/per/admin/trends", stateCode, refreshKey],
  });

  const { data: supervisorData, isLoading: supervisorLoading } = useQuery<{ success: boolean; data: SupervisorDashboardData }>({
    queryKey: [`/api/per/supervisor/dashboard?stateCode=${stateCode}${ldssId ? `&ldssId=${ldssId}` : ''}`, refreshKey],
  });

  const { data: drillDownData, isLoading: drillDownLoading } = useQuery<{ success: boolean; data: ErrorDrillDownData }>({
    queryKey: [`/api/per/supervisor/error-drill-down/${encodeURIComponent(drillDownCategory || '')}?stateCode=${stateCode}${ldssId ? `&ldssId=${ldssId}` : ''}`, refreshKey],
    enabled: !!drillDownCategory,
  });

  // LDSS League query
  const [leaguePeriod, setLeaguePeriod] = useState<string>('monthly');
  const { data: ldssLeague, isLoading: leagueLoading } = useQuery<{
    success: boolean;
    data: {
      periodType: string;
      periodStart: string;
      periodEnd: string;
      totalOffices: number;
      rankings: Array<{
        officeId: string;
        officeName: string;
        officeCode: string;
        totalChecks: number;
        passedChecks: number;
        accuracyRate: number;
        totalNudges: number;
        followedNudges: number;
        nudgeComplianceRate: number;
        compositeScore: number;
        rank: number;
        tier: 'gold' | 'silver' | 'bronze';
        tierBadge: string;
      }>;
      topPerformers: Array<{
        officeId: string;
        officeName: string;
        compositeScore: number;
        rank: number;
        tierBadge: string;
      }>;
      stateAverage: {
        accuracyRate: number;
        nudgeComplianceRate: number;
      };
    };
  }>({
    queryKey: [`/api/per/ldss-league?stateCode=${stateCode}&periodType=${leaguePeriod}`, refreshKey],
  });

  const coachingMutation = useMutation({
    mutationFn: async ({ nudgeId, action, notes }: { nudgeId: string; action: string; notes: string }) => {
      return apiRequest(`/api/per/supervisor/coaching-action/${nudgeId}`, {
        method: 'POST',
        body: JSON.stringify({ action, notes }),
      });
    },
    onSuccess: () => {
      toast({ title: "Coaching action recorded successfully" });
      setCoachingNudgeId(null);
      setCoachingNotes("");
      // Invalidate supervisor dashboard queries with current filters
      queryClient.invalidateQueries({ 
        queryKey: [`/api/per/supervisor/dashboard?stateCode=${stateCode}${ldssId ? `&ldssId=${ldssId}` : ''}`] 
      });
    },
    onError: (error) => {
      toast({ title: "Failed to record coaching action", variant: "destructive" });
    },
  });

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleExportPDF = async () => {
    if (!execSummary || !ldssData) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const reportDate = format(new Date(), "MMMM d, yyyy");
      doc.setFontSize(18);
      doc.text("PER Executive Summary Report", 20, 20);
      doc.setFontSize(10);
      doc.text(`State: ${execSummary.stateCode} | Generated: ${reportDate}`, 20, 30);
      doc.setFontSize(12);
      doc.text("Key Performance Metrics", 20, 45);
      doc.setFontSize(10);
      let y = 55;
      doc.text(`Current Error Rate: ${execSummary.keyMetrics.currentErrorRate}`, 25, y); y += 8;
      doc.text(`Error Rate Change: ${execSummary.keyMetrics.errorRateChange}`, 25, y); y += 8;
      doc.text(`Total Verifications (Month): ${execSummary.keyMetrics.totalVerificationsThisMonth.toLocaleString()}`, 25, y); y += 8;
      doc.text(`Errors Detected: ${execSummary.keyMetrics.errorsDetectedThisMonth.toLocaleString()}`, 25, y); y += 8;
      doc.text(`Estimated Error Amount: $${execSummary.keyMetrics.estimatedErrorAmount.toLocaleString()}`, 25, y); y += 15;
      doc.setFontSize(12);
      doc.text("Nudge Impact", 20, y); y += 10;
      doc.setFontSize(10);
      doc.text(`Nudges Generated: ${execSummary.nudgeImpact.nudgesGeneratedThisMonth.toLocaleString()}`, 25, y); y += 8;
      doc.text(`Errors Prevented: ${execSummary.nudgeImpact.errorsPreventedThisMonth.toLocaleString()}`, 25, y); y += 8;
      doc.text(`Estimated Savings: $${execSummary.nudgeImpact.estimatedSavings.toLocaleString()}`, 25, y); y += 15;
      if (execSummary.permCompliance) {
        doc.setFontSize(12);
        doc.text("PERM Compliance", 20, y); y += 10;
        doc.setFontSize(10);
        doc.text(`Period: ${execSummary.permCompliance.currentPeriod}`, 25, y); y += 8;
        doc.text(`Completion Rate: ${execSummary.permCompliance.completionRate}`, 25, y); y += 8;
        doc.text(`PERM Error Rate: ${execSummary.permCompliance.errorRate}`, 25, y); y += 15;
      }
      doc.setFontSize(12);
      doc.text("LDSS Office Performance Summary", 20, y); y += 10;
      doc.setFontSize(10);
      doc.text(`Total Offices: ${ldssData.statewideKPIs.ldssCount}`, 25, y); y += 8;
      doc.text(`Statewide Error Rate: ${ldssData.statewideKPIs.overallErrorRate.toFixed(2)}%`, 25, y); y += 15;
      if (ldssData.highestRiskOffices?.length > 0) {
        doc.setFontSize(12);
        doc.text("Highest Risk Offices", 20, y); y += 10;
        doc.setFontSize(10);
        ldssData.highestRiskOffices.forEach((office, i) => {
          doc.text(`${i + 1}. ${office.name} - Error Rate: ${office.errorRate}`, 25, y);
          y += 7;
        });
      }
      const fileName = `PER_Executive_Summary_${stateCode}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);
      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "Failed to export PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!execSummary || !ldssData) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "JAWN PER Dashboard";
      workbook.created = new Date();
      const summarySheet = workbook.addWorksheet("Executive Summary");
      summarySheet.columns = [
        { header: "Metric", key: "metric", width: 35 },
        { header: "Value", key: "value", width: 25 },
      ];
      summarySheet.addRow({ metric: "Report Month", value: execSummary.reportMonth });
      summarySheet.addRow({ metric: "State Code", value: execSummary.stateCode });
      summarySheet.addRow({ metric: "", value: "" });
      summarySheet.addRow({ metric: "KEY METRICS", value: "" });
      summarySheet.addRow({ metric: "Current Error Rate", value: execSummary.keyMetrics.currentErrorRate });
      summarySheet.addRow({ metric: "Error Rate Change", value: execSummary.keyMetrics.errorRateChange });
      summarySheet.addRow({ metric: "Error Rate Trend", value: execSummary.keyMetrics.errorRateTrend });
      summarySheet.addRow({ metric: "Total Verifications (Month)", value: execSummary.keyMetrics.totalVerificationsThisMonth });
      summarySheet.addRow({ metric: "Errors Detected", value: execSummary.keyMetrics.errorsDetectedThisMonth });
      summarySheet.addRow({ metric: "Estimated Error Amount", value: `$${execSummary.keyMetrics.estimatedErrorAmount.toLocaleString()}` });
      summarySheet.addRow({ metric: "", value: "" });
      summarySheet.addRow({ metric: "NUDGE IMPACT", value: "" });
      summarySheet.addRow({ metric: "Nudges Generated", value: execSummary.nudgeImpact.nudgesGeneratedThisMonth });
      summarySheet.addRow({ metric: "Errors Prevented", value: execSummary.nudgeImpact.errorsPreventedThisMonth });
      summarySheet.addRow({ metric: "Estimated Savings", value: `$${execSummary.nudgeImpact.estimatedSavings.toLocaleString()}` });
      if (execSummary.permCompliance) {
        summarySheet.addRow({ metric: "", value: "" });
        summarySheet.addRow({ metric: "PERM COMPLIANCE", value: "" });
        summarySheet.addRow({ metric: "Current Period", value: execSummary.permCompliance.currentPeriod });
        summarySheet.addRow({ metric: "Total Samples", value: execSummary.permCompliance.totalSamples });
        summarySheet.addRow({ metric: "Completed Reviews", value: execSummary.permCompliance.completedReviews });
        summarySheet.addRow({ metric: "Completion Rate", value: execSummary.permCompliance.completionRate });
        summarySheet.addRow({ metric: "PERM Error Rate", value: execSummary.permCompliance.errorRate });
      }
      const ldssSheet = workbook.addWorksheet("LDSS Office Comparison");
      ldssSheet.columns = [
        { header: "Office Name", key: "name", width: 30 },
        { header: "Region", key: "region", width: 15 },
        { header: "Error Rate", key: "errorRate", width: 15 },
        { header: "Verifications", key: "verifications", width: 15 },
        { header: "Nudges Generated", key: "nudges", width: 15 },
        { header: "Errors Prevented", key: "prevented", width: 15 },
      ];
      ldssData.ldssComparison?.forEach((office) => {
        ldssSheet.addRow({
          name: office.ldssName,
          region: office.region || "N/A",
          errorRate: `${office.metrics.incomeVerification.errorRate.toFixed(2)}%`,
          verifications: office.metrics.incomeVerification.total,
          nudges: office.metrics.caseworkerNudges.total,
          prevented: office.metrics.caseworkerNudges.errorsPreventedCount,
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PER_Executive_Report_${stateCode}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel exported successfully" });
    } catch (error) {
      console.error("Excel export error:", error);
      toast({ title: "Failed to export Excel", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const dashboardData = metrics?.data;
  const nudges = highPriorityNudges?.data || [];
  const health = systemHealth?.data;
  const riskQueueData = riskQueue?.data;
  const riskStatsData = riskStats?.data;
  const ldssData = ldssComparison?.data;
  const execSummary = executiveSummary?.data;
  const trends = trendsData?.data;
  const supervisorDash = supervisorData?.data;

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
        <Tabs defaultValue="executive" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="executive" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" /> Executive Overview
            </TabsTrigger>
            <TabsTrigger value="supervisor" className="flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" /> Supervisor Dashboard
            </TabsTrigger>
            <TabsTrigger value="riskQueue">Risk Queue</TabsTrigger>
            <TabsTrigger value="nudges">High Priority Nudges</TabsTrigger>
            <TabsTrigger value="errors">Error Breakdown</TabsTrigger>
            <TabsTrigger value="perm">PERM Compliance</TabsTrigger>
            <TabsTrigger value="ldssLeague" className="flex items-center gap-1">
              <Trophy className="h-4 w-4" /> LDSS League
            </TabsTrigger>
            <TabsTrigger value="solutionsHub" className="flex items-center gap-1">
              <GraduationCap className="h-4 w-4" /> Solutions Hub
            </TabsTrigger>
            <TabsTrigger value="trainingImpact" className="flex items-center gap-1">
              <Target className="h-4 w-4" /> Training Impact
            </TabsTrigger>
          </TabsList>

          {/* Executive Overview Tab - State Admin View */}
          <TabsContent value="executive">
            <div className="space-y-6">
              {/* Executive Summary KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    Statewide Executive Summary
                  </CardTitle>
                  <CardDescription>
                    {execSummary?.reportMonth || "Current Month"} - High-level metrics for leadership briefings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {executiveSummaryLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className={execSummary?.keyMetrics?.errorRateTrend === "improving" ? "border-green-500/50" : execSummary?.keyMetrics?.errorRateTrend === "worsening" ? "border-red-500/50" : ""}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Statewide Error Rate</p>
                              <p className="text-3xl font-bold">{execSummary?.keyMetrics?.currentErrorRate || "0%"}</p>
                              <p className="text-sm flex items-center gap-1">
                                <span className={execSummary?.keyMetrics?.errorRateTrend === "improving" ? "text-green-600" : execSummary?.keyMetrics?.errorRateTrend === "worsening" ? "text-red-600" : ""}>
                                  {execSummary?.keyMetrics?.errorRateChange || "0%"}
                                </span>
                                {execSummary?.keyMetrics?.errorRateTrend === "improving" && <TrendingDown className="h-4 w-4 text-green-500" />}
                                {execSummary?.keyMetrics?.errorRateTrend === "worsening" && <TrendingUp className="h-4 w-4 text-red-500" />}
                                <span className="text-muted-foreground">vs last month</span>
                              </p>
                            </div>
                            <Target className="h-10 w-10 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-green-500/50">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Errors Prevented This Month</p>
                              <p className="text-3xl font-bold text-green-600">{execSummary?.nudgeImpact?.errorsPreventedThisMonth || 0}</p>
                              <p className="text-sm text-muted-foreground">
                                Est. Savings: ${(execSummary?.nudgeImpact?.estimatedSavings || 0).toLocaleString()}
                              </p>
                            </div>
                            <CheckCircle className="h-10 w-10 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">PERM Compliance</p>
                              <p className="text-3xl font-bold">{execSummary?.permCompliance?.completionRate || "N/A"}</p>
                              <p className="text-sm text-muted-foreground">
                                {execSummary?.permCompliance?.currentPeriod || "No active period"}
                              </p>
                            </div>
                            <ShieldCheck className="h-10 w-10 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* LDSS Office Comparison Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-orange-500" />
                        LDSS Office Comparison
                      </CardTitle>
                      <CardDescription>
                        Compare error rates, nudge effectiveness, and workload across {ldssData?.statewideKPIs?.ldssCount || 24} LDSS offices
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isExporting || !execSummary || !ldssData}>
                          <Download className="h-4 w-4 mr-2" />
                          {isExporting ? "Exporting..." : "Export Report"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportPDF}>
                          <FileText className="h-4 w-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportExcel}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Export as Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {ldssComparisonLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : !ldssData?.ldssComparison?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4" />
                      <p>No LDSS offices configured</p>
                      <p className="text-sm">Configure counties in the system to see comparisons</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            <th className="text-left py-3 px-2 font-medium">LDSS Office</th>
                            <th className="text-left py-3 px-2 font-medium">Region</th>
                            <th className="text-right py-3 px-2 font-medium">Error Rate</th>
                            <th className="text-right py-3 px-2 font-medium">Verifications</th>
                            <th className="text-right py-3 px-2 font-medium">Nudge Rate</th>
                            <th className="text-right py-3 px-2 font-medium">Errors Prevented</th>
                            <th className="text-center py-3 px-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ldssData.ldssComparison.map((ldss) => (
                            <tr key={ldss.ldssId} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-medium">{ldss.ldssName}</td>
                              <td className="py-3 px-2 text-muted-foreground capitalize">{ldss.region || "-"}</td>
                              <td className="py-3 px-2 text-right">
                                <span className={ldss.metrics.incomeVerification.errorRate > 6 ? "text-red-600 font-medium" : ldss.metrics.incomeVerification.errorRate > 4 ? "text-yellow-600" : "text-green-600"}>
                                  {ldss.metrics.incomeVerification.errorRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">{ldss.metrics.incomeVerification.total}</td>
                              <td className="py-3 px-2 text-right">
                                {ldss.metrics.caseworkerNudges.acknowledgeRate.toFixed(0)}%
                              </td>
                              <td className="py-3 px-2 text-right text-green-600">
                                {ldss.metrics.caseworkerNudges.errorsPreventedCount}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <Badge variant={ldss.metrics.incomeVerification.errorRate > 6 ? "destructive" : ldss.metrics.incomeVerification.errorRate > 4 ? "secondary" : "default"}>
                                  {ldss.metrics.incomeVerification.errorRate > 6 ? "High Risk" : ldss.metrics.incomeVerification.errorRate > 4 ? "Monitor" : "Good"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Highest Risk Offices Alert */}
              {ldssData?.highestRiskOffices && ldssData.highestRiskOffices.length > 0 && (
                <Card className="border-red-500/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Highest Risk Offices - Action Required
                    </CardTitle>
                    <CardDescription>
                      These offices have the highest error rates and may require additional support or intervention
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {ldssData.highestRiskOffices.map((office, index) => (
                        <Card key={index} className="border-l-4 border-l-red-500">
                          <CardContent className="py-3">
                            <div className="font-medium">{office.name}</div>
                            <div className="text-2xl font-bold text-red-600">{office.errorRate}</div>
                            <div className="text-xs text-muted-foreground capitalize">{office.region || "Unknown"} Region</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Statewide Aggregates */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <FileSearch className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Verifications</p>
                        <p className="text-2xl font-bold">{ldssData?.statewideKPIs?.totalVerifications?.toLocaleString() || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Errors Detected</p>
                        <p className="text-2xl font-bold text-red-600">{ldssData?.statewideKPIs?.totalErrors?.toLocaleString() || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Bell className="h-8 w-8 text-orange-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Nudges Generated</p>
                        <p className="text-2xl font-bold">{ldssData?.statewideKPIs?.totalNudgesGenerated?.toLocaleString() || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Duplicates Found</p>
                        <p className="text-2xl font-bold">{ldssData?.statewideKPIs?.confirmedDuplicates?.toLocaleString() || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Statewide Trend Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Error Rate Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Error Rate Trend</CardTitle>
                    <CardDescription>Statewide payment error rate over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trendsLoading ? (
                      <Skeleton className="h-[200px] w-full" />
                    ) : !trends?.trends?.incomeVerification?.length ? (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <p>No trend data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={trends.trends.incomeVerification.map(t => ({
                          ...t,
                          period: t.period ? format(new Date(t.period), "MMM d") : ""
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="errorRate" 
                            name="Error Rate %" 
                            stroke="#ef4444" 
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Nudge Effectiveness */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Nudge Effectiveness</CardTitle>
                    <CardDescription>Errors prevented through caseworker nudges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trendsLoading ? (
                      <Skeleton className="h-[200px] w-full" />
                    ) : !trends?.trends?.caseworkerNudges?.length ? (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <p>No nudge data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={trends.trends.caseworkerNudges.map(t => ({
                          ...t,
                          period: t.period ? format(new Date(t.period), "MMM d") : ""
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="totalNudges" name="Nudges Generated" fill="#f59e0b" />
                          <Bar dataKey="errorsPrevented" name="Errors Prevented" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Verification Volume */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Verification Volume</CardTitle>
                    <CardDescription>Income verifications and errors detected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trendsLoading ? (
                      <Skeleton className="h-[200px] w-full" />
                    ) : !trends?.trends?.incomeVerification?.length ? (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <p>No verification data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={trends.trends.incomeVerification.map(t => ({
                          ...t,
                          period: t.period ? format(new Date(t.period), "MMM d") : ""
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="totalVerifications" name="Verifications" fill="#06b6d4" />
                          <Bar dataKey="errorCount" name="Errors Found" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* PERM Compliance Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">PERM Error Rate by Quarter</CardTitle>
                    <CardDescription>Federal QC sample error rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trendsLoading ? (
                      <Skeleton className="h-[200px] w-full" />
                    ) : !trends?.trends?.permCompliance?.length ? (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <p>No PERM data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={trends.trends.permCompliance}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="samplePeriod" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="errorRate" 
                            name="PERM Error Rate %" 
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Supervisor Dashboard Tab - Proactive QA & Coaching */}
          <TabsContent value="supervisor">
            <div className="space-y-6">
              {/* LDSS Office Selector for Tier-2 filtering */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">View Scope:</span>
                </div>
                <Select 
                  value={ldssId || "statewide"} 
                  onValueChange={(val) => setLdssId(val === "statewide" ? null : val)}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select LDSS Office" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="statewide">
                      <span className="flex items-center gap-2">
                        <Eye className="h-4 w-4" /> Statewide View (Admin)
                      </span>
                    </SelectItem>
                    {ldssOffices?.data?.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name} ({office.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ldssId && (
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    Office-Specific View (Tier 2)
                  </Badge>
                )}
                {!ldssId && (
                  <Badge variant="outline" className="text-purple-600 border-purple-300">
                    Statewide View (Tier 1)
                  </Badge>
                )}
              </div>

              {/* Supervisor Landing - Trend Alerts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={supervisorDash?.pendingReview?.highRiskCases ? "border-red-500/50" : ""}>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" /> High-Risk Cases Pending
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {supervisorLoading ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-red-600">
                          {supervisorDash?.pendingReview?.highRiskCases || 0}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          of {supervisorDash?.pendingReview?.totalCases || 0} total flagged
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <MessageSquareWarning className="h-4 w-4 text-orange-500" /> Unacknowledged Nudges
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {supervisorLoading ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      <>
                        <div className="text-3xl font-bold">
                          {supervisorDash?.pendingReview?.unacknowledgedNudges || 0}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Awaiting caseworker response
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className={supervisorDash?.trendAlerts?.length ? "border-yellow-500/50" : ""}>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <ArrowUpRight className="h-4 w-4 text-yellow-600" /> Error Trend Alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {supervisorLoading ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-yellow-600">
                          {supervisorDash?.trendAlerts?.length || 0}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Categories with spike this week
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Trend Alerts - Data-Driven Error Categories */}
              {supervisorDash?.trendAlerts && supervisorDash.trendAlerts.length > 0 && (
                <Card className="border-yellow-500/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-700">
                      <AlertTriangle className="h-5 w-5" />
                      Error Category Spikes Detected
                    </CardTitle>
                    <CardDescription>
                      These error categories show a significant increase compared to last week. Consider targeted coaching.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {supervisorDash.trendAlerts.map((alert, i) => (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                          <div className="flex items-center gap-3">
                            <Badge variant={alert.severity === 'critical' ? "destructive" : "secondary"}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <div>
                              <p className="font-medium capitalize">{alert.checkType?.replace(/_/g, ' ') || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">
                                This week: {alert.currentWeek} | Last week: {alert.previousWeek}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-lg font-bold ${alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                              +{alert.percentChange}%
                            </span>
                            <p className="text-xs text-muted-foreground">increase</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pre-Case Coaching Queue */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-blue-500" />
                        Pre-Case Coaching Queue
                      </CardTitle>
                      <CardDescription>
                        High-risk cases flagged before finalization. Review and coach caseworkers proactively.
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {supervisorDash?.preCaseCoachingQueue?.length || 0} cases
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {supervisorLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : !supervisorDash?.preCaseCoachingQueue?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No high-risk cases in coaching queue</p>
                      <p className="text-sm">All flagged cases have been reviewed</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {supervisorDash.preCaseCoachingQueue.map((item) => (
                          <div key={item.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={item.riskLevel === 'critical' ? "destructive" : item.riskLevel === 'high' ? "destructive" : "secondary"}>
                                    {item.riskLevel?.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    Risk Score: {item.riskScore}
                                  </span>
                                  <span className="text-sm text-muted-foreground">|</span>
                                  <span className="text-sm text-muted-foreground capitalize">
                                    {item.nudgeType?.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <h4 className="font-medium">{item.nudgeTitle}</h4>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {item.nudgeDescription}
                                </p>
                                {item.statutoryCitations && item.statutoryCitations.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.statutoryCitations.slice(0, 3).map((cite, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {cite}
                                      </Badge>
                                    ))}
                                    {item.statutoryCitations.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{item.statutoryCitations.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Button size="sm" variant="default">
                                  <Eye className="h-3 w-3 mr-1" />
                                  Review
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  {item.createdAt ? format(new Date(item.createdAt), "MMM d, h:mm a") : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Two-Column Layout: Error Categories + Nudge Compliance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Data-Driven Error Category Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-purple-500" />
                      Error Category Analysis
                    </CardTitle>
                    <CardDescription>
                      Error types discovered from QC data (30 days). Categories emerge from actual patterns, not hardcoded.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {supervisorLoading ? (
                      <Skeleton className="h-[250px] w-full" />
                    ) : !supervisorDash?.errorCategoryAnalysis?.length ? (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>No error category data available</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">Click any bar to drill down into root causes</p>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart 
                            data={supervisorDash.errorCategoryAnalysis.map(cat => ({
                              category: cat.category?.replace(/_/g, ' ').slice(0, 15) || 'Unknown',
                              fullCategory: cat.category,
                              failedChecks: cat.failedChecks,
                              totalChecks: cat.totalChecks,
                              errorRate: cat.errorRate?.toFixed(1)
                            }))}
                            layout="vertical"
                            onClick={(data) => {
                              if (data && data.activePayload && data.activePayload[0]) {
                                setDrillDownCategory(data.activePayload[0].payload.fullCategory);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11 }} />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-background border rounded p-2 shadow-lg">
                                      <p className="font-medium capitalize">{data.fullCategory?.replace(/_/g, ' ')}</p>
                                      <p className="text-sm">Failed: {data.failedChecks} of {data.totalChecks}</p>
                                      <p className="text-sm">Error Rate: {data.errorRate}%</p>
                                      <p className="text-xs text-blue-500 mt-1">Click to drill down</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="failedChecks" fill="#ef4444" name="Failed Checks" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Caseworker Nudge Compliance Tracking */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-green-500" />
                      Caseworker Nudge Compliance
                    </CardTitle>
                    <CardDescription>
                      Track who follows vs ignores AI guidance. Identify coaching opportunities.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {supervisorLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : !supervisorDash?.nudgeComplianceByWorker?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4" />
                        <p>No nudge compliance data available</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[250px]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background border-b">
                            <tr>
                              <th className="text-left py-2 px-2 font-medium">Caseworker</th>
                              <th className="text-right py-2 px-2 font-medium">Nudges</th>
                              <th className="text-right py-2 px-2 font-medium">Compliance</th>
                              <th className="text-right py-2 px-2 font-medium">Prevented</th>
                              <th className="text-right py-2 px-2 font-medium">Ignored</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supervisorDash.nudgeComplianceByWorker.map((worker, i) => (
                              <tr key={i} className="border-b hover:bg-muted/50">
                                <td className="py-2 px-2 font-medium">
                                  {worker.caseworkerId?.slice(0, 8) || 'Unassigned'}...
                                </td>
                                <td className="py-2 px-2 text-right">{worker.totalNudges}</td>
                                <td className="py-2 px-2 text-right">
                                  <span className={worker.complianceRate < 50 ? "text-red-600 font-medium" : worker.complianceRate >= 80 ? "text-green-600 font-medium" : ""}>
                                    {worker.complianceRate.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right text-green-600">{worker.errorsPrevented}</td>
                                <td className="py-2 px-2 text-right text-red-600">{worker.ignored}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

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

          {/* LDSS League Tab */}
          <TabsContent value="ldssLeague">
            <div className="space-y-6">
              {/* League Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        LDSS League for PER Excellence
                      </CardTitle>
                      <CardDescription>
                        Recognize and celebrate LDSS offices with the highest payment error prevention rates
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={leaguePeriod} onValueChange={setLeaguePeriod}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="all_time">All Time</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => setRefreshKey(k => k + 1)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Top Performers Podium */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leagueLoading ? (
                    <div className="flex justify-center gap-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-40" />)}
                    </div>
                  ) : (
                    <div className="flex justify-center items-end gap-4">
                      {/* 2nd Place */}
                      {ldssLeague?.data?.topPerformers?.[1] && (
                        <div className="text-center">
                          <div className="text-4xl mb-2">🥈</div>
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 h-24 flex flex-col justify-center">
                            <div className="font-semibold text-sm">{ldssLeague.data.topPerformers[1].officeName.replace(' LDSS', '')}</div>
                            <div className="text-2xl font-bold text-gray-600">{ldssLeague.data.topPerformers[1].compositeScore}</div>
                            <div className="text-xs text-muted-foreground">points</div>
                          </div>
                        </div>
                      )}
                      {/* 1st Place */}
                      {ldssLeague?.data?.topPerformers?.[0] && (
                        <div className="text-center">
                          <div className="text-5xl mb-2">🥇</div>
                          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 h-32 flex flex-col justify-center border-2 border-yellow-400">
                            <div className="font-semibold">{ldssLeague.data.topPerformers[0].officeName.replace(' LDSS', '')}</div>
                            <div className="text-3xl font-bold text-yellow-600">{ldssLeague.data.topPerformers[0].compositeScore}</div>
                            <div className="text-xs text-muted-foreground">points</div>
                          </div>
                        </div>
                      )}
                      {/* 3rd Place */}
                      {ldssLeague?.data?.topPerformers?.[2] && (
                        <div className="text-center">
                          <div className="text-4xl mb-2">🥉</div>
                          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 h-20 flex flex-col justify-center">
                            <div className="font-semibold text-sm">{ldssLeague.data.topPerformers[2].officeName.replace(' LDSS', '')}</div>
                            <div className="text-xl font-bold text-orange-600">{ldssLeague.data.topPerformers[2].compositeScore}</div>
                            <div className="text-xs text-muted-foreground">points</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {!leagueLoading && (!ldssLeague?.data?.topPerformers || ldssLeague.data.topPerformers.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No league data available yet</p>
                      <p className="text-sm">Rankings will appear as LDSS offices process cases</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* State Averages */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Participating Offices</p>
                        <p className="text-2xl font-bold">{ldssLeague?.data?.totalOffices || 0}</p>
                      </div>
                      <Building2 className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Accuracy Rate</p>
                        <p className="text-2xl font-bold">{ldssLeague?.data?.stateAverage?.accuracyRate || 0}%</p>
                      </div>
                      <Target className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Nudge Compliance</p>
                        <p className="text-2xl font-bold">{ldssLeague?.data?.stateAverage?.nudgeComplianceRate || 0}%</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Full Rankings Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Medal className="h-4 w-4" />
                    Full League Standings
                  </CardTitle>
                  <CardDescription>
                    Composite score = 60% accuracy + 30% nudge compliance + 10% volume bonus
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {leagueLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr className="text-left text-sm">
                            <th className="py-2 px-2 w-12">Rank</th>
                            <th className="py-2 px-2">LDSS Office</th>
                            <th className="py-2 px-2 text-right">Cases</th>
                            <th className="py-2 px-2 text-right">Accuracy</th>
                            <th className="py-2 px-2 text-right">Nudge %</th>
                            <th className="py-2 px-2 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ldssLeague?.data?.rankings?.map((office) => (
                            <tr key={office.officeId} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-1">
                                  {office.tierBadge && <span className="text-lg">{office.tierBadge}</span>}
                                  {!office.tierBadge && <span className="text-muted-foreground">{office.rank}</span>}
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <div className="font-medium">{office.officeName.replace(' LDSS', '')}</div>
                                <div className="text-xs text-muted-foreground">{office.officeCode}</div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className="text-sm">{office.totalChecks}</span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <Badge variant={office.accuracyRate >= 95 ? 'default' : office.accuracyRate >= 90 ? 'secondary' : 'destructive'}>
                                  {office.accuracyRate}%
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className={office.nudgeComplianceRate >= 80 ? 'text-green-600' : office.nudgeComplianceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                                  {office.nudgeComplianceRate}%
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className="font-bold">{office.compositeScore}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(!ldssLeague?.data?.rankings || ldssLeague.data.rankings.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          No ranking data available
                        </div>
                      )}
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* PER Excellence Achievements Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-purple-500" />
                    PER Excellence Achievements
                  </CardTitle>
                  <CardDescription>
                    Individual caseworker achievements for error prevention excellence
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-sm">Error Prevention Rookie</span>
                      </div>
                      <p className="text-xs text-muted-foreground">10 error-free cases</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm">Error Prevention Champion</span>
                      </div>
                      <p className="text-xs text-muted-foreground">50 error-free cases</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-sm">Zero Defect Master</span>
                      </div>
                      <p className="text-xs text-muted-foreground">100 error-free cases</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-sm">Nudge Follower</span>
                      </div>
                      <p className="text-xs text-muted-foreground">25 AI guidance followed</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-sm">Quality Conscience</span>
                      </div>
                      <p className="text-xs text-muted-foreground">98%+ accuracy rate</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">LDSS League All-Star</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Top 3 office contributor</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Solutions Hub Tab - Training Resources for Error Categories */}
          <TabsContent value="solutionsHub">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-purple-500" />
                    Solutions Hub - Training Resources & Policy References
                  </CardTitle>
                  <CardDescription>
                    Comprehensive training materials, job aids, and policy references for reducing errors in key categories.
                    Per PTIG: "Solutions Hub displays links to the specific training tools."
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Wages & Salaries */}
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-blue-500" />
                          Wages & Salaries
                        </CardTitle>
                        <CardDescription>Income verification and earned income documentation</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Training Resources</h5>
                          <div className="space-y-1">
                            <a href="/training/income-docs" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                              <FileText className="h-3 w-3" /> Income Documentation Requirements
                            </a>
                            <a href="/training/w2-verification" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                              <FileText className="h-3 w-3" /> W-2 vs Pay Stub Verification (Video)
                            </a>
                            <a href="/training/self-employment" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                              <FileText className="h-3 w-3" /> Self-Employment Income Calculation
                            </a>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Policy References</h5>
                          <div className="space-y-1">
                            <p className="text-xs font-mono text-muted-foreground">7 CFR 273.9 - Income and Deductions</p>
                            <p className="text-xs font-mono text-muted-foreground">COMAR 07.03.17.05 - Income Standards</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Shelter Deduction */}
                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-green-500" />
                          Shelter Deduction
                        </CardTitle>
                        <CardDescription>Housing costs, utilities, and SUA calculations</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Training Resources</h5>
                          <div className="space-y-1">
                            <a href="/training/sua-calculator" className="flex items-center gap-2 text-sm text-green-600 hover:underline">
                              <FileText className="h-3 w-3" /> Standard Utility Allowance Calculator
                            </a>
                            <a href="/training/shelter-guide" className="flex items-center gap-2 text-sm text-green-600 hover:underline">
                              <FileText className="h-3 w-3" /> Shelter Deduction Guidelines
                            </a>
                            <a href="/training/cooling-sua" className="flex items-center gap-2 text-sm text-green-600 hover:underline">
                              <FileText className="h-3 w-3" /> Seasonal Cooling SUA Application
                            </a>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Policy References</h5>
                          <div className="space-y-1">
                            <p className="text-xs font-mono text-muted-foreground">7 CFR 273.9(d) - Shelter Deductions</p>
                            <p className="text-xs font-mono text-muted-foreground">COMAR 07.03.17.09 - Utility Standards</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Household Composition */}
                    <Card className="border-l-4 border-l-orange-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-5 w-5 text-orange-500" />
                          Household Composition
                        </CardTitle>
                        <CardDescription>Who is in the household and purchasing/preparing food together</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Training Resources</h5>
                          <div className="space-y-1">
                            <a href="/training/household-comp" className="flex items-center gap-2 text-sm text-orange-600 hover:underline">
                              <FileText className="h-3 w-3" /> Who Is In the Household? Job Aid
                            </a>
                            <a href="/training/boarder-rules" className="flex items-center gap-2 text-sm text-orange-600 hover:underline">
                              <FileText className="h-3 w-3" /> Boarder vs Household Member (Video)
                            </a>
                            <a href="/training/student-rules" className="flex items-center gap-2 text-sm text-orange-600 hover:underline">
                              <FileText className="h-3 w-3" /> Student Eligibility Rules
                            </a>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Policy References</h5>
                          <div className="space-y-1">
                            <p className="text-xs font-mono text-muted-foreground">7 CFR 273.1 - Household Concept</p>
                            <p className="text-xs font-mono text-muted-foreground">COMAR 07.03.17.03 - Household Definition</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ABAWD Time Limits */}
                    <Card className="border-l-4 border-l-red-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          ABAWD Work Requirements
                        </CardTitle>
                        <CardDescription>Able-bodied adults without dependents time limits and exemptions</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Training Resources</h5>
                          <div className="space-y-1">
                            <a href="/training/abawd-exemptions" className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                              <FileText className="h-3 w-3" /> ABAWD Exemption Checklist
                            </a>
                            <a href="/training/work-verification" className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                              <FileText className="h-3 w-3" /> Work Requirement Verification (Video)
                            </a>
                            <a href="/training/hr1-changes" className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                              <FileText className="h-3 w-3" /> HR1 Work Requirement Changes
                            </a>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Policy References</h5>
                          <div className="space-y-1">
                            <p className="text-xs font-mono text-muted-foreground">7 CFR 273.24 - ABAWD Time Limits</p>
                            <p className="text-xs font-mono text-muted-foreground">COMAR 07.03.17.21 - Work Requirements</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Tips Section */}
                  <div className="mt-6">
                    <Card className="bg-purple-50 dark:bg-purple-950/30">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <MessageSquareWarning className="h-5 w-5 text-purple-500" />
                          Quick Reference Tips for Supervisors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Always verify income with most recent 4 pay stubs</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Check all possible ABAWD exemption categories before applying time limit</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Verify which SUA applies based on actual utility payments</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Verify all individuals purchase and prepare food together</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Check for overtime and variable income patterns</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Confirm relationship documentation for all members</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Training Impact Tab */}
          <TabsContent value="trainingImpact">
            <TrainingImpactTracing />
          </TabsContent>
        </Tabs>
      </div>

      {/* Error Category Drill-Down Modal */}
      <Dialog open={!!drillDownCategory} onOpenChange={(open) => !open && setDrillDownCategory(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-purple-500" />
              Error Category Drill-Down: {drillDownCategory?.replace(/_/g, ' ')}
            </DialogTitle>
            <DialogDescription>
              Quarterly trends, root cause analysis, and recent examples for this error category.
            </DialogDescription>
          </DialogHeader>

          {drillDownLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[100px] w-full" />
              <Skeleton className="h-[150px] w-full" />
            </div>
          ) : drillDownData?.data ? (
            <div className="space-y-6">
              {/* Weekly Trend Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Weekly Error Trend (Last 12 Weeks)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={drillDownData.data.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis 
                        tick={{ fontSize: 10 }} 
                        domain={[0, 'auto']}
                        label={{ value: 'Error Rate %', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <Tooltip />
                      <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="Error Rate %" />
                      <Line type="monotone" dataKey="criticalCount" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} name="Critical Errors" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Root Cause Breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Root Cause Analysis
                  </CardTitle>
                  <CardDescription>
                    Distribution of underlying causes from hybrid gateway UNSAT cores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(drillDownData.data.rootCauseBreakdown).length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No root cause data available</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(drillDownData.data.rootCauseBreakdown).map(([cause, count]) => (
                        <div key={cause} className="p-3 border rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{count as number}</div>
                          <div className="text-xs text-muted-foreground capitalize">{cause.replace(/_/g, ' ')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Examples */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent Examples (Last 10)</CardTitle>
                  <CardDescription>
                    Anonymized case details for training reference
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {drillDownData.data.recentExamples.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No recent examples found</p>
                  ) : (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {drillDownData.data.recentExamples.map((example, idx) => (
                          <div key={example.id || idx} className="p-3 border rounded-lg text-sm">
                            <div className="flex justify-between items-start mb-2">
                              <Badge variant={example.severity === 'critical' ? 'destructive' : example.severity === 'high' ? 'secondary' : 'outline'}>
                                {example.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Case: {example.anonymizedCaseId}
                              </span>
                            </div>
                            <p className="mb-1">{example.message}</p>
                            {example.fieldName && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Field:</span> {example.fieldName}
                                {example.expectedValue && (
                                  <span className="ml-2">Expected: {example.expectedValue}</span>
                                )}
                                {example.actualValue && (
                                  <span className="ml-2">Actual: {example.actualValue}</span>
                                )}
                              </div>
                            )}
                            {example.impactAmount > 0 && (
                              <div className="text-xs text-red-600 mt-1">
                                Potential Impact: ${example.impactAmount.toFixed(2)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <p>No drill-down data available for this category</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillDownCategory(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coaching Action Modal */}
      <Dialog open={!!coachingNudgeId} onOpenChange={(open) => !open && setCoachingNudgeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-500" />
              Record Coaching Action
            </DialogTitle>
            <DialogDescription>
              Document the coaching action taken for this nudge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action Taken</Label>
              <Select value={coachingAction} onValueChange={setCoachingAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coached">Coached Caseworker</SelectItem>
                  <SelectItem value="training_assigned">Assigned Training</SelectItem>
                  <SelectItem value="escalated">Escalated to Management</SelectItem>
                  <SelectItem value="discussed">Discussed in Team Meeting</SelectItem>
                  <SelectItem value="no_action">No Action Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add coaching notes..."
                value={coachingNotes}
                onChange={(e) => setCoachingNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoachingNudgeId(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (coachingNudgeId) {
                  coachingMutation.mutate({
                    nudgeId: coachingNudgeId,
                    action: coachingAction,
                    notes: coachingNotes,
                  });
                }
              }}
              disabled={coachingMutation.isPending}
            >
              {coachingMutation.isPending ? "Saving..." : "Save Coaching Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
