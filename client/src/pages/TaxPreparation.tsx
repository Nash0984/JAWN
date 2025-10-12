import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, 
  Calculator, DollarSign, Users, Home as HomeIcon, Info,
  ChevronRight, X, Eye, FileCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeVariants } from "@/lib/animations";

interface TaxDocument {
  id: string;
  documentType: string;
  taxYear: number;
  extractedData: any;
  geminiConfidence: number;
  verificationStatus: string;
  requiresManualReview: boolean;
  createdAt: string;
}

interface TaxCalculation {
  taxYear: number;
  filingStatus: string;
  adjustedGrossIncome: number;
  taxableIncome: number;
  totalTax: number;
  eitcAmount: number;
  childTaxCredit: number;
  additionalChildTaxCredit: number;
  refundAmount: number;
}

export default function TaxPreparation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedDocType, setSelectedDocType] = useState<string>("w2");
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear() - 1);
  const [uploading, setUploading] = useState(false);
  const [calculationResult, setCalculationResult] = useState<TaxCalculation | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<TaxDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch tax documents
  const { data: documents = [], isLoading: loadingDocs } = useQuery<TaxDocument[]>({
    queryKey: ["/api/tax/documents"],
  });

  // Personal info form state
  const [personalInfo, setPersonalInfo] = useState({
    taxpayerFirstName: "",
    taxpayerLastName: "",
    taxpayerSSN: "",
    spouseFirstName: "",
    spouseLastName: "",
    spouseSSN: "",
    streetAddress: "",
    aptNumber: "",
    city: "",
    state: "MD",
    zipCode: "",
    filingStatus: "single",
    virtualCurrency: false
  });

  // Dependents
  const [dependents, setDependents] = useState<any[]>([]);

  // Document upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append('taxDocument', file);
      formData.append('documentType', selectedDocType);
      formData.append('taxYear', taxYear.toString());

      const response = await fetch('/api/tax/documents/extract', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax/documents"] });
      toast({
        title: "Document Uploaded",
        description: `${selectedDocType.toUpperCase()} extracted successfully${data.requiresManualReview ? ' (review needed)' : ''}`,
      });
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploading(false);
    },
  });

  // Tax calculation mutation
  const calculateMutation = useMutation({
    mutationFn: async () => {
      // Build household tax input from forms and extracted documents
      const w2Docs = documents.filter(d => d.documentType === 'w2');
      const totalWages = w2Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box1_wages || 0);
      }, 0);

      const taxInput = {
        taxYear,
        filingStatus: personalInfo.filingStatus as any,
        stateCode: "MD",
        taxpayer: {
          age: 35, // TODO: collect from form
          isBlind: false,
          isDisabled: false
        },
        ...(personalInfo.filingStatus === 'married_joint' && {
          spouse: {
            age: 35,
            isBlind: false,
            isDisabled: false
          }
        }),
        dependents: dependents.map(d => ({
          age: d.age,
          relationship: 'child' as any,
          studentStatus: 'none' as any
        })),
        w2Income: {
          taxpayerWages: totalWages,
          federalWithholding: w2Docs.reduce((sum, doc) => sum + (doc.extractedData?.box2_federalTaxWithheld || 0), 0),
          socialSecurityWithholding: 0,
          medicareWithholding: 0
        }
      };

      return await apiRequest("/api/tax/calculate", "POST", taxInput);
    },
    onSuccess: (data: TaxCalculation) => {
      setCalculationResult(data);
      toast({
        title: "Calculation Complete",
        description: `Estimated refund: $${data.refundAmount.toFixed(2)}`,
      });
      setActiveTab("review");
    },
    onError: (error: Error) => {
      toast({
        title: "Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form 1040 PDF generation
  const generateForm1040Mutation = useMutation({
    mutationFn: async () => {
      if (!calculationResult) {
        throw new Error("No calculation available");
      }

      const response = await fetch('/api/tax/form1040/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo,
          calculationResult,
          taxYear
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate Form 1040');
      }

      const blob = await response.blob();
      return blob;
    },
    onSuccess: (pdfBlob) => {
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Form_1040_${taxYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Form 1040 Generated",
        description: "PDF downloaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const addDependent = () => {
    setDependents([...dependents, {
      firstName: "",
      lastName: "",
      ssn: "",
      relationship: "child",
      age: 0,
      childTaxCredit: true
    }]);
  };

  const removeDependent = (index: number) => {
    setDependents(dependents.filter((_, i) => i !== index));
  };

  return (
    <motion.div 
      className="container mx-auto px-4 py-8"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Tax Preparation</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Prepare your federal tax return with AI-powered document extraction and PolicyEngine calculations
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="personal" data-testid="tab-personal">
              <Users className="h-4 w-4 mr-2" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="calculate" data-testid="tab-calculate">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate
            </TabsTrigger>
            <TabsTrigger value="review" data-testid="tab-review" disabled={!calculationResult}>
              <FileCheck className="h-4 w-4 mr-2" />
              Review & File
            </TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Tax Documents</CardTitle>
                <CardDescription>
                  Upload W-2, 1099, or 1095-A forms for automatic data extraction using AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="document-type">Document Type</Label>
                    <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                      <SelectTrigger id="document-type" data-testid="select-document-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="w2">W-2 (Wages)</SelectItem>
                        <SelectItem value="1099-misc">1099-MISC</SelectItem>
                        <SelectItem value="1099-nec">1099-NEC</SelectItem>
                        <SelectItem value="1095-a">1095-A (Health Insurance)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax-year">Tax Year</Label>
                    <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(parseInt(v))}>
                      <SelectTrigger id="tax-year" data-testid="select-tax-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2023">2023</SelectItem>
                        <SelectItem value="2022">2022</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    data-testid="input-file-upload"
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    data-testid="button-upload-document"
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Choose File</>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Supports PDF, JPG, PNG (max 10MB)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Documents List */}
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Documents ({documents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`document-item-${doc.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">{doc.documentType.toUpperCase()} - {doc.taxYear}</p>
                            <p className="text-sm text-muted-foreground">
                              Confidence: {(doc.geminiConfidence * 100).toFixed(0)}%
                              {doc.requiresManualReview && (
                                <Badge variant="outline" className="ml-2">Review Needed</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedDoc(doc);
                              setShowPreviewDialog(true);
                            }}
                            data-testid={`button-view-${doc.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Badge variant={doc.verificationStatus === 'verified' ? 'default' : 'secondary'}>
                            {doc.verificationStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Taxpayer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={personalInfo.taxpayerFirstName}
                      onChange={(e) => setPersonalInfo({...personalInfo, taxpayerFirstName: e.target.value})}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={personalInfo.taxpayerLastName}
                      onChange={(e) => setPersonalInfo({...personalInfo, taxpayerLastName: e.target.value})}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssn">Social Security Number</Label>
                  <Input
                    id="ssn"
                    type="password"
                    placeholder="XXX-XX-XXXX"
                    value={personalInfo.taxpayerSSN}
                    onChange={(e) => setPersonalInfo({...personalInfo, taxpayerSSN: e.target.value})}
                    data-testid="input-ssn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filing-status">Filing Status</Label>
                  <Select value={personalInfo.filingStatus} onValueChange={(v) => setPersonalInfo({...personalInfo, filingStatus: v})}>
                    <SelectTrigger id="filing-status" data-testid="select-filing-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married_joint">Married Filing Jointly</SelectItem>
                      <SelectItem value="married_separate">Married Filing Separately</SelectItem>
                      <SelectItem value="head_of_household">Head of Household</SelectItem>
                      <SelectItem value="qualifying_widow">Qualifying Widow(er)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Dependents</Label>
                    <Button onClick={addDependent} variant="outline" size="sm" data-testid="button-add-dependent">
                      + Add Dependent
                    </Button>
                  </div>

                  {dependents.map((dep, idx) => (
                    <div key={idx} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Dependent {idx + 1}</h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeDependent(idx)}
                          data-testid={`button-remove-dependent-${idx}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="First Name"
                          value={dep.firstName}
                          onChange={(e) => {
                            const updated = [...dependents];
                            updated[idx].firstName = e.target.value;
                            setDependents(updated);
                          }}
                          data-testid={`input-dependent-first-name-${idx}`}
                        />
                        <Input
                          placeholder="Last Name"
                          value={dep.lastName}
                          onChange={(e) => {
                            const updated = [...dependents];
                            updated[idx].lastName = e.target.value;
                            setDependents(updated);
                          }}
                          data-testid={`input-dependent-last-name-${idx}`}
                        />
                        <Input
                          placeholder="SSN"
                          type="password"
                          value={dep.ssn}
                          onChange={(e) => {
                            const updated = [...dependents];
                            updated[idx].ssn = e.target.value;
                            setDependents(updated);
                          }}
                          data-testid={`input-dependent-ssn-${idx}`}
                        />
                        <Input
                          placeholder="Age"
                          type="number"
                          value={dep.age || ""}
                          onChange={(e) => {
                            const updated = [...dependents];
                            updated[idx].age = parseInt(e.target.value) || 0;
                            setDependents(updated);
                          }}
                          data-testid={`input-dependent-age-${idx}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    value={personalInfo.streetAddress}
                    onChange={(e) => setPersonalInfo({...personalInfo, streetAddress: e.target.value})}
                    data-testid="input-street"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={personalInfo.city}
                      onChange={(e) => setPersonalInfo({...personalInfo, city: e.target.value})}
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={personalInfo.state}
                      onChange={(e) => setPersonalInfo({...personalInfo, state: e.target.value})}
                      data-testid="input-state"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={personalInfo.zipCode}
                      onChange={(e) => setPersonalInfo({...personalInfo, zipCode: e.target.value})}
                      data-testid="input-zip"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                onClick={() => setActiveTab("calculate")} 
                data-testid="button-continue-to-calculate"
              >
                Continue to Calculate
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Calculate Tab */}
          <TabsContent value="calculate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ready to Calculate</CardTitle>
                <CardDescription>
                  Review your information and calculate your federal tax return
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>What's Included</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>{documents.length} tax document(s) uploaded</li>
                      <li>Filing Status: {personalInfo.filingStatus.replace('_', ' ')}</li>
                      <li>{dependents.length} dependent(s)</li>
                      <li>Estimated EITC, Child Tax Credit, and refund amount</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Button 
                  className="w-full"
                  size="lg"
                  onClick={() => calculateMutation.mutate()}
                  disabled={calculateMutation.isPending || documents.length === 0}
                  data-testid="button-calculate-taxes"
                >
                  {calculateMutation.isPending ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Calculating...</>
                  ) : (
                    <><Calculator className="h-5 w-5 mr-2" /> Calculate Taxes with PolicyEngine</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Review Tab */}
          <TabsContent value="review" className="space-y-6">
            {calculationResult && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Calculation Results</CardTitle>
                    <CardDescription>Tax Year {calculationResult.taxYear}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Adjusted Gross Income</Label>
                        <p className="text-2xl font-bold" data-testid="text-agi">
                          ${calculationResult.adjustedGrossIncome.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Taxable Income</Label>
                        <p className="text-2xl font-bold" data-testid="text-taxable-income">
                          ${calculationResult.taxableIncome.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Total Tax</Label>
                        <p className="text-2xl font-bold" data-testid="text-total-tax">
                          ${calculationResult.totalTax.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">EITC</Label>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-eitc">
                          ${calculationResult.eitcAmount.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Child Tax Credit</Label>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-ctc">
                          ${calculationResult.childTaxCredit.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">
                          {calculationResult.refundAmount >= 0 ? 'Refund' : 'Amount Owed'}
                        </Label>
                        <p 
                          className={`text-3xl font-bold ${calculationResult.refundAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          data-testid="text-refund"
                        >
                          ${Math.abs(calculationResult.refundAmount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-4">
                      <Button
                        className="flex-1"
                        variant="outline"
                        onClick={() => generateForm1040Mutation.mutate()}
                        disabled={generateForm1040Mutation.isPending}
                        data-testid="button-download-form1040"
                      >
                        {generateForm1040Mutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                        ) : (
                          <><Download className="h-4 w-4 mr-2" /> Download Form 1040 PDF</>
                        )}
                      </Button>
                      <Button 
                        className="flex-1"
                        data-testid="button-file-electronically"
                      >
                        <FileCheck className="h-4 w-4 mr-2" />
                        File Electronically
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Next Steps</AlertTitle>
                  <AlertDescription>
                    <ol className="list-decimal list-inside space-y-1 mt-2">
                      <li>Download Form 1040 for your records</li>
                      <li>Review all information for accuracy</li>
                      <li>Gather supporting documentation</li>
                      <li>Schedule appointment for e-filing (coming soon)</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>
              Extracted data from {selectedDoc?.documentType.toUpperCase()} - {selectedDoc?.taxYear}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {selectedDoc && (
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
                {JSON.stringify(selectedDoc.extractedData, null, 2)}
              </pre>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
