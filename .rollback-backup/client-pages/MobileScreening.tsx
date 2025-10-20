/**
 * Mobile-Optimized Screening Page
 * Secure, privacy-focused benefit screening accessed via SMS link
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight,
  ChevronLeft,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  Save,
  Loader2,
  Smartphone,
  Languages,
} from "lucide-react";
import MarylandLogo from "@/components/MarylandLogo";

// Screening form schema
const screeningSchema = z.object({
  // Basic Information (Step 1)
  zipCode: z.string().regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code"),
  language: z.enum(["en", "es"]).default("en"),
  
  // Household (Step 2)
  householdSize: z.number().min(1).max(20),
  hasChildren: z.enum(["yes", "no"]),
  hasElderlyOrDisabled: z.enum(["yes", "no"]),
  
  // Income (Step 3)
  monthlyIncome: z.number().min(0),
  employmentStatus: z.enum(["employed", "unemployed", "retired", "disabled", "student"]),
  
  // Resources (Step 4)
  hasSavingsOver2750: z.enum(["yes", "no"]),
  ownsVehicle: z.enum(["yes", "no"]),
  ownsHome: z.enum(["yes", "no"]),
  
  // Programs of Interest (Step 5)
  interestedPrograms: z.array(z.enum(["snap", "medicaid", "tanf", "wic", "energy", "childcare"])),
  
  // Contact Preferences (Step 6)
  preferredContactTime: z.enum(["morning", "afternoon", "evening", "anytime"]),
  canReceiveTexts: z.enum(["yes", "no"]),
});

type ScreeningFormData = z.infer<typeof screeningSchema>;

const TOTAL_STEPS = 6;
const AUTO_SAVE_DELAY = 3000; // 3 seconds

export default function MobileScreening() {
  const { token } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const form = useForm<ScreeningFormData>({
    resolver: zodResolver(screeningSchema),
    defaultValues: {
      zipCode: "",
      language: "en",
      householdSize: 1,
      hasChildren: "no",
      hasElderlyOrDisabled: "no",
      monthlyIncome: 0,
      employmentStatus: "unemployed",
      hasSavingsOver2750: "no",
      ownsVehicle: "no",
      ownsHome: "no",
      interestedPrograms: ["snap"],
      preferredContactTime: "anytime",
      canReceiveTexts: "yes",
    },
  });

  // Validate screening link
  const { data: linkData, isLoading: isValidating, error: validationError } = useQuery({
    queryKey: [`/api/sms/screening/validate/${token}`],
    enabled: !!token,
    retry: false,
  });

  // Auto-save progress
  const saveProgressMutation = useMutation({
    mutationFn: async (data: Partial<ScreeningFormData>) => {
      return apiRequest(`/api/sms/screening/progress/${token}`, {
        method: "POST",
        body: JSON.stringify({ screeningData: data }),
      });
    },
    onSuccess: () => {
      setIsAutoSaving(false);
      setLastSaved(new Date());
    },
    onError: () => {
      setIsAutoSaving(false);
    },
  });

  // Complete screening
  const completeScreeningMutation = useMutation({
    mutationFn: async (data: ScreeningFormData) => {
      return apiRequest("/api/sms/screening/complete", {
        method: "POST",
        body: JSON.stringify({ token, completionData: data }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Screening Complete!",
        description: "A navigator will contact you within 48 hours.",
      });
      setCurrentStep(TOTAL_STEPS + 1); // Show completion screen
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete screening. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-save on form changes
  useEffect(() => {
    const subscription = form.watch((data) => {
      setIsAutoSaving(true);
      const timer = setTimeout(() => {
        saveProgressMutation.mutate(data as Partial<ScreeningFormData>);
      }, AUTO_SAVE_DELAY);
      return () => clearTimeout(timer);
    });
    return () => subscription.unsubscribe();
  }, [form, saveProgressMutation]);

  // Load saved progress if available
  useEffect(() => {
    if (linkData?.link?.screeningData) {
      form.reset(linkData.link.screeningData);
    }
  }, [linkData, form]);

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: ScreeningFormData) => {
    if (currentStep < TOTAL_STEPS) {
      nextStep();
    } else {
      completeScreeningMutation.mutate(data);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Validating screening link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (validationError || !linkData?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-center text-red-700">Invalid or Expired Link</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {validationError?.message || linkData?.error || "This screening link is no longer valid."}
              </AlertDescription>
            </Alert>
            <p className="mt-4 text-center text-gray-600">
              Please text <strong>START</strong> to receive a new screening link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completion screen
  if (currentStep > TOTAL_STEPS) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-center text-2xl">Thank You!</CardTitle>
            <CardDescription className="text-center text-lg">
              Your screening is complete
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">What happens next?</h3>
              <ul className="space-y-2 text-green-700">
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <span>A benefits navigator will contact you within 48 hours</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <span>They'll help you apply for eligible programs</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <span>All services are free and confidential</span>
                </li>
              </ul>
            </div>
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                You can text <strong>STATUS</strong> anytime to check on your application
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <MarylandLogo className="h-8" />
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Secure & Private
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-md mx-auto px-4 py-3 bg-white/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Step {currentStep} of {TOTAL_STEPS}</span>
          {isAutoSaving && (
            <span className="text-xs text-gray-500 flex items-center">
              <Save className="h-3 w-3 mr-1 animate-pulse" />
              Saving...
            </span>
          )}
          {!isAutoSaving && lastSaved && (
            <span className="text-xs text-gray-500">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Progress value={(currentStep / TOTAL_STEPS) * 100} className="h-2" />
      </div>

      {/* Main content */}
      <div className="max-w-md mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {currentStep === 1 && "Let's Get Started"}
                      {currentStep === 2 && "About Your Household"}
                      {currentStep === 3 && "Income Information"}
                      {currentStep === 4 && "Resources & Assets"}
                      {currentStep === 5 && "Programs You're Interested In"}
                      {currentStep === 6 && "Contact Preferences"}
                    </CardTitle>
                    <CardDescription>
                      {currentStep === 1 && "Basic information to check your eligibility"}
                      {currentStep === 2 && "Tell us who lives with you"}
                      {currentStep === 3 && "Your household's monthly income"}
                      {currentStep === 4 && "Resources that may affect eligibility"}
                      {currentStep === 5 && "Select all programs you want to learn about"}
                      {currentStep === 6 && "How should we contact you?"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Step 1: Basic Info */}
                    {currentStep === 1 && (
                      <>
                        <FormField
                          control={form.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP Code</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="tel"
                                  inputMode="numeric"
                                  pattern="[0-9]{5}"
                                  placeholder="21201"
                                  className="text-lg h-12"
                                  data-testid="input-zipcode"
                                />
                              </FormControl>
                              <FormDescription>
                                Your Maryland ZIP code
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="language"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <Languages className="h-4 w-4 inline mr-2" />
                                Preferred Language
                              </FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="en" />
                                    <span className="text-lg">English</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="es" />
                                    <span className="text-lg">Español</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Step 2: Household */}
                    {currentStep === 2 && (
                      <>
                        <FormField
                          control={form.control}
                          name="householdSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>How many people live in your household?</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  inputMode="numeric"
                                  min="1"
                                  max="20"
                                  className="text-lg h-12"
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-household-size"
                                />
                              </FormControl>
                              <FormDescription>
                                Include yourself and everyone who lives with you
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="hasChildren"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Are there children under 18 in your household?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="yes" />
                                    <span className="text-lg">Yes</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="no" />
                                    <span className="text-lg">No</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="hasElderlyOrDisabled"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Is anyone elderly (60+) or disabled?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="yes" />
                                    <span className="text-lg">Yes</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="no" />
                                    <span className="text-lg">No</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Step 3: Income */}
                    {currentStep === 3 && (
                      <>
                        <FormField
                          control={form.control}
                          name="monthlyIncome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total monthly household income (before taxes)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-500">$</span>
                                  <Input
                                    {...field}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    className="text-lg h-12 pl-8"
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    placeholder="0"
                                    data-testid="input-monthly-income"
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>
                                Include wages, self-employment, social security, etc.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="employmentStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employment status</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  {[
                                    { value: "employed", label: "Employed" },
                                    { value: "unemployed", label: "Unemployed" },
                                    { value: "retired", label: "Retired" },
                                    { value: "disabled", label: "Disabled" },
                                    { value: "student", label: "Student" },
                                  ].map((option) => (
                                    <label key={option.value} className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                      <RadioGroupItem value={option.value} />
                                      <span className="text-lg">{option.label}</span>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Step 4: Resources */}
                    {currentStep === 4 && (
                      <>
                        <FormField
                          control={form.control}
                          name="hasSavingsOver2750"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Do you have more than $2,750 in savings/bank accounts?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="yes" />
                                    <span className="text-lg">Yes</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="no" />
                                    <span className="text-lg">No</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ownsVehicle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Do you own a vehicle?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="yes" />
                                    <span className="text-lg">Yes</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="no" />
                                    <span className="text-lg">No</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ownsHome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Do you own your home?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="yes" />
                                    <span className="text-lg">Yes</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="no" />
                                    <span className="text-lg">No</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Step 5: Programs */}
                    {currentStep === 5 && (
                      <FormField
                        control={form.control}
                        name="interestedPrograms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Which programs are you interested in?</FormLabel>
                            <FormDescription>Select all that apply</FormDescription>
                            <div className="space-y-3">
                              {[
                                { value: "snap", label: "SNAP (Food Assistance)", icon: "🍎" },
                                { value: "medicaid", label: "Medicaid (Health Insurance)", icon: "🏥" },
                                { value: "tanf", label: "TANF (Cash Assistance)", icon: "💵" },
                                { value: "wic", label: "WIC (Women, Infants & Children)", icon: "👶" },
                                { value: "energy", label: "Energy Assistance", icon: "⚡" },
                                { value: "childcare", label: "Child Care Assistance", icon: "🏫" },
                              ].map((program) => (
                                <label
                                  key={program.value}
                                  className={`flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 ${
                                    field.value?.includes(program.value as any) ? "bg-blue-50 border-blue-500" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded text-blue-600"
                                    checked={field.value?.includes(program.value as any)}
                                    onChange={(e) => {
                                      const updatedValue = e.target.checked
                                        ? [...(field.value || []), program.value]
                                        : field.value?.filter((v) => v !== program.value) || [];
                                      field.onChange(updatedValue);
                                    }}
                                  />
                                  <span className="text-2xl">{program.icon}</span>
                                  <span className="text-lg flex-1">{program.label}</span>
                                </label>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Step 6: Contact */}
                    {currentStep === 6 && (
                      <>
                        <FormField
                          control={form.control}
                          name="preferredContactTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Best time to contact you?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  {[
                                    { value: "morning", label: "Morning (8am - 12pm)" },
                                    { value: "afternoon", label: "Afternoon (12pm - 5pm)" },
                                    { value: "evening", label: "Evening (5pm - 8pm)" },
                                    { value: "anytime", label: "Anytime" },
                                  ].map((time) => (
                                    <label key={time.value} className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                      <RadioGroupItem value={time.value} />
                                      <span className="text-lg">{time.label}</span>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="canReceiveTexts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Can we send you text updates?</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="yes" />
                                    <span className="text-lg">Yes, text me updates</span>
                                  </label>
                                  <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                                    <RadioGroupItem value="no" />
                                    <span className="text-lg">No, call only</span>
                                  </label>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </CardContent>

                  <CardFooter className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={previousStep}
                      disabled={currentStep === 1}
                      className="h-12 px-6"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="h-12 px-6"
                      disabled={completeScreeningMutation.isPending}
                      data-testid="button-continue"
                    >
                      {completeScreeningMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : currentStep === TOTAL_STEPS ? (
                        <>
                          Complete
                          <CheckCircle2 className="h-4 w-4 ml-2" />
                        </>
                      ) : (
                        <>
                          Continue
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatePresence>
          </form>
        </Form>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto px-4 py-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Your Privacy is Protected</AlertTitle>
          <AlertDescription>
            We never share your personal information without your consent.
            This screening is completely confidential.
          </AlertDescription>
        </Alert>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Questions? Text HELP or call 1-800-XXX-XXXX</p>
          <p className="mt-2">
            <Clock className="h-3 w-3 inline mr-1" />
            This link expires in 24 hours
          </p>
        </div>
      </div>
    </div>
  );
}