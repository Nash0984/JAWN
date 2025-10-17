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
  ChevronRight, X, Eye, FileCheck, TrendingUp, Network, Clock, ArrowRight, UserCircle, ExternalLink
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  marylandTax?: {
    marylandAGI: number;
    marylandStateTax: number;
    countyTax: number;
    totalMarylandTax: number;
    marylandEITC: number;
    marylandRefund: number;
    countyRate: number;
  };
}

interface CrossEnrollmentOpportunity {
  id: string;
  type: 'tax_to_benefit' | 'benefit_to_tax';
  priority: 'high' | 'medium' | 'low';
  category: string;
  trigger: {
    source: string;
    value: number | string;
    threshold?: number;
  };
  recommendation: {
    program: string;
    estimatedValue: number;
    action: string;
    automationAvailable: boolean;
  };
  evidence: {
    incomeIndicators?: {
      agi: number;
      eitc: number;
      wages: number;
    };
    householdIndicators?: {
      dependents: number;
      medicalExpenses?: number;
      childcareExpenses?: number;
    };
    programEligibility?: {
      snapIncomeLimitMonthly: number;
      currentIncomeMonthly: number;
      likelyEligible: boolean;
    };
  };
  navigatorNotes: string;
  urgency: 'immediate' | 'within_30_days' | 'annual' | 'future_planning';
}

interface CrossEnrollmentAnalysis {
  opportunities: CrossEnrollmentOpportunity[];
  summary: {
    totalPotentialValue: number;
    highPriorityCount: number;
    autoEnrollableCount: number;
  };
  householdProfile: {
    agi: number;
    householdSize: number;
    dependents: number;
    hasDisability: boolean;
    hasElderly: boolean;
  };
}

interface HouseholdProfile {
  id: string;
  name: string;
  profileMode: string;
  householdSize: number;
  filingStatus?: string;
  employmentIncome: number;
  unearnedIncome: number;
  selfEmploymentIncome: number;
  wageWithholding: number;
  estimatedTaxPayments: number;
  dependents: any[];
  taxpayerBlind: boolean;
  taxpayerDisabled: boolean;
  spouseBlind: boolean;
  spouseDisabled: boolean;
  stateCode: string;
}

export default function TaxPreparation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedDocType, setSelectedDocType] = useState<string>("w2");
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear() - 1);
  const [uploading, setUploading] = useState(false);
  const [calculationResult, setCalculationResult] = useState<TaxCalculation | null>(null);
  const [crossEnrollmentAnalysis, setCrossEnrollmentAnalysis] = useState<CrossEnrollmentAnalysis | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<TaxDocument | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch household profiles
  const { data: profiles = [] } = useQuery<HouseholdProfile[]>({
    queryKey: ['/api/household-profiles'],
    select: (data) => data.filter((p: any) => p.profileMode === 'combined' || p.profileMode === 'tax_only')
  });

  // Fetch tax documents
  const { data: documents = [], isLoading: loadingDocs } = useQuery<TaxDocument[]>({
    queryKey: ["/api/tax/documents"],
  });

  // Personal info form state
  const [personalInfo, setPersonalInfo] = useState({
    taxpayerFirstName: "",
    taxpayerLastName: "",
    taxpayerSSN: "",
    taxpayerAge: 35,
    taxpayerBlind: false,
    taxpayerDisabled: false,
    spouseFirstName: "",
    spouseLastName: "",
    spouseSSN: "",
    spouseAge: 35,
    spouseBlind: false,
    spouseDisabled: false,
    streetAddress: "",
    aptNumber: "",
    city: "",
    state: "MD",
    county: "Baltimore City",
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
  const calculateMutation = useMutation<TaxCalculation & { taxInput: any }, Error, void>({
    mutationFn: async () => {
      // Build household tax input from forms and extracted documents
      
      // Process W-2 documents (wage income)
      const w2Docs = documents.filter(d => d.documentType === 'w2');
      const totalWages = w2Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box1_wages || 0);
      }, 0);
      const w2FederalWithholding = w2Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box2_federalTaxWithheld || 0);
      }, 0);

      // Process 1099-MISC documents - separate passive income from self-employment
      const misc1099Docs = documents.filter(d => d.documentType === '1099-misc');
      
      // Passive income (NOT self-employment)
      const passiveRentalIncome = misc1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box1_rents || 0);
      }, 0);
      const passiveRoyaltyIncome = misc1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box2_royalties || 0);
      }, 0);
      const passiveOtherIncome = misc1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box3_otherIncome || 0);
      }, 0);
      
      // Self-employment income from box 7 (pre-2020 only)
      const misc1099SelfEmployment = misc1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box7_nonemployeeCompensation || 0);
      }, 0);
      
      const misc1099Withholding = misc1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box4_federalTaxWithheld || 0);
      }, 0);

      // Process 1099-NEC documents (self-employment income, post-2020)
      const nec1099Docs = documents.filter(d => d.documentType === '1099-nec');
      const necSelfEmployment = nec1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box1_nonemployeeCompensation || 0);
      }, 0);
      const nec1099Withholding = nec1099Docs.reduce((sum, doc) => {
        return sum + (doc.extractedData?.box4_federalTaxWithheld || 0);
      }, 0);

      // Total self-employment income (1099-NEC + 1099-MISC box 7 only)
      const totalSelfEmployment = necSelfEmployment + misc1099SelfEmployment;

      // Process 1095-A documents (health insurance)
      const aca1095Docs = documents.filter(d => d.documentType === '1095-a');
      const acaData = aca1095Docs.length > 0 ? aca1095Docs[0].extractedData : null;

      const taxInput = {
        taxYear,
        filingStatus: personalInfo.filingStatus as any,
        stateCode: "MD",
        taxpayer: {
          age: personalInfo.taxpayerAge,
          isBlind: personalInfo.taxpayerBlind,
          isDisabled: personalInfo.taxpayerDisabled
        },
        ...(personalInfo.filingStatus === 'married_joint' && {
          spouse: {
            age: personalInfo.spouseAge,
            isBlind: personalInfo.spouseBlind,
            isDisabled: personalInfo.spouseDisabled
          }
        }),
        dependents: dependents.map(d => ({
          age: d.age,
          relationship: 'child' as any,
          studentStatus: 'none' as any
        })),
        w2Income: {
          taxpayerWages: totalWages,
          federalWithholding: w2FederalWithholding + misc1099Withholding + nec1099Withholding,
          socialSecurityWithholding: w2Docs.reduce((sum, doc) => sum + (doc.extractedData?.box4_socialSecurityTaxWithheld || 0), 0),
          medicareWithholding: w2Docs.reduce((sum, doc) => sum + (doc.extractedData?.box6_medicareTaxWithheld || 0), 0)
        },
        ...(totalSelfEmployment > 0 && {
          selfEmploymentIncome: {
            businessIncome: totalSelfEmployment,
            businessExpenses: 0 // TODO: add expense tracking in future
          }
        }),
        ...(passiveRentalIncome > 0 && {
          rentalIncome: passiveRentalIncome
        }),
        ...(passiveRoyaltyIncome > 0 && {
          royaltyIncome: passiveRoyaltyIncome
        }),
        ...(passiveOtherIncome > 0 && {
          otherIncome: passiveOtherIncome
        }),
        ...(acaData && {
          healthInsurance: {
            marketplaceCoverage: true,
            slcspPremium: acaData.annualTotals?.slcspTotal || 0,
            actualPremium: acaData.annualTotals?.enrolledTotal || 0,
            advancePremiumTaxCredit: acaData.annualTotals?.aptcTotal || 0
          }
        })
      };

      const federalResult = await apiRequest("/api/tax/calculate", "POST", taxInput) as unknown as TaxCalculation;
      
      const marylandResult = await apiRequest("/api/tax/maryland/calculate", "POST", {
        federalAGI: federalResult.adjustedGrossIncome,
        federalEITC: federalResult.eitcAmount,
        filingStatus: personalInfo.filingStatus,
        county: personalInfo.county,
        marylandInput: {},
        federalDeduction: 0,
        federalItemizedDeduction: 0
      }) as unknown as TaxCalculation['marylandTax'];

      return { ...federalResult, marylandTax: marylandResult, taxInput };
    },
    onSuccess: (data: TaxCalculation & { taxInput: any }) => {
      const { taxInput, ...taxCalcResult } = data;
      setCalculationResult(taxCalcResult);
      
      // Automatically trigger cross-enrollment analysis
      crossEnrollmentMutation.mutate(taxInput);
      
      toast({
        title: "Calculation Complete",
        description: `Federal refund: $${taxCalcResult.refundAmount.toFixed(2)}${taxCalcResult.marylandTax ? `, MD refund: $${taxCalcResult.marylandTax.marylandRefund.toFixed(2)}` : ''}`,
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

  // Cross-enrollment analysis mutation
  const crossEnrollmentMutation = useMutation<CrossEnrollmentAnalysis, Error, any>({
    mutationFn: async (taxInput: any) => {
      const response = await apiRequest("/api/tax/cross-enrollment/analyze", "POST", { taxInput });
      return response as unknown as CrossEnrollmentAnalysis;
    },
    onSuccess: (data: CrossEnrollmentAnalysis) => {
      setCrossEnrollmentAnalysis(data);
      
      if (data.summary.highPriorityCount > 0) {
        toast({
          title: "Benefit Opportunities Found!",
          description: `Found ${data.opportunities.length} benefit opportunities worth up to $${data.summary.totalPotentialValue.toLocaleString()}/year`,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Cross-enrollment analysis failed:", error);
      toast({
        title: "Cross-Enrollment Analysis Failed",
        description: error.message || "Unable to analyze benefit opportunities. Please try again.",
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

      window.open(url, '_blank');

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

  // Maryland Form 502 PDF generation
  const generateForm502Mutation = useMutation({
    mutationFn: async () => {
      if (!calculationResult) {
        throw new Error("No calculation available");
      }

      const response = await fetch('/api/tax/form502/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo: {
            taxpayerFirstName: personalInfo.taxpayerFirstName,
            taxpayerLastName: personalInfo.taxpayerLastName,
            taxpayerSSN: personalInfo.taxpayerSSN,
            spouseFirstName: personalInfo.spouseFirstName,
            spouseLastName: personalInfo.spouseLastName,
            spouseSSN: personalInfo.spouseSSN,
            streetAddress: personalInfo.streetAddress,
            city: personalInfo.city,
            state: personalInfo.state,
            county: personalInfo.county,
            zipCode: personalInfo.zipCode,
            filingStatus: personalInfo.filingStatus
          },
          calculationResult,
          taxYear
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate Maryland Form 502');
      }

      const blob = await response.blob();
      return blob;
    },
    onSuccess: (pdfBlob) => {
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Form_502_MD_${taxYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      window.open(url, '_blank');

      toast({
        title: "Maryland Form 502 Generated",
        description: "PDF downloaded and opened in new tab",
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
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="opportunities" data-testid="tab-opportunities" disabled={!crossEnrollmentAnalysis}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Benefit Opportunities
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
                        <SelectItem value="2021">2021</SelectItem>
                        <SelectItem value="2020">2020</SelectItem>
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
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  Load from Household Profile
                </CardTitle>
                <CardDescription>
                  Pre-fill tax information from a saved household profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select 
                    value={selectedProfileId} 
                    onValueChange={(value) => {
                      setSelectedProfileId(value);
                      const profile = profiles.find(p => p.id === value);
                      if (profile) {
                        setPersonalInfo({
                          ...personalInfo,
                          filingStatus: profile.filingStatus || personalInfo.filingStatus,
                          taxpayerBlind: profile.taxpayerBlind,
                          taxpayerDisabled: profile.taxpayerDisabled,
                          spouseBlind: profile.spouseBlind,
                          spouseDisabled: profile.spouseDisabled,
                          state: profile.stateCode
                        });
                        setDependents(profile.dependents || []);
                        toast({
                          title: "Profile Loaded",
                          description: `Household data loaded from "${profile.name}"`
                        });
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-household-profile-tax">
                      <SelectValue placeholder="Select a household profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.householdSize} {profile.householdSize === 1 ? 'member' : 'members'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open('/profiler', '_blank')}
                    data-testid="button-open-profiler-tax"
                    title="Open Household Profiler"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                {selectedProfileId && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Profile data has been loaded. You can still modify individual fields below.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

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

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
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
                    <Label htmlFor="taxpayer-age">Age</Label>
                    <Input
                      id="taxpayer-age"
                      type="number"
                      min="0"
                      max="120"
                      value={personalInfo.taxpayerAge}
                      onChange={(e) => setPersonalInfo({...personalInfo, taxpayerAge: parseInt(e.target.value) || 0})}
                      data-testid="input-taxpayer-age"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="taxpayer-blind"
                      checked={personalInfo.taxpayerBlind}
                      onChange={(e) => setPersonalInfo({...personalInfo, taxpayerBlind: e.target.checked})}
                      data-testid="checkbox-taxpayer-blind"
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="taxpayer-blind" className="cursor-pointer">Blind</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="taxpayer-disabled"
                      checked={personalInfo.taxpayerDisabled}
                      onChange={(e) => setPersonalInfo({...personalInfo, taxpayerDisabled: e.target.checked})}
                      data-testid="checkbox-taxpayer-disabled"
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="taxpayer-disabled" className="cursor-pointer">Disabled</Label>
                  </div>
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

                {(personalInfo.filingStatus === 'married_joint' || personalInfo.filingStatus === 'married_separate') && (
                  <>
                    <Separator />
                    <h3 className="font-medium">Spouse Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="spouse-first-name">Spouse First Name</Label>
                        <Input
                          id="spouse-first-name"
                          value={personalInfo.spouseFirstName}
                          onChange={(e) => setPersonalInfo({...personalInfo, spouseFirstName: e.target.value})}
                          data-testid="input-spouse-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spouse-last-name">Spouse Last Name</Label>
                        <Input
                          id="spouse-last-name"
                          value={personalInfo.spouseLastName}
                          onChange={(e) => setPersonalInfo({...personalInfo, spouseLastName: e.target.value})}
                          data-testid="input-spouse-last-name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="spouse-ssn">Spouse SSN</Label>
                        <Input
                          id="spouse-ssn"
                          type="password"
                          placeholder="XXX-XX-XXXX"
                          value={personalInfo.spouseSSN}
                          onChange={(e) => setPersonalInfo({...personalInfo, spouseSSN: e.target.value})}
                          data-testid="input-spouse-ssn"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spouse-age">Age</Label>
                        <Input
                          id="spouse-age"
                          type="number"
                          min="0"
                          max="120"
                          value={personalInfo.spouseAge}
                          onChange={(e) => setPersonalInfo({...personalInfo, spouseAge: parseInt(e.target.value) || 0})}
                          data-testid="input-spouse-age"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="spouse-blind"
                          checked={personalInfo.spouseBlind}
                          onChange={(e) => setPersonalInfo({...personalInfo, spouseBlind: e.target.checked})}
                          data-testid="checkbox-spouse-blind"
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="spouse-blind" className="cursor-pointer">Spouse Blind</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="spouse-disabled"
                          checked={personalInfo.spouseDisabled}
                          onChange={(e) => setPersonalInfo({...personalInfo, spouseDisabled: e.target.checked})}
                          data-testid="checkbox-spouse-disabled"
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="spouse-disabled" className="cursor-pointer">Spouse Disabled</Label>
                      </div>
                    </div>
                  </>
                )}

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
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="county">County (for MD taxes)</Label>
                    <Select value={personalInfo.county} onValueChange={(v) => setPersonalInfo({...personalInfo, county: v})}>
                      <SelectTrigger id="county" data-testid="select-county">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Allegany">Allegany</SelectItem>
                        <SelectItem value="Anne Arundel">Anne Arundel</SelectItem>
                        <SelectItem value="Baltimore City">Baltimore City</SelectItem>
                        <SelectItem value="Baltimore">Baltimore County</SelectItem>
                        <SelectItem value="Calvert">Calvert</SelectItem>
                        <SelectItem value="Caroline">Caroline</SelectItem>
                        <SelectItem value="Carroll">Carroll</SelectItem>
                        <SelectItem value="Cecil">Cecil</SelectItem>
                        <SelectItem value="Charles">Charles</SelectItem>
                        <SelectItem value="Dorchester">Dorchester</SelectItem>
                        <SelectItem value="Frederick">Frederick</SelectItem>
                        <SelectItem value="Garrett">Garrett</SelectItem>
                        <SelectItem value="Harford">Harford</SelectItem>
                        <SelectItem value="Howard">Howard</SelectItem>
                        <SelectItem value="Kent">Kent</SelectItem>
                        <SelectItem value="Montgomery">Montgomery</SelectItem>
                        <SelectItem value="Prince Georges">Prince George's</SelectItem>
                        <SelectItem value="Queen Annes">Queen Anne's</SelectItem>
                        <SelectItem value="Somerset">Somerset</SelectItem>
                        <SelectItem value="St. Marys">St. Mary's</SelectItem>
                        <SelectItem value="Talbot">Talbot</SelectItem>
                        <SelectItem value="Washington">Washington</SelectItem>
                        <SelectItem value="Wicomico">Wicomico</SelectItem>
                        <SelectItem value="Worcester">Worcester</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                      <li>{documents.filter(d => d.documentType === 'w2').length} W-2 form(s) - Wage Income</li>
                      <li>{documents.filter(d => d.documentType === '1099-misc').length} 1099-MISC form(s) - Miscellaneous Income</li>
                      <li>{documents.filter(d => d.documentType === '1099-nec').length} 1099-NEC form(s) - Self-Employment Income</li>
                      <li>{documents.filter(d => d.documentType === '1095-a').length} 1095-A form(s) - Health Insurance</li>
                      <li>Filing Status: {personalInfo.filingStatus.replace('_', ' ')}</li>
                      <li>Taxpayer Age: {personalInfo.taxpayerAge} {personalInfo.taxpayerBlind && '(Blind)'} {personalInfo.taxpayerDisabled && '(Disabled)'}</li>
                      {(personalInfo.filingStatus === 'married_joint' || personalInfo.filingStatus === 'married_separate') && (
                        <li>Spouse Age: {personalInfo.spouseAge} {personalInfo.spouseBlind && '(Blind)'} {personalInfo.spouseDisabled && '(Disabled)'}</li>
                      )}
                      <li>{dependents.length} dependent(s)</li>
                      <li>Calculations: AGI, Taxable Income, EITC, Child Tax Credit, Refund</li>
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
                {calculationResult.marylandTax && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Maryland State Tax Summary
                      </CardTitle>
                      <CardDescription>
                        {personalInfo.county} County • Tax Year {calculationResult.taxYear}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Maryland AGI</Label>
                          <p className="text-2xl font-bold" data-testid="text-md-agi">
                            ${calculationResult.marylandTax.marylandAGI.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">MD State Tax</Label>
                          <p className="text-2xl font-bold" data-testid="text-md-state-tax">
                            ${calculationResult.marylandTax.marylandStateTax.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            {personalInfo.county} County Tax ({(calculationResult.marylandTax.countyRate * 100).toFixed(2)}%)
                          </Label>
                          <p className="text-2xl font-bold" data-testid="text-county-tax">
                            ${calculationResult.marylandTax.countyTax.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Total MD Tax</Label>
                          <p className="text-2xl font-bold" data-testid="text-total-md-tax">
                            ${calculationResult.marylandTax.totalMarylandTax.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">MD EITC (50% of Federal)</Label>
                          <p className="text-2xl font-bold text-green-600" data-testid="text-md-eitc">
                            ${calculationResult.marylandTax.marylandEITC.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            {calculationResult.marylandTax.marylandRefund >= 0 ? 'MD Refund' : 'MD Amount Owed'}
                          </Label>
                          <p 
                            className={`text-3xl font-bold ${calculationResult.marylandTax.marylandRefund >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            data-testid="text-md-refund"
                          >
                            ${Math.abs(calculationResult.marylandTax.marylandRefund).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Federal Tax Calculation Results</CardTitle>
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

                    <div className="space-y-4">
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
                            <><Download className="h-4 w-4 mr-2" /> Generate Form 1040</>
                          )}
                        </Button>
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => generateForm502Mutation.mutate()}
                          disabled={generateForm502Mutation.isPending || !calculationResult?.marylandTax}
                          data-testid="button-download-form502"
                        >
                          {generateForm502Mutation.isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                          ) : (
                            <><Download className="h-4 w-4 mr-2" /> Generate MD Form 502</>
                          )}
                        </Button>
                      </div>
                      <Button 
                        className="w-full"
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

          {/* Cross-Enrollment Opportunities Tab */}
          <TabsContent value="opportunities" className="space-y-6">
            {crossEnrollmentMutation.isPending ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
                <Skeleton className="h-64" />
                <Skeleton className="h-48" />
              </div>
            ) : crossEnrollmentAnalysis ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Total Potential Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600" data-testid="text-total-value">
                        ${crossEnrollmentAnalysis.summary.totalPotentialValue.toLocaleString()}/year
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Across all opportunities
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        High Priority
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600" data-testid="text-high-priority-count">
                        {crossEnrollmentAnalysis.summary.highPriorityCount}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Immediate action needed
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Auto-Enrollable
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600" data-testid="text-auto-enrollable-count">
                        {crossEnrollmentAnalysis.summary.autoEnrollableCount}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Can pre-fill from tax data
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Opportunities List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      Benefit Opportunities ({crossEnrollmentAnalysis.opportunities?.length || 0})
                    </CardTitle>
                    <CardDescription>
                      AI-identified benefit programs based on your tax return data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!crossEnrollmentAnalysis.opportunities || crossEnrollmentAnalysis.opportunities.length === 0 ? (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>No New Opportunities</AlertTitle>
                        <AlertDescription>
                          Based on your tax return, you appear to be enrolled in all eligible benefit programs.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Accordion type="single" collapsible className="w-full">
                        {crossEnrollmentAnalysis.opportunities.map((opportunity) => {
                          const priorityColors = {
                            high: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
                            medium: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
                            low: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                          };

                          const urgencyIcons = {
                            immediate: <AlertCircle className="h-4 w-4 text-red-600" />,
                            within_30_days: <Clock className="h-4 w-4 text-yellow-600" />,
                            annual: <Info className="h-4 w-4 text-blue-600" />,
                            future_planning: <Info className="h-4 w-4 text-gray-600" />
                          };

                          return (
                            <AccordionItem 
                              key={opportunity.id} 
                              value={opportunity.id}
                              className={`border ${priorityColors[opportunity.priority]} rounded-lg mb-3 px-4`}
                              data-testid={`opportunity-${opportunity.id}`}
                            >
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-start justify-between w-full pr-4">
                                  <div className="flex items-start gap-3 text-left">
                                    <div className="mt-1">
                                      {urgencyIcons[opportunity.urgency]}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-base">
                                          {opportunity.recommendation.program}
                                        </h4>
                                        <Badge 
                                          variant={opportunity.priority === 'high' ? 'destructive' : opportunity.priority === 'medium' ? 'default' : 'secondary'}
                                          data-testid={`badge-priority-${opportunity.id}`}
                                        >
                                          {opportunity.priority.toUpperCase()}
                                        </Badge>
                                      </div>
                                      <p className="text-sm opacity-90">
                                        {opportunity.trigger.source}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold" data-testid={`text-value-${opportunity.id}`}>
                                      ${opportunity.recommendation.estimatedValue.toLocaleString()}
                                    </p>
                                    <p className="text-xs opacity-75">
                                      {opportunity.category.includes('SNAP') || opportunity.category.includes('Child Care') ? '/month' : '/year'}
                                    </p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pt-4">
                                <div className="space-y-4">
                                  {/* Trigger Details */}
                                  <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                      Why This Opportunity?
                                    </Label>
                                    <p className="text-sm mt-1">
                                      {opportunity.trigger.source}
                                      {opportunity.trigger.threshold && (
                                        <span className="ml-2 text-muted-foreground">
                                          (Threshold: ${typeof opportunity.trigger.value === 'number' ? opportunity.trigger.value.toLocaleString() : opportunity.trigger.value})
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* Evidence */}
                                  {opportunity.evidence.incomeIndicators && (
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                      {opportunity.evidence.incomeIndicators.agi !== undefined && (
                                        <div>
                                          <Label className="text-xs opacity-70">AGI</Label>
                                          <p className="font-medium">${opportunity.evidence.incomeIndicators.agi.toLocaleString()}</p>
                                        </div>
                                      )}
                                      {opportunity.evidence.incomeIndicators.eitc !== undefined && (
                                        <div>
                                          <Label className="text-xs opacity-70">EITC</Label>
                                          <p className="font-medium">${opportunity.evidence.incomeIndicators.eitc.toLocaleString()}</p>
                                        </div>
                                      )}
                                      {opportunity.evidence.incomeIndicators.wages !== undefined && (
                                        <div>
                                          <Label className="text-xs opacity-70">Wages</Label>
                                          <p className="font-medium">${opportunity.evidence.incomeIndicators.wages.toLocaleString()}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Recommended Action */}
                                  <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                      Recommended Action
                                    </Label>
                                    <p className="text-sm mt-1 font-medium">
                                      {opportunity.recommendation.action}
                                    </p>
                                    {opportunity.recommendation.automationAvailable && (
                                      <Badge variant="outline" className="mt-2">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Auto-fillable from tax data
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Navigator Notes */}
                                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                      Navigator Notes
                                    </Label>
                                    <p className="text-sm mt-1 text-blue-900 dark:text-blue-100">
                                      {opportunity.navigatorNotes}
                                    </p>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-3 pt-2">
                                    <Button 
                                      className="flex-1"
                                      data-testid={`button-start-application-${opportunity.id}`}
                                    >
                                      <ArrowRight className="h-4 w-4 mr-2" />
                                      Start Application
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      className="flex-1"
                                      data-testid={`button-send-to-navigator-${opportunity.id}`}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Send to Navigator
                                    </Button>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}
                  </CardContent>
                </Card>

                {/* Household Profile Summary */}
                {crossEnrollmentAnalysis.householdProfile && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Household Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">AGI</Label>
                          <p className="font-semibold">${crossEnrollmentAnalysis.householdProfile.agi.toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Household Size</Label>
                          <p className="font-semibold">{crossEnrollmentAnalysis.householdProfile.householdSize}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Dependents</Label>
                          <p className="font-semibold">{crossEnrollmentAnalysis.householdProfile.dependents}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Has Disability</Label>
                          <p className="font-semibold">{crossEnrollmentAnalysis.householdProfile.hasDisability ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Has Elderly (65+)</Label>
                          <p className="font-semibold">{crossEnrollmentAnalysis.householdProfile.hasElderly ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No Analysis Available</AlertTitle>
                <AlertDescription>
                  Complete your tax calculation to see benefit enrollment opportunities.
                </AlertDescription>
              </Alert>
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
