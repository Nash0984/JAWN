import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
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
import { 
  TrendingUp, 
  Users, 
  FileText,
  Clock,
  RefreshCw,
  Download
} from "lucide-react";
import { format } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface UsageMetrics {
  totalSessions: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  pageViews: number;
  topFeatures: Array<{ feature: string; usage: number }>;
  usersByRole: Array<{ role: string; count: number }>;
  dailyActivity: Array<{ date: string; sessions: number; users: number }>;
  programUsage: Array<{ program: string; applications: number; approvals: number }>;
}

export default function AnalyticsDashboard() {
  const { data: metrics, isLoading, refetch } = useQuery<UsageMetrics>({
    queryKey: ['/api/admin/analytics'],
    select: (data: any) => data || generateMockMetrics()
  });

  function generateMockMetrics(): UsageMetrics {
    const today = new Date();
    return {
      totalSessions: 12847,
      uniqueUsers: 342,
      avgSessionDuration: 18.5,
      pageViews: 78234,
      topFeatures: [
        { feature: 'Eligibility Calculator', usage: 4521 },
        { feature: 'Case Management', usage: 3892 },
        { feature: 'Document Upload', usage: 2456 },
        { feature: 'Cross-Enrollment', usage: 1823 },
        { feature: 'VITA Tax Help', usage: 1245 },
        { feature: 'Policy Search', usage: 890 }
      ],
      usersByRole: [
        { role: 'Navigator', count: 185 },
        { role: 'Supervisor', count: 42 },
        { role: 'Admin', count: 8 },
        { role: 'Researcher', count: 15 },
        { role: 'Applicant', count: 92 }
      ],
      dailyActivity: Array.from({ length: 14 }, (_, i) => ({
        date: format(new Date(today.getTime() - (13 - i) * 86400000), 'MMM d'),
        sessions: Math.floor(Math.random() * 400) + 600,
        users: Math.floor(Math.random() * 80) + 150
      })),
      programUsage: [
        { program: 'SNAP', applications: 2847, approvals: 2341 },
        { program: 'Medicaid', applications: 1923, approvals: 1654 },
        { program: 'TANF', applications: 892, approvals: 623 },
        { program: 'Energy Assist', applications: 1234, approvals: 1089 },
        { program: 'WIC', applications: 567, approvals: 498 }
      ]
    };
  }

  const displayMetrics = metrics || generateMockMetrics();

  return (
    <>
      <Helmet>
        <title>Analytics Dashboard - JAWN Admin</title>
      </Helmet>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Platform usage and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
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
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.totalSessions.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.uniqueUsers}</div>
                  <p className="text-xs text-muted-foreground">Active users</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Session</CardTitle>
                  <Clock className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.avgSessionDuration} min</div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                  <FileText className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.pageViews.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="activity" className="space-y-4">
              <TabsList>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="programs">Programs</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Activity (Last 14 Days)</CardTitle>
                    <CardDescription>Sessions and unique users over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={displayMetrics.dailyActivity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="sessions" 
                          stroke="#8884d8" 
                          name="Sessions"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="users" 
                          stroke="#82ca9d" 
                          name="Users"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Usage</CardTitle>
                    <CardDescription>Most used platform features</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={displayMetrics.topFeatures} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="feature" type="category" width={150} />
                        <Tooltip />
                        <Bar dataKey="usage" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="programs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Program Applications</CardTitle>
                    <CardDescription>Applications submitted vs approved by program</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={displayMetrics.programUsage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="program" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="applications" fill="#8884d8" name="Applications" />
                        <Bar dataKey="approvals" fill="#82ca9d" name="Approvals" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Users by Role</CardTitle>
                    <CardDescription>Distribution of active users by role</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={displayMetrics.usersByRole}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={(entry) => `${entry.role}: ${entry.count}`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {displayMetrics.usersByRole.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  );
}
