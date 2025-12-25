import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  Target,
  Activity,
  Download,
  RefreshCw,
  Brain,
  Zap,
  Award,
  BarChart3,
} from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";

interface PredictionMetric {
  label: string;
  value: number;
  change: number;
  trend: "up" | "down" | "stable";
  confidence: number;
}

interface CrossEnrollmentOpportunity {
  program: string;
  households: number;
  potentialBenefit: number;
  confidence: number;
  priority: "low" | "medium" | "high" | "critical";
}

interface ProcessingTimeForecast {
  program: string;
  currentAvg: number;
  predictedAvg: number;
  complexity: string;
  bottlenecks: string[];
}

interface ResourceUtilization {
  office: string;
  currentLoad: number;
  predictedLoad: number;
  staffing: number;
  efficiency: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedOffice, setSelectedOffice] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch analytics data
  const { data: predictions, isLoading: loadingPredictions } = useQuery({
    queryKey: ["/api/analytics/predictions", timeRange, refreshKey],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: crossEnrollment, isLoading: loadingCrossEnrollment } = useQuery({
    queryKey: ["/api/analytics/cross-enrollment", refreshKey],
  });

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["/api/analytics/insights", timeRange, selectedOffice, refreshKey],
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ["/api/analytics/trends", timeRange, refreshKey],
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleExport = (type: string) => {
    // Generate and download report
    const endpoint = `/api/analytics/export?type=${type}&range=${timeRange}&office=${selectedOffice}`;
    window.open(endpoint, "_blank");
  };

  // Key metrics
  const keyMetrics: PredictionMetric[] = predictions?.metrics || [
    { label: "Case Approval Rate", value: 78, change: 3.2, trend: "up", confidence: 0.89 },
    { label: "Avg Processing Time", value: 21, change: -2.5, trend: "down", confidence: 0.92 },
    { label: "Renewal Rate", value: 85, change: 1.8, trend: "up", confidence: 0.87 },
    { label: "Cross-Enrollment Rate", value: 42, change: 8.5, trend: "up", confidence: 0.84 },
  ];

  // Cross-enrollment opportunities
  const opportunities: CrossEnrollmentOpportunity[] = crossEnrollment?.opportunities || [
    { program: "SNAP", households: 1250, potentialBenefit: 312500, confidence: 0.92, priority: "high" },
    { program: "WIC", households: 890, potentialBenefit: 89000, confidence: 0.88, priority: "high" },
    { program: "LIHEAP", households: 2100, potentialBenefit: 420000, confidence: 0.85, priority: "critical" },
    { program: "Medicaid", households: 560, potentialBenefit: 280000, confidence: 0.91, priority: "medium" },
    { program: "TANF", households: 320, potentialBenefit: 160000, confidence: 0.79, priority: "medium" },
  ];

  // Processing time forecasts
  const processingForecasts: ProcessingTimeForecast[] = insights?.processing || [
    { program: "SNAP", currentAvg: 21, predictedAvg: 18, complexity: "medium", bottlenecks: ["Income verification"] },
    { program: "Medicaid", currentAvg: 35, predictedAvg: 30, complexity: "high", bottlenecks: ["Medical review", "Documentation"] },
    { program: "TANF", currentAvg: 28, predictedAvg: 25, complexity: "medium", bottlenecks: ["Work requirements"] },
    { program: "WIC", currentAvg: 14, predictedAvg: 12, complexity: "low", bottlenecks: [] },
  ];

  // Resource utilization
  const resourceData: ResourceUtilization[] = insights?.resources || [
    { office: "Baltimore", currentLoad: 85, predictedLoad: 92, staffing: 12, efficiency: 78 },
    { office: "Montgomery", currentLoad: 72, predictedLoad: 75, staffing: 10, efficiency: 85 },
    { office: "Prince George's", currentLoad: 90, predictedLoad: 88, staffing: 14, efficiency: 72 },
    { office: "Anne Arundel", currentLoad: 68, predictedLoad: 70, staffing: 8, efficiency: 88 },
  ];

  // Trend data for charts
  const trendData = trends?.data || Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), "MMM dd"),
    predictions: Math.floor(Math.random() * 50) + 100,
    actual: Math.floor(Math.random() * 50) + 95,
    confidence: Math.random() * 0.2 + 0.8,
  }));

  // Anomaly data
  const anomalies = insights?.anomalies || [
    { type: "Sudden spike in applications", severity: "high", count: 3 },
    { type: "Processing delays", severity: "medium", count: 5 },
    { type: "Data quality issues", severity: "low", count: 8 },
  ];

  const isLoading = loadingPredictions || loadingCrossEnrollment || loadingInsights || loadingTrends;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Predictive Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            AI-powered insights and predictions for benefit programs
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              <SelectItem value="baltimore">Baltimore</SelectItem>
              <SelectItem value="montgomery">Montgomery</SelectItem>
              <SelectItem value="pg">Prince George's</SelectItem>
              <SelectItem value="anne-arundel">Anne Arundel</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => handleExport("full")}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {keyMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {metric.label.includes("Time") ? `${metric.value} days` : `${metric.value}%`}
                </div>
                <div className="flex flex-col items-end">
                  <Badge variant={metric.trend === "up" ? "success" : "secondary"}>
                    {metric.trend === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {Math.abs(metric.change)}%
                  </Badge>
                  <span className="text-xs text-muted-foreground mt-1">
                    {Math.round(metric.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="cross-enrollment" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="cross-enrollment">Cross-Enrollment</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="processing">Processing Times</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
        </TabsList>

        {/* Cross-Enrollment Tab */}
        <TabsContent value="cross-enrollment" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Opportunity Matrix */}
            <Card>
              <CardHeader>
                <CardTitle>Cross-Enrollment Opportunities</CardTitle>
                <CardDescription>Unclaimed benefits by program</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <Treemap
                    data={opportunities.map(opp => ({
                      name: opp.program,
                      size: opp.households,
                      value: opp.potentialBenefit,
                      confidence: opp.confidence,
                    }))}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    fill="#8884d8"
                  >
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload[0]) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background p-2 border rounded shadow">
                            <p className="font-semibold">{data.name}</p>
                            <p>Households: {data.size}</p>
                            <p>Benefit: ${data.value.toLocaleString()}</p>
                            <p>Confidence: {Math.round(data.confidence * 100)}%</p>
                          </div>
                        );
                      }}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Priority List */}
            <Card>
              <CardHeader>
                <CardTitle>Priority Recommendations</CardTitle>
                <CardDescription>Highest impact opportunities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {opportunities
                  .sort((a, b) => b.potentialBenefit - a.potentialBenefit)
                  .slice(0, 5)
                  .map((opp, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Award className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{opp.program}</p>
                          <p className="text-sm text-muted-foreground">
                            {opp.households.toLocaleString()} households
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${(opp.potentialBenefit / 1000).toFixed(0)}K</p>
                        <Badge variant={
                          opp.priority === "critical" ? "destructive" :
                          opp.priority === "high" ? "warning" :
                          "secondary"
                        }>
                          {opp.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Impact Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Cross-Enrollment Impact Over Time</CardTitle>
              <CardDescription>Projected vs actual enrollment rates</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorPredictions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="predictions"
                    stroke="#8884d8"
                    fillOpacity={1}
                    fill="url(#colorPredictions)"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#82ca9d"
                    fillOpacity={1}
                    fill="url(#colorActual)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Case Outcome Predictions */}
            <Card>
              <CardHeader>
                <CardTitle>Case Outcome Predictions</CardTitle>
                <CardDescription>AI confidence scores by outcome</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={[
                    { outcome: "Approved", current: 78, predicted: 82 },
                    { outcome: "Denied", current: 15, predicted: 12 },
                    { outcome: "Pending", current: 7, predicted: 6 },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="outcome" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Current" dataKey="current" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Radar name="Predicted" dataKey="predicted" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Renewal Predictions */}
            <Card>
              <CardHeader>
                <CardTitle>Renewal & Churn Predictions</CardTitle>
                <CardDescription>Next 90 days forecast</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Will Renew", value: 85 },
                        { name: "At Risk", value: 10 },
                        { name: "Will Churn", value: 5 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Prediction Accuracy */}
          <Card>
            <CardHeader>
              <CardTitle>Model Performance</CardTitle>
              <CardDescription>Prediction accuracy over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData.map(d => ({ ...d, accuracy: d.confidence * 100 }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[70, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#8884d8" name="Accuracy %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processing Times Tab */}
        <TabsContent value="processing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Time Forecasts</CardTitle>
              <CardDescription>Current vs predicted processing times by program</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={processingForecasts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="program" />
                  <YAxis label={{ value: "Days", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="currentAvg" fill="#8884d8" name="Current Average" />
                  <Bar dataKey="predictedAvg" fill="#82ca9d" name="Predicted Average" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bottleneck Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {processingForecasts.map((forecast, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{forecast.program}</CardTitle>
                  <CardDescription>
                    Complexity: <Badge variant="outline">{forecast.complexity}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Current Avg:</span>
                      <span className="font-bold">{forecast.currentAvg} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Predicted:</span>
                      <span className="font-bold text-green-600">{forecast.predictedAvg} days</span>
                    </div>
                    {forecast.bottlenecks.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-1">Bottlenecks:</p>
                        {forecast.bottlenecks.map((bottleneck, i) => (
                          <Badge key={i} variant="secondary" className="mr-1 mb-1">
                            {bottleneck}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Utilization Predictions</CardTitle>
              <CardDescription>Current vs predicted workload by office</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={resourceData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="office" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="currentLoad" fill="#8884d8" name="Current Load %" />
                  <Bar dataKey="predictedLoad" fill="#82ca9d" name="Predicted Load %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Efficiency Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resourceData.map((office, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{office.office}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Efficiency Score</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${office.efficiency}%` }}
                          />
                        </div>
                        <span className="font-bold">{office.efficiency}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Staff</span>
                      <span className="font-bold">{office.staffing}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Utilization</span>
                      <Badge variant={office.currentLoad > 85 ? "destructive" : "secondary"}>
                        {office.currentLoad}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Anomalies</CardTitle>
              <CardDescription>Unusual patterns requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {anomalies.map((anomaly, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${
                        anomaly.severity === "high" ? "text-red-500" :
                        anomaly.severity === "medium" ? "text-yellow-500" :
                        "text-blue-500"
                      }`} />
                      <div>
                        <p className="font-medium">{anomaly.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {anomaly.count} occurrences in selected period
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      anomaly.severity === "high" ? "destructive" :
                      anomaly.severity === "medium" ? "warning" :
                      "secondary"
                    }>
                      {anomaly.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Seasonal Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Pattern Analysis</CardTitle>
              <CardDescription>Predicted trends based on historical patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="predictions" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="actual" stroke="#82ca9d" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Insights Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Generated Insights
          </CardTitle>
          <CardDescription>Key findings and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4" />
                <span className="font-semibold">Quick Win</span>
              </div>
              <p className="text-sm">
                LIHEAP has the highest cross-enrollment potential with 2,100 households eligible.
                Immediate outreach could generate $420K in benefits.
              </p>
            </div>
            <div className="p-4 border rounded space-y-2">
              <div className="flex items-center gap-2 text-yellow-600">
                <Target className="h-4 w-4" />
                <span className="font-semibold">Focus Area</span>
              </div>
              <p className="text-sm">
                Processing times for Medicaid can be reduced by 5 days by addressing
                medical review bottlenecks.
              </p>
            </div>
            <div className="p-4 border rounded space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <Activity className="h-4 w-4" />
                <span className="font-semibold">Trend Alert</span>
              </div>
              <p className="text-sm">
                Renewal rates are trending up 3.2% month-over-month.
                Intervention programs are showing positive impact.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}