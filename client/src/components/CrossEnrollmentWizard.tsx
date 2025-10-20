import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Calculator,
  Target,
  DollarSign,
  Users,
  Home,
  Briefcase,
  Heart,
  Baby,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  FileText,
  Send,
  Sparkles,
  Info,
} from "lucide-react";

interface HouseholdData {
  householdSize: number;
  monthlyIncome: number;
  hasChildren: boolean;
  hasElderly: boolean;
  hasDisabled: boolean;
  employmentStatus: string;
  housingStatus: string;
  county: string;
  zipCode: string;
}

interface BenefitProgram {
  id: string;
  name: string;
  description: string;
  estimatedBenefit: number;
  confidence: number;
  priority: "low" | "medium" | "high" | "critical";
  requirements: string[];
  processingTime: number;
  deadline?: string;
  currentlyEnrolled: boolean;
}

interface WhatIfScenario {
  name: string;
  changes: Partial<HouseholdData>;
  impact: string;
  benefitDelta: number;
}

const STEPS = [
  { id: "household", title: "Household Info", icon: Users },
  { id: "discovery", title: "Benefit Discovery", icon: Target },
  { id: "calculator", title: "What-If Calculator", icon: Calculator },
  { id: "comparison", title: "Compare Benefits", icon: TrendingUp },
  { id: "apply", title: "Apply & Bundle", icon: Send },
];

export default function CrossEnrollmentWizard({ 
  householdId,
  onComplete 
}: { 
  householdId?: string;
  onComplete?: (data: any) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [household, setHousehold] = useState<HouseholdData>({
    householdSize: 3,
    monthlyIncome: 2500,
    hasChildren: true,
    hasElderly: false,
    hasDisabled: false,
    employmentStatus: "employed",
    housingStatus: "renting",
    county: "Baltimore",
    zipCode: "21201",
  });
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [whatIfScenarios, setWhatIfScenarios] = useState<WhatIfScenario[]>([]);
  const [comparisonPrograms, setComparisonPrograms] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing household data if ID provided
  const { data: existingHousehold } = useQuery({
    queryKey: [`/api/households/${householdId}`],
    enabled: !!householdId,
  });

  // Analyze household for cross-enrollment opportunities
  const analyzeMutation = useMutation({
    mutationFn: async (data: HouseholdData) => {
      return apiRequest(`/api/cross-enrollment/analyze`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Analysis Complete",
        description: `Found ${data.opportunities.length} benefit opportunities`,
      });
    },
  });

  // Generate what-if scenarios
  const whatIfMutation = useMutation({
    mutationFn: async (scenarios: Array<{ name: string; changes: Partial<HouseholdData> }>) => {
      return apiRequest(`/api/cross-enrollment/what-if`, {
        method: "POST",
        body: JSON.stringify({ householdId, scenarios }),
      });
    },
  });

  // Submit bundled applications
  const applyMutation = useMutation({
    mutationFn: async (programIds: string[]) => {
      return apiRequest(`/api/cross-enrollment/apply`, {
        method: "POST",
        body: JSON.stringify({ householdId, programIds }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Applications Submitted",
        description: "Your benefit applications have been submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/households"] });
      onComplete?.(selectedPrograms);
    },
  });

  useEffect(() => {
    if (existingHousehold) {
      setHousehold(existingHousehold);
    }
  }, [existingHousehold]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      
      // Trigger analysis when moving to discovery step
      if (currentStep === 0) {
        analyzeMutation.mutate(household);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleProgramToggle = (programId: string) => {
    const newSelection = new Set(selectedPrograms);
    if (newSelection.has(programId)) {
      newSelection.delete(programId);
    } else {
      newSelection.add(programId);
    }
    setSelectedPrograms(newSelection);
  };

  const handleAddScenario = (name: string, changes: Partial<HouseholdData>) => {
    const scenario: WhatIfScenario = {
      name,
      changes,
      impact: "Calculating...",
      benefitDelta: 0,
    };
    setWhatIfScenarios([...whatIfScenarios, scenario]);
    
    // Calculate impact
    whatIfMutation.mutate([{ name, changes }]);
  };

  const handleSubmitApplications = () => {
    applyMutation.mutate(Array.from(selectedPrograms));
    setShowConfirmDialog(false);
  };

  // Mock data for demonstration
  const discoveredPrograms: BenefitProgram[] = analyzeMutation.data?.opportunities || [
    {
      id: "snap",
      name: "SNAP (Food Assistance)",
      description: "Monthly food benefits for eligible households",
      estimatedBenefit: 281,
      confidence: 0.92,
      priority: "high",
      requirements: ["Income verification", "Identity proof", "Residency proof"],
      processingTime: 30,
      deadline: "2025-02-15",
      currentlyEnrolled: false,
    },
    {
      id: "wic",
      name: "WIC",
      description: "Nutrition assistance for women, infants, and children",
      estimatedBenefit: 100,
      confidence: 0.88,
      priority: "high",
      requirements: ["Child under 5", "Income verification", "Health screening"],
      processingTime: 14,
      currentlyEnrolled: false,
    },
    {
      id: "liheap",
      name: "LIHEAP",
      description: "Help with heating and cooling costs",
      estimatedBenefit: 200,
      confidence: 0.85,
      priority: "critical",
      requirements: ["Utility bills", "Income verification"],
      processingTime: 45,
      deadline: "2025-03-31",
      currentlyEnrolled: false,
    },
    {
      id: "medicaid",
      name: "Medicaid",
      description: "Health insurance for low-income families",
      estimatedBenefit: 500,
      confidence: 0.90,
      priority: "critical",
      requirements: ["Income verification", "Identity proof", "Citizenship status"],
      processingTime: 45,
      currentlyEnrolled: true,
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Household Info
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Household Size */}
              <div className="space-y-2">
                <Label>Household Size</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[household.householdSize]}
                    onValueChange={([value]) => 
                      setHousehold({ ...household, householdSize: value })
                    }
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-center font-bold">
                    {household.householdSize}
                  </span>
                </div>
              </div>

              {/* Monthly Income */}
              <div className="space-y-2">
                <Label>Monthly Income</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[household.monthlyIncome]}
                    onValueChange={([value]) => 
                      setHousehold({ ...household, monthlyIncome: value })
                    }
                    min={0}
                    max={10000}
                    step={100}
                    className="flex-1"
                  />
                  <span className="w-20 text-center font-bold">
                    ${household.monthlyIncome}
                  </span>
                </div>
              </div>

              {/* Employment Status */}
              <div className="space-y-2">
                <Label>Employment Status</Label>
                <Select
                  value={household.employmentStatus}
                  onValueChange={(value) => 
                    setHousehold({ ...household, employmentStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="unemployed">Unemployed</SelectItem>
                    <SelectItem value="self-employed">Self-Employed</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Housing Status */}
              <div className="space-y-2">
                <Label>Housing Status</Label>
                <Select
                  value={household.housingStatus}
                  onValueChange={(value) => 
                    setHousehold({ ...household, housingStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">Own Home</SelectItem>
                    <SelectItem value="renting">Renting</SelectItem>
                    <SelectItem value="homeless">Homeless</SelectItem>
                    <SelectItem value="temporary">Temporary Housing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Household Characteristics */}
            <div className="space-y-4">
              <Label>Household Characteristics</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={household.hasChildren}
                    onCheckedChange={(checked) => 
                      setHousehold({ ...household, hasChildren: checked })
                    }
                  />
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Baby className="h-4 w-4" />
                    Has children under 18
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={household.hasElderly}
                    onCheckedChange={(checked) => 
                      setHousehold({ ...household, hasElderly: checked })
                    }
                  />
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    Has elderly members (65+)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={household.hasDisabled}
                    onCheckedChange={(checked) => 
                      setHousehold({ ...household, hasDisabled: checked })
                    }
                  />
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Heart className="h-4 w-4" />
                    Has disabled members
                  </Label>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>County</Label>
                <Select
                  value={household.county}
                  onValueChange={(value) => 
                    setHousehold({ ...household, county: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baltimore">Baltimore</SelectItem>
                    <SelectItem value="Montgomery">Montgomery</SelectItem>
                    <SelectItem value="Prince George's">Prince George's</SelectItem>
                    <SelectItem value="Anne Arundel">Anne Arundel</SelectItem>
                    <SelectItem value="Howard">Howard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <input
                  type="text"
                  value={household.zipCode}
                  onChange={(e) => 
                    setHousehold({ ...household, zipCode: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  maxLength={5}
                />
              </div>
            </div>
          </div>
        );

      case 1: // Benefit Discovery
        return (
          <div className="space-y-6">
            {/* AI Insights */}
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold">AI Analysis Complete</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on your household profile, we've identified {discoveredPrograms.filter(p => !p.currentlyEnrolled).length} potential 
                benefit programs with an estimated total value of ${discoveredPrograms.filter(p => !p.currentlyEnrolled).reduce((sum, p) => sum + p.estimatedBenefit, 0)}/month.
              </p>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-6">
                {discoveredPrograms
                  .sort((a, b) => {
                    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                  })
                  .map((program, index) => (
                    <div key={program.id} className="relative flex gap-4">
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center shrink-0",
                        program.currentlyEnrolled ? "bg-green-100" : "bg-gray-100"
                      )}>
                        {program.currentlyEnrolled ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <DollarSign className="h-6 w-6 text-gray-600" />
                        )}
                      </div>
                      <Card className={cn(
                        "flex-1 transition-all",
                        selectedPrograms.has(program.id) && "ring-2 ring-primary"
                      )}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{program.name}</CardTitle>
                              <CardDescription>{program.description}</CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant={
                                program.priority === "critical" ? "destructive" :
                                program.priority === "high" ? "warning" :
                                "secondary"
                              }>
                                {program.priority} priority
                              </Badge>
                              {program.currentlyEnrolled && (
                                <Badge variant="success">Enrolled</Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Estimated Benefit</p>
                              <p className="text-xl font-bold">${program.estimatedBenefit}/mo</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Confidence</p>
                              <div className="flex items-center gap-2">
                                <Progress value={program.confidence * 100} className="flex-1" />
                                <span className="text-sm font-medium">{Math.round(program.confidence * 100)}%</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Processing Time</p>
                              <p className="text-sm font-medium">{program.processingTime} days</p>
                            </div>
                          </div>
                          
                          {program.deadline && (
                            <div className="flex items-center gap-2 mb-3 text-sm text-orange-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>Application deadline: {program.deadline}</span>
                            </div>
                          )}

                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="requirements" className="border-none">
                              <AccordionTrigger className="text-sm py-2">
                                Requirements ({program.requirements.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <ul className="space-y-1">
                                  {program.requirements.map((req, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm">
                                      <FileText className="h-3 w-3" />
                                      {req}
                                    </li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>

                          {!program.currentlyEnrolled && (
                            <Button
                              variant={selectedPrograms.has(program.id) ? "default" : "outline"}
                              className="w-full mt-4"
                              onClick={() => handleProgramToggle(program.id)}
                            >
                              {selectedPrograms.has(program.id) ? "Selected for Application" : "Select Program"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );

      case 2: // What-If Calculator
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What-If Scenario Calculator</CardTitle>
                <CardDescription>
                  See how changes to your household would affect benefit eligibility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="income" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="income">Income Changes</TabsTrigger>
                    <TabsTrigger value="household">Household Changes</TabsTrigger>
                    <TabsTrigger value="employment">Employment Changes</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="income" className="space-y-4">
                    <div className="space-y-2">
                      <Label>If monthly income changed to:</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          defaultValue={[household.monthlyIncome]}
                          min={0}
                          max={10000}
                          step={100}
                          className="flex-1"
                          onValueChange={([value]) => {
                            handleAddScenario("Income Change", { monthlyIncome: value });
                          }}
                        />
                        <span className="w-20 text-center">$2500</span>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="household" className="space-y-4">
                    <div className="space-y-2">
                      <Label>If household size changed to:</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          defaultValue={[household.householdSize]}
                          min={1}
                          max={10}
                          step={1}
                          className="flex-1"
                          onValueChange={([value]) => {
                            handleAddScenario("Household Size Change", { householdSize: value });
                          }}
                        />
                        <span className="w-12 text-center">3</span>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="employment" className="space-y-4">
                    <div className="space-y-2">
                      <Label>If employment status changed to:</Label>
                      <Select
                        onValueChange={(value) => {
                          handleAddScenario("Employment Change", { employmentStatus: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unemployed">Unemployed</SelectItem>
                          <SelectItem value="part-time">Part-Time</SelectItem>
                          <SelectItem value="self-employed">Self-Employed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Scenario Results */}
            {whatIfScenarios.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Scenario Results</h3>
                {whatIfScenarios.map((scenario, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-base">{scenario.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Benefit Impact:</span>
                        <span className={cn(
                          "font-bold",
                          scenario.benefitDelta > 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {scenario.benefitDelta > 0 ? "+" : ""}{scenario.benefitDelta}/month
                        </span>
                      </div>
                      <p className="text-sm">{scenario.impact}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 3: // Compare Benefits
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Side-by-Side Comparison</CardTitle>
                <CardDescription>
                  Compare selected benefits to make informed decisions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Benefit</th>
                        <th className="text-center py-2">Monthly Amount</th>
                        <th className="text-center py-2">Processing Time</th>
                        <th className="text-center py-2">Confidence</th>
                        <th className="text-center py-2">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discoveredPrograms
                        .filter(p => selectedPrograms.has(p.id))
                        .map((program) => (
                          <tr key={program.id} className="border-b">
                            <td className="py-3">{program.name}</td>
                            <td className="text-center font-bold">${program.estimatedBenefit}</td>
                            <td className="text-center">{program.processingTime} days</td>
                            <td className="text-center">{Math.round(program.confidence * 100)}%</td>
                            <td className="text-center">
                              <Badge variant={
                                program.priority === "critical" ? "destructive" :
                                program.priority === "high" ? "warning" :
                                "secondary"
                              }>
                                {program.priority}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td className="pt-3">Total</td>
                        <td className="text-center pt-3">
                          ${discoveredPrograms
                            .filter(p => selectedPrograms.has(p.id))
                            .reduce((sum, p) => sum + p.estimatedBenefit, 0)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Visual Impact */}
            <Card>
              <CardHeader>
                <CardTitle>Potential Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Current Monthly Benefits</span>
                    <span className="text-xl font-bold">
                      ${discoveredPrograms
                        .filter(p => p.currentlyEnrolled)
                        .reduce((sum, p) => sum + p.estimatedBenefit, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-green-600">
                    <span>Potential Additional Benefits</span>
                    <span className="text-xl font-bold">
                      +${discoveredPrograms
                        .filter(p => selectedPrograms.has(p.id) && !p.currentlyEnrolled)
                        .reduce((sum, p) => sum + p.estimatedBenefit, 0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Monthly Benefits</span>
                    <span className="text-2xl font-bold text-primary">
                      ${discoveredPrograms
                        .filter(p => p.currentlyEnrolled || selectedPrograms.has(p.id))
                        .reduce((sum, p) => sum + p.estimatedBenefit, 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4: // Apply & Bundle
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Bundle Summary</CardTitle>
                <CardDescription>
                  Review your selected benefits before submitting applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {discoveredPrograms
                    .filter(p => selectedPrograms.has(p.id))
                    .map((program) => (
                      <div key={program.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{program.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ${program.estimatedBenefit}/month • {program.processingTime} days
                          </p>
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    ))}
                </div>

                {selectedPrograms.size === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No programs selected for application
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Required Documents */}
            {selectedPrograms.size > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Required Documents</CardTitle>
                  <CardDescription>
                    Consolidated list of documents needed for all selected programs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Array.from(new Set(
                      discoveredPrograms
                        .filter(p => selectedPrograms.has(p.id))
                        .flatMap(p => p.requirements)
                    )).map((requirement, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{requirement}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Actions */}
            {selectedPrograms.size > 0 && (
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  className="w-full md:w-auto"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={applyMutation.isPending}
                >
                  <Send className="h-5 w-5 mr-2" />
                  Submit {selectedPrograms.size} Application{selectedPrograms.size !== 1 ? "s" : ""}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  By submitting, you authorize us to share your information with the relevant agencies
                  for benefit determination.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col items-center gap-2 flex-1",
                  index <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border-2",
                    index < currentStep ? "bg-primary border-primary text-primary-foreground" :
                    index === currentStep ? "border-primary" :
                    "border-muted-foreground"
                  )}>
                    {index < currentStep ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "absolute top-6 left-12 w-full h-0.5",
                      index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                    )} style={{ width: "calc(100% + 48px)" }} />
                  )}
                </div>
                <span className="text-xs text-center hidden md:block">{step.title}</span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep].title}</CardTitle>
          </CardHeader>
          <CardContent>{renderStepContent()}</CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Application Submission</DialogTitle>
            <DialogDescription>
              You are about to submit {selectedPrograms.size} benefit application{selectedPrograms.size !== 1 ? "s" : ""}.
              This will share your household information with the relevant agencies.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-semibold mb-2">Applications to be submitted:</p>
            <ul className="space-y-1">
              {discoveredPrograms
                .filter(p => selectedPrograms.has(p.id))
                .map(p => (
                  <li key={p.id} className="text-sm">• {p.name}</li>
                ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitApplications} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}