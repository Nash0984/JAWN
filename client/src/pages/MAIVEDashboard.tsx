/**
 * MAIVE Dashboard - AI Validation Engine Monitoring
 * 
 * Displays test results, accuracy trends, and validation gates for AI systems.
 * Ensures 95%+ accuracy for Maryland benefits policies.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  BarChart3, 
  Play,
  RefreshCw,
  FileText,
  Zap
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TestCase {
  id: string;
  name: string;
  category: string;
  scenario: string;
  accuracyThreshold: number;
  stateSpecific?: string;
  tags: string[];
  isActive: boolean;
}

interface TestRun {
  id: string;
  name: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallAccuracy: number;
  status: 'running' | 'passed' | 'failed';
  state?: string;
  startedAt: string;
  completedAt?: string;
}

interface Evaluation {
  testCaseId: string;
  accuracy: number;
  passed: boolean;
  reasoning: string;
  deviations: string[];
  executionTime: number;
  llmJudgment: string;
}

interface AccuracyTrend {
  date: string;
  avgAccuracy: number;
  testCount: number;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "benefit_calculation", label: "Benefit Calculations" },
  { value: "policy_interpretation", label: "Policy Interpretation" },
  { value: "document_extraction", label: "Document Extraction" },
  { value: "eligibility_determination", label: "Eligibility Determination" },
  { value: "work_requirements", label: "Work Requirements" },
];

export default function MAIVEDashboard() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("MD");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Fetch test cases
  const { data: testCases, isLoading: testCasesLoading } = useQuery<TestCase[]>({
    queryKey: ["/api/maive/test-cases", selectedCategory, selectedState],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedState) params.append("state", selectedState);
      const url = `/api/maive/test-cases${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, { credentials: 'include' });
      const data = await response.json();
      return data.testCases || [];
    },
  });

  // Fetch recent test runs
  const { data: testRuns, isLoading: runsLoading } = useQuery<TestRun[]>({
    queryKey: ["/api/maive/test-runs", selectedState],
    queryFn: async () => {
      const params = selectedState ? `?state=${selectedState}` : "";
      const response = await fetch(`/api/maive/test-runs${params}`, { credentials: 'include' });
      const data = await response.json();
      return data.runs || [];
    },
  });

  // Fetch accuracy trends
  const { data: trends, isLoading: trendsLoading } = useQuery<AccuracyTrend[]>({
    queryKey: ["/api/maive/trends", selectedState],
    queryFn: async () => {
      const params = selectedState ? `?state=${selectedState}` : "";
      const response = await fetch(`/api/maive/trends${params}`, { credentials: 'include' });
      const data = await response.json();
      return data.trends || [];
    },
  });

  // Fetch selected run details
  const { data: runDetails } = useQuery({
    queryKey: ["/api/maive/test-runs", selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return null;
      const response = await fetch(`/api/maive/test-runs/${selectedRunId}`, { credentials: 'include' });
      return response.json();
    },
    enabled: !!selectedRunId,
  });

  // Run test suite mutation
  const runTestSuite = useMutation({
    mutationFn: async (systemType: string) => {
      const testCaseIds = testCases?.map(tc => tc.id) || [];
      if (testCaseIds.length === 0) {
        throw new Error("No test cases available");
      }
      
      return apiRequest("/api/maive/run-suite", "POST", {
        suiteName: `${selectedState} ${systemType} Validation - ${new Date().toISOString()}`,
        testCaseIds,
        systemType,
        state: selectedState,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maive/test-runs"] });
      toast({
        title: "Test Suite Started",
        description: "MAIVE validation is running. Results will appear shortly.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate key metrics (accuracy values are 0-1 scale from backend)
  const latestRun = testRuns?.[0];
  const averageAccuracy = trends?.length ? 
    trends.reduce((acc, t) => acc + t.avgAccuracy * 100, 0) / trends.length : 0;
  const accuracyTrend = trends?.length >= 2 ? 
    (trends[trends.length - 1].avgAccuracy - trends[0].avgAccuracy) * 100 : 0;
  const totalTestsRun = testRuns?.reduce((acc, run) => acc + run.totalTests, 0) || 0;

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'running': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  // Get accuracy badge (accuracy is on 0-1 scale)
  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 0.95) {
      return <Badge className="bg-green-100 text-green-800">✓ Production Ready</Badge>;
    } else if (accuracy >= 0.90) {
      return <Badge className="bg-yellow-100 text-yellow-800">⚠ Needs Improvement</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">✗ Below Threshold</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="title-maive">
          MAIVE - AI Validation Engine
        </h1>
        <p className="text-muted-foreground">
          LLM-as-Judge framework ensuring 95%+ accuracy for benefits determination. 
          Generic architecture for multi-state white-labeling.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card data-testid="metric-latest-accuracy">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Accuracy</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestRun ? `${(latestRun.overallAccuracy * 100).toFixed(1)}%` : "N/A"}
            </div>
            {latestRun && getAccuracyBadge(latestRun.overallAccuracy)}
          </CardContent>
        </Card>

        <Card data-testid="metric-average-accuracy">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30-Day Average</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageAccuracy.toFixed(1)}%
            </div>
            <div className="flex items-center text-sm">
              {accuracyTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
              )}
              <span>{Math.abs(accuracyTrend).toFixed(1)}% trend</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="metric-tests-run">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests Run</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTestsRun.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {testRuns?.length || 0} test runs
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-test-cases">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Test Cases</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testCases?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedState} specific
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="w-48" data-testid="select-state">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MD">Maryland</SelectItem>
            <SelectItem value="CA">California</SelectItem>
            <SelectItem value="TX">Texas</SelectItem>
            <SelectItem value="NY">New York</SelectItem>
            <SelectItem value="FL">Florida</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-64" data-testid="select-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          onClick={() => runTestSuite.mutate("policy_engine")}
          disabled={runTestSuite.isPending}
          data-testid="button-run-policy"
        >
          <Play className="h-4 w-4 mr-2" />
          Test PolicyEngine
        </Button>

        <Button
          onClick={() => runTestSuite.mutate("gemini_extraction")}
          disabled={runTestSuite.isPending}
          variant="outline"
          data-testid="button-run-gemini"
        >
          <Play className="h-4 w-4 mr-2" />
          Test Gemini
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList data-testid="tabs-maive">
          <TabsTrigger value="runs" data-testid="tab-runs">Test Runs</TabsTrigger>
          <TabsTrigger value="cases" data-testid="tab-cases">Test Cases</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Accuracy Trends</TabsTrigger>
        </TabsList>

        {/* Test Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Runs</CardTitle>
              <CardDescription>
                Click a run to see detailed evaluation results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : testRuns?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No test runs yet. Click "Test PolicyEngine" or "Test Gemini" to start validation.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Suite</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Tests</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testRuns?.map((run) => (
                      <TableRow 
                        key={run.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRunId(run.id)}
                        data-testid={`run-${run.id}`}
                      >
                        <TableCell className="font-medium">{run.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{run.state || "General"}</Badge>
                        </TableCell>
                        <TableCell>{run.totalTests}</TableCell>
                        <TableCell>{run.passedTests}/{run.totalTests}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={run.overallAccuracy * 100} className="w-16 h-2" />
                            <span className="text-sm font-medium">{(run.overallAccuracy * 100).toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(run.status)}>
                            {run.status === 'passed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {run.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                            {run.status === 'running' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(run.startedAt), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Run Details */}
          {runDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Evaluation Details</CardTitle>
                <CardDescription>
                  Individual test case results for run {selectedRunId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {runDetails.evaluations?.map((evaluation: Evaluation, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Test Case {evaluation.testCaseId}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={evaluation.passed ? "default" : "destructive"}>
                            {evaluation.passed ? "PASSED" : "FAILED"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {evaluation.accuracy.toFixed(1)}% accuracy
                          </span>
                        </div>
                      </div>
                      {evaluation.deviations.length > 0 && (
                        <Alert className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Deviations Detected</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside mt-2">
                              {evaluation.deviations.map((dev, i) => (
                                <li key={i} className="text-sm">{dev}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">{evaluation.reasoning}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Execution time: {evaluation.executionTime}ms | Judge: {evaluation.llmJudgment}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Test Cases Tab */}
        <TabsContent value="cases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Test Cases</CardTitle>
              <CardDescription>
                {selectedState}-specific validation scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testCasesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {testCases?.map((testCase) => (
                    <div key={testCase.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{testCase.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {testCase.scenario}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{testCase.category}</Badge>
                            <Badge variant="outline">
                              {testCase.accuracyThreshold * 100}% threshold
                            </Badge>
                            {testCase.tags.map(tag => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Trends</CardTitle>
              <CardDescription>
                30-day accuracy history for {selectedState}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : trends?.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  No trend data available. Run tests to see accuracy trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), "MMM d")}
                    />
                    <YAxis domain={[0, 100]} />
                    <RechartsTooltip 
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      labelFormatter={(date) => format(new Date(date), "MMM d, yyyy")}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgAccuracy" 
                      stroke="#3b82f6" 
                      name="Average Accuracy"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="testCount" 
                      stroke="#10b981" 
                      name="Tests Run"
                      strokeWidth={2}
                      dot={{ fill: '#10b981' }}
                      yAxisId="right"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Accuracy by Category</CardTitle>
              <CardDescription>
                Performance across different validation types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={CATEGORIES.slice(1).map(cat => ({
                  category: cat.label.replace(' ', '\n'),
                  accuracy: 85 + Math.random() * 15, // Placeholder data
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Bar 
                    dataKey="accuracy" 
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}