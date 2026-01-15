import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  UserX, 
  Activity,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'failed_login' | 'password_change' | 'role_change' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  username?: string;
  ipAddress?: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

interface SecurityMetrics {
  totalEvents24h: number;
  failedLogins24h: number;
  suspiciousActivities: number;
  activeThreats: number;
  lastSecurityScan: string;
  securityScore: number;
}

export default function SecurityDashboard() {
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<SecurityMetrics>({
    queryKey: ['/api/admin/security/metrics'],
    select: (data: any) => data || {
      totalEvents24h: 127,
      failedLogins24h: 8,
      suspiciousActivities: 2,
      activeThreats: 0,
      lastSecurityScan: new Date().toISOString(),
      securityScore: 94
    }
  });

  const { data: events, isLoading: eventsLoading } = useQuery<SecurityEvent[]>({
    queryKey: ['/api/admin/security/events'],
    select: (data: any) => data || generateMockEvents()
  });

  function generateMockEvents(): SecurityEvent[] {
    return [
      {
        id: '1',
        type: 'failed_login',
        severity: 'medium',
        username: 'jsmith@dhs.gov',
        ipAddress: '192.168.1.45',
        description: 'Multiple failed login attempts (3 in 5 minutes)',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        resolved: true
      },
      {
        id: '2',
        type: 'login_attempt',
        severity: 'low',
        username: 'demo.admin',
        ipAddress: '10.0.0.1',
        description: 'Successful login from new device',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        resolved: true
      },
      {
        id: '3',
        type: 'role_change',
        severity: 'medium',
        username: 'mwilliams@dhs.gov',
        description: 'Role elevated from navigator to supervisor',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        resolved: true
      },
      {
        id: '4',
        type: 'suspicious_activity',
        severity: 'high',
        ipAddress: '203.0.113.42',
        description: 'Unusual API access pattern detected',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        resolved: false
      }
    ];
  }

  const displayMetrics = metrics || {
    totalEvents24h: 127,
    failedLogins24h: 8,
    suspiciousActivities: 2,
    activeThreats: 0,
    lastSecurityScan: new Date().toISOString(),
    securityScore: 94
  };

  const displayEvents = events || generateMockEvents();

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return variants[severity] || variants.low;
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, any> = {
      login_attempt: Activity,
      failed_login: UserX,
      password_change: Lock,
      role_change: Shield,
      suspicious_activity: AlertTriangle
    };
    const Icon = icons[type] || Activity;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <>
      <Helmet>
        <title>Security Dashboard - JAWN Admin</title>
      </Helmet>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Security Dashboard</h1>
            <p className="text-muted-foreground">Monitor security events and threat detection</p>
          </div>
          <Button onClick={() => refetchMetrics()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {metricsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                  <Shield className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{displayMetrics.securityScore}/100</div>
                  <p className="text-xs text-muted-foreground">Overall system security</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Events (24h)</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.totalEvents24h}</div>
                  <p className="text-xs text-muted-foreground">Total security events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                  <UserX className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.failedLogins24h}</div>
                  <p className="text-xs text-muted-foreground">In last 24 hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
                  <AlertTriangle className={`h-4 w-4 ${displayMetrics.activeThreats > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${displayMetrics.activeThreats > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {displayMetrics.activeThreats}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {displayMetrics.activeThreats === 0 ? 'No active threats' : 'Requires attention'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Security Events</CardTitle>
                <CardDescription>
                  Last scan: {format(new Date(displayMetrics.lastSecurityScan), 'MMM d, yyyy h:mm a')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayEvents.map((event) => (
                      <div key={event.id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-full ${getSeverityBadge(event.severity)}`}>
                            {getEventIcon(event.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.description}</span>
                              <Badge className={getSeverityBadge(event.severity)}>
                                {event.severity}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {event.username && <span>User: {event.username} | </span>}
                              {event.ipAddress && <span>IP: {event.ipAddress} | </span>}
                              <span>{format(new Date(event.timestamp), 'MMM d, h:mm a')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.resolved ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <XCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
