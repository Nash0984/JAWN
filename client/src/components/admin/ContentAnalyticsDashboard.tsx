import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, Zap } from "lucide-react";

interface ContentAnalyticsProps {
  data: {
    syncMetrics: {
      pending: number;
      approved: number;
      rejected: number;
      failed: number;
      total: number;
      autoRegenRate: number;
      avgReviewTimeSeconds: number;
    };
    templateMetrics: {
      topTemplates: Array<{
        id: string;
        templateCode: string;
        templateName: string;
        program: string;
        usageCount: number;
      }>;
      byProgram: Array<{
        program: string;
        count: number;
      }>;
      totalActive: number;
    };
    generationMetrics: {
      trends: Array<{
        date: string;
        count: number;
      }>;
      total: number;
      sent: number;
      delivered: number;
      failed: number;
    };
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ContentAnalyticsDashboard({ data }: ContentAnalyticsProps) {
  const formatReviewTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const successRate = data.syncMetrics.total > 0
    ? ((data.syncMetrics.approved / data.syncMetrics.total) * 100).toFixed(1)
    : '0.0';

  const deliveryRate = data.generationMetrics.total > 0
    ? ((data.generationMetrics.delivered / data.generationMetrics.total) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="metric-pending-jobs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-pending-jobs">{data.syncMetrics.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-auto-regen-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Regen Rate</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-auto-regen-rate">{data.syncMetrics.autoRegenRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Automatically approved</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-avg-review-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-avg-review-time">
              {formatReviewTime(data.syncMetrics.avgReviewTimeSeconds)}
            </div>
            <p className="text-xs text-muted-foreground">Time to review</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-sync-success-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-success-rate">{successRate}%</div>
            <p className="text-xs text-muted-foreground">Jobs approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Templates Bar Chart */}
        <Card data-testid="chart-top-templates">
          <CardHeader>
            <CardTitle>Most Used Templates</CardTitle>
            <CardDescription>Top 5 templates by generation count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.templateMetrics.topTemplates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="templateCode" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usageCount" fill="#3b82f6" name="Usage Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Templates by Program Pie Chart */}
        <Card data-testid="chart-templates-by-program">
          <CardHeader>
            <CardTitle>Templates by Program</CardTitle>
            <CardDescription>Distribution across benefit programs</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.templateMetrics.byProgram}
                  dataKey="count"
                  nameKey="program"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.program}: ${entry.count}`}
                >
                  {data.templateMetrics.byProgram.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Generation Trends Line Chart */}
      <Card data-testid="chart-generation-trends">
        <CardHeader>
          <CardTitle>Notification Generation Trends</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.generationMetrics.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US')}
              />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Notifications Generated" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="metric-total-notifications">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="value-total-notifications">
              {data.generationMetrics.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-delivery-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="value-delivery-rate">{deliveryRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.generationMetrics.delivered} of {data.generationMetrics.total} delivered
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-active-templates">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="value-active-templates">
              {data.templateMetrics.totalActive}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all programs</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
