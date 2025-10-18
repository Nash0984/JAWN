import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck,
  Target,
  Download,
  Calendar,
  Award,
} from "lucide-react";
import { format } from "date-fns";

interface ProductivityMetrics {
  navigatorId: string;
  navigatorName: string;
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

interface TeamMetrics {
  totalNavigators: number;
  activeCases: number;
  totalCasesThisMonth: number;
  totalBenefitsThisMonth: number;
  avgSuccessRate: number;
  topPerformers: ProductivityMetrics[];
  trends: {
    period: string;
    cases: number;
    benefits: number;
    successRate: number;
  }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ProductivityDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all_time'>('monthly');
  const [selectedNavigator, setSelectedNavigator] = useState<string>('all');

  const { data: metrics, isLoading: metricsLoading } = useQuery<ProductivityMetrics[]>({
    queryKey: ['/api/analytics/productivity', selectedPeriod, selectedNavigator],
  });

  const { data: teamMetrics, isLoading: teamLoading } = useQuery<TeamMetrics>({
    queryKey: ['/api/analytics/team-metrics'],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 75) return <Badge className="bg-blue-500">Good</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">Average</Badge>;
    return <Badge className="bg-red-500">Needs Improvement</Badge>;
  };

  const handleExportReport = () => {
    // Export metrics to CSV
    if (!metrics) return;
    
    const csv = [
      ['Navigator', 'Cases Closed', 'Success Rate', 'Benefits Secured', 'Avg Response Time', 'Performance Score'],
      ...metrics.map(m => [
        m.navigatorName,
        m.casesClosed,
        `${m.successRate.toFixed(1)}%`,
        formatCurrency(m.totalBenefitsSecured),
        formatHours(m.avgResponseTime),
        m.performanceScore.toFixed(1),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const summaryMetrics = metrics?.[0] || {} as ProductivityMetrics;
  const isLoading = metricsLoading || teamLoading;

  return (
    <>
      <Helmet>
        <title>Productivity Dashboard - Caseworker Analytics</title>
        <meta
          name="description"
          content="Track caseworker performance, applications completed, benefits secured, and productivity metrics"
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="dashboard-title">
              Caseworker Productivity Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track performance metrics and optimize service delivery
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={(v: any) => setSelectedPeriod(v)}>
              <SelectTrigger className="w-[140px]" data-testid="period-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleExportReport} variant="outline" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-cases-closed">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cases Closed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryMetrics.casesClosed || 0}</div>
              <p className="text-xs text-muted-foreground">
                {summaryMetrics.casesApproved || 0} approved, {summaryMetrics.casesDenied || 0} denied
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-success-rate">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryMetrics.successRate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                Above average performance
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-benefits-secured">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Benefits Secured</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summaryMetrics.totalBenefitsSecured || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                ${(summaryMetrics.avgBenefitPerCase || 0).toFixed(0)} avg per case
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-response-time">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatHours(summaryMetrics.avgResponseTime || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Completion: {(summaryMetrics.avgCaseCompletionTime || 0).toFixed(1)} days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="benefits">Benefits Impact</TabsTrigger>
            <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Cases Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Cases Processed Over Time</CardTitle>
                  <CardDescription>Daily case closure trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={teamMetrics?.trends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="cases" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Success Rate Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Case Outcomes</CardTitle>
                  <CardDescription>Approval vs denial distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Approved', value: summaryMetrics.casesApproved || 0 },
                          { name: 'Denied', value: summaryMetrics.casesDenied || 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Documents Processed</CardTitle>
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryMetrics.documentsProcessed || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {summaryMetrics.documentsVerified || 0} verified successfully
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Cross-Enrollments</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summaryMetrics.crossEnrollmentsIdentified || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Additional benefits identified
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(summaryMetrics.performanceScore || 0).toFixed(1)}
                  </div>
                  <div className="mt-2">
                    {getPerformanceBadge(summaryMetrics.performanceScore || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Breakdown</CardTitle>
                <CardDescription>Detailed performance metrics and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className="text-2xl font-bold">{summaryMetrics.successRate?.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${summaryMetrics.successRate || 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm font-medium">Document Quality</span>
                    <span className="text-2xl font-bold">
                      {((summaryMetrics.avgDocumentQuality || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(summaryMetrics.avgDocumentQuality || 0) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="benefits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Benefits Impact Analysis</CardTitle>
                <CardDescription>Total dollar value of benefits secured for clients</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamMetrics?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="benefits" fill="#82ca9d" name="Benefits Secured ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>High-Value Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{summaryMetrics.highValueCases || 0}</div>
                  <p className="text-sm text-muted-foreground">
                    Cases with benefits ≥ $1,000/month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Benefit Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatCurrency(summaryMetrics.avgBenefitPerCase || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Per approved case
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Document Verification Quality</CardTitle>
                  <CardDescription>AI confidence scores for processed documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Average Quality Score</span>
                      <span className="font-bold">
                        {((summaryMetrics.avgDocumentQuality || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${(summaryMetrics.avgDocumentQuality || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Recommendations</CardTitle>
                  <CardDescription>Cross-enrollment suggestions accepted</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {summaryMetrics.aiRecommendationsAccepted || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI-powered benefit opportunities
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
