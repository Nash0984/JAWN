import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, FileCheck, Users, Clock } from "lucide-react";
import { LoadingWrapper } from "@/components/common";
import { useTenant } from "@/contexts/TenantContext";

interface CountyComparison {
  county: {
    id: string;
    name: string;
    code: string;
    region: string | null;
  };
  metrics: {
    totalCases: number;
    casesClosed: number;
    casesApproved: number;
    totalBenefitsSecured: number;
    successRate: number;
    avgResponseTime: number;
    activeNavigators: number;
    avgCasesPerNavigator: number;
  } | null;
}

export default function CountyAnalytics() {
  const [periodType, setPeriodType] = useState<string>("monthly");
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';

  const { data: comparison, isLoading, error } = useQuery<CountyComparison[]>({
    queryKey: [`/api/county-analytics/comparison?periodType=${periodType}`],
  });

  const validComparison = comparison?.filter(c => c.metrics !== null) || [];

  // Calculate statewide totals
  const statewideTotals = validComparison.reduce(
    (acc, curr) => {
      if (!curr.metrics) return acc;
      return {
        totalCases: acc.totalCases + (curr.metrics.totalCases || 0),
        casesClosed: acc.casesClosed + (curr.metrics.casesClosed || 0),
        casesApproved: acc.casesApproved + (curr.metrics.casesApproved || 0),
        totalBenefitsSecured: acc.totalBenefitsSecured + (curr.metrics.totalBenefitsSecured || 0),
        activeNavigators: acc.activeNavigators + (curr.metrics.activeNavigators || 0),
      };
    },
    { totalCases: 0, casesClosed: 0, casesApproved: 0, totalBenefitsSecured: 0, activeNavigators: 0 }
  );

  // Prepare chart data
  const caseComparisonData = validComparison.map((c) => ({
    name: c.county.name,
    closed: c.metrics?.casesClosed || 0,
    approved: c.metrics?.casesApproved || 0,
  }));

  const benefitsData = validComparison.map((c) => ({
    name: c.county.name,
    benefits: c.metrics?.totalBenefitsSecured || 0,
  }));

  const performanceData = validComparison.map((c) => ({
    name: c.county.name,
    successRate: c.metrics?.successRate || 0,
    avgResponseTime: c.metrics?.avgResponseTime || 0,
  }));

  const MetricCard = ({ title, value, icon: Icon, trend, trendValue }: any) => (
    <Card data-testid={`card-metric-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`text-${title.toLowerCase().replace(/\s/g, '-')}-value`}>
          {value}
        </div>
        {trend && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span>{trendValue}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <LoadingWrapper isLoading={isLoading} skeletonType="card">
        {error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <h2 className="text-lg font-semibold text-destructive mb-2">Failed to load analytics data</h2>
            <p className="text-sm text-muted-foreground">
              Unable to fetch county performance metrics. Please try again later.
            </p>
          </div>
        ) : (
          <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            County Performance Analytics
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Compare performance metrics across {stateName} LDSSs
          </p>
        </div>
        <Select value={periodType} onValueChange={setPeriodType}>
          <SelectTrigger className="w-[180px]" data-testid="select-period-type">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily" data-testid="option-daily">Daily</SelectItem>
            <SelectItem value="weekly" data-testid="option-weekly">Weekly</SelectItem>
            <SelectItem value="monthly" data-testid="option-monthly">Monthly</SelectItem>
            <SelectItem value="quarterly" data-testid="option-quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Statewide Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Cases Closed"
          value={statewideTotals.casesClosed.toLocaleString()}
          icon={FileCheck}
        />
        <MetricCard
          title="Cases Approved"
          value={statewideTotals.casesApproved.toLocaleString()}
          icon={TrendingUp}
        />
        <MetricCard
          title="Benefits Secured"
          value={`$${(statewideTotals.totalBenefitsSecured / 1000).toFixed(1)}K`}
          icon={DollarSign}
        />
        <MetricCard
          title="Active Navigators"
          value={statewideTotals.activeNavigators}
          icon={Users}
        />
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="cases" className="space-y-4">
        <TabsList data-testid="tabs-analytics">
          <TabsTrigger value="cases" data-testid="tab-cases">Case Performance</TabsTrigger>
          <TabsTrigger value="benefits" data-testid="tab-benefits">Benefits Secured</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Efficiency Metrics</TabsTrigger>
          <TabsTrigger value="table" data-testid="tab-table">Detailed View</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-cases-chart-title">Cases by County</CardTitle>
              <CardDescription>Closed vs. Approved cases comparison</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={caseComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="closed" fill="hsl(var(--primary))" name="Cases Closed" />
                  <Bar dataKey="approved" fill="hsl(var(--success))" name="Cases Approved" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-benefits-chart-title">Total Benefits Secured</CardTitle>
              <CardDescription>Dollar amount of benefits secured by county</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benefitsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="benefits" fill="hsl(var(--accent-warm))" name="Benefits Secured ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-performance-chart-title">Performance Metrics</CardTitle>
              <CardDescription>Success rate and average response time</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="successRate"
                    stroke="hsl(var(--success))"
                    name="Success Rate (%)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgResponseTime"
                    stroke="hsl(var(--warning))"
                    name="Avg Response Time (hrs)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-table-title">Detailed Metrics by County</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-county-metrics">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">County</th>
                      <th className="text-right p-2">Cases Closed</th>
                      <th className="text-right p-2">Success Rate</th>
                      <th className="text-right p-2">Benefits Secured</th>
                      <th className="text-right p-2">Avg Response Time</th>
                      <th className="text-right p-2">Active Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validComparison.map((c) => (
                      <tr key={c.county.id} className="border-b hover:bg-muted/50" data-testid={`row-county-${c.county.code}`}>
                        <td className="p-2 font-medium" data-testid={`text-county-name-${c.county.code}`}>{c.county.name}</td>
                        <td className="text-right p-2" data-testid={`text-cases-closed-${c.county.code}`}>{c.metrics?.casesClosed || 0}</td>
                        <td className="text-right p-2" data-testid={`text-success-rate-${c.county.code}`}>{c.metrics?.successRate.toFixed(1) || 0}%</td>
                        <td className="text-right p-2" data-testid={`text-benefits-${c.county.code}`}>
                          ${(c.metrics?.totalBenefitsSecured || 0).toLocaleString()}
                        </td>
                        <td className="text-right p-2" data-testid={`text-response-time-${c.county.code}`}>
                          {c.metrics?.avgResponseTime.toFixed(1) || 0} hrs
                        </td>
                        <td className="text-right p-2" data-testid={`text-active-staff-${c.county.code}`}>{c.metrics?.activeNavigators || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
          </>
        )}
      </LoadingWrapper>
    </div>
  );
}
