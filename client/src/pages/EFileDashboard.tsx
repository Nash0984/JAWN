import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Upload,
  Plus
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";

interface TaxReturn {
  id: string;
  taxYear: number;
  filingStatus: string;
  efileStatus: string;
  efileTransmissionId?: string;
  efileSubmittedAt?: string;
  efileAcceptedAt?: string;
  efileRejectionReason?: string;
  efileRejectionDetails?: any;
  createdAt: string;
  updatedAt: string;
}

interface MarylandReturn {
  id: string;
  federalReturnId: string;
  efileStatus: string;
  efileTransmissionId?: string;
  efileSubmittedAt?: string;
  efileAcceptedAt?: string;
  createdAt: string;
}

interface QueueItem {
  id: string;
  federalReturnId: string;
  status: string;
  transmissionId?: string;
  submittedAt?: string;
  processedAt?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'accepted':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'transmitted':
      return <Send className="h-4 w-4 text-blue-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'ready':
      return <FileText className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    ready: "default",
    pending: "outline",
    transmitted: "outline",
    accepted: "default",
    rejected: "destructive",
  };
  
  const colors: Record<string, string> = {
    draft: "text-gray-600 bg-gray-100",
    ready: "text-blue-600 bg-blue-100",
    pending: "text-yellow-600 bg-yellow-100",
    transmitted: "text-blue-500 bg-blue-50",
    accepted: "text-green-600 bg-green-100",
    rejected: "text-red-600 bg-red-100",
  };

  return (
    <Badge variant={variants[status] || "secondary"} className={colors[status]}>
      {getStatusIcon(status)}
      <span className="ml-1">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </Badge>
  );
};

export default function EFileDashboard() {
  const { user } = useAuth();
  const { subscribe, isConnected } = useWebSocket();
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState<{ id: string; type: 'federal' | 'maryland' } | null>(null);
  const [showXmlDialog, setShowXmlDialog] = useState<{ id: string; type: 'federal' | 'maryland' } | null>(null);
  const { toast } = useToast();

  // Fetch federal tax returns for current user
  const { data: federalReturns, isLoading: federalLoading, error: federalError, refetch: refetchFederal } = useQuery<TaxReturn[]>({
    queryKey: ['/api/tax-returns/my-returns'],
    enabled: !!user,
  });

  // Fetch Maryland returns
  const { data: marylandReturns, isLoading: marylandLoading, refetch: refetchMaryland } = useQuery<MarylandReturn[]>({
    queryKey: ['/api/maryland/tax-returns/my-returns'],
    enabled: !!user,
  });

  // Fetch e-file queue
  const { data: queue, isLoading: queueLoading, refetch: refetchQueue } = useQuery<QueueItem[]>({
    queryKey: ['/api/efile/queue'],
    enabled: !!user,
  });

  // Submit for federal e-filing
  const submitFederalMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/efile/submit/${id}`, {
      method: 'POST',
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Federal return submitted for e-filing",
      });
      refetchFederal();
      refetchQueue();
      setShowSubmitDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit return for e-filing",
        variant: "destructive",
      });
    },
  });

  // Submit for Maryland e-filing
  const submitMarylandMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/maryland/efile/submit/${id}`, {
      method: 'POST',
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Maryland return submitted for e-filing",
      });
      refetchMaryland();
      setShowSubmitDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit Maryland return",
        variant: "destructive",
      });
    },
  });

  // Validate return
  const validateMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/efile/validate/${id}`, {
      method: 'POST',
    }),
    onSuccess: (data: any) => {
      toast({
        title: data.isValid ? "Validation Passed" : "Validation Failed",
        description: data.isValid 
          ? "Return is ready for e-filing" 
          : `${data.errors?.length || 0} validation error(s) found`,
        variant: data.isValid ? "default" : "destructive",
      });
    },
  });

  // Get XML
  const getXmlMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'federal' | 'maryland' }) => {
      const endpoint = type === 'federal' 
        ? `/api/efile/xml/${id}` 
        : `/api/maryland/efile/xml/${id}`;
      return apiRequest(endpoint);
    },
    onSuccess: (data: any) => {
      // Create downloadable XML file
      const blob = new Blob([data.xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.taxYear}_${showXmlDialog?.type || 'federal'}_return.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "XML Downloaded",
        description: "Tax return XML file downloaded successfully",
      });
      setShowXmlDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to generate XML",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!showSubmitDialog) return;
    
    if (showSubmitDialog.type === 'federal') {
      submitFederalMutation.mutate(showSubmitDialog.id);
    } else {
      submitMarylandMutation.mutate(showSubmitDialog.id);
    }
  };

  const handleDownloadXml = () => {
    if (!showXmlDialog) return;
    getXmlMutation.mutate(showXmlDialog);
  };

  const handleRefresh = () => {
    refetchFederal();
    refetchMaryland();
    refetchQueue();
    toast({
      title: "Refreshed",
      description: "E-filing data updated",
    });
  };

  // Subscribe to real-time e-file status updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribe('efile_status_update', (data: any) => {
      console.log('E-file status update received:', data);
      
      // Show toast notification
      toast({
        title: `E-File ${data.status}`,
        description: `${data.type === 'federal' ? 'Federal' : 'Maryland'} return ${data.returnId.substring(0, 8)}... ${data.status}`,
      });

      // Refresh data to show updated status
      if (data.type === 'federal') {
        refetchFederal();
      } else {
        refetchMaryland();
      }
      refetchQueue();
    });

    return () => {
      unsubscribe();
    };
  }, [user, subscribe, refetchFederal, refetchMaryland, refetchQueue, toast]);

  const isLoading = federalLoading || marylandLoading || queueLoading;

  return (
    <>
      <Helmet>
        <title>E-Filing Dashboard - Maryland Benefits Navigator</title>
        <meta name="description" content="Submit and track federal and Maryland tax return e-filing status" />
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
              E-Filing Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
              Submit and track your federal and Maryland tax return e-filing status
              {isConnected && (
                <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Live
                </Badge>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Link href="/tax-preparation">
              <Button size="sm" data-testid="button-new-return">
                <Plus className="h-4 w-4 mr-2" />
                New Tax Return
              </Button>
            </Link>
          </div>
        </div>

        {federalError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load e-filing data. Please try again.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="federal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="federal" data-testid="tab-federal">
              Federal Returns ({federalReturns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="maryland" data-testid="tab-maryland">
              Maryland Returns ({marylandReturns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="queue" data-testid="tab-queue">
              E-File Queue ({queue?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Federal Returns Tab */}
          <TabsContent value="federal">
            <Card>
              <CardHeader>
                <CardTitle>Federal Tax Returns (Form 1040)</CardTitle>
                <CardDescription>
                  Manage your IRS Form 1040 electronic filing submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !federalReturns || federalReturns.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">No federal tax returns found</p>
                    <Link href="/tax-preparation">
                      <Button data-testid="button-create-first-return">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Return
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax Year</TableHead>
                          <TableHead>Filing Status</TableHead>
                          <TableHead>E-File Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Transmission ID</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {federalReturns.map((ret) => (
                          <TableRow key={ret.id} data-testid={`row-federal-${ret.id}`}>
                            <TableCell className="font-medium">{ret.taxYear}</TableCell>
                            <TableCell className="capitalize">{ret.filingStatus.replace('_', ' ')}</TableCell>
                            <TableCell>{getStatusBadge(ret.efileStatus)}</TableCell>
                            <TableCell>
                              {ret.efileSubmittedAt 
                                ? format(new Date(ret.efileSubmittedAt), 'MM/dd/yyyy HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {ret.efileTransmissionId || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                {ret.efileStatus === 'ready' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => validateMutation.mutate(ret.id)}
                                      data-testid={`button-validate-${ret.id}`}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Validate
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => setShowSubmitDialog({ id: ret.id, type: 'federal' })}
                                      data-testid={`button-submit-${ret.id}`}
                                    >
                                      <Send className="h-3 w-3 mr-1" />
                                      Submit
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowXmlDialog({ id: ret.id, type: 'federal' })}
                                  data-testid={`button-download-xml-${ret.id}`}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  XML
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maryland Returns Tab */}
          <TabsContent value="maryland">
            <Card>
              <CardHeader>
                <CardTitle>Maryland Tax Returns (Form 502)</CardTitle>
                <CardDescription>
                  Manage your Maryland Form 502 electronic filing submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !marylandReturns || marylandReturns.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">No Maryland tax returns found</p>
                    <p className="text-sm text-gray-400">
                      Maryland returns are automatically created when you complete a federal return
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Federal Return ID</TableHead>
                          <TableHead>E-File Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Transmission ID</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marylandReturns.map((ret) => (
                          <TableRow key={ret.id} data-testid={`row-maryland-${ret.id}`}>
                            <TableCell className="font-mono text-xs">
                              {ret.federalReturnId.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{getStatusBadge(ret.efileStatus)}</TableCell>
                            <TableCell>
                              {ret.efileSubmittedAt 
                                ? format(new Date(ret.efileSubmittedAt), 'MM/dd/yyyy HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {ret.efileTransmissionId || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                {ret.efileStatus === 'ready' && (
                                  <Button
                                    size="sm"
                                    onClick={() => setShowSubmitDialog({ id: ret.id, type: 'maryland' })}
                                    data-testid={`button-submit-md-${ret.id}`}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Submit
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowXmlDialog({ id: ret.id, type: 'maryland' })}
                                  data-testid={`button-download-xml-md-${ret.id}`}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  XML
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* E-File Queue Tab */}
          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <CardTitle>E-File Processing Queue</CardTitle>
                <CardDescription>
                  Track your e-filing submissions through the transmission process
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !queue || queue.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No items in e-file queue</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Return ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Processed</TableHead>
                          <TableHead>Retries</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queue.map((item) => (
                          <TableRow key={item.id} data-testid={`row-queue-${item.id}`}>
                            <TableCell className="font-mono text-xs">
                              {item.federalReturnId.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              {item.submittedAt 
                                ? format(new Date(item.submittedAt), 'MM/dd/yyyy HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {item.processedAt 
                                ? format(new Date(item.processedAt), 'MM/dd/yyyy HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.retryCount > 0 ? "destructive" : "secondary"}>
                                {item.retryCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {item.errorMessage ? (
                                <span className="text-red-600 text-sm" title={item.errorMessage}>
                                  {item.errorMessage}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Submit Confirmation Dialog */}
        <Dialog open={!!showSubmitDialog} onOpenChange={() => setShowSubmitDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit for E-Filing</DialogTitle>
              <DialogDescription>
                Are you sure you want to submit this {showSubmitDialog?.type === 'federal' ? 'federal' : 'Maryland'} tax return for electronic filing?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Once submitted, the return will be transmitted to the {showSubmitDialog?.type === 'federal' ? 'IRS' : 'Maryland Comptroller'}. 
                  Make sure all information is accurate before proceeding.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowSubmitDialog(null)}
                data-testid="button-cancel-submit"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={submitFederalMutation.isPending || submitMarylandMutation.isPending}
                data-testid="button-confirm-submit"
              >
                {submitFederalMutation.isPending || submitMarylandMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Download XML Dialog */}
        <Dialog open={!!showXmlDialog} onOpenChange={() => setShowXmlDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download E-File XML</DialogTitle>
              <DialogDescription>
                Download the {showXmlDialog?.type === 'federal' ? 'IRS MeF' : 'Maryland iFile'} XML file for this tax return.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowXmlDialog(null)}
                data-testid="button-cancel-download"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDownloadXml}
                disabled={getXmlMutation.isPending}
                data-testid="button-confirm-download"
              >
                {getXmlMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
