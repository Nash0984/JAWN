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
  TrendingUp, 
  Clock, 
  Users, 
  Server,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MonitoringMetrics {
  errorRate: {
    current: number;
    trend: Array<{ timestamp: string; value: number }>;
  };
  performance: {
    p50: number;
    p90: number;
    p95: number;
    trend: Array<{ timestamp: string; p50: number; p90: number; p95: number }>;
  };
  topErrors: Array<{
    errorType: string;
    count: number;
    lastOccurrence: string;
  }>;
  slowestEndpoints: Array<{
    endpoint: string;
    avgResponseTime: number;
    p95: number;
    count: number;
  }>;
  health: {
    sentryEnabled: boolean;
    sentryConfigured: boolean;
    databaseConnected: boolean;
    uptime: number;
  };
  recentAlerts: Array<{
    id: string;
    severity: string;
    message: string;
    createdAt: string;
    resolved: boolean;
  }>;
}

export default function Monitoring() {
  const { data: metrics, isLoading, error, refetch } = useQuery<MonitoringMetrics>({
    queryKey: ['/api/admin/monitoring/metrics'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-muted-foreground">Error tracking, performance metrics, and observability</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring metrics. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="monitoring-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">System Monitoring</h1>
          <p className="text-muted-foreground">Error tracking, performance metrics, and observability</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Sentry Configuration Alert */}
      {!metrics.health.sentryEnabled && (
        <Alert data-testid="alert-sentry-not-configured">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex justify-between items-center">
              <div>
                <strong>Sentry not configured.</strong> Add SENTRY_DSN and VITE_SENTRY_DSN to environment variables to enable advanced error tracking and performance monitoring.
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="https://sentry.io" target="_blank" rel="noopener noreferrer">
                  Learn More
                  <ExternalLink className="h-3 w-3 ml-2" />
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Health Status Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-error-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-error-rate">
              {metrics.errorRate.current.toFixed(2)}/min
            </div>
            <p className="text-xs text-muted-foreground">Errors per minute</p>
          </CardContent>
        </Card>

        <Card data-testid="card-response-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time (p95)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-response-time">
              {metrics.performance.p95.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground">95th percentile</p>
          </CardContent>
        </Card>

        <Card data-testid="card-uptime">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-uptime">
              {(metrics.health.uptime / 3600).toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">Hours online</p>
          </CardContent>
        </Card>

        <Card data-testid="card-health-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {metrics.health.databaseConnected ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-health-healthy" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" data-testid="icon-health-unhealthy" />
              )}
              <span className="text-2xl font-bold" data-testid="text-health-status">
                {metrics.health.databaseConnected ? "Healthy" : "Degraded"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sentry: {metrics.health.sentryEnabled ? "Enabled" : "Disabled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-error-trend">
              <CardHeader>
                <CardTitle>Error Rate Trend</CardTitle>
                <CardDescription>Errors per minute over time</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.errorRate.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={metrics.errorRate.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                      />
                      <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No error data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-errors">
              <CardHeader>
                <CardTitle>Top Errors</CardTitle>
                <CardDescription>Most frequent errors (last hour)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topErrors.length > 0 ? (
                    metrics.topErrors.slice(0, 5).map((error, index) => (
                      <div key={index} className="flex items-center justify-between" data-testid={`error-${index}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{error.errorType}</p>
                          <p className="text-xs text-muted-foreground">
                            Last: {new Date(error.lastOccurrence).toLocaleTimeString()}
                          </p>
                        </div>
                        <Badge variant="destructive" data-testid={`error-count-${index}`}>{error.count}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No errors recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-response-trend">
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Response times over time (ms)</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.performance.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={metrics.performance.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} name="p50" />
                      <Line type="monotone" dataKey="p90" stroke="#f59e0b" strokeWidth={2} name="p90" />
                      <Line type="monotone" dataKey="p95" stroke="#ef4444" strokeWidth={2} name="p95" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No performance data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-slowest-endpoints">
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>Average response time (ms)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.slowestEndpoints.length > 0 ? (
                    metrics.slowestEndpoints.slice(0, 5).map((endpoint, index) => (
                      <div key={index} className="space-y-1" data-testid={`endpoint-${index}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate flex-1">{endpoint.endpoint}</p>
                          <span className="text-sm font-bold">{endpoint.avgResponseTime.toFixed(0)}ms</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>p95: {endpoint.p95.toFixed(0)}ms</span>
                          <span>{endpoint.count} requests</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No performance data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card data-testid="card-recent-alerts">
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>System alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentAlerts.length > 0 ? (
                  metrics.recentAlerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className="flex items-start justify-between p-4 border rounded-lg"
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityColor(alert.severity) as any}>
                            {alert.severity}
                          </Badge>
                          {alert.resolved && (
                            <Badge variant="outline">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent alerts</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
