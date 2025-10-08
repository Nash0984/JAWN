import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, TrendingUp, FileCheck, AlertTriangle, BarChart3, Clock } from "lucide-react";

interface QueryAnalytics {
  trends: Array<{
    date: string;
    count: number;
    avgRelevance: number;
    avgResponseTime: number;
  }>;
  totals: {
    totalQueries: number;
    avgRelevance: number;
    avgResponseTime: number;
    withCitations: number;
  };
  topQueries: Array<{
    query: string;
    count: number;
    avgRelevance: number;
  }>;
  period: string;
}

interface SystemHealth {
  errorTrends: Array<{
    date: string;
    totalEvents: number;
    errors: number;
  }>;
  serviceHealth: Array<{
    service: string;
    totalCalls: number;
    failures: number;
    avgResponseTime: number;
  }>;
  period: string;
}

interface ResponseQuality {
  citationMetrics: {
    withCitations: number;
    withoutCitations: number;
    citationRate: number;
    avgCitationsPerResponse: number;
  };
  relevanceDistribution: Array<{
    scoreRange: string;
    count: number;
  }>;
  period: string;
  sampleSize: number;
}

export default function AIMonitoring() {
  const { data: queryAnalytics, isLoading: loadingAnalytics } = useQuery<QueryAnalytics>({
    queryKey: ["/api/ai-monitoring/query-analytics"],
  });

  const { data: systemHealth, isLoading: loadingHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/ai-monitoring/system-health"],
  });

  const { data: responseQuality, isLoading: loadingQuality } = useQuery<ResponseQuality>({
    queryKey: ["/api/ai-monitoring/response-quality"],
  });

  const isLoading = loadingAnalytics || loadingHealth || loadingQuality;

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

  const errorRate = systemHealth?.errorTrends.reduce((sum, day) => sum + day.errors, 0) || 0;
  const totalEvents = systemHealth?.errorTrends.reduce((sum, day) => sum + day.totalEvents, 0) || 1;
  const errorPercentage = ((errorRate / totalEvents) * 100).toFixed(2);

  const geminiHealth = systemHealth?.serviceHealth.find(s => s.service === "Gemini");
  const geminiSuccessRate = geminiHealth 
    ? (((geminiHealth.totalCalls - geminiHealth.failures) / geminiHealth.totalCalls) * 100).toFixed(1)
    : "N/A";

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="title-ai-monitoring">
          AI Health & Bias Monitoring
        </h1>
        <p className="text-muted-foreground">
          Transparency dashboard for Maryland SNAP AI system - monitoring accuracy, citations, and bias indicators
        </p>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card data-testid="metric-total-queries">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-total-queries">
              {queryAnalytics?.totals.totalQueries.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{queryAnalytics?.period}</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-citation-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citation Rate</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-citation-rate">
              {responseQuality?.citationMetrics.citationRate.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {responseQuality?.citationMetrics.withCitations} with citations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-avg-relevance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Relevance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-avg-relevance">
              {queryAnalytics?.totals.avgRelevance?.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Quality score 0-1</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-error-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-error-rate">
              {errorPercentage}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{errorRate} errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="quality" className="space-y-4">
        <TabsList data-testid="tabs-monitoring">
          <TabsTrigger value="quality" data-testid="tab-quality">Response Quality</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Query Analytics</TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">System Health</TabsTrigger>
        </TabsList>

        {/* Response Quality Tab */}
        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Citation Metrics */}
            <Card data-testid="card-citation-metrics">
              <CardHeader>
                <CardTitle>Citation Quality</CardTitle>
                <CardDescription>
                  Grounding policy responses in official sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Responses with Citations</span>
                    <Badge variant="default" data-testid="badge-with-citations">
                      {responseQuality?.citationMetrics.withCitations || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Responses without Citations</span>
                    <Badge variant="secondary" data-testid="badge-without-citations">
                      {responseQuality?.citationMetrics.withoutCitations || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-medium">Avg Citations per Response</span>
                    <span className="font-bold" data-testid="value-avg-citations">
                      {responseQuality?.citationMetrics.avgCitationsPerResponse.toFixed(1) || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Relevance Distribution */}
            <Card data-testid="card-relevance-distribution">
              <CardHeader>
                <CardTitle>Relevance Score Distribution</CardTitle>
                <CardDescription>
                  Quality of AI responses (0.0 = poor, 1.0 = excellent)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {responseQuality?.relevanceDistribution.map((range, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm" data-testid={`range-label-${idx}`}>{range.scoreRange}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ 
                              width: `${(range.count / (responseQuality?.sampleSize || 1)) * 100}%` 
                            }}
                            data-testid={`range-bar-${idx}`}
                          />
                        </div>
                        <Badge variant="outline" data-testid={`range-count-${idx}`}>{range.count}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bias Monitoring Note */}
          <Card className="border-blue-200 bg-blue-50" data-testid="card-bias-note">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
                Maryland SNAP Bias Monitoring
              </CardTitle>
              <CardDescription className="text-blue-900">
                Ensuring equitable access for all Maryland residents
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-blue-900 space-y-2">
              <p>
                <strong>Monitored for:</strong> Racial bias, socioeconomic bias, language accessibility (LEP compliance), geographic equity
              </p>
              <p>
                <strong>Review Process:</strong> Low relevance scores (&lt;0.4) and responses without citations are flagged for manual review by DHS policy staff
              </p>
              <p>
                <strong>Accountability:</strong> All AI responses are logged with full audit trail for compliance and quality assurance
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Query Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card data-testid="card-top-queries">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top 10 Queries
              </CardTitle>
              <CardDescription>Most frequently asked questions ({queryAnalytics?.period})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {queryAnalytics?.topQueries.map((q, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`query-item-${idx}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium" data-testid={`query-text-${idx}`}>{q.query}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg Relevance: {q.avgRelevance?.toFixed(2) || "N/A"}
                      </p>
                    </div>
                    <Badge data-testid={`query-count-${idx}`}>{q.count}x</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-response-time">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
              <CardDescription>System response times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="value-avg-response-time">
                {queryAnalytics?.totals.avgResponseTime || 0}ms
              </div>
              <p className="text-sm text-muted-foreground mt-1">Average response time</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card data-testid="card-gemini-health">
            <CardHeader>
              <CardTitle>Google Gemini API Health</CardTitle>
              <CardDescription>External AI service reliability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Success Rate</span>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold" data-testid="value-gemini-success-rate">
                      {geminiSuccessRate}%
                    </div>
                    <Badge 
                      variant={parseFloat(geminiSuccessRate as string) > 95 ? "default" : "destructive"}
                      data-testid="badge-gemini-status"
                    >
                      {parseFloat(geminiSuccessRate as string) > 95 ? "Healthy" : "Degraded"}
                    </Badge>
                  </div>
                </div>
                {geminiHealth && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Calls</span>
                      <span className="font-medium" data-testid="value-gemini-calls">{geminiHealth.totalCalls}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Failures</span>
                      <span className="font-medium" data-testid="value-gemini-failures">{geminiHealth.failures}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Response Time</span>
                      <span className="font-medium" data-testid="value-gemini-response-time">
                        {geminiHealth.avgResponseTime || "N/A"}ms
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-error-trends">
            <CardHeader>
              <CardTitle>Error Trends</CardTitle>
              <CardDescription>System errors over {systemHealth?.period}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {systemHealth?.errorTrends.slice(-7).map((day, idx) => {
                  const errorRate = day.totalEvents > 0 ? (day.errors / day.totalEvents) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground" data-testid={`error-date-${idx}`}>
                        {new Date(day.date).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${errorRate > 5 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(errorRate * 10, 100)}%` }}
                            data-testid={`error-bar-${idx}`}
                          />
                        </div>
                        <span className="font-medium w-16 text-right" data-testid={`error-count-${idx}`}>
                          {day.errors} / {day.totalEvents}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
