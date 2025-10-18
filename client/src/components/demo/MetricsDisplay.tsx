import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Activity, Database, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import type { DemoMetrics } from "@server/services/demoDataService";

interface MetricsDisplayProps {
  metrics: DemoMetrics;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  if (!metrics || !metrics.platformPerformance || !metrics.systemHealth) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No metrics data available</p>
      </div>
    );
  }

  const apiResponseData = [
    {
      name: 'P50',
      'SNAP Eligibility': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/eligibility/snap']?.p50 ?? 0,
      'Tax Calculation': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/tax/calculate']?.p50 ?? 0,
      'Document Upload': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/documents/upload']?.p50 ?? 0,
    },
    {
      name: 'P95',
      'SNAP Eligibility': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/eligibility/snap']?.p95 ?? 0,
      'Tax Calculation': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/tax/calculate']?.p95 ?? 0,
      'Document Upload': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/documents/upload']?.p95 ?? 0,
    },
    {
      name: 'P99',
      'SNAP Eligibility': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/eligibility/snap']?.p99 ?? 0,
      'Tax Calculation': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/tax/calculate']?.p99 ?? 0,
      'Document Upload': metrics.platformPerformance?.apiResponseTimes?.byEndpoint?.['/api/documents/upload']?.p99 ?? 0,
    },
  ];

  const cacheHitData = Object.entries(metrics.platformPerformance?.cacheHitRates?.byCache ?? {}).map(([name, data]) => ({
    name: name.replace('Cache', '').replace(/([A-Z])/g, ' $1').trim(),
    value: data.hitRate,
    hits: data.hits,
    misses: data.misses,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Stats Cards */}
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="metric-uptime">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.systemHealth?.uptime ?? 0}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-error-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.systemHealth?.errorRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground">Active alerts: {metrics.systemHealth?.activeAlerts ?? 0}</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-cache-overall">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.platformPerformance?.cacheHitRates?.overall ?? 0}%</div>
            <p className="text-xs text-muted-foreground">Overall performance</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-db-performance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DB Query Time</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.platformPerformance?.databasePerformance?.avgQueryTime ?? 0}ms</div>
            <p className="text-xs text-muted-foreground">Average query</p>
          </CardContent>
        </Card>
      </div>

      {/* API Response Times Chart */}
      <Card className="lg:col-span-2" data-testid="chart-api-response-times">
        <CardHeader>
          <CardTitle>API Response Times</CardTitle>
          <CardDescription>P50, P95, P99 latencies by endpoint (ms)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={apiResponseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="SNAP Eligibility" fill="#10b981" />
              <Bar dataKey="Tax Calculation" fill="#3b82f6" />
              <Bar dataKey="Document Upload" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cache Hit Rates Pie Chart */}
      <Card data-testid="chart-cache-hit-rates">
        <CardHeader>
          <CardTitle>Cache Hit Rates by Layer</CardTitle>
          <CardDescription>Performance breakdown by cache type</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={cacheHitData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {cacheHitData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* AI Performance Stats */}
      <Card data-testid="chart-ai-performance">
        <CardHeader>
          <CardTitle>AI Service Performance</CardTitle>
          <CardDescription>Gemini API and RAG service metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Gemini API</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.platformPerformance?.aiPerformance?.geminiApi?.successRate ?? 0}% success rate
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Avg Response</p>
                  <p className="font-medium">{metrics.platformPerformance?.aiPerformance?.geminiApi?.avgResponseTime ?? 0}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Calls</p>
                  <p className="font-medium">{(metrics.platformPerformance?.aiPerformance?.geminiApi?.totalCalls ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">RAG Service</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.platformPerformance?.aiPerformance?.ragService?.avgRelevanceScore ?? 0}% relevance
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Search Time</p>
                  <p className="font-medium">{metrics.platformPerformance?.aiPerformance?.ragService?.avgSearchTime ?? 0}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Searches</p>
                  <p className="font-medium">{(metrics.platformPerformance?.aiPerformance?.ragService?.totalSearches ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
