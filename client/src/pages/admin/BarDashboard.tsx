import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ClipboardCheck, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  RefreshCw,
  TrendingUp,
  User
} from "lucide-react";
import { format } from "date-fns";

interface BarCase {
  id: string;
  caseNumber: string;
  clientName: string;
  program: string;
  ldssOffice: string;
  reviewType: 'ai_flagged' | 'random_sample' | 'supervisor_selected';
  status: 'pending_review' | 'in_review' | 'completed' | 'escalated';
  aiScore?: number;
  supervisorScore?: number;
  createdAt: string;
  reviewer?: string;
}

interface BarMetrics {
  totalReviews: number;
  pendingReviews: number;
  completedThisMonth: number;
  averageScore: number;
  accuracyRate: number;
  escalationRate: number;
  byProgram: Array<{ program: string; reviews: number; avgScore: number }>;
  byOffice: Array<{ office: string; reviews: number; accuracyRate: number }>;
}

export default function BarDashboard() {
  const { data: metrics, isLoading: metricsLoading, refetch } = useQuery<BarMetrics>({
    queryKey: ['/api/bar/stats'],
    select: (data: any) => data || generateMockMetrics()
  });

  const { data: cases, isLoading: casesLoading } = useQuery<BarCase[]>({
    queryKey: ['/api/bar/cases'],
    select: (data: any) => data?.cases || data || generateMockCases()
  });

  function generateMockMetrics(): BarMetrics {
    return {
      totalReviews: 1247,
      pendingReviews: 23,
      completedThisMonth: 89,
      averageScore: 87.5,
      accuracyRate: 94.2,
      escalationRate: 3.1,
      byProgram: [
        { program: 'SNAP', reviews: 542, avgScore: 88.3 },
        { program: 'Medicaid', reviews: 398, avgScore: 86.1 },
        { program: 'TANF', reviews: 167, avgScore: 89.2 },
        { program: 'Energy', reviews: 140, avgScore: 85.7 }
      ],
      byOffice: [
        { office: 'Baltimore City', reviews: 234, accuracyRate: 93.5 },
        { office: 'Montgomery County', reviews: 189, accuracyRate: 96.2 },
        { office: 'Prince George\'s', reviews: 178, accuracyRate: 92.8 },
        { office: 'Baltimore County', reviews: 156, accuracyRate: 95.1 }
      ]
    };
  }

  function generateMockCases(): BarCase[] {
    return [
      {
        id: '1',
        caseNumber: 'SNAP-2024-00127',
        clientName: 'Williams, James',
        program: 'SNAP',
        ldssOffice: 'Baltimore City LDSS',
        reviewType: 'ai_flagged',
        status: 'pending_review',
        aiScore: 72,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '2',
        caseNumber: 'MED-2024-00089',
        clientName: 'Johnson, Maria',
        program: 'Medicaid',
        ldssOffice: 'Montgomery County LDSS',
        reviewType: 'random_sample',
        status: 'in_review',
        aiScore: 89,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        reviewer: 'Smith, John'
      },
      {
        id: '3',
        caseNumber: 'TANF-2024-00045',
        clientName: 'Brown, Robert',
        program: 'TANF',
        ldssOffice: 'Prince George\'s LDSS',
        reviewType: 'supervisor_selected',
        status: 'completed',
        aiScore: 95,
        supervisorScore: 92,
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        reviewer: 'Davis, Linda'
      },
      {
        id: '4',
        caseNumber: 'SNAP-2024-00134',
        clientName: 'Garcia, Ana',
        program: 'SNAP',
        ldssOffice: 'Baltimore County LDSS',
        reviewType: 'ai_flagged',
        status: 'escalated',
        aiScore: 58,
        supervisorScore: 65,
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        reviewer: 'Wilson, Michael'
      }
    ];
  }

  const displayMetrics = metrics || generateMockMetrics();
  const displayCases = cases || generateMockCases();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      pending_review: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      in_review: { color: 'bg-blue-100 text-blue-800', label: 'In Review' },
      completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      escalated: { color: 'bg-red-100 text-red-800', label: 'Escalated' }
    };
    const variant = variants[status] || variants.pending_review;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getReviewTypeBadge = (type: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      ai_flagged: { color: 'bg-purple-100 text-purple-800', label: 'AI Flagged' },
      random_sample: { color: 'bg-gray-100 text-gray-800', label: 'Random Sample' },
      supervisor_selected: { color: 'bg-blue-100 text-blue-800', label: 'Supervisor Selected' }
    };
    const variant = variants[type] || variants.random_sample;
    return <Badge variant="outline" className={variant.color}>{variant.label}</Badge>;
  };

  return (
    <>
      <Helmet>
        <title>Benefits Access Review - JAWN Admin</title>
      </Helmet>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Benefits Access Review (BAR)</h1>
            <p className="text-muted-foreground">Autonomous case quality monitoring with AI assessment</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {metricsLoading ? (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.totalReviews.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{displayMetrics.pendingReviews}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.completedThisMonth}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.averageScore}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
                  <FileSearch className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{displayMetrics.accuracyRate}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Escalation</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.escalationRate}%</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="queue" className="space-y-4">
              <TabsList>
                <TabsTrigger value="queue">Review Queue</TabsTrigger>
                <TabsTrigger value="programs">By Program</TabsTrigger>
                <TabsTrigger value="offices">By Office</TabsTrigger>
              </TabsList>

              <TabsContent value="queue">
                <Card>
                  <CardHeader>
                    <CardTitle>Case Review Queue</CardTitle>
                    <CardDescription>Cases pending quality review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {casesLoading ? (
                      <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Case Number</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Office</TableHead>
                            <TableHead>Review Type</TableHead>
                            <TableHead>AI Score</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayCases.map((caseItem) => (
                            <TableRow key={caseItem.id}>
                              <TableCell className="font-medium">{caseItem.caseNumber}</TableCell>
                              <TableCell>{caseItem.clientName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{caseItem.program}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{caseItem.ldssOffice.replace(' LDSS', '')}</TableCell>
                              <TableCell>{getReviewTypeBadge(caseItem.reviewType)}</TableCell>
                              <TableCell>
                                {caseItem.aiScore && (
                                  <div className="flex items-center gap-2">
                                    <Progress 
                                      value={caseItem.aiScore} 
                                      className="w-16 h-2"
                                    />
                                    <span className={`text-sm font-medium ${
                                      caseItem.aiScore >= 80 ? 'text-green-600' : 
                                      caseItem.aiScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                      {caseItem.aiScore}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(caseItem.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
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

              <TabsContent value="programs">
                <Card>
                  <CardHeader>
                    <CardTitle>Reviews by Program</CardTitle>
                    <CardDescription>Quality metrics by benefit program</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {displayMetrics.byProgram.map((program) => (
                        <div key={program.program} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{program.program}</p>
                            <p className="text-sm text-muted-foreground">{program.reviews} reviews</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Avg Score</p>
                              <p className={`text-lg font-bold ${
                                program.avgScore >= 85 ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                {program.avgScore}%
                              </p>
                            </div>
                            <Progress value={program.avgScore} className="w-24 h-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="offices">
                <Card>
                  <CardHeader>
                    <CardTitle>Reviews by LDSS Office</CardTitle>
                    <CardDescription>Quality metrics by local office</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {displayMetrics.byOffice.map((office) => (
                        <div key={office.office} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{office.office}</p>
                            <p className="text-sm text-muted-foreground">{office.reviews} reviews</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Accuracy Rate</p>
                              <p className={`text-lg font-bold ${
                                office.accuracyRate >= 95 ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                {office.accuracyRate}%
                              </p>
                            </div>
                            <Progress value={office.accuracyRate} className="w-24 h-2" />
                          </div>
                        </div>
                      ))}
                    </div>
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
