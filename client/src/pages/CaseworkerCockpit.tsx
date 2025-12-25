import { useState, Fragment } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, TrendingUp, TrendingDown, BookOpen, FileText, HelpCircle, Search, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ERROR_CATEGORY_LABELS } from "@shared/qcConstants";

interface FlaggedCase {
  id: string;
  caseId: string;
  clientName: string;
  riskScore: number;
  flaggedErrorTypes: string[];
  flaggedDate: string;
  reviewStatus: string;
  riskLevel: string;
  aiGuidance: string;
}

interface ErrorPattern {
  id: string;
  errorCategory: string;
  errorSubtype: string;
  errorDescription: string;
  quarterOccurred: string;
  errorCount: number;
  totalCases: number;
  errorRate: number;
  trendDirection: string;
  severity: string;
}

interface JobAid {
  id: string;
  title: string;
  category: string;
  content: string;
  policyReference: string;
  lastUpdated: string;
}

interface TrainingIntervention {
  id: string;
  trainingTitle: string;
  targetErrorCategory: string;
  preTrainingErrorRate: number;
  postTrainingErrorRate: number;
  impactScore: number;
  completedDate: string;
}

export default function CaseworkerCockpit() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [jobAidCategory, setJobAidCategory] = useState<string>("all");
  const [jobAidSearch, setJobAidSearch] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);

  // Fetch flagged cases for current caseworker
  const { data: flaggedCases, isLoading: flaggedCasesLoading, error: flaggedCasesError } = useQuery<FlaggedCase[]>({
    queryKey: ["/api/qc/flagged-cases/me"],
  });

  // Fetch error patterns for current caseworker
  const { data: errorPatterns, isLoading: errorPatternsLoading } = useQuery<ErrorPattern[]>({
    queryKey: ["/api/qc/error-patterns/me"],
  });

  // Fetch job aids
  const { data: jobAids, isLoading: jobAidsLoading } = useQuery<JobAid[]>({
    queryKey: ["/api/qc/job-aids"],
  });

  // Fetch training interventions
  const { data: trainingInterventions, isLoading: trainingLoading } = useQuery<TrainingIntervention[]>({
    queryKey: ["/api/qc/training-interventions"],
  });

  // Get risk score color
  const getRiskScoreColor = (score: number) => {
    if (score > 0.8) return "text-red-600 bg-red-50 dark:bg-red-950";
    if (score > 0.7) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950";
    return "text-green-600 bg-green-50 dark:bg-green-950";
  };

  // Get review status badge variant
  const getReviewStatusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">Pending</Badge>;
    if (status === "reviewed") return <Badge variant="outline" className="bg-green-50 dark:bg-green-950">Reviewed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  // Process error trends data for chart
  const errorTrendsData = errorPatterns ? errorPatterns.reduce((acc: any[], pattern) => {
    const existingQuarter = acc.find(item => item.quarter === pattern.quarterOccurred);
    if (existingQuarter) {
      existingQuarter.errorRate += pattern.errorRate;
      existingQuarter.count += 1;
    } else {
      acc.push({
        quarter: pattern.quarterOccurred,
        errorRate: pattern.errorRate,
        count: 1,
      });
    }
    return acc;
  }, []).map(item => ({
    ...item,
    errorRate: (item.errorRate / item.count).toFixed(2),
  })).sort((a, b) => a.quarter.localeCompare(b.quarter)) : [];

  // Get most common error categories
  const errorCategoryCount = errorPatterns ? errorPatterns.reduce((acc: Record<string, number>, pattern) => {
    acc[pattern.errorCategory] = (acc[pattern.errorCategory] || 0) + 1;
    return acc;
  }, {}) : {};

  const topErrorCategories = Object.entries(errorCategoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category]) => category);

  // Filter job aids
  const filteredJobAids = jobAids?.filter(aid => {
    const matchesCategory = jobAidCategory === "all" || aid.category === jobAidCategory;
    const matchesSearch = aid.title.toLowerCase().includes(jobAidSearch.toLowerCase()) ||
                         aid.content.toLowerCase().includes(jobAidSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || [];

  // Get unique job aid categories
  const jobAidCategories = Array.from(new Set(jobAids?.map(aid => aid.category) || []));

  // Calculate improvement percentage
  const calculateImprovement = () => {
    if (errorTrendsData.length < 2) return null;
    const latest = parseFloat(errorTrendsData[errorTrendsData.length - 1].errorRate);
    const previous = parseFloat(errorTrendsData[errorTrendsData.length - 2].errorRate);
    const change = ((latest - previous) / previous) * 100;
    return { change, improved: change < 0 };
  };

  const improvement = calculateImprovement();

  return (
    <>
      <Helmet>
        <title>Caseworker Cockpit - {stateName} Benefits Navigator</title>
      </Helmet>
      <TooltipProvider>
        <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">
            My Quality Assurance Cockpit
          </h1>
          <p className="text-muted-foreground text-lg" data-testid="page-subtitle">
            Your personal QC dashboard powered by predictive analytics to help you proactively address quality issues before they become errors.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1: Flagged Cases Panel - Takes 2 columns on large screens */}
          <Card className="lg:col-span-2" data-testid="flagged-cases-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle>Flagged Cases Requiring Review</CardTitle>
              </div>
              <CardDescription>
                High-risk cases identified by our predictive QC system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flaggedCasesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : flaggedCasesError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-red-500" />
                  <p>Failed to load flagged cases</p>
                </div>
              ) : !flaggedCases || flaggedCases.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  iconColor="green"
                  title="No flagged cases - great work!"
                  description="Keep up the excellent quality standards."
                  data-testid="empty-state-flagged-cases"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Error Types</TableHead>
                        <TableHead>Flagged Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flaggedCases.map((flaggedCase) => (
                        <Fragment key={flaggedCase.id}>
                          <TableRow data-testid={`case-row-${flaggedCase.id}`}>
                            <TableCell className="font-mono font-medium" data-testid={`case-id-${flaggedCase.id}`}>
                              {flaggedCase.caseId}
                            </TableCell>
                            <TableCell>
                              <Badge className={getRiskScoreColor(flaggedCase.riskScore)} data-testid={`risk-score-${flaggedCase.id}`}>
                                {(flaggedCase.riskScore * 100).toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {flaggedCase.flaggedErrorTypes.map((errorType, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs" data-testid={`error-type-badge-${flaggedCase.id}-${idx}`}>
                                    {ERROR_CATEGORY_LABELS[errorType] || errorType}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`flagged-date-${flaggedCase.id}`}>
                              {format(new Date(flaggedCase.flaggedDate), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell data-testid={`review-status-${flaggedCase.id}`}>
                              {getReviewStatusBadge(flaggedCase.reviewStatus)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedCaseId(expandedCaseId === flaggedCase.id ? null : flaggedCase.id)}
                                data-testid={`expand-case-${flaggedCase.id}`}
                              >
                                {expandedCaseId === flaggedCase.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expandedCaseId === flaggedCase.id && (
                            <TableRow key={`${flaggedCase.id}-expanded`}>
                              <TableCell colSpan={6}>
                                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg" data-testid={`ai-guidance-${flaggedCase.id}`}>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    AI Guidance
                                  </h4>
                                  <p className="text-sm">{flaggedCase.aiGuidance}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: My Error Trends */}
          <Card data-testid="error-trends-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                {improvement && improvement.improved ? (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                )}
                <CardTitle>My Error Trends</CardTitle>
              </div>
              <CardDescription>
                Your error rate over the last 4 quarters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorPatternsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !errorPatterns || errorPatterns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No error trend data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={errorTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="errorRate" stroke="#f59e0b" name="Error Rate %" />
                    </LineChart>
                  </ResponsiveContainer>

                  {improvement && (
                    <div className={`p-3 rounded-lg ${improvement.improved ? 'bg-green-50 dark:bg-green-950' : 'bg-orange-50 dark:bg-orange-950'}`} data-testid="improvement-indicator">
                      <p className="text-sm font-medium">
                        {improvement.improved ? (
                          <>
                            <TrendingDown className="inline h-4 w-4 mr-1" />
                            {Math.abs(improvement.change).toFixed(1)}% improvement from last quarter
                          </>
                        ) : (
                          <>
                            <TrendingUp className="inline h-4 w-4 mr-1" />
                            {Math.abs(improvement.change).toFixed(1)}% increase from last quarter
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {topErrorCategories.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Most Common Error Categories:</h4>
                      <div className="flex flex-wrap gap-2">
                        {topErrorCategories.map((category, idx) => (
                          <Badge key={idx} variant="secondary" data-testid={`top-error-category-${idx}`}>
                            {ERROR_CATEGORY_LABELS[category] || category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Recommended Training */}
          <Card data-testid="training-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <CardTitle>Recommended Training</CardTitle>
              </div>
              <CardDescription>
                Training interventions based on your error patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trainingLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : !trainingInterventions || trainingInterventions.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  iconColor="gray"
                  title="No training recommendations at this time"
                  data-testid="empty-state-training"
                />
              ) : (
                <div className="space-y-3">
                  {trainingInterventions.map((training) => (
                    <div key={training.id} className="border rounded-lg p-4 space-y-2" data-testid={`training-card-${training.id}`}>
                      <h4 className="font-semibold">{training.trainingTitle}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ERROR_CATEGORY_LABELS[training.targetErrorCategory] || training.targetErrorCategory}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Expected Impact: <span className="font-semibold text-green-600">{(training.impactScore * 100).toFixed(0)}%</span> improvement</p>
                        <p className="text-xs mt-1">
                          Historical data: {training.preTrainingErrorRate.toFixed(1)}% → {training.postTrainingErrorRate.toFixed(1)}%
                        </p>
                      </div>
                      <Button size="sm" className="w-full mt-2" data-testid={`start-training-${training.id}`}>
                        Start Training
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Quick Job Aids */}
          <Card className="lg:col-span-2" data-testid="job-aids-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                <CardTitle>Quick Job Aids</CardTitle>
              </div>
              <CardDescription>
                Searchable guidance documents and policy references
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search job aids..."
                      value={jobAidSearch}
                      onChange={(e) => setJobAidSearch(e.target.value)}
                      className="pl-9"
                      data-testid="job-aid-search"
                    />
                  </div>
                  <Select value={jobAidCategory} onValueChange={setJobAidCategory}>
                    <SelectTrigger className="w-64" data-testid="job-aid-category-filter">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {jobAidCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {ERROR_CATEGORY_LABELS[category] || category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Job Aids List */}
                {jobAidsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : filteredJobAids.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    iconColor="gray"
                    title="No job aids found"
                    data-testid="empty-state-job-aids"
                  />
                ) : (
                  <div className="grid gap-2 max-h-96 overflow-y-auto">
                    {filteredJobAids.map((aid) => (
                      <Dialog key={aid.id}>
                        <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors" data-testid={`job-aid-${aid.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium">{aid.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {ERROR_CATEGORY_LABELS[aid.category] || aid.category}
                                </Badge>
                                {aid.policyReference && (
                                  <span className="text-xs text-muted-foreground">
                                    {aid.policyReference}
                                  </span>
                                )}
                              </div>
                            </div>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" data-testid={`view-job-aid-${aid.id}`}>
                                View Guide
                              </Button>
                            </DialogTrigger>
                          </div>
                        </div>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{aid.title}</DialogTitle>
                            <DialogDescription>
                              {aid.policyReference && `Reference: ${aid.policyReference}`}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: aid.content }} />
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Floating Help Button */}
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0"
              data-testid="help-button"
            >
              <HelpCircle className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Context-Aware Tips</DialogTitle>
              <DialogDescription>
                Based on your error patterns, here are your top 3 tips:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {topErrorCategories.length > 0 ? (
                topErrorCategories.map((category, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                    <h4 className="font-semibold">{ERROR_CATEGORY_LABELS[category] || category}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Focus on double-checking {(ERROR_CATEGORY_LABELS[category] || category).toLowerCase()} calculations and documentation requirements. Review the job aids for detailed guidance.
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>Great work! No specific tips at this time.</p>
                  <p className="text-sm mt-2">Keep maintaining your quality standards.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
    </>
  );
}
