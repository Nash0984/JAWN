import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Activity, Lock, Ban, FileWarning, AlertCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SecurityMetrics {
  securityScore: number;
  period: string;
  metrics: {
    failedAuthAttempts: {
      total: number;
      trend: Array<{ date: string; count: number; uniqueIPs: number }>;
    };
    xssSanitizations: {
      total: number;
      trend: Array<{ date: string; count: number }>;
    };
    authorizationFailures: {
      total: number;
      trend: Array<{ date: string; count: number; entityTypes: string }>;
    };
    rateLimitViolations: {
      total: number;
      trend: Array<{ date: string; count: number; uniqueIPs: number }>;
    };
    csrfFailures: {
      total: number;
      trend: Array<{ date: string; count: number }>;
    };
    sessionEvents: {
      total: number;
      trend: Array<{ date: string; count: number; eventTypes: string }>;
    };
  };
  threats: {
    topAttackingIPs: Array<{
      ipAddress: string;
      failedAttempts: number;
      firstSeen: string;
      lastSeen: string;
    }>;
  };
}

interface SecurityAlert {
  id: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  userId: string | null;
  username: string | null;
  metadata: any;
}

interface SecurityAlerts {
  alerts: SecurityAlert[];
  count: number;
  period: string;
}

export default function SecurityMonitoring() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<SecurityMetrics>({
    queryKey: ["/api/security/metrics"],
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<SecurityAlerts>({
    queryKey: ["/api/security/alerts"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const isLoading = metricsLoading || alertsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const securityScore = metrics?.securityScore || 0;
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-600">Good</Badge>;
    if (score >= 50) return <Badge className="bg-orange-600">Fair</Badge>;
    return <Badge variant="destructive">Needs Attention</Badge>;
  };

  const getSeverityIcon = (action: string) => {
    switch (action) {
      case "XSS_SANITIZED":
        return <FileWarning className="h-4 w-4 text-orange-600" />;
      case "SQL_INJECTION_ATTEMPT":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "CSRF_VALIDATION_FAILED":
        return <Ban className="h-4 w-4 text-red-600" />;
      case "SESSION_HIJACK_ATTEMPT":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "BRUTE_FORCE_DETECTED":
        return <Lock className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  // Prepare combined threat trend data for chart
  const combinedTrendData = metrics?.metrics.failedAuthAttempts.trend.map((day) => {
    const xss = metrics.metrics.xssSanitizations.trend.find(x => x.date === day.date);
    const authz = metrics.metrics.authorizationFailures.trend.find(a => a.date === day.date);
    const rate = metrics.metrics.rateLimitViolations.trend.find(r => r.date === day.date);
    
    return {
      date: day.date,
      failedAuth: day.count,
      xss: xss?.count || 0,
      authzFailures: authz?.count || 0,
      rateLimits: rate?.count || 0,
    };
  }) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="title-security-monitoring">
          Security Monitoring Dashboard
        </h1>
        <p className="text-muted-foreground">
          Real-time security metrics, threat detection, and incident alerts
        </p>
      </div>

      {/* Security Score Overview */}
      <Card className="mb-8 border-2" data-testid="card-security-score">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Score
              </CardTitle>
              <CardDescription>Overall system security health ({metrics?.period})</CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getScoreColor(securityScore)}`} data-testid="value-security-score">
                {securityScore.toFixed(1)}
              </div>
              <div className="mt-1">
                {getScoreBadge(securityScore)}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-sm text-muted-foreground">Failed Auth</div>
              <div className="text-2xl font-bold" data-testid="metric-failed-auth">
                {metrics?.metrics.failedAuthAttempts.total || 0}
              </div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-sm text-muted-foreground">XSS Blocked</div>
              <div className="text-2xl font-bold" data-testid="metric-xss-blocked">
                {metrics?.metrics.xssSanitizations.total || 0}
              </div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-sm text-muted-foreground">Authz Failures</div>
              <div className="text-2xl font-bold" data-testid="metric-authz-failures">
                {metrics?.metrics.authorizationFailures.total || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {alerts && alerts.count > 0 && (
        <Alert variant="destructive" className="mb-8" data-testid="alert-critical-events">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Security Events Detected</AlertTitle>
          <AlertDescription>
            {alerts.count} critical security event{alerts.count !== 1 ? 's' : ''} detected in the last 24 hours. Review immediately.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="threats" data-testid="tab-threats">Threats</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Threat Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Security Threat Trends</CardTitle>
              <CardDescription>Daily security incidents ({metrics?.period})</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={combinedTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="failedAuth" stroke="#ef4444" name="Failed Auth" />
                  <Line type="monotone" dataKey="xss" stroke="#f97316" name="XSS Blocked" />
                  <Line type="monotone" dataKey="authzFailures" stroke="#eab308" name="Authz Failures" />
                  <Line type="monotone" dataKey="rateLimits" stroke="#3b82f6" name="Rate Limits" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Security Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Rate Limit Violations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" data-testid="value-rate-limits">
                  {metrics?.metrics.rateLimitViolations.total || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {metrics?.metrics.rateLimitViolations.trend.reduce((sum, day) => sum + day.uniqueIPs, 0)} unique IPs
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Session Security Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" data-testid="value-session-events">
                  {metrics?.metrics.sessionEvents.total || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Expired, hijacked, or invalid sessions
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  CSRF Failures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" data-testid="value-csrf-failures">
                  {metrics?.metrics.csrfFailures.total || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  CSRF token validation failures
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  XSS Sanitizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" data-testid="value-xss-total">
                  {metrics?.metrics.xssSanitizations.total || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Malicious scripts blocked
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="threats">
          <Card>
            <CardHeader>
              <CardTitle>Top Attacking IP Addresses</CardTitle>
              <CardDescription>IPs with most failed authentication and authorization attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.threats.topAttackingIPs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attacking IPs detected in this period</p>
                ) : (
                  metrics?.threats.topAttackingIPs.map((ip, index) => (
                    <div
                      key={ip.ipAddress}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`threat-ip-${index}`}
                    >
                      <div className="flex-1">
                        <div className="font-mono font-semibold">{ip.ipAddress}</div>
                        <div className="text-sm text-muted-foreground">
                          First seen: {new Date(ip.firstSeen).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-red-600">{ip.failedAttempts}</div>
                        <div className="text-xs text-muted-foreground">failed attempts</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Critical Security Alerts</CardTitle>
              <CardDescription>{alerts?.period || "Last 24 hours"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts?.alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No critical security alerts</p>
                  </div>
                ) : (
                  alerts?.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-4 border rounded-lg"
                      data-testid={`alert-${alert.id}`}
                    >
                      {getSeverityIcon(alert.action)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{alert.action.replace(/_/g, ' ')}</span>
                          <Badge variant="outline">{new Date(alert.timestamp).toLocaleTimeString()}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {alert.ipAddress && (
                            <div>IP: <span className="font-mono">{alert.ipAddress}</span></div>
                          )}
                          {alert.username && (
                            <div>User: {alert.username}</div>
                          )}
                          {alert.userAgent && (
                            <div className="truncate max-w-lg">Agent: {alert.userAgent}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
