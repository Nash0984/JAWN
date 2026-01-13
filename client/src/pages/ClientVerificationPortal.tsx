import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Helmet } from "react-helmet-async";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Calendar, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Phone,
  MessageSquare,
  Clock,
  Shield
} from "lucide-react";

const incomeChangeSchema = z.object({
  changeType: z.enum(['new_job', 'job_loss', 'hours_changed', 'new_income_source', 'income_stopped']),
  employerName: z.string().optional(),
  previousIncome: z.coerce.number().min(0).optional(),
  newIncome: z.coerce.number().min(0),
  effectiveDate: z.string().min(1, "Effective date is required"),
  explanation: z.string().min(10, "Please explain the change"),
  hasDocumentation: z.boolean().default(false),
});

const householdChangeSchema = z.object({
  changeType: z.enum(['member_added', 'member_removed', 'member_moved_out', 'baby_born', 'marriage', 'divorce']),
  memberName: z.string().min(1, "Member name is required"),
  relationship: z.string().optional(),
  dateOfChange: z.string().min(1, "Date of change is required"),
  explanation: z.string().min(10, "Please explain the change"),
});

const workStatusSchema = z.object({
  currentStatus: z.enum(['employed', 'unemployed', 'seeking_work', 'unable_to_work', 'exempt']),
  hoursPerWeek: z.coerce.number().min(0).optional(),
  exemptionReason: z.string().optional(),
  workSearchActivities: z.string().optional(),
  documentationType: z.string().optional(),
});

const redeterminationSchema = z.object({
  confirmHousehold: z.boolean(),
  confirmIncome: z.boolean(),
  confirmDeductions: z.boolean(),
  confirmResources: z.boolean(),
  additionalNotes: z.string().optional(),
});

type IncomeChangeForm = z.infer<typeof incomeChangeSchema>;
type HouseholdChangeForm = z.infer<typeof householdChangeSchema>;
type WorkStatusForm = z.infer<typeof workStatusSchema>;
type RedeterminationForm = z.infer<typeof redeterminationSchema>;

interface StepProgress {
  income: number;
  household: number;
  work: number;
  redetermination: number;
}

export default function ClientVerificationPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("income");
  const [stepProgress, setStepProgress] = useState<StepProgress>({
    income: 0,
    household: 0,
    work: 0,
    redetermination: 0
  });

  const incomeForm = useForm<IncomeChangeForm>({
    resolver: zodResolver(incomeChangeSchema),
    defaultValues: {
      changeType: 'new_job',
      newIncome: 0,
      effectiveDate: '',
      explanation: '',
      hasDocumentation: false,
    },
  });

  const householdForm = useForm<HouseholdChangeForm>({
    resolver: zodResolver(householdChangeSchema),
    defaultValues: {
      changeType: 'member_added',
      memberName: '',
      dateOfChange: '',
      explanation: '',
    },
  });

  const workStatusForm = useForm<WorkStatusForm>({
    resolver: zodResolver(workStatusSchema),
    defaultValues: {
      currentStatus: 'employed',
      hoursPerWeek: 0,
    },
  });

  const redeterminationForm = useForm<RedeterminationForm>({
    resolver: zodResolver(redeterminationSchema),
    defaultValues: {
      confirmHousehold: false,
      confirmIncome: false,
      confirmDeductions: false,
      confirmResources: false,
    },
  });

  const submitChangeMutation = useMutation({
    mutationFn: async (data: { type: string; payload: any }) => {
      return await apiRequest("POST", "/api/client/report-change", data);
    },
    onSuccess: () => {
      toast({
        title: "Change Reported Successfully",
        description: "Your caseworker will review this change and contact you if additional information is needed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Submitting Change",
        description: error.message || "Please try again or contact your caseworker.",
        variant: "destructive",
      });
    },
  });

  const onSubmitIncomeChange = (data: IncomeChangeForm) => {
    submitChangeMutation.mutate({ type: 'income_change', payload: data });
    setStepProgress(prev => ({ ...prev, income: 100 }));
  };

  const onSubmitHouseholdChange = (data: HouseholdChangeForm) => {
    submitChangeMutation.mutate({ type: 'household_change', payload: data });
    setStepProgress(prev => ({ ...prev, household: 100 }));
  };

  const onSubmitWorkStatus = (data: WorkStatusForm) => {
    submitChangeMutation.mutate({ type: 'work_status', payload: data });
    setStepProgress(prev => ({ ...prev, work: 100 }));
  };

  const onSubmitRedetermination = (data: RedeterminationForm) => {
    submitChangeMutation.mutate({ type: 'redetermination', payload: data });
    setStepProgress(prev => ({ ...prev, redetermination: 100 }));
  };

  return (
    <>
      <Helmet>
        <title>Report Changes - Benefits Portal</title>
      </Helmet>
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" data-testid="page-title">
            Report Changes to Your Benefits
          </h1>
          <p className="text-muted-foreground mt-2">
            It's important to report changes within 10 days. This helps ensure you receive the correct benefit amount.
          </p>
        </div>

        <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertTitle>Your Information is Protected</AlertTitle>
          <AlertDescription>
            All information you provide is secure and will only be used to process your benefits.
            Per HIPAA and Privacy Act guidelines, your data is protected.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 w-full mb-6">
                <TabsTrigger value="income" className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Income</span>
                </TabsTrigger>
                <TabsTrigger value="household" className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Household</span>
                </TabsTrigger>
                <TabsTrigger value="work" className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Work Status</span>
                </TabsTrigger>
                <TabsTrigger value="redetermination" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Renewal</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="income">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Report an Income Change
                    </CardTitle>
                    <CardDescription>
                      New job, job loss, hours changed, or new income source
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...incomeForm}>
                      <form onSubmit={incomeForm.handleSubmit(onSubmitIncomeChange)} className="space-y-6">
                        <FormField
                          control={incomeForm.control}
                          name="changeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>What type of income change?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-income-change-type">
                                    <SelectValue placeholder="Select change type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="new_job">I started a new job</SelectItem>
                                  <SelectItem value="job_loss">I lost my job</SelectItem>
                                  <SelectItem value="hours_changed">My hours changed</SelectItem>
                                  <SelectItem value="new_income_source">I have a new income source</SelectItem>
                                  <SelectItem value="income_stopped">An income source stopped</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={incomeForm.control}
                          name="employerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employer Name (if applicable)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., ABC Company" {...field} data-testid="input-employer-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={incomeForm.control}
                            name="previousIncome"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Previous Monthly Income</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" placeholder="0" {...field} data-testid="input-previous-income" />
                                </FormControl>
                                <FormDescription>Before the change</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={incomeForm.control}
                            name="newIncome"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Monthly Income</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" placeholder="0" {...field} data-testid="input-new-income" />
                                </FormControl>
                                <FormDescription>After the change</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={incomeForm.control}
                          name="effectiveDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>When did this change happen?</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-effective-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={incomeForm.control}
                          name="explanation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Please explain the change</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Tell us more about this income change..."
                                  className="min-h-[100px]"
                                  {...field}
                                  data-testid="textarea-explanation"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Alert>
                          <Upload className="h-4 w-4" />
                          <AlertTitle>Documentation Needed</AlertTitle>
                          <AlertDescription>
                            You may need to provide pay stubs, a letter from your employer, or other proof of income.
                            Your caseworker will contact you if additional documents are needed.
                          </AlertDescription>
                        </Alert>

                        <Button type="submit" className="w-full" disabled={submitChangeMutation.isPending} data-testid="button-submit-income">
                          {submitChangeMutation.isPending ? "Submitting..." : "Submit Income Change"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="household">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Report a Household Change
                    </CardTitle>
                    <CardDescription>
                      Someone moved in, moved out, baby born, marriage, or divorce
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...householdForm}>
                      <form onSubmit={householdForm.handleSubmit(onSubmitHouseholdChange)} className="space-y-6">
                        <FormField
                          control={householdForm.control}
                          name="changeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>What type of household change?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-household-change-type">
                                    <SelectValue placeholder="Select change type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="member_added">Someone moved in</SelectItem>
                                  <SelectItem value="member_removed">Someone moved out</SelectItem>
                                  <SelectItem value="baby_born">A baby was born</SelectItem>
                                  <SelectItem value="marriage">I got married</SelectItem>
                                  <SelectItem value="divorce">I got divorced</SelectItem>
                                  <SelectItem value="member_moved_out">A member moved to their own household</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={householdForm.control}
                          name="memberName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name of the person</FormLabel>
                              <FormControl>
                                <Input placeholder="Full name" {...field} data-testid="input-member-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={householdForm.control}
                          name="relationship"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Relationship to you</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-relationship">
                                    <SelectValue placeholder="Select relationship" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="spouse">Spouse</SelectItem>
                                  <SelectItem value="child">Child</SelectItem>
                                  <SelectItem value="parent">Parent</SelectItem>
                                  <SelectItem value="sibling">Sibling</SelectItem>
                                  <SelectItem value="grandparent">Grandparent</SelectItem>
                                  <SelectItem value="grandchild">Grandchild</SelectItem>
                                  <SelectItem value="other_relative">Other Relative</SelectItem>
                                  <SelectItem value="non_relative">Non-Relative</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={householdForm.control}
                          name="dateOfChange"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>When did this change happen?</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-date-of-change" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={householdForm.control}
                          name="explanation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Please explain the change</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Tell us more about this household change..."
                                  className="min-h-[100px]"
                                  {...field}
                                  data-testid="textarea-household-explanation"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button type="submit" className="w-full" disabled={submitChangeMutation.isPending} data-testid="button-submit-household">
                          {submitChangeMutation.isPending ? "Submitting..." : "Submit Household Change"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="work">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-purple-600" />
                      Report Your Work Status
                    </CardTitle>
                    <CardDescription>
                      Employment status, work hours, or exemptions from work requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...workStatusForm}>
                      <form onSubmit={workStatusForm.handleSubmit(onSubmitWorkStatus)} className="space-y-6">
                        <FormField
                          control={workStatusForm.control}
                          name="currentStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>What is your current work status?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-2"
                                  data-testid="radio-work-status"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="employed" id="employed" />
                                    <label htmlFor="employed">I am working</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="unemployed" id="unemployed" />
                                    <label htmlFor="unemployed">I am not working but looking for work</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="seeking_work" id="seeking_work" />
                                    <label htmlFor="seeking_work">I am participating in job training/education</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="unable_to_work" id="unable_to_work" />
                                    <label htmlFor="unable_to_work">I am unable to work (medical/disability)</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="exempt" id="exempt" />
                                    <label htmlFor="exempt">I am exempt from work requirements</label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={workStatusForm.control}
                          name="hoursPerWeek"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hours worked per week (if employed)</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="168" {...field} data-testid="input-hours-per-week" />
                              </FormControl>
                              <FormDescription>
                                ABAWD work requirement is 80 hours per month (approximately 20 hours per week)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={workStatusForm.control}
                          name="workSearchActivities"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job search activities (if applicable)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Describe your job search activities: applications submitted, interviews, etc."
                                  {...field}
                                  data-testid="textarea-work-search"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Alert className="bg-amber-50 dark:bg-amber-950/30">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle>Work Requirements</AlertTitle>
                          <AlertDescription>
                            Able-bodied adults without dependents (ABAWD) must work or participate in approved activities 
                            for at least 80 hours per month to continue receiving SNAP benefits beyond 3 months.
                          </AlertDescription>
                        </Alert>

                        <Button type="submit" className="w-full" disabled={submitChangeMutation.isPending} data-testid="button-submit-work">
                          {submitChangeMutation.isPending ? "Submitting..." : "Submit Work Status"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="redetermination">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-orange-600" />
                      Complete Your Renewal
                    </CardTitle>
                    <CardDescription>
                      Confirm your information is still correct for your benefits renewal
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-6">
                      <Clock className="h-4 w-4" />
                      <AlertTitle>Renewal Deadline</AlertTitle>
                      <AlertDescription>
                        Complete your renewal before your certification period ends to avoid a gap in benefits.
                        Check your notice for your specific deadline.
                      </AlertDescription>
                    </Alert>

                    <Form {...redeterminationForm}>
                      <form onSubmit={redeterminationForm.handleSubmit(onSubmitRedetermination)} className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="font-medium">Please confirm each section is accurate:</h3>
                          
                          <FormField
                            control={redeterminationForm.control}
                            name="confirmHousehold"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 rounded-lg border p-4">
                                <FormControl>
                                  <input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange}
                                    className="h-5 w-5"
                                    data-testid="checkbox-confirm-household"
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-base font-medium">Household Members</FormLabel>
                                  <FormDescription>
                                    I confirm all household members listed are correct, and no one has moved in or out.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={redeterminationForm.control}
                            name="confirmIncome"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 rounded-lg border p-4">
                                <FormControl>
                                  <input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange}
                                    className="h-5 w-5"
                                    data-testid="checkbox-confirm-income"
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-base font-medium">Income Information</FormLabel>
                                  <FormDescription>
                                    I confirm all income sources are accurate and unchanged since my last report.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={redeterminationForm.control}
                            name="confirmDeductions"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 rounded-lg border p-4">
                                <FormControl>
                                  <input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange}
                                    className="h-5 w-5"
                                    data-testid="checkbox-confirm-deductions"
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-base font-medium">Shelter and Utility Costs</FormLabel>
                                  <FormDescription>
                                    I confirm my rent/mortgage and utility costs are accurate.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={redeterminationForm.control}
                            name="confirmResources"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 rounded-lg border p-4">
                                <FormControl>
                                  <input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange}
                                    className="h-5 w-5"
                                    data-testid="checkbox-confirm-resources"
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-base font-medium">Resources and Assets</FormLabel>
                                  <FormDescription>
                                    I confirm my bank accounts and other resources are accurately reported.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={redeterminationForm.control}
                          name="additionalNotes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Additional Notes (optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Any additional information you'd like to share..."
                                  {...field}
                                  data-testid="textarea-additional-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button type="submit" className="w-full" disabled={submitChangeMutation.isPending} data-testid="button-submit-renewal">
                          {submitChangeMutation.isPending ? "Submitting..." : "Submit Renewal Confirmation"}
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="tel:1-800-332-6347">
                    <Phone className="mr-2 h-4 w-4" />
                    1-800-332-6347
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/chat">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Chat with Us
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/faq">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    FAQs
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Important Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span>Report changes within 10 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span>Complete renewal before certification ends</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span>Submit documents within 30 days of request</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Your Progress</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Income</span>
                    <Badge variant={stepProgress.income === 100 ? "default" : "secondary"}>
                      {stepProgress.income === 100 ? "Complete" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Household</span>
                    <Badge variant={stepProgress.household === 100 ? "default" : "secondary"}>
                      {stepProgress.household === 100 ? "Complete" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Work Status</span>
                    <Badge variant={stepProgress.work === 100 ? "default" : "secondary"}>
                      {stepProgress.work === 100 ? "Complete" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Renewal</span>
                    <Badge variant={stepProgress.redetermination === 100 ? "default" : "secondary"}>
                      {stepProgress.redetermination === 100 ? "Complete" : "Pending"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
