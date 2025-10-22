import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Network, Search, TrendingUp, Users, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTenant } from "@/contexts/TenantContext";

interface BenefitProgram {
  id: string;
  code: string;
  name: string;
}

interface ProgramEnrollment {
  id: string;
  clientIdentifier: string;
  benefitProgramId: string;
  enrollmentStatus: string;
  householdSize?: number;
  householdIncome?: number;
  enrollmentDate?: string;
}

interface CrossEnrollmentAnalysis {
  enrolledPrograms: ProgramEnrollment[];
  suggestedPrograms: {
    programId: string;
    programName: string;
    reason: string;
  }[];
}

export default function CrossEnrollmentAdmin() {
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const [clientIdentifier, setClientIdentifier] = useState("");
  const [analysisResult, setAnalysisResult] = useState<CrossEnrollmentAnalysis | null>(null);

  // Fetch benefit programs
  const { data: programs = [] } = useQuery<BenefitProgram[]>({
    queryKey: ["/api/public/benefit-programs"],
  });

  // Analyze cross-enrollment
  const analyzeMutation = useMutation({
    mutationFn: async (identifier: string) => {
      const response = await fetch(`/api/cross-enrollment/analyze/${identifier}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to analyze cross-enrollment");
      return response.json();
    },
    onSuccess: (data: CrossEnrollmentAnalysis) => {
      setAnalysisResult(data);
      if (data.suggestedPrograms.length === 0) {
        toast({
          title: "Analysis Complete",
          description: "Client is already enrolled in all eligible programs."
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Found ${data.suggestedPrograms.length} enrollment opportunities.`
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      setAnalysisResult(null);
    }
  });

  const getProgramName = (programId: string) => {
    const program = programs.find(p => p.id === programId);
    return program?.name || "Unknown Program";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      enrolled: { variant: "default", text: "Enrolled" },
      pending: { variant: "secondary", text: "Pending" },
      denied: { variant: "destructive", text: "Denied" },
      terminated: { variant: "outline", text: "Terminated" },
      suspended: { variant: "outline", text: "Suspended" }
    };
    const config = variants[status] || { variant: "secondary", text: status };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const handleAnalyze = () => {
    if (!clientIdentifier.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a client identifier to analyze.",
        variant: "destructive"
      });
      return;
    }
    analyzeMutation.mutate(clientIdentifier);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cross-Enrollment Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Identify benefit program enrollment opportunities across {stateName}'s benefit programs
        </p>
      </div>

      {/* Analysis Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Analyze Client Enrollment
          </CardTitle>
          <CardDescription>
            Enter a client identifier to analyze their current enrollments and discover new program opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="clientIdentifier">Client Identifier (SSN, Case ID, etc.)</Label>
              <Input
                id="clientIdentifier"
                data-testid="input-client-identifier"
                value={clientIdentifier}
                onChange={(e) => setClientIdentifier(e.target.value)}
                placeholder="Enter client identifier"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analyzeMutation.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : analysisResult && (
        <div className="space-y-6">
          {/* Current Enrollments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Current Enrollments
              </CardTitle>
              <CardDescription>
                Programs the client is currently enrolled in
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult.enrolledPrograms.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No Current Enrollments</AlertTitle>
                  <AlertDescription>
                    This client is not currently enrolled in any programs in the system.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {analysisResult.enrolledPrograms.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      data-testid={`enrollment-${enrollment.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{getProgramName(enrollment.benefitProgramId)}</h4>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          {enrollment.householdSize !== undefined && (
                            <span>Household Size: {enrollment.householdSize}</span>
                          )}
                          {enrollment.householdIncome !== undefined && (
                            <span>Income: ${(enrollment.householdIncome / 100).toLocaleString()}/yr</span>
                          )}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(enrollment.enrollmentStatus)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggested Programs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Enrollment Opportunities
              </CardTitle>
              <CardDescription>
                Recommended programs based on client's household profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult.suggestedPrograms.length === 0 ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Fully Enrolled</AlertTitle>
                  <AlertDescription>
                    This client is enrolled in all programs they may be eligible for based on their household data.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {analysisResult.suggestedPrograms.map((suggestion, index) => (
                    <div
                      key={index}
                      data-testid={`suggestion-${suggestion.programId}`}
                      className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-md">
                          <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                            {suggestion.programName}
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            {suggestion.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Enrollments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analysisResult.enrolledPrograms.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  New Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {analysisResult.suggestedPrograms.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Coverage Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {programs.length > 0
                    ? Math.round((analysisResult.enrolledPrograms.length / programs.length) * 100)
                    : 0}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {!analysisResult && !analyzeMutation.isPending && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>How Cross-Enrollment Analysis Works</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>
              This tool analyzes a client's current program enrollments and suggests additional programs they may be eligible for based on:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Household size and composition</li>
              <li>Annual household income</li>
              <li>Current enrollment status</li>
              <li>Program-specific eligibility rules</li>
            </ul>
            <p className="mt-2">
              Supported programs: MD SNAP, MD Medicaid, MD TCA/TANF, MD OHEP (Energy), MD WIC, MD MCHP, and IRS VITA Tax Assistance
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
