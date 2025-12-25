import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PlayCircle, Plus, Edit, Trash2, Filter, Download, Upload, CheckCircle2, XCircle, AlertCircle, BarChart3, TrendingUp, Target } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { EvaluationTestCase, EvaluationRun, EvaluationResult } from "@shared/schema";
import { useTenant } from "@/contexts/TenantContext";

const CATEGORIES = ["eligibility", "calculation", "edge_case", "categorical_eligibility", "asset_test"];
const VARIANCE_COLORS = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444"
};

export default function EvaluationFramework() {
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const stateCode = stateConfig?.stateCode || 'ST';
  
  // Dynamically generate program codes based on tenant
  const PROGRAMS = useMemo(() => [
    `${stateCode}_SNAP`,
    `${stateCode}_MEDICAID`,
    `${stateCode}_TANF`,
    `${stateCode}_TCA`
  ], [stateCode]);
  
  const [activeTab, setActiveTab] = useState("test-cases");
  const [filterProgram, setFilterProgram] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterActive, setFilterActive] = useState<boolean>(true);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<EvaluationTestCase | null>(null);

  // Queries
  const { data: testCases = [], isLoading: loadingTestCases } = useQuery<EvaluationTestCase[]>({
    queryKey: ["/api/evaluation/test-cases", filterProgram, filterCategory, filterActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterProgram) params.append('program', filterProgram);
      if (filterCategory) params.append('category', filterCategory);
      if (filterActive) params.append('isActive', 'true');
      
      const response = await fetch(`/api/evaluation/test-cases?${params.toString()}`);
      return response.json();
    },
    enabled: activeTab === "test-cases"
  });

  const { data: runs = [], isLoading: loadingRuns } = useQuery<EvaluationRun[]>({
    queryKey: ["/api/evaluation/runs"],
    enabled: activeTab === "results" || activeTab === "run-tests"
  });

  const { data: selectedRunResults = [], isLoading: loadingResults } = useQuery<EvaluationResult[]>({
    queryKey: ["/api/evaluation/runs", selectedRun, "results"],
    queryFn: async () => {
      const response = await fetch(`/api/evaluation/runs/${selectedRun}/results`);
      return response.json();
    },
    enabled: !!selectedRun
  });

  // Mutations
  const createTestCaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/evaluation/test-cases", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/test-cases"] });
      toast({ title: "Test case created successfully" });
      setCreateDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create test case", variant: "destructive" });
    }
  });

  const updateTestCaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/evaluation/test-cases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/test-cases"] });
      toast({ title: "Test case updated successfully" });
      setEditingTestCase(null);
    },
    onError: () => {
      toast({ title: "Failed to update test case", variant: "destructive" });
    }
  });

  const deleteTestCaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/evaluation/test-cases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/test-cases"] });
      toast({ title: "Test case deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete test case", variant: "destructive" });
    }
  });

  const createRunMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/evaluation/runs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/runs"] });
      toast({ title: "Evaluation run started" });
    },
    onError: () => {
      toast({ title: "Failed to start evaluation run", variant: "destructive" });
    }
  });

  // Calculate summary metrics
  const summaryMetrics = runs.length > 0 ? runs.reduce((acc, run) => {
    return {
      totalTests: acc.totalTests + run.totalCases,
      totalPassed: acc.totalPassed + run.passedCases,
      totalFailed: acc.totalFailed + run.failedCases,
      avgVariance: (acc.avgVariance * acc.count + (run.averageVariance || 0)) / (acc.count + 1),
      count: acc.count + 1
    };
  }, { totalTests: 0, totalPassed: 0, totalFailed: 0, avgVariance: 0, count: 0 }) : null;

  const passRate = summaryMetrics ? (summaryMetrics.totalPassed / summaryMetrics.totalTests * 100).toFixed(1) : "0";

  const getVarianceColor = (variance: number | null | undefined) => {
    if (!variance) return VARIANCE_COLORS.green;
    if (variance < 2) return VARIANCE_COLORS.green;
    if (variance < 5) return VARIANCE_COLORS.yellow;
    return VARIANCE_COLORS.red;
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "Running...";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-evaluation-framework">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">{stateName} Evaluation Framework</h1>
          <p className="text-muted-foreground">Test and validate {stateName} benefit program calculations</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-test-case">
          <Plus className="mr-2 h-4 w-4" />
          New Test Case
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-evaluation">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test-cases" data-testid="tab-test-cases">Test Cases</TabsTrigger>
          <TabsTrigger value="run-tests" data-testid="tab-run-tests">Run Tests</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results Dashboard</TabsTrigger>
        </TabsList>

        {/* TEST CASES TAB */}
        <TabsContent value="test-cases" className="space-y-4">
          <Card data-testid="card-test-case-filters">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-program">Program</Label>
                  <Select value={filterProgram} onValueChange={setFilterProgram}>
                    <SelectTrigger id="filter-program" data-testid="select-filter-program">
                      <SelectValue placeholder="All programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All programs</SelectItem>
                      {PROGRAMS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-category">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger id="filter-category" data-testid="select-filter-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 mt-8">
                  <Switch
                    id="filter-active"
                    checked={filterActive}
                    onCheckedChange={setFilterActive}
                    data-testid="switch-filter-active"
                  />
                  <Label htmlFor="filter-active">Active only</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-test-cases-list">
            <CardHeader>
              <CardTitle>Test Cases ({testCases.length})</CardTitle>
              <CardDescription>Manage evaluation test cases for {stateName} benefit programs</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTestCases ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Tolerance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testCases.map((testCase) => (
                      <TableRow key={testCase.id} data-testid={`row-test-case-${testCase.id}`}>
                        <TableCell className="font-medium" data-testid={`text-test-name-${testCase.id}`}>
                          {testCase.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-program-${testCase.id}`}>
                            {testCase.program}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-category-${testCase.id}`}>{testCase.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {testCase.tags?.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {testCase.tags && testCase.tags.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{testCase.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-tolerance-${testCase.id}`}>
                          {testCase.tolerance}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={testCase.isActive ? "default" : "secondary"}>
                            {testCase.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTestCase(testCase)}
                            data-testid={`button-edit-${testCase.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTestCaseMutation.mutate(testCase.id)}
                            data-testid={`button-delete-${testCase.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RUN TESTS TAB */}
        <TabsContent value="run-tests" className="space-y-4">
          <Card data-testid="card-run-configuration">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Run Configuration
              </CardTitle>
              <CardDescription>Select test cases to run and execute evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="run-program">Filter by Program</Label>
                  <Select>
                    <SelectTrigger id="run-program" data-testid="select-run-program">
                      <SelectValue placeholder="All programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All programs</SelectItem>
                      {PROGRAMS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="run-category">Filter by Category</Label>
                  <Select>
                    <SelectTrigger id="run-category" data-testid="select-run-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Selected Test Cases</p>
                  <p className="text-sm text-muted-foreground">{testCases.filter(tc => tc.isActive).length} active test cases will be executed</p>
                </div>
                <Button
                  size="lg"
                  onClick={() => {
                    createRunMutation.mutate({
                      runName: `Evaluation Run ${new Date().toISOString()}`,
                      program: filterProgram || null,
                      totalCases: testCases.filter(tc => tc.isActive).length,
                      passedCases: 0,
                      failedCases: 0,
                      status: "running",
                      metadata: { startedBy: "user", filters: { program: filterProgram, category: filterCategory } }
                    });
                  }}
                  disabled={createRunMutation.isPending}
                  data-testid="button-start-run"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Start Evaluation Run
                </Button>
              </div>
            </CardContent>
          </Card>

          {loadingRuns ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card data-testid="card-recent-runs">
              <CardHeader>
                <CardTitle>Recent Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run Name</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Pass Rate</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.slice(0, 10).map((run) => (
                      <TableRow key={run.id} data-testid={`row-run-${run.id}`}>
                        <TableCell className="font-medium">{run.runName}</TableCell>
                        <TableCell>
                          {run.program ? (
                            <Badge variant="outline">{run.program}</Badge>
                          ) : (
                            <span className="text-muted-foreground">All</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{run.passedCases + run.failedCases} / {run.totalCases}</span>
                            </div>
                            <Progress 
                              value={(run.passedCases + run.failedCases) / run.totalCases * 100} 
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {run.passRate ? `${run.passRate.toFixed(1)}%` : "N/A"}
                        </TableCell>
                        <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRun(run.id);
                              setActiveTab("results");
                            }}
                            data-testid={`button-view-results-${run.id}`}
                          >
                            View Results
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* RESULTS DASHBOARD TAB */}
        <TabsContent value="results" className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="card-metric-total-tests">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Total Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryMetrics?.totalTests || 0}</div>
                <p className="text-xs text-muted-foreground">Across all runs</p>
              </CardContent>
            </Card>

            <Card data-testid="card-metric-pass-rate">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{passRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {summaryMetrics?.totalPassed || 0} / {summaryMetrics?.totalTests || 0} passed
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-metric-avg-variance">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Avg Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryMetrics?.avgVariance?.toFixed(2) || "0.00"}%
                </div>
                <p className="text-xs text-muted-foreground">Average across runs</p>
              </CardContent>
            </Card>

            <Card data-testid="card-metric-failed-tests">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Failed Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{summaryMetrics?.totalFailed || 0}</div>
                <p className="text-xs text-muted-foreground">Need attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Benchmark Comparison */}
          <Card data-testid="card-benchmark-comparison">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Benchmark Comparison
              </CardTitle>
              <CardDescription>
                Current performance vs Column Tax baseline (41% strict, 61% lenient accuracy)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: "Column Tax (Strict)", value: 41 },
                  { name: "Column Tax (Lenient)", value: 61 },
                  { name: `${stateName} System`, value: parseFloat(passRate) }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8">
                    {[0, 1, 2].map((index) => (
                      <Cell key={`cell-${index}`} fill={index === 2 ? "#22c55e" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Evaluation Runs History */}
          <Card data-testid="card-runs-history">
            <CardHeader>
              <CardTitle>Evaluation Runs History</CardTitle>
              <CardDescription>Historical evaluation run results</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRuns ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pass Rate</TableHead>
                      <TableHead>Avg Variance</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Started At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow 
                        key={run.id} 
                        data-testid={`row-history-run-${run.id}`}
                        className={selectedRun === run.id ? "bg-muted" : ""}
                      >
                        <TableCell className="font-mono text-sm">{run.id.substring(0, 8)}</TableCell>
                        <TableCell>
                          {run.program ? (
                            <Badge variant="outline">{run.program}</Badge>
                          ) : (
                            <span className="text-muted-foreground">All</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span style={{ color: getVarianceColor(run.passRate ? 100 - run.passRate : null) }}>
                            {run.passRate ? `${run.passRate.toFixed(1)}%` : "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span style={{ color: getVarianceColor(run.averageVariance) }}>
                            {run.averageVariance ? `${run.averageVariance.toFixed(2)}%` : "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDuration(new Date(run.startedAt), run.completedAt ? new Date(run.completedAt) : null)}</TableCell>
                        <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant={selectedRun === run.id ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedRun(run.id)}
                            data-testid={`button-select-run-${run.id}`}
                          >
                            {selectedRun === run.id ? "Selected" : "View Details"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Detailed Results View */}
          {selectedRun && (
            <Card data-testid="card-detailed-results">
              <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
                <CardDescription>
                  Test case results for run {selectedRun.substring(0, 8)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingResults ? (
                  <Skeleton className="h-96 w-full" />
                ) : selectedRunResults.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    No results available for this run
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedRunResults.map((result) => {
                      const testCase = testCases.find(tc => tc.id === result.testCaseId);
                      return (
                        <Card key={result.id} data-testid={`card-result-${result.id}`}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {result.passed ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                )}
                                <CardTitle className="text-base">
                                  {testCase?.name || "Unknown Test"}
                                </CardTitle>
                              </div>
                              <div className="flex items-center gap-4">
                                {result.variance !== null && result.variance !== undefined && (
                                  <Badge 
                                    variant="outline"
                                    style={{ borderColor: getVarianceColor(result.variance), color: getVarianceColor(result.variance) }}
                                  >
                                    Variance: {result.variance.toFixed(2)}%
                                  </Badge>
                                )}
                                {result.executionTimeMs && (
                                  <span className="text-sm text-muted-foreground">
                                    {result.executionTimeMs}ms
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {result.errorMessage && (
                              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-red-900 dark:text-red-100">Error</p>
                                    <p className="text-sm text-red-700 dark:text-red-300">{result.errorMessage}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Expected Result</Label>
                                <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-auto max-h-48">
                                  {JSON.stringify(testCase?.expectedResult, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Actual Result</Label>
                                <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-auto max-h-48">
                                  {JSON.stringify(result.actualResult, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Test Case Dialog */}
      <TestCaseDialog
        open={createDialogOpen || !!editingTestCase}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingTestCase(null);
          }
        }}
        testCase={editingTestCase}
        onSave={(data) => {
          if (editingTestCase) {
            updateTestCaseMutation.mutate({ id: editingTestCase.id, data });
          } else {
            createTestCaseMutation.mutate(data);
          }
        }}
        isPending={createTestCaseMutation.isPending || updateTestCaseMutation.isPending}
      />
    </div>
  );
}

// Test Case Dialog Component
function TestCaseDialog({
  open,
  onOpenChange,
  testCase,
  onSave,
  isPending
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: EvaluationTestCase | null;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const { stateConfig } = useTenant();
  const stateCode = stateConfig?.stateCode || 'ST';
  
  // Dynamically generate program codes based on tenant
  const PROGRAMS = useMemo(() => [
    `${stateCode}_SNAP`,
    `${stateCode}_MEDICAID`,
    `${stateCode}_TANF`,
    `${stateCode}_TCA`
  ], [stateCode]);
  
  const [formData, setFormData] = useState({
    name: testCase?.name || "",
    program: testCase?.program || PROGRAMS[0], // Default to first program for current state
    category: testCase?.category || "eligibility",
    description: testCase?.description || "",
    inputData: JSON.stringify(testCase?.inputData || {}, null, 2),
    expectedResult: JSON.stringify(testCase?.expectedResult || {}, null, 2),
    tolerance: testCase?.tolerance?.toString() || "2.00",
    tags: testCase?.tags?.join(", ") || "",
    source: testCase?.source || "",
    isActive: testCase?.isActive ?? true
  });

  const handleSubmit = () => {
    try {
      const data = {
        name: formData.name,
        program: formData.program,
        category: formData.category,
        description: formData.description,
        inputData: JSON.parse(formData.inputData),
        expectedResult: JSON.parse(formData.expectedResult),
        tolerance: parseFloat(formData.tolerance),
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        source: formData.source,
        isActive: formData.isActive
      };
      onSave(data);
    } catch (error) {
      alert("Invalid JSON in input data or expected result");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-test-case">
        <DialogHeader>
          <DialogTitle>{testCase ? "Edit Test Case" : "Create Test Case"}</DialogTitle>
          <DialogDescription>
            {testCase ? "Update the test case details" : "Add a new evaluation test case"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Test Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., SNAP eligibility for household of 3"
                data-testid="input-test-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program">Program *</Label>
              <Select value={formData.program} onValueChange={(value) => setFormData({ ...formData, program: value })}>
                <SelectTrigger id="program" data-testid="select-program">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tolerance">Variance Tolerance (%)</Label>
              <Input
                id="tolerance"
                type="number"
                step="0.01"
                value={formData.tolerance}
                onChange={(e) => setFormData({ ...formData, tolerance: e.target.value })}
                placeholder="2.00"
                data-testid="input-tolerance"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this test case validates"
              data-testid="textarea-description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="md_asset_limit, md_drug_felony, bbce"
              data-testid="input-tags"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source Reference</Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="Manual section or regulation reference"
              data-testid="input-source"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inputData">Input Data (JSON) *</Label>
            <Textarea
              id="inputData"
              value={formData.inputData}
              onChange={(e) => setFormData({ ...formData, inputData: e.target.value })}
              placeholder='{"householdSize": 3, "monthlyIncome": 2500, ...}'
              className="font-mono text-sm"
              rows={6}
              data-testid="textarea-input-data"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedResult">Expected Result (JSON) *</Label>
            <Textarea
              id="expectedResult"
              value={formData.expectedResult}
              onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })}
              placeholder='{"isEligible": true, "monthlyBenefit": 740, ...}'
              className="font-mono text-sm"
              rows={6}
              data-testid="textarea-expected-result"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              data-testid="switch-is-active"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save">
            {isPending ? "Saving..." : testCase ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
