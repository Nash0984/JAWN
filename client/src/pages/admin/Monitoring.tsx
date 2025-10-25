import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Zap, 
  FileText, 
  Brain, 
  Database,
  Server,
  RefreshCw,
  Download
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
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { useWebSocket } from "@/hooks/useWebSocket";
import { useState, useEffect, Component, ErrorInfo } from "react";
import { KPICard } from "@/components/monitoring/KPICard";
import { TrendChart } from "@/components/monitoring/TrendChart";
import { exportToCSV, exportToJSON } from "@/lib/exportUtils";
import type { MonitoringDashboardMetrics } from "@shared/monitoring";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Error boundary for the monitoring page
class MonitoringErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Monitoring page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load monitoring dashboard. Please refresh the page or contact support.
              {this.state.error && <div className="mt-2 text-sm">{this.state.error.message}</div>}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

function MonitoringContent() {
  const [metrics, setMetrics] = useState<MonitoringDashboardMetrics | null>(null);
  const { subscribe, isConnected, send } = useWebSocket();

  // WebSocket subscription for realtime updates
  useEffect(() => {
    if (!subscribe) return;
    
    const unsubscribe = subscribe('metrics_update', (data) => {
      setMetrics(data);
    });

    // Send subscription message when connected
    if (isConnected && send) {
      try {
        send({ type: 'subscribe_metrics' });
      } catch (error) {
        console.warn('Failed to send WebSocket subscription:', error);
      }
    }

    return unsubscribe;
  }, [isConnected, subscribe, send]);

  // HTTP polling fallback if WebSocket unavailable
  const { data: polledMetrics, isLoading, error, refetch } = useQuery<{ data: MonitoringDashboardMetrics }>({
    queryKey: ['/api/admin/metrics/realtime'],
    enabled: !isConnected,
    refetchInterval: 30000, // 30 seconds
    retry: 3,
    retryDelay: 1000,
  });

  const displayMetrics = metrics || polledMetrics?.data;

  const handleExportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).map(key => ({ key, label: key }));
    exportToCSV(data, headers, filename);
  };

  const handleExportJSON = (data: any, filename: string) => {
    if (!data) return;
    exportToJSON(data, filename);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring Dashboard</h1>
            <p className="text-muted-foreground">Realtime observability across 7 domains</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(7)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring metrics. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!displayMetrics) {
    return null;
  }

  return (
    <>
      <div className="container mx-auto p-6 space-y-6" data-testid="monitoring-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            System Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground">
            Realtime observability across 8 domains (includes immutable audit logs)
            {isConnected && (
              <Badge variant="outline" className="ml-2" data-testid="badge-websocket-status">
                <Activity className="h-3 w-3 mr-1 text-green-500" />
                Live
              </Badge>
            )}
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          size="sm" 
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs for different domains */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="eFiling" data-testid="tab-efiling">E-Filing</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">AI</TabsTrigger>
          <TabsTrigger value="cache" data-testid="tab-cache">Cache</TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">Health</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4" data-testid="content-overview">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV([displayMetrics], `metrics-overview-${Date.now()}.csv`)}
              data-testid="button-export-csv-overview"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics, `metrics-overview-${Date.now()}.json`)}
              data-testid="button-export-json-overview"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Error Rate"
              value={`${displayMetrics.errors.errorRate.toFixed(2)}/min`}
              icon={<AlertTriangle className="h-5 w-5" />}
              status={displayMetrics.errors.errorRate > 10 ? 'critical' : displayMetrics.errors.errorRate > 5 ? 'warning' : 'healthy'}
              testId="kpi-error-rate"
            />
            <KPICard
              title="Security Threats"
              value={displayMetrics.security.highSeverityThreats}
              icon={<Shield className="h-5 w-5" />}
              status={displayMetrics.security.highSeverityThreats > 0 ? 'warning' : 'healthy'}
              testId="kpi-security-threats"
            />
            <KPICard
              title="Response Time (p95)"
              value={`${displayMetrics.performance.p95ResponseTime}ms`}
              icon={<Zap className="h-5 w-5" />}
              status={displayMetrics.performance.p95ResponseTime > 1000 ? 'warning' : 'healthy'}
              testId="kpi-performance"
            />
            <KPICard
              title="E-Filing Submissions"
              value={displayMetrics.eFiling.totalSubmissions}
              icon={<FileText className="h-5 w-5" />}
              testId="kpi-efiling"
            />
            <KPICard
              title="AI API Calls"
              value={displayMetrics.ai.totalCalls}
              icon={<Brain className="h-5 w-5" />}
              testId="kpi-ai-calls"
            />
            <KPICard
              title="AI Cost"
              value={`$${displayMetrics.ai.totalCost.toFixed(2)}`}
              icon={<Brain className="h-5 w-5" />}
              testId="kpi-ai-cost"
            />
            <KPICard
              title="Cache Hit Rate"
              value={`${displayMetrics.cache.hitRate.toFixed(1)}%`}
              icon={<Database className="h-5 w-5" />}
              status={displayMetrics.cache.hitRate > 80 ? 'healthy' : displayMetrics.cache.hitRate > 60 ? 'warning' : 'critical'}
              testId="kpi-cache-hitrate"
            />
            <KPICard
              title="System Health"
              value={displayMetrics.health.overallStatus}
              icon={<Server className="h-5 w-5" />}
              status={displayMetrics.health.overallStatus === 'healthy' ? 'healthy' : displayMetrics.health.overallStatus === 'degraded' ? 'warning' : 'critical'}
              testId="kpi-health"
            />
          </div>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4" data-testid="content-errors">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.errors.trend, `error-trend-${Date.now()}.csv`)}
              data-testid="button-export-csv-errors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.errors, `error-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-errors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-error-trend">
              <CardHeader>
                <CardTitle>Error Rate Trend</CardTitle>
                <CardDescription>Errors over time</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={displayMetrics.errors.trend}
                  dataKey="count"
                  xAxisKey="timestamp"
                  title=""
                  color="#ef4444"
                  testId="chart-error-trend"
                />
              </CardContent>
            </Card>
            <Card data-testid="card-top-errors">
              <CardHeader>
                <CardTitle>Top Error Types</CardTitle>
                <CardDescription>Most frequent errors</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayMetrics.errors.topErrors}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4" data-testid="content-security">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.security.trend, `security-trend-${Date.now()}.csv`)}
              data-testid="button-export-csv-security"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.security, `security-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-security"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-security-trend">
              <CardHeader>
                <CardTitle>Security Events Trend</CardTitle>
                <CardDescription>Security events over time</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={displayMetrics.security.trend}
                  dataKey="events"
                  xAxisKey="timestamp"
                  title=""
                  color="#f59e0b"
                  testId="chart-security-trend"
                />
              </CardContent>
            </Card>
            <Card data-testid="card-security-breakdown">
              <CardHeader>
                <CardTitle>Events by Type</CardTitle>
                <CardDescription>Security event distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={displayMetrics.security.eventsByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.type}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(Array.isArray(displayMetrics.security?.eventsByType) ? displayMetrics.security.eventsByType : []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4" data-testid="content-performance">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.performance.trend, `performance-trend-${Date.now()}.csv`)}
              data-testid="button-export-csv-performance"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.performance, `performance-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-performance"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-performance-trend">
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Response times over time</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={displayMetrics.performance.trend}
                  dataKey="avg"
                  xAxisKey="timestamp"
                  title=""
                  color="#10b981"
                  additionalLines={[
                    { dataKey: 'p95', color: '#ef4444', name: 'p95' }
                  ]}
                  testId="chart-performance-trend"
                />
              </CardContent>
            </Card>
            <Card data-testid="card-slowest-endpoints">
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>Average response time (ms)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayMetrics.performance.slowestEndpoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="endpoint" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgTime" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* E-Filing Tab */}
        <TabsContent value="eFiling" className="space-y-4" data-testid="content-efiling">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.eFiling.processingTimeTrend, `efiling-trend-${Date.now()}.csv`)}
              data-testid="button-export-csv-efiling"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.eFiling, `efiling-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-efiling"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-efiling-status">
              <CardHeader>
                <CardTitle>Submission Status</CardTitle>
                <CardDescription>Distribution by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={displayMetrics.eFiling.byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.status}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(Array.isArray(displayMetrics.eFiling?.byStatus) ? displayMetrics.eFiling.byStatus : []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card data-testid="card-efiling-processing">
              <CardHeader>
                <CardTitle>Processing Time Trend</CardTitle>
                <CardDescription>Average processing time over time</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={displayMetrics.eFiling.processingTimeTrend}
                  dataKey="avgTime"
                  xAxisKey="timestamp"
                  title=""
                  color="#8b5cf6"
                  testId="chart-efiling-processing"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai" className="space-y-4" data-testid="content-ai">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.ai.costTrend, `ai-cost-trend-${Date.now()}.csv`)}
              data-testid="button-export-csv-ai"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.ai, `ai-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-ai"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-ai-cost-trend">
              <CardHeader>
                <CardTitle>Cost Trend</CardTitle>
                <CardDescription>AI costs over time</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={displayMetrics.ai.costTrend}
                  dataKey="cost"
                  xAxisKey="timestamp"
                  title=""
                  color="#ec4899"
                  testId="chart-ai-cost"
                />
              </CardContent>
            </Card>
            <Card data-testid="card-ai-calls-by-feature">
              <CardHeader>
                <CardTitle>Calls by Feature</CardTitle>
                <CardDescription>API calls distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayMetrics.ai.callsByFeature}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="calls" fill="#ec4899" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card data-testid="card-ai-tokens-by-model" className="md:col-span-2">
              <CardHeader>
                <CardTitle>Tokens by Model</CardTitle>
                <CardDescription>Token usage distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={displayMetrics.ai.tokensByModel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.model}: ${entry.tokens}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="tokens"
                    >
                      {(Array.isArray(displayMetrics.ai?.tokensByModel) ? displayMetrics.ai.tokensByModel : []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cache Tab */}
        <TabsContent value="cache" className="space-y-4" data-testid="content-cache">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.cache.hitRateByLayer, `cache-hitrate-${Date.now()}.csv`)}
              data-testid="button-export-csv-cache"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.cache, `cache-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-cache"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-cache-hitrate">
              <CardHeader>
                <CardTitle>Hit Rate by Layer</CardTitle>
                <CardDescription>Cache performance per layer</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayMetrics.cache.hitRateByLayer}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="layer" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hitRate" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card data-testid="card-cache-invalidation">
              <CardHeader>
                <CardTitle>Invalidation Events</CardTitle>
                <CardDescription>Cache invalidations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={displayMetrics.cache.invalidationEvents}
                  dataKey="count"
                  xAxisKey="timestamp"
                  title=""
                  color="#06b6d4"
                  testId="chart-cache-invalidation"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4" data-testid="content-health">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCSV(displayMetrics.health.components, `health-components-${Date.now()}.csv`)}
              data-testid="button-export-csv-health"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportJSON(displayMetrics.health, `health-metrics-${Date.now()}.json`)}
              data-testid="button-export-json-health"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(Array.isArray(displayMetrics.health?.components) ? displayMetrics.health.components : []).map((component, index) => (
              <KPICard
                key={index}
                title={component.name}
                value={component.status}
                trendValue={`${(component.uptime / 3600).toFixed(1)}h uptime`}
                status={component.status === 'healthy' ? 'healthy' : component.status === 'degraded' ? 'warning' : 'critical'}
                testId={`kpi-component-${index}`}
              />
            ))}
          </div>
          <Card data-testid="card-uptime">
            <CardHeader>
              <CardTitle>System Uptime</CardTitle>
              <CardDescription>Total system uptime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {(displayMetrics.health.uptime / 3600).toFixed(1)} hours
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Database: {displayMetrics.health.databaseConnected ? '✓ Connected' : '✗ Disconnected'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4" data-testid="content-audit">
          <AuditLogsTabContent />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}

// Audit Logs Tab Component (inline to avoid creating separate file - reduces bloat)
function AuditLogsTabContent() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const { data: auditStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{success: boolean; statistics: any}>({
    queryKey: ['/api/audit/statistics'],
  });

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/audit/verify-chain', {
        method: 'GET',
        credentials: 'include',
      });
      const result = await response.json();
      setVerificationResult(result.verification);
      refetchStats();
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const stats = auditStats?.statistics;

  return (
    <div className="space-y-4">
      {/* Header with manual verification button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Immutable Audit Log Chain</h3>
          <p className="text-sm text-muted-foreground">
            Cryptographic hash chain verification (NIST 800-53 AU-9, IRS Pub 1075 9.3.1)
          </p>
        </div>
        <Button 
          onClick={handleVerifyChain} 
          disabled={isVerifying}
          variant="outline"
          data-testid="button-verify-chain"
        >
          {isVerifying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Verify Chain
            </>
          )}
        </Button>
      </div>

      {/* Statistics KPI Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <KPICard
          title="Total Entries"
          value={stats?.totalEntries?.toLocaleString() || '0'}
          icon={<FileText className="h-5 w-5" />}
          testId="kpi-audit-total"
        />
        <KPICard
          title="Chain Length"
          value={stats?.chainLength?.toLocaleString() || '0'}
          icon={<Database className="h-5 w-5" />}
          testId="kpi-audit-chain-length"
        />
        <KPICard
          title="Last Verified"
          value={stats?.lastVerified ? new Date(stats.lastVerified).toLocaleDateString() : 'Never'}
          trendValue={stats?.lastVerified ? new Date(stats.lastVerified).toLocaleTimeString() : ''}
          icon={<Shield className="h-5 w-5" />}
          testId="kpi-audit-last-verified"
        />
        <KPICard
          title="Chain Integrity"
          value={stats?.integrityStatus || 'Unknown'}
          icon={<Shield className="h-5 w-5" />}
          status={stats?.integrityStatus === 'valid' ? 'healthy' : stats?.integrityStatus === 'pending' ? 'warning' : 'critical'}
          testId="kpi-audit-integrity"
        />
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <Alert variant={verificationResult.isValid ? "default" : "destructive"} data-testid="alert-verification-result">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold">
              {verificationResult.isValid ? '✓ Chain Integrity Verified' : '✗ Chain Integrity Compromised'}
            </div>
            <div className="text-sm mt-2">
              Verified {verificationResult.verifiedEntries} of {verificationResult.totalEntries} entries.
              {verificationResult.brokenLinks && verificationResult.brokenLinks.length > 0 && (
                <div className="mt-2 text-red-600 dark:text-red-400">
                  Found {verificationResult.brokenLinks.length} broken link(s) at sequence: {verificationResult.brokenLinks.join(', ')}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Activity Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-audit-actions">
          <CardHeader>
            <CardTitle>Recent Actions (Last 24h)</CardTitle>
            <CardDescription>Audit log activity breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.recentActionCounts?.slice(0, 10).map((action: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{action.action}</span>
                  <Badge variant="outline">{action.count}</Badge>
                </div>
              )) || <p className="text-sm text-muted-foreground">No recent activity</p>}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-audit-info">
          <CardHeader>
            <CardTitle>Chain Information</CardTitle>
            <CardDescription>Audit log technical details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hash Algorithm:</span>
                <span className="font-mono">SHA-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Genesis Hash:</span>
                <span className="font-mono text-xs">NULL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concurrency Control:</span>
                <span className="font-mono text-xs">pg_advisory_xact_lock</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Immutability:</span>
                <span className="text-green-600 dark:text-green-400">PostgreSQL Trigger</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verification Schedule:</span>
                <span>Weekly (Sundays 3 AM)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            // Export functionality will be implemented
            console.log('Export audit logs to CSV');
          }}
          data-testid="button-export-csv-audit"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            // Export functionality will be implemented
            console.log('Export audit logs to JSON');
          }}
          data-testid="button-export-json-audit"
        >
          <Download className="h-4 w-4 mr-2" />
          Export JSON
        </Button>
      </div>
    </div>
  );
}

// Wrap with error boundary and export
export default function Monitoring() {
  return (
    <MonitoringErrorBoundary>
      <MonitoringContent />
    </MonitoringErrorBoundary>
  );
}
