import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Users, 
  DollarSign, 
  Calculator, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  Info,
  Briefcase,
  PiggyBank,
  Home,
  TrendingUp,
  Heart,
  Dice3,
  FileSpreadsheet,
  HelpCircle,
  GraduationCap,
  Baby,
  Lightbulb,
  FileHeart,
  Receipt,
  Shield,
  Import
} from "lucide-react";
import type { VitaIntakeSession, InsertVitaIntakeSession } from "@shared/schema";

// Step configuration
const STEPS = [
  {
    number: 1,
    title: "Personal Information",
    description: "Basic taxpayer and spouse information",
    icon: FileText,
  },
  {
    number: 2,
    title: "Household & Dependents",
    description: "Marital status and dependent information",
    icon: Users,
  },
  {
    number: 3,
    title: "Income",
    description: "All sources of income",
    icon: DollarSign,
  },
  {
    number: 4,
    title: "Deductions & Credits",
    description: "Tax deductions and credits",
    icon: Calculator,
  },
  {
    number: 5,
    title: "Review & Consent",
    description: "Review information and sign",
    icon: CheckCircle2,
  },
];

// Helper function to mask SSN
const maskSSN = (ssn: string | null | undefined): string => {
  if (!ssn) return "";
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return ssn;
  return `***-**-${digits.slice(-4)}`;
};

// Helper function to mask account number
const maskAccountNumber = (accountNum: string | null | undefined): string => {
  if (!accountNum) return "";
  const digits = accountNum.replace(/\D/g, "");
  if (digits.length < 4) return accountNum;
  return `****${digits.slice(-4)}`;
};

// Mapping function to convert household profile to VITA intake data
const mapHouseholdProfileToVitaIntake = (profile: any): Partial<VitaIntakeFormData> => {
  // Determine marital status from filing status
  let maritalStatus: "single" | "married" | "divorced" | "widowed" | "legally_separated" | undefined;
  if (profile.filingStatus === "single") {
    maritalStatus = "single";
  } else if (profile.filingStatus === "married_joint" || profile.filingStatus === "married_separate") {
    maritalStatus = "married";
  } else if (profile.filingStatus === "head_of_household") {
    maritalStatus = "single"; // Head of household is typically single with dependents
  }

  // Map dependents with field name conversions
  const mappedDependents = (profile.dependents || []).map((dep: any) => ({
    firstName: dep.name?.split(' ')[0] || dep.name || "",
    lastName: dep.name?.split(' ').slice(1).join(' ') || "",
    dateOfBirth: dep.dateOfBirth || "",
    relationship: dep.relationship || "",
    monthsInHome: 12,
    singleOrMarried: "single" as const,
    residentOfNorthAmerica: true,
    usCitizen: true,
    fullTimeStudent: false,
    totallyPermanentlyDisabled: dep.disabled || false,
    issuedIPPIN: false,
    qualifyingChildOfAnotherPerson: false,
    providedOwnSupport: false,
    hadLessThan5200Income: true,
    taxpayerProvidedSupport: true,
    taxpayerPaidHomeExpenses: false,
  }));

  return {
    currentStep: 1,
    status: "in_progress",
    householdProfileId: profile.id,
    
    // Primary taxpayer info
    primaryFirstName: profile.taxpayerFirstName || "",
    primaryLastName: profile.taxpayerLastName || "",
    primarySSN: profile.taxpayerSSN || "",
    primaryDateOfBirth: profile.taxpayerDateOfBirth || "",
    primaryLegallyBlind: profile.taxpayerBlind || false,
    primaryTotallyPermanentlyDisabled: profile.taxpayerDisabled || false,
    
    // Spouse info
    hasSpouse: !!(profile.spouseFirstName || profile.spouseLastName || profile.spouseSSN),
    spouseFirstName: profile.spouseFirstName || "",
    spouseLastName: profile.spouseLastName || "",
    spouseSSN: profile.spouseSSN || "",
    spouseDateOfBirth: profile.spouseDateOfBirth || "",
    spouseLegallyBlind: profile.spouseBlind || false,
    spouseTotallyPermanentlyDisabled: profile.spouseDisabled || false,
    
    // Address
    mailingAddress: profile.streetAddress || "",
    aptNumber: profile.aptNumber || "",
    city: profile.city || "",
    zipCode: profile.zipCode || "",
    state: profile.stateCode || "MD",
    
    // Marital status
    maritalStatusDec31: maritalStatus,
    marriedOnLastDay: maritalStatus === "married" ? true : undefined,
    
    // Dependents
    dependents: mappedDependents,
    
    // Income indicators (set booleans based on amounts > 0)
    hasW2Income: (profile.employmentIncome || 0) > 0,
    hasSelfEmploymentIncome: (profile.selfEmploymentIncome || 0) > 0,
    hasInterestIncome: (profile.unearnedIncome || 0) > 0,
    
    // Expense indicators
    hasMedicalExpenses: (profile.medicalExpenses || 0) > 0,
    hasChildcareExpenses: (profile.childcareExpenses || 0) > 0,
    hasMortgageInterest: (profile.rentOrMortgage || 0) > 0,
    
    // Tax payments
    hasEstimatedTaxPayments: (profile.estimatedTaxPayments || 0) > 0,
  };
};

// Form schema with step-based validation
const vitaIntakeFormSchema = z.object({
  // Session metadata
  currentStep: z.number().min(1).max(5).default(1),
  status: z.enum(["in_progress", "review_needed", "completed", "filed"]).default("in_progress"),
  householdProfileId: z.string().optional(),
  
  // Step 1: Personal Information
  // Primary taxpayer
  primaryFirstName: z.string().min(1, "First name is required"),
  primaryMiddleInitial: z.string().max(1).optional(),
  primaryLastName: z.string().min(1, "Last name is required"),
  primaryDateOfBirth: z.string().min(1, "Date of birth is required"),
  primaryJobTitle: z.string().optional(),
  primaryTelephone: z.string()
    .min(1, "Phone number is required")
    .regex(/^\d{3}-\d{3}-\d{4}$/, "Phone must be in format XXX-XXX-XXXX"),
  primarySSN: z.string()
    .min(1, "SSN is required")
    .regex(/^\d{3}-\d{2}-\d{4}$/, "SSN must be in format XXX-XX-XXXX"),
  
  // Spouse (conditional based on hasSpouse)
  hasSpouse: z.boolean().default(false),
  spouseFirstName: z.string().optional(),
  spouseMiddleInitial: z.string().max(1).optional(),
  spouseLastName: z.string().optional(),
  spouseDateOfBirth: z.string().optional(),
  spouseJobTitle: z.string().optional(),
  spouseTelephone: z.string().optional(),
  spouseSSN: z.string().optional(),
  
  // Address
  mailingAddress: z.string().min(1, "Mailing address is required"),
  aptNumber: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().default("MD"),
  zipCode: z.string()
    .min(1, "ZIP code is required")
    .regex(/^\d{5}(-\d{4})?$/, "ZIP code must be XXXXX or XXXXX-XXXX"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  
  // Multi-state presence
  livedOrWorkedInMultipleStates: z.boolean().default(false),
  
  // Status flags - Primary
  canAnyoneClaimYou: z.boolean().default(false),
  primaryLegallyBlind: z.boolean().default(false),
  primaryUSCitizen: z.boolean().default(true),
  primaryOnVisa: z.boolean().default(false),
  primaryFullTimeStudent: z.boolean().default(false),
  primaryTotallyPermanentlyDisabled: z.boolean().default(false),
  primaryIssuedIPPIN: z.boolean().default(false),
  primaryOwnerDigitalAssets: z.boolean().default(false),
  
  // Status flags - Spouse
  spouseLegallyBlind: z.boolean().default(false),
  spouseUSCitizen: z.boolean().default(true),
  spouseOnVisa: z.boolean().default(false),
  spouseFullTimeStudent: z.boolean().default(false),
  spouseTotallyPermanentlyDisabled: z.boolean().default(false),
  spouseIssuedIPPIN: z.boolean().default(false),
  spouseOwnerDigitalAssets: z.boolean().default(false),
  
  // Refund preferences
  refundMethod: z.enum(["direct_deposit", "check", "apply_to_next_year"]).optional(),
  bankAccountNumber: z.string().optional(),
  bankRoutingNumber: z.string()
    .optional()
    .refine((val) => !val || /^\d{9}$/.test(val), "Routing number must be 9 digits"),
  
  // IRS preferences
  preferredIRSLanguage: z.string().optional(),
  
  // Presidential Campaign Fund
  primaryPresidentialCampaignFund: z.boolean().default(false),
  spousePresidentialCampaignFund: z.boolean().default(false),
  
  // Step 2: Household & Dependents
  maritalStatusDec31: z.enum(["single", "married", "divorced", "widowed", "legally_separated"]).optional(),
  marriedOnLastDay: z.boolean().optional(),
  livedApartLast6Months: z.boolean().default(false),
  separationDate: z.string().optional(),
  divorceDate: z.string().optional(),
  dependents: z.array(
    z.object({
      firstName: z.string().min(1, "First name required"),
      lastName: z.string().min(1, "Last name required"),
      dateOfBirth: z.string().min(1, "Date of birth required"),
      relationship: z.string().min(1, "Relationship required"),
      monthsInHome: z.coerce.number().min(0).max(12),
      singleOrMarried: z.enum(["single", "married"]).default("single"),
      residentOfNorthAmerica: z.boolean().default(true),
      usCitizen: z.boolean().default(true),
      fullTimeStudent: z.boolean().default(false),
      totallyPermanentlyDisabled: z.boolean().default(false),
      issuedIPPIN: z.boolean().default(false),
      qualifyingChildOfAnotherPerson: z.boolean().default(false),
      providedOwnSupport: z.boolean().default(false),
      hadLessThan5200Income: z.boolean().default(true),
      taxpayerProvidedSupport: z.boolean().default(true),
      taxpayerPaidHomeExpenses: z.boolean().default(false),
    })
  ).default([]),
  
  // Step 3: Income - All Form 13614-C income sources
  // Employment income
  hasW2Income: z.boolean().default(false),
  w2JobCount: z.coerce.number().min(0).optional(),
  hasTips: z.boolean().default(false),
  
  // Retirement & benefits
  hasRetirementIncome: z.boolean().default(false),
  hasQualifiedCharitableDistribution: z.boolean().default(false),
  qcdAmount: z.coerce.number().min(0).optional(),
  hasDisabilityIncome: z.boolean().default(false),
  hasSocialSecurityIncome: z.boolean().default(false),
  hasUnemploymentIncome: z.boolean().default(false),
  
  // State/local refund
  hasStateLocalRefund: z.boolean().default(false),
  stateLocalRefundAmount: z.coerce.number().min(0).optional(),
  itemizedLastYear: z.boolean().default(false),
  
  // Investment income
  hasInterestIncome: z.boolean().default(false),
  hasDividendIncome: z.boolean().default(false),
  hasCapitalGains: z.boolean().default(false),
  reportedLossLastYear: z.boolean().default(false),
  hasCapitalLossCarryover: z.boolean().default(false),
  
  // Alimony
  hasAlimonyIncome: z.boolean().default(false),
  alimonyAmount: z.coerce.number().min(0).optional(),
  
  // Rental income
  hasRentalIncome: z.boolean().default(false),
  rentedDwellingAsResidence: z.boolean().default(false),
  rentedFewerThan15Days: z.boolean().default(false),
  rentalExpenseAmount: z.coerce.number().min(0).optional(),
  hasPersonalPropertyRental: z.boolean().default(false),
  
  // Gambling
  hasGamblingIncome: z.boolean().default(false),
  
  // Self-employment
  hasSelfEmploymentIncome: z.boolean().default(false),
  reportedSelfEmploymentLossLastYear: z.boolean().default(false),
  scheduleCExpenses: z.coerce.number().min(0).optional(),
  
  // Other income
  hasOtherIncome: z.boolean().default(false),
  otherIncomeDescription: z.string().optional(),
  
  // Step 4: Deductions & Credits - All Form 13614-C fields
  // Education
  hasStudentLoanInterest: z.boolean().default(false),
  hasTuitionExpenses: z.boolean().default(false),
  
  // Childcare & dependents
  hasChildcareExpenses: z.boolean().default(false),
  hasAdoptionExpenses: z.boolean().default(false),
  
  // Energy
  hasEnergyImprovements: z.boolean().default(false),
  
  // Health insurance
  hasHealthCoverage: z.boolean().default(false),
  purchasedMarketplaceInsurance: z.boolean().default(false),
  hasForm1095A: z.boolean().default(false),
  
  // Charitable
  hasCharitableContributions: z.boolean().default(false),
  
  // Homeownership
  hasMortgageInterest: z.boolean().default(false),
  soldHome: z.boolean().default(false),
  
  // Medical
  hasMedicalExpenses: z.boolean().default(false),
  
  // Tax payments
  hasEstimatedTaxPayments: z.boolean().default(false),
  
  // Retirement
  hasRetirementContributions: z.boolean().default(false),
  
  // Life events & special situations
  receivedAdvancedChildTaxCredit: z.boolean().default(false),
  receivedEconomicImpactPayment: z.boolean().default(false),
  hadDebtForgiven: z.boolean().default(false),
  receivedStateLocalStimulus: z.boolean().default(false),
  receivedDisasterRelief: z.boolean().default(false),
  
  // Step 5: Review & Consent
  globalCarryForwardConsent: z.boolean().default(false),
  primaryTaxpayerSignature: z.string().optional(),
  primaryCertifyAccurate: z.boolean().default(false),
  spouseTaxpayerSignature: z.string().optional(),
  spouseCertifyAccurate: z.boolean().default(false),
  
  // Metadata
  additionalNotes: z.string().optional(),
});

type VitaIntakeFormData = z.infer<typeof vitaIntakeFormSchema>;

export default function VitaIntake() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showPrimarySSN, setShowPrimarySSN] = useState(false);
  const [showSpouseSSN, setShowSpouseSSN] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatusSelection, setReviewStatusSelection] = useState<"approved" | "needs_correction" | "">("");

  // Fetch all sessions for the current user
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<VitaIntakeSession[]>({
    queryKey: ["/api/vita-intake"],
  });

  // Fetch household profiles for import
  const { data: householdProfiles = [], isLoading: profilesLoading } = useQuery<any[]>({
    queryKey: ["/api/household-profiles"],
  });

  // Fetch selected session
  const { data: selectedSession } = useQuery<VitaIntakeSession>({
    queryKey: ["/api/vita-intake", selectedSessionId],
    enabled: !!selectedSessionId,
  });

  // Form setup
  const form = useForm<VitaIntakeFormData>({
    resolver: zodResolver(vitaIntakeFormSchema),
    defaultValues: {
      currentStep: 1,
      status: "in_progress",
      // Step 1 fields
      primaryFirstName: "",
      primaryMiddleInitial: "",
      primaryLastName: "",
      primaryDateOfBirth: "",
      primaryJobTitle: "",
      primaryTelephone: "",
      primarySSN: "",
      hasSpouse: false,
      spouseFirstName: "",
      spouseMiddleInitial: "",
      spouseLastName: "",
      spouseDateOfBirth: "",
      spouseJobTitle: "",
      spouseTelephone: "",
      spouseSSN: "",
      mailingAddress: "",
      aptNumber: "",
      city: "",
      state: "MD",
      zipCode: "",
      email: "",
      livedOrWorkedInMultipleStates: false,
      canAnyoneClaimYou: false,
      primaryLegallyBlind: false,
      primaryUSCitizen: true,
      primaryOnVisa: false,
      primaryFullTimeStudent: false,
      primaryTotallyPermanentlyDisabled: false,
      primaryIssuedIPPIN: false,
      primaryOwnerDigitalAssets: false,
      spouseLegallyBlind: false,
      spouseUSCitizen: true,
      spouseOnVisa: false,
      spouseFullTimeStudent: false,
      spouseTotallyPermanentlyDisabled: false,
      spouseIssuedIPPIN: false,
      spouseOwnerDigitalAssets: false,
      refundMethod: undefined,
      bankAccountNumber: "",
      bankRoutingNumber: "",
      preferredIRSLanguage: "",
      primaryPresidentialCampaignFund: false,
      spousePresidentialCampaignFund: false,
      // Step 2: Marital status and dependents
      maritalStatusDec31: undefined,
      marriedOnLastDay: undefined,
      livedApartLast6Months: false,
      separationDate: "",
      divorceDate: "",
      dependents: [],
      // Step 3: Income - All sources
      hasW2Income: false,
      w2JobCount: 0,
      hasTips: false,
      hasRetirementIncome: false,
      hasQualifiedCharitableDistribution: false,
      qcdAmount: 0,
      hasDisabilityIncome: false,
      hasSocialSecurityIncome: false,
      hasUnemploymentIncome: false,
      hasStateLocalRefund: false,
      stateLocalRefundAmount: 0,
      itemizedLastYear: false,
      hasInterestIncome: false,
      hasDividendIncome: false,
      hasCapitalGains: false,
      reportedLossLastYear: false,
      hasCapitalLossCarryover: false,
      hasAlimonyIncome: false,
      alimonyAmount: 0,
      hasRentalIncome: false,
      rentedDwellingAsResidence: false,
      rentedFewerThan15Days: false,
      rentalExpenseAmount: 0,
      hasPersonalPropertyRental: false,
      hasGamblingIncome: false,
      hasSelfEmploymentIncome: false,
      reportedSelfEmploymentLossLastYear: false,
      scheduleCExpenses: 0,
      hasOtherIncome: false,
      otherIncomeDescription: "",
      // Step 4: Deductions & Credits
      hasStudentLoanInterest: false,
      hasTuitionExpenses: false,
      hasChildcareExpenses: false,
      hasAdoptionExpenses: false,
      hasEnergyImprovements: false,
      hasHealthCoverage: false,
      purchasedMarketplaceInsurance: false,
      hasForm1095A: false,
      hasCharitableContributions: false,
      hasMortgageInterest: false,
      soldHome: false,
      hasMedicalExpenses: false,
      hasEstimatedTaxPayments: false,
      hasRetirementContributions: false,
      receivedAdvancedChildTaxCredit: false,
      receivedEconomicImpactPayment: false,
      hadDebtForgiven: false,
      receivedStateLocalStimulus: false,
      receivedDisasterRelief: false,
      // Step 5
      globalCarryForwardConsent: false,
      primaryTaxpayerSignature: "",
      primaryCertifyAccurate: false,
      spouseTaxpayerSignature: "",
      spouseCertifyAccurate: false,
    },
  });

  // Watch for progressive disclosure
  const hasSpouse = form.watch("hasSpouse");
  const refundMethod = form.watch("refundMethod");
  const maritalStatusDec31 = form.watch("maritalStatusDec31");
  const dependents = form.watch("dependents");
  
  // Step 5: Watch for signature validation
  const primaryTaxpayerSignature = form.watch("primaryTaxpayerSignature");
  const primaryCertifyAccurate = form.watch("primaryCertifyAccurate");
  const spouseTaxpayerSignature = form.watch("spouseTaxpayerSignature");
  const spouseCertifyAccurate = form.watch("spouseCertifyAccurate");
  
  // Step 3: Income watch hooks
  const hasW2Income = form.watch("hasW2Income");
  const hasRetirementIncome = form.watch("hasRetirementIncome");
  const hasQualifiedCharitableDistribution = form.watch("hasQualifiedCharitableDistribution");
  const hasStateLocalRefund = form.watch("hasStateLocalRefund");
  const hasCapitalGains = form.watch("hasCapitalGains");
  const hasAlimonyIncome = form.watch("hasAlimonyIncome");
  const hasRentalIncome = form.watch("hasRentalIncome");
  const rentedDwellingAsResidence = form.watch("rentedDwellingAsResidence");
  const hasSelfEmploymentIncome = form.watch("hasSelfEmploymentIncome");
  const hasOtherIncome = form.watch("hasOtherIncome");
  
  // Step 4: Deductions watch hooks
  const purchasedMarketplaceInsurance = form.watch("purchasedMarketplaceInsurance");

  // Update form when session is selected
  useEffect(() => {
    if (selectedSession) {
      setCurrentStep(selectedSession.currentStep || 1);
      const hasSpouse = !!(selectedSession.spouseFirstName || selectedSession.spouseLastName || selectedSession.spouseSSN);
      form.reset({
        currentStep: selectedSession.currentStep || 1,
        status: selectedSession.status as any,
        householdProfileId: selectedSession.householdProfileId || undefined,
        // Step 1: Personal Information
        primaryFirstName: selectedSession.primaryFirstName || "",
        primaryMiddleInitial: selectedSession.primaryMiddleInitial || "",
        primaryLastName: selectedSession.primaryLastName || "",
        primaryDateOfBirth: selectedSession.primaryDateOfBirth || "",
        primaryJobTitle: selectedSession.primaryJobTitle || "",
        primaryTelephone: selectedSession.primaryTelephone || "",
        primarySSN: selectedSession.primarySSN || "",
        hasSpouse,
        spouseFirstName: selectedSession.spouseFirstName || "",
        spouseMiddleInitial: selectedSession.spouseMiddleInitial || "",
        spouseLastName: selectedSession.spouseLastName || "",
        spouseDateOfBirth: selectedSession.spouseDateOfBirth || "",
        spouseJobTitle: selectedSession.spouseJobTitle || "",
        spouseTelephone: selectedSession.spouseTelephone || "",
        spouseSSN: selectedSession.spouseSSN || "",
        mailingAddress: selectedSession.mailingAddress || "",
        aptNumber: selectedSession.aptNumber || "",
        city: selectedSession.city || "",
        state: selectedSession.state || "MD",
        zipCode: selectedSession.zipCode || "",
        email: selectedSession.email || "",
        livedOrWorkedInMultipleStates: selectedSession.livedOrWorkedInMultipleStates || false,
        canAnyoneClaimYou: selectedSession.canAnyoneClaimYou || false,
        primaryLegallyBlind: selectedSession.primaryLegallyBlind || false,
        primaryUSCitizen: selectedSession.primaryUSCitizen !== false,
        primaryOnVisa: selectedSession.primaryOnVisa || false,
        primaryFullTimeStudent: selectedSession.primaryFullTimeStudent || false,
        primaryTotallyPermanentlyDisabled: selectedSession.primaryTotallyPermanentlyDisabled || false,
        primaryIssuedIPPIN: selectedSession.primaryIssuedIPPIN || false,
        primaryOwnerDigitalAssets: selectedSession.primaryOwnerDigitalAssets || false,
        spouseLegallyBlind: selectedSession.spouseLegallyBlind || false,
        spouseUSCitizen: selectedSession.spouseUSCitizen !== false,
        spouseOnVisa: selectedSession.spouseOnVisa || false,
        spouseFullTimeStudent: selectedSession.spouseFullTimeStudent || false,
        spouseTotallyPermanentlyDisabled: selectedSession.spouseTotallyPermanentlyDisabled || false,
        spouseIssuedIPPIN: selectedSession.spouseIssuedIPPIN || false,
        spouseOwnerDigitalAssets: selectedSession.spouseOwnerDigitalAssets || false,
        refundMethod: selectedSession.refundMethod as any || undefined,
        bankAccountNumber: selectedSession.bankAccountNumber || "",
        bankRoutingNumber: selectedSession.bankRoutingNumber || "",
        preferredIRSLanguage: selectedSession.preferredIRSLanguage || "",
        primaryPresidentialCampaignFund: selectedSession.primaryPresidentialCampaignFund || false,
        spousePresidentialCampaignFund: selectedSession.spousePresidentialCampaignFund || false,
        // Step 2: Marital status and dependents
        maritalStatusDec31: selectedSession.maritalStatusDec31 as any || undefined,
        marriedOnLastDay: selectedSession.marriedOnLastDay || undefined,
        livedApartLast6Months: selectedSession.livedApartLast6Months || false,
        separationDate: selectedSession.separationDate || "",
        divorceDate: selectedSession.divorceDate || "",
        dependents: (selectedSession.dependents as any[]) || [],
        // Step 3: Income - All sources
        hasW2Income: selectedSession.hasW2Income || false,
        w2JobCount: selectedSession.w2JobCount || 0,
        hasTips: selectedSession.hasTips || false,
        hasRetirementIncome: selectedSession.hasRetirementIncome || false,
        hasQualifiedCharitableDistribution: selectedSession.hasQualifiedCharitableDistribution || false,
        qcdAmount: selectedSession.qcdAmount || 0,
        hasDisabilityIncome: selectedSession.hasDisabilityIncome || false,
        hasSocialSecurityIncome: selectedSession.hasSocialSecurityIncome || false,
        hasUnemploymentIncome: selectedSession.hasUnemploymentIncome || false,
        hasStateLocalRefund: selectedSession.hasStateLocalRefund || false,
        stateLocalRefundAmount: selectedSession.stateLocalRefundAmount || 0,
        itemizedLastYear: selectedSession.itemizedLastYear || false,
        hasInterestIncome: selectedSession.hasInterestIncome || false,
        hasDividendIncome: selectedSession.hasDividendIncome || false,
        hasCapitalGains: selectedSession.hasCapitalGains || false,
        reportedLossLastYear: selectedSession.reportedLossLastYear || false,
        hasCapitalLossCarryover: selectedSession.hasCapitalLossCarryover || false,
        hasAlimonyIncome: selectedSession.hasAlimonyIncome || false,
        alimonyAmount: selectedSession.alimonyAmount || 0,
        hasRentalIncome: selectedSession.hasRentalIncome || false,
        rentedDwellingAsResidence: selectedSession.rentedDwellingAsResidence || false,
        rentedFewerThan15Days: selectedSession.rentedFewerThan15Days || false,
        rentalExpenseAmount: selectedSession.rentalExpenseAmount || 0,
        hasPersonalPropertyRental: selectedSession.hasPersonalPropertyRental || false,
        hasGamblingIncome: selectedSession.hasGamblingIncome || false,
        hasSelfEmploymentIncome: selectedSession.hasSelfEmploymentIncome || false,
        reportedSelfEmploymentLossLastYear: selectedSession.reportedSelfEmploymentLossLastYear || false,
        scheduleCExpenses: selectedSession.scheduleCExpenses || 0,
        hasOtherIncome: selectedSession.hasOtherIncome || false,
        otherIncomeDescription: selectedSession.otherIncomeDescription || "",
        // Step 4: Deductions & Credits
        hasStudentLoanInterest: selectedSession.hasStudentLoanInterest || false,
        hasTuitionExpenses: selectedSession.hasTuitionExpenses || false,
        hasChildcareExpenses: selectedSession.hasChildcareExpenses || false,
        hasAdoptionExpenses: selectedSession.hasAdoptionExpenses || false,
        hasEnergyImprovements: selectedSession.hasEnergyImprovements || false,
        hasHealthCoverage: selectedSession.hasHealthCoverage || false,
        purchasedMarketplaceInsurance: selectedSession.purchasedMarketplaceInsurance || false,
        hasForm1095A: selectedSession.hasForm1095A || false,
        hasCharitableContributions: selectedSession.hasCharitableContributions || false,
        hasMortgageInterest: selectedSession.hasMortgageInterest || false,
        soldHome: selectedSession.soldHome || false,
        hasMedicalExpenses: selectedSession.hasMedicalExpenses || false,
        hasEstimatedTaxPayments: selectedSession.hasEstimatedTaxPayments || false,
        hasRetirementContributions: selectedSession.hasRetirementContributions || false,
        receivedAdvancedChildTaxCredit: selectedSession.receivedAdvancedChildTaxCredit || false,
        receivedEconomicImpactPayment: selectedSession.receivedEconomicImpactPayment || false,
        hadDebtForgiven: selectedSession.hadDebtForgiven || false,
        receivedStateLocalStimulus: selectedSession.receivedStateLocalStimulus || false,
        receivedDisasterRelief: selectedSession.receivedDisasterRelief || false,
        // Step 5
        globalCarryForwardConsent: selectedSession.globalCarryForwardConsent || false,
        primaryTaxpayerSignature: selectedSession.primaryTaxpayerSignature || "",
        primaryCertifyAccurate: !!selectedSession.primaryTaxpayerSignature,
        spouseTaxpayerSignature: selectedSession.spouseTaxpayerSignature || "",
        spouseCertifyAccurate: !!selectedSession.spouseTaxpayerSignature,
        additionalNotes: selectedSession.additionalNotes || undefined,
      });
    }
  }, [selectedSession, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<InsertVitaIntakeSession>) => {
      return await apiRequest("/api/vita-intake", "POST", {
        ...data,
        userId: user?.id,
      }) as unknown as VitaIntakeSession;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake"] });
      toast({
        title: "Session Created",
        description: "Your VITA intake session has been started.",
      });
      setSelectedSessionId(data.id);
    },
  });

  // Update mutation with auto-save
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertVitaIntakeSession> }) => {
      return await apiRequest(`/api/vita-intake/${id}`, "PATCH", data) as unknown as VitaIntakeSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/vita-intake/${id}`, "DELETE") as unknown as void;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake"] });
      toast({
        title: "Session Deleted",
        description: "The intake session has been deleted.",
      });
      setSelectedSessionId(null);
      setCurrentStep(1);
      form.reset();
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, reviewStatus, reviewNotes, certificationLevel }: { 
      id: string; 
      reviewStatus: string; 
      reviewNotes: string;
      certificationLevel: string;
    }) => {
      return await apiRequest(`/api/vita-intake/${id}`, "PATCH", {
        reviewStatus,
        reviewNotes,
        certificationLevel,
      }) as unknown as VitaIntakeSession;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake", selectedSessionId] });
      
      if (variables.reviewStatus === "approved") {
        toast({
          title: "Intake Approved",
          description: "Intake approved and ready for tax preparation.",
        });
      } else if (variables.reviewStatus === "needs_correction") {
        toast({
          title: "Corrections Requested",
          description: "Corrections requested. Taxpayer will be notified.",
        });
      }
      
      setReviewMode(false);
      setReviewNotes("");
      setReviewStatusSelection("");
    },
  });

  // Helper function: Detect required certification level
  const detectCertificationLevel = (formData: VitaIntakeFormData): { 
    level: "basic" | "advanced" | "military"; 
    reasons: string[];
  } => {
    const reasons: string[] = [];
    
    // Check for Military certification requirements
    // Note: Military-specific fields would need to be added to the form schema
    // For now, we'll focus on Basic vs Advanced
    
    // Check for Advanced certification requirements
    if (formData.hasSelfEmploymentIncome) {
      reasons.push("Self-employment income (Schedule C)");
      return { level: "advanced", reasons };
    }
    
    if (formData.hasRentalIncome) {
      reasons.push("Rental income");
      return { level: "advanced", reasons };
    }
    
    if (formData.hasCapitalGains) {
      reasons.push("Capital gains");
      return { level: "advanced", reasons };
    }
    
    if (formData.hasTuitionExpenses || formData.hasStudentLoanInterest) {
      reasons.push("Education credits (tuition, student loan interest)");
      return { level: "advanced", reasons };
    }
    
    if (formData.hasRetirementContributions) {
      reasons.push("Retirement contributions");
      return { level: "advanced", reasons };
    }
    
    // Basic certification is sufficient for all other cases
    return { level: "basic", reasons: [] };
  };

  // Helper function: Check completeness
  const checkCompleteness = (formData: VitaIntakeFormData) => {
    const checks = {
      personalInfo: false,
      income: false,
      dependents: true, // Optional
      signatures: false,
      documents: true, // Assuming documents are optional for now
    };
    
    // Check personal info
    checks.personalInfo = !!(
      formData.primaryFirstName &&
      formData.primaryLastName &&
      formData.primaryDateOfBirth &&
      formData.primaryTelephone &&
      formData.primarySSN &&
      formData.mailingAddress &&
      formData.city &&
      formData.zipCode
    );
    
    // Check if spouse info is complete (if has spouse)
    if (formData.hasSpouse || formData.maritalStatusDec31 === "married") {
      checks.personalInfo = checks.personalInfo && !!(
        formData.spouseFirstName &&
        formData.spouseLastName &&
        formData.spouseDateOfBirth &&
        formData.spouseSSN
      );
    }
    
    // Check income sources documented
    const hasAnyIncome = formData.hasW2Income || 
                         formData.hasRetirementIncome || 
                         formData.hasSocialSecurityIncome || 
                         formData.hasUnemploymentIncome || 
                         formData.hasInterestIncome || 
                         formData.hasDividendIncome ||
                         formData.hasSelfEmploymentIncome ||
                         formData.hasRentalIncome ||
                         formData.hasCapitalGains;
    checks.income = hasAnyIncome;
    
    // Check dependents (only if they exist)
    if (formData.dependents && formData.dependents.length > 0) {
      checks.dependents = formData.dependents.every(dep => 
        dep.firstName && 
        dep.lastName && 
        dep.dateOfBirth && 
        dep.relationship
      );
    }
    
    // Check signatures
    checks.signatures = !!(formData.primaryTaxpayerSignature && formData.primaryCertifyAccurate);
    if (formData.hasSpouse || formData.maritalStatusDec31 === "married") {
      checks.signatures = checks.signatures && !!(formData.spouseTaxpayerSignature && formData.spouseCertifyAccurate);
    }
    
    return checks;
  };

  // Auto-save when step changes
  const handleStepChange = (newStep: number) => {
    if (selectedSessionId) {
      const formData = form.getValues();
      updateMutation.mutate({
        id: selectedSessionId,
        data: {
          ...formData,
          currentStep: newStep,
        },
      });
    }
    setCurrentStep(newStep);
  };

  // Save and exit
  const handleSaveAndExit = () => {
    if (selectedSessionId) {
      const formData = form.getValues();
      updateMutation.mutate({
        id: selectedSessionId,
        data: {
          ...formData,
          currentStep,
        },
      });
    }
    toast({
      title: "Progress Saved",
      description: "You can continue this session later.",
    });
  };

  // Start new session
  const handleStartNew = () => {
    setSelectedSessionId(null);
    setCurrentStep(1);
    form.reset();
  };

  // Import from household profile
  const handleImportProfile = (profileId: string) => {
    const profile = householdProfiles.find((p: any) => p.id === profileId);
    if (!profile) return;

    const mappedData = mapHouseholdProfileToVitaIntake(profile);
    
    // Merge with default values to ensure all required fields are present
    const completeData = {
      ...form.formState.defaultValues,
      ...mappedData,
    };
    
    form.reset(completeData);
    setCurrentStep(1);
    setImportDialogOpen(false);
    
    toast({
      title: "Profile imported successfully",
      description: `Data from "${profile.name}" has been imported. Review and update information as needed.`,
    });
  };

  // Navigate steps
  const handlePrevious = () => {
    if (currentStep > 1) {
      handleStepChange(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      handleStepChange(currentStep + 1);
    }
  };

  // Submit current step (create session if new)
  const onSubmit = (data: VitaIntakeFormData) => {
    // Prepare submission data
    const submissionData: any = {
      ...data,
      currentStep,
    };
    
    // If completing Step 5, set status and timestamps
    if (currentStep === 5) {
      submissionData.status = 'review_needed';
      submissionData.completedAt = new Date().toISOString();
      
      // Set signature timestamps
      if (data.primaryTaxpayerSignature) {
        submissionData.primaryTaxpayerSignedAt = new Date().toISOString();
      }
      if (data.spouseTaxpayerSignature) {
        submissionData.spouseTaxpayerSignedAt = new Date().toISOString();
      }
    }
    
    if (!selectedSessionId) {
      createMutation.mutate(submissionData);
    } else {
      updateMutation.mutate({
        id: selectedSessionId,
        data: submissionData,
      });
      
      // Show success message when completing
      if (currentStep === 5) {
        toast({
          title: "Intake Complete!",
          description: "A VITA volunteer will review your information.",
        });
      }
    }
  };

  // Dependent management functions
  const addDependent = () => {
    const currentDependents = form.getValues("dependents");
    form.setValue("dependents", [
      ...currentDependents,
      {
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        relationship: "",
        monthsInHome: 12,
        singleOrMarried: "single" as const,
        residentOfNorthAmerica: true,
        usCitizen: true,
        fullTimeStudent: false,
        totallyPermanentlyDisabled: false,
        issuedIPPIN: false,
        qualifyingChildOfAnotherPerson: false,
        providedOwnSupport: false,
        hadLessThan5200Income: true,
        taxpayerProvidedSupport: true,
        taxpayerPaidHomeExpenses: false,
      },
    ]);
  };

  const removeDependent = (index: number) => {
    const currentDependents = form.getValues("dependents");
    form.setValue("dependents", currentDependents.filter((_, i) => i !== index));
  };

  const progressPercentage = (currentStep / 5) * 100;
  const currentStepInfo = STEPS.find(s => s.number === currentStep);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> In Progress</Badge>;
      case "review_needed":
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Review Needed</Badge>;
      case "completed":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
      case "filed":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Filed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold" data-testid="page-title">
            VITA Tax Intake Assistant
          </h1>
          <p className="text-muted-foreground mt-2">
            Digital IRS Form 13614-C - Intake/Interview & Quality Review Sheet
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Session List Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Sessions</CardTitle>
              <CardDescription>Your saved intake sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleStartNew}
                className="w-full mb-2"
                variant="outline"
                data-testid="button-start-new"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start New Intake
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full mb-4">
                      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            className="w-full"
                            variant="outline"
                            disabled={householdProfiles.length === 0}
                            data-testid="button-import-profile"
                          >
                            <Import className="h-4 w-4 mr-2" />
                            Import from Household Profile
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-import-profile">
                          <DialogHeader>
                            <DialogTitle>Import Household Profile</DialogTitle>
                            <DialogDescription>
                              Select a household profile to pre-fill your VITA intake form. You can review and update the imported information.
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh] pr-4">
                            <div className="space-y-2">
                              {profilesLoading ? (
                                <p className="text-sm text-muted-foreground">Loading profiles...</p>
                              ) : householdProfiles.length === 0 ? (
                                <div className="text-center py-8">
                                  <p className="text-sm text-muted-foreground">No household profiles available</p>
                                  <p className="text-xs text-muted-foreground mt-1">Create a household profile first to use this feature</p>
                                </div>
                              ) : (
                                householdProfiles.map((profile: any) => (
                                  <Button
                                    key={profile.id}
                                    variant="outline"
                                    className="w-full justify-start text-left h-auto py-4"
                                    onClick={() => handleImportProfile(profile.id)}
                                    data-testid={`select-profile-${profile.id}`}
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="font-medium">{profile.name}</div>
                                        <Badge variant="secondary" className="capitalize">
                                          {profile.profileMode?.replace('_', ' ') || 'Combined'}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground space-y-1">
                                        {profile.taxpayerFirstName && profile.taxpayerLastName && (
                                          <div>Primary: {profile.taxpayerFirstName} {profile.taxpayerLastName}</div>
                                        )}
                                        {profile.spouseFirstName && profile.spouseLastName && (
                                          <div>Spouse: {profile.spouseFirstName} {profile.spouseLastName}</div>
                                        )}
                                        {profile.updatedAt && (
                                          <div>Last updated: {new Date(profile.updatedAt).toLocaleDateString()}</div>
                                        )}
                                      </div>
                                    </div>
                                  </Button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TooltipTrigger>
                  {householdProfiles.length === 0 && (
                    <TooltipContent>
                      <p>No profiles available</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {sessionsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sessions yet</p>
                  ) : (
                    sessions.map((session) => (
                      <Button
                        key={session.id}
                        variant={selectedSessionId === session.id ? "default" : "ghost"}
                        className="w-full justify-start flex-col items-start h-auto py-3"
                        onClick={() => setSelectedSessionId(session.id)}
                        data-testid={`session-item-${session.id}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <FileText className="h-4 w-4" />
                          <div className="flex-1 text-left truncate">
                            <div className="font-medium truncate">
                              {session.primaryFirstName && session.primaryLastName
                                ? `${session.primaryFirstName} ${session.primaryLastName}`
                                : "Unnamed Session"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 w-full">
                          <span className="text-xs text-muted-foreground">
                            Step {session.currentStep || 1} of 5
                          </span>
                          {getStatusBadge(session.status)}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Wizard */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {currentStepInfo && <currentStepInfo.icon className="h-5 w-5" />}
                    {currentStepInfo?.title}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    {currentStepInfo?.description}
                    {form.watch("householdProfileId") && (
                      <Badge variant="outline" className="ml-2 gap-1" data-testid="badge-imported-profile">
                        <FileText className="h-3 w-3" />
                        Imported from Profile
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium" data-testid="step-indicator">
                    Step {currentStep} of 5
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {progressPercentage.toFixed(0)}% Complete
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />

              {/* Step Pills */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {STEPS.map((step) => (
                  <button
                    key={step.number}
                    onClick={() => handleStepChange(step.number)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors ${
                      currentStep === step.number
                        ? "bg-primary text-primary-foreground"
                        : currentStep > step.number
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-pill-${step.number}`}
                  >
                    <step.icon className="h-3 w-3" />
                    {step.number}
                  </button>
                ))}
              </div>

              {/* Review Mode Toggle (only shown for review_needed status) */}
              {selectedSession?.status === "review_needed" && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant={reviewMode ? "secondary" : "outline"}
                    onClick={() => setReviewMode(!reviewMode)}
                    className="w-full"
                    data-testid="button-enter-review-mode"
                  >
                    {reviewMode ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Exit Review Mode
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Enter Review Mode
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>

            <Separator />

            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Step Content - Disabled when in review mode */}
                  <fieldset disabled={reviewMode} className="space-y-6">
                  <ScrollArea className="h-[600px] pr-4">
                    {currentStep === 1 && (
                      <div className="space-y-6">
                        {/* Primary Taxpayer Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Primary Taxpayer Information</CardTitle>
                            <CardDescription>Enter the primary taxpayer's personal details</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name="primaryFirstName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>First Name *</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-primary-first-name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="primaryMiddleInitial"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Middle Initial</FormLabel>
                                    <FormControl>
                                      <Input {...field} maxLength={1} data-testid="input-primary-middle-initial" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="primaryLastName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Last Name *</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-primary-last-name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="primaryDateOfBirth"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Date of Birth *</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} data-testid="input-primary-dob" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="primaryJobTitle"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Job Title/Occupation</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-primary-job-title" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="primaryTelephone"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Telephone *</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="XXX-XXX-XXXX" 
                                        data-testid="input-primary-telephone" 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="primarySSN"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Social Security Number *</FormLabel>
                                    <FormControl>
                                      <div className="flex gap-2">
                                        <Input 
                                          {...field} 
                                          type={showPrimarySSN ? "text" : "password"}
                                          placeholder="XXX-XX-XXXX" 
                                          data-testid="input-primary-ssn" 
                                          className="flex-1"
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          onClick={() => setShowPrimarySSN(!showPrimarySSN)}
                                          data-testid="button-toggle-primary-ssn"
                                        >
                                          {showPrimarySSN ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Spouse Section */}
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">Spouse Information</CardTitle>
                                <CardDescription>If filing jointly, enter spouse details</CardDescription>
                              </div>
                              <FormField
                                control={form.control}
                                name="hasSpouse"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        data-testid="switch-has-spouse"
                                      />
                                    </FormControl>
                                    <FormLabel className="!mt-0">Include Spouse</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </CardHeader>
                          {hasSpouse && (
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                  control={form.control}
                                  name="spouseFirstName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>First Name</FormLabel>
                                      <FormControl>
                                        <Input {...field} data-testid="input-spouse-first-name" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="spouseMiddleInitial"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Middle Initial</FormLabel>
                                      <FormControl>
                                        <Input {...field} maxLength={1} data-testid="input-spouse-middle-initial" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="spouseLastName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Last Name</FormLabel>
                                      <FormControl>
                                        <Input {...field} data-testid="input-spouse-last-name" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="spouseDateOfBirth"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Date of Birth</FormLabel>
                                      <FormControl>
                                        <Input type="date" {...field} data-testid="input-spouse-dob" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="spouseJobTitle"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Job Title/Occupation</FormLabel>
                                      <FormControl>
                                        <Input {...field} data-testid="input-spouse-job-title" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="spouseTelephone"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Telephone</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          placeholder="XXX-XXX-XXXX" 
                                          data-testid="input-spouse-telephone" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="spouseSSN"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Social Security Number</FormLabel>
                                      <FormControl>
                                        <div className="flex gap-2">
                                          <Input 
                                            {...field} 
                                            type={showSpouseSSN ? "text" : "password"}
                                            placeholder="XXX-XX-XXXX" 
                                            data-testid="input-spouse-ssn" 
                                            className="flex-1"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowSpouseSSN(!showSpouseSSN)}
                                            data-testid="button-toggle-spouse-ssn"
                                          >
                                            {showSpouseSSN ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </CardContent>
                          )}
                        </Card>

                        {/* Address Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Mailing Address</CardTitle>
                            <CardDescription>Where should we send correspondence?</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <FormField
                                control={form.control}
                                name="mailingAddress"
                                render={({ field }) => (
                                  <FormItem className="md:col-span-3">
                                    <FormLabel>Street Address *</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-mailing-address" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="aptNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Apt/Unit</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-apt-number" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>City *</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-city" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="state"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>State</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-state" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="zipCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ZIP Code *</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="XXXXX" data-testid="input-zip-code" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email (Optional)</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} data-testid="input-email" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="livedOrWorkedInMultipleStates"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="checkbox-multi-state"
                                    />
                                  </FormControl>
                                  <FormLabel className="!mt-0">
                                    Did you live or work in multiple states in 2024?
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Status Flags Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Status Information</CardTitle>
                            <CardDescription>Check all that apply to you{hasSpouse && " and your spouse"}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Primary Status Flags */}
                            <div>
                              <h4 className="font-medium mb-3">Primary Taxpayer</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="canAnyoneClaimYou"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-can-claim-primary"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">
                                        Can anyone claim you as a dependent?
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryLegallyBlind"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-blind"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">Legally blind</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryUSCitizen"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-us-citizen"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">U.S. Citizen</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryOnVisa"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-visa"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">On a visa</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryFullTimeStudent"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-student"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">Full-time student</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryTotallyPermanentlyDisabled"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-disabled"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">Totally and permanently disabled</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryIssuedIPPIN"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-ippin"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">Issued Identity Protection PIN (IPPIN)</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="primaryOwnerDigitalAssets"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-digital-assets"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">Owner of digital assets</FormLabel>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Spouse Status Flags */}
                            {hasSpouse && (
                              <div>
                                <Separator className="my-4" />
                                <h4 className="font-medium mb-3">Spouse</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name="spouseLegallyBlind"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-blind"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">Legally blind</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="spouseUSCitizen"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-us-citizen"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">U.S. Citizen</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="spouseOnVisa"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-visa"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">On a visa</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="spouseFullTimeStudent"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-student"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">Full-time student</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="spouseTotallyPermanentlyDisabled"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-disabled"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">Totally and permanently disabled</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="spouseIssuedIPPIN"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-ippin"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">Issued Identity Protection PIN (IPPIN)</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="spouseOwnerDigitalAssets"
                                    render={({ field }) => (
                                      <FormItem className="flex items-start gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-digital-assets"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">Owner of digital assets</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Refund Preferences Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Refund Preferences</CardTitle>
                            <CardDescription>How would you like to receive your refund?</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="refundMethod"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Refund Method</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      className="space-y-2"
                                      data-testid="radio-refund-method"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="direct_deposit" id="direct_deposit" data-testid="radio-direct-deposit" />
                                        <Label htmlFor="direct_deposit" className="font-normal cursor-pointer">
                                          Direct Deposit
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="check" id="check" data-testid="radio-check" />
                                        <Label htmlFor="check" className="font-normal cursor-pointer">
                                          Paper Check
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="apply_to_next_year" id="apply_to_next_year" data-testid="radio-apply-next-year" />
                                        <Label htmlFor="apply_to_next_year" className="font-normal cursor-pointer">
                                          Apply to Next Year's Taxes
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {refundMethod === "direct_deposit" && (
                              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                <p className="text-sm font-medium">Bank Account Information</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name="bankRoutingNumber"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Routing Number</FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            placeholder="9 digits" 
                                            maxLength={9}
                                            data-testid="input-routing-number" 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="bankAccountNumber"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Account Number</FormLabel>
                                        <FormControl>
                                          <div className="flex gap-2">
                                            <Input 
                                              {...field} 
                                              type={showAccountNumber ? "text" : "password"}
                                              data-testid="input-account-number" 
                                              className="flex-1"
                                            />
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              onClick={() => setShowAccountNumber(!showAccountNumber)}
                                              data-testid="button-toggle-account-number"
                                            >
                                              {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* IRS Preferences & Presidential Campaign Fund */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Additional Preferences</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="preferredIRSLanguage"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Preferred Language for IRS Communications</FormLabel>
                                  <FormControl>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger data-testid="select-irs-language">
                                        <SelectValue placeholder="Select language" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="english">English</SelectItem>
                                        <SelectItem value="spanish">Spanish</SelectItem>
                                        <SelectItem value="chinese">Chinese</SelectItem>
                                        <SelectItem value="korean">Korean</SelectItem>
                                        <SelectItem value="vietnamese">Vietnamese</SelectItem>
                                        <SelectItem value="russian">Russian</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div>
                              <Label className="text-base font-medium mb-3 block">Presidential Election Campaign Fund</Label>
                              <p className="text-sm text-muted-foreground mb-3">
                                Checking a box will not change your tax or reduce your refund
                              </p>
                              <div className="space-y-2">
                                <FormField
                                  control={form.control}
                                  name="primaryPresidentialCampaignFund"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="checkbox-primary-campaign-fund"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0 font-normal">
                                        Primary taxpayer: $3 to Presidential Election Campaign
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                                {hasSpouse && (
                                  <FormField
                                    control={form.control}
                                    name="spousePresidentialCampaignFund"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center gap-2">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="checkbox-spouse-campaign-fund"
                                          />
                                        </FormControl>
                                        <FormLabel className="!mt-0 font-normal">
                                          Spouse: $3 to Presidential Election Campaign
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div className="space-y-6">
                        {/* Marital Status Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Marital Status (as of December 31, 2024)</CardTitle>
                            <CardDescription>Select your marital status on the last day of the tax year</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <FormField
                              control={form.control}
                              name="maritalStatusDec31"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel data-testid="label-marital-status">Marital Status</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      className="flex flex-col space-y-2"
                                      data-testid="radio-marital-status"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="single" id="single" data-testid="radio-single" />
                                        <Label htmlFor="single" className="font-normal cursor-pointer">Single</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="married" id="married" data-testid="radio-married" />
                                        <Label htmlFor="married" className="font-normal cursor-pointer">Married</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="divorced" id="divorced" data-testid="radio-divorced" />
                                        <Label htmlFor="divorced" className="font-normal cursor-pointer">Divorced</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="widowed" id="widowed" data-testid="radio-widowed" />
                                        <Label htmlFor="widowed" className="font-normal cursor-pointer">Widowed</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="legally_separated" id="legally_separated" data-testid="radio-legally-separated" />
                                        <Label htmlFor="legally_separated" className="font-normal cursor-pointer">Legally Separated</Label>
                                      </div>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Progressive disclosure for Married */}
                            {maritalStatusDec31 === "married" && (
                              <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                                <FormField
                                  control={form.control}
                                  name="marriedOnLastDay"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0">
                                      <div className="space-y-0.5">
                                        <FormLabel data-testid="label-married-last-day">
                                          Were you married on the last day of the year?
                                        </FormLabel>
                                      </div>
                                      <FormControl>
                                        <RadioGroup
                                          onValueChange={(value) => field.onChange(value === "yes")}
                                          value={field.value === true ? "yes" : field.value === false ? "no" : undefined}
                                          className="flex gap-4"
                                          data-testid="radio-married-last-day"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="yes" id="married-yes" data-testid="radio-married-yes" />
                                            <Label htmlFor="married-yes" className="font-normal cursor-pointer">Yes</Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="no" id="married-no" data-testid="radio-married-no" />
                                            <Label htmlFor="married-no" className="font-normal cursor-pointer">No</Label>
                                          </div>
                                        </RadioGroup>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="livedApartLast6Months"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0">
                                      <div className="space-y-0.5">
                                        <FormLabel data-testid="label-lived-apart">
                                          Did you and your spouse live apart for the last 6 months of the year?
                                        </FormLabel>
                                        <FormDescription className="text-xs">
                                          This may affect your filing status eligibility
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-lived-apart"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            {/* Progressive disclosure for Legally Separated */}
                            {maritalStatusDec31 === "legally_separated" && (
                              <div className="pl-6 border-l-2 border-primary/20">
                                <FormField
                                  control={form.control}
                                  name="separationDate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-separation-date">
                                        Date of Separate Maintenance Decree
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="date"
                                          {...field}
                                          data-testid="input-separation-date"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            {/* Progressive disclosure for Divorced */}
                            {maritalStatusDec31 === "divorced" && (
                              <div className="pl-6 border-l-2 border-primary/20">
                                <FormField
                                  control={form.control}
                                  name="divorceDate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-divorce-date">
                                        Date of Final Divorce Decree
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="date"
                                          {...field}
                                          data-testid="input-divorce-date"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Dependents Section */}
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">Dependents</CardTitle>
                                <CardDescription>List all dependents and their qualifying information</CardDescription>
                              </div>
                              <Button
                                type="button"
                                onClick={addDependent}
                                variant="outline"
                                size="sm"
                                data-testid="button-add-dependent"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Dependent
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {dependents.length === 0 ? (
                              <div className="text-center py-12 border-2 border-dashed rounded-lg" data-testid="empty-dependents">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                                <p className="text-sm text-muted-foreground">
                                  No dependents added yet. Click "Add Dependent" to begin.
                                </p>
                              </div>
                            ) : (
                              <Accordion type="single" collapsible className="space-y-4">
                                {dependents.map((dependent, index) => (
                                  <AccordionItem
                                    key={index}
                                    value={`dependent-${index}`}
                                    className="border rounded-lg"
                                    data-testid={`card-dependent-${index}`}
                                  >
                                    <AccordionTrigger className="px-4 hover:no-underline" data-testid={`trigger-dependent-${index}`}>
                                      <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                                            {index + 1}
                                          </div>
                                          <div className="text-left">
                                            <p className="font-medium">
                                              {dependent.firstName && dependent.lastName
                                                ? `${dependent.firstName} ${dependent.lastName}`
                                                : "New Dependent"}
                                            </p>
                                            {dependent.relationship && (
                                              <p className="text-sm text-muted-foreground capitalize">
                                                {dependent.relationship}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="text-destructive hover:text-destructive"
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid={`button-delete-dependent-${index}`}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Remove Dependent?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Are you sure you want to remove this dependent? This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel data-testid={`button-cancel-delete-${index}`}>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => removeDependent(index)}
                                                className="bg-destructive hover:bg-destructive/90"
                                                data-testid={`button-confirm-delete-${index}`}
                                              >
                                                Remove
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                      <div className="space-y-6 pt-4">
                                        {/* Basic Information */}
                                        <div>
                                          <h4 className="font-semibold mb-3 text-sm">Basic Information</h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                              control={form.control}
                                              name={`dependents.${index}.firstName`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel data-testid={`label-first-name-${index}`}>First Name</FormLabel>
                                                  <FormControl>
                                                    <Input {...field} data-testid={`input-first-name-${index}`} />
                                                  </FormControl>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />

                                            <FormField
                                              control={form.control}
                                              name={`dependents.${index}.lastName`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel data-testid={`label-last-name-${index}`}>Last Name</FormLabel>
                                                  <FormControl>
                                                    <Input {...field} data-testid={`input-last-name-${index}`} />
                                                  </FormControl>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />

                                            <FormField
                                              control={form.control}
                                              name={`dependents.${index}.dateOfBirth`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel data-testid={`label-dob-${index}`}>Date of Birth</FormLabel>
                                                  <FormControl>
                                                    <Input type="date" {...field} data-testid={`input-dob-${index}`} />
                                                  </FormControl>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />

                                            <FormField
                                              control={form.control}
                                              name={`dependents.${index}.relationship`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel data-testid={`label-relationship-${index}`}>Relationship</FormLabel>
                                                  <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                      <SelectTrigger data-testid={`select-relationship-${index}`}>
                                                        <SelectValue placeholder="Select relationship" />
                                                      </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                      <SelectItem value="child" data-testid={`option-child-${index}`}>Child</SelectItem>
                                                      <SelectItem value="stepchild" data-testid={`option-stepchild-${index}`}>Stepchild</SelectItem>
                                                      <SelectItem value="grandchild" data-testid={`option-grandchild-${index}`}>Grandchild</SelectItem>
                                                      <SelectItem value="sibling" data-testid={`option-sibling-${index}`}>Sibling</SelectItem>
                                                      <SelectItem value="parent" data-testid={`option-parent-${index}`}>Parent</SelectItem>
                                                      <SelectItem value="grandparent" data-testid={`option-grandparent-${index}`}>Grandparent</SelectItem>
                                                      <SelectItem value="other" data-testid={`option-other-${index}`}>Other</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                          </div>
                                        </div>

                                        {/* Qualifying Criteria - 13 Fields */}
                                        <div>
                                          <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                                            Qualifying Criteria
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                          </h4>
                                          <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.monthsInHome`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel data-testid={`label-months-${index}`}>
                                                      Number of months lived in your home (2024)
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        max="12"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                        data-testid={`input-months-${index}`}
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.singleOrMarried`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel data-testid={`label-marital-${index}`}>
                                                      Single or Married as of 12/31/2024
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                      <FormControl>
                                                        <SelectTrigger data-testid={`select-marital-${index}`}>
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                        <SelectItem value="single" data-testid={`option-single-${index}`}>Single</SelectItem>
                                                        <SelectItem value="married" data-testid={`option-married-${index}`}>Married</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.residentOfNorthAmerica`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-resident-${index}`}>
                                                      Resident of U.S., Canada, or Mexico
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-resident-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.usCitizen`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-citizen-${index}`}>
                                                      U.S. Citizen
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-citizen-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.fullTimeStudent`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-student-${index}`}>
                                                      Full-time student
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-student-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.totallyPermanentlyDisabled`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-disabled-${index}`}>
                                                      Totally and permanently disabled
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-disabled-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.issuedIPPIN`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-ippin-${index}`}>
                                                      Issued IPPIN
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-ippin-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.qualifyingChildOfAnotherPerson`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-qualifying-other-${index}`}>
                                                      Qualifying child/relative of another person
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-qualifying-other-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.providedOwnSupport`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-own-support-${index}`}>
                                                      Provided more than 50% of own support
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-own-support-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.hadLessThan5200Income`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-income-${index}`}>
                                                      Had less than $5,200 of income
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-income-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.taxpayerProvidedSupport`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-taxpayer-support-${index}`}>
                                                      Taxpayer(s) provided &gt;50% support
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-taxpayer-support-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dependents.${index}.taxpayerPaidHomeExpenses`}
                                                render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                                    <FormLabel className="text-sm font-normal" data-testid={`label-home-expenses-${index}`}>
                                                      Taxpayer(s) paid &gt;50% home expenses
                                                    </FormLabel>
                                                    <FormControl>
                                                      <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        data-testid={`switch-home-expenses-${index}`}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div className="space-y-6">
                        {/* Employment Income */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Briefcase className="h-5 w-5" />
                              Employment Income
                            </CardTitle>
                            <CardDescription>Wages, salaries, and tips from employment</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasW2Income"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-w2-income">
                                    Did you have wages as a part-time or full-time employee?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-w2-income"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasW2Income && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="w2JobCount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-w2-job-count">How many jobs did you have?</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min="1" 
                                          placeholder="Number of W-2 jobs"
                                          {...field}
                                          data-testid="input-w2-job-count"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                            
                            <FormField
                              control={form.control}
                              name="hasTips"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-tips">
                                    Did you receive tips?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-tips"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Retirement & Pensions */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <PiggyBank className="h-5 w-5" />
                              Retirement & Pensions
                            </CardTitle>
                            <CardDescription>Retirement, pension, annuity, and disability income</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasRetirementIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-retirement">
                                    Did you receive retirement, pension, or annuity income?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-retirement"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasRetirementIncome && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="hasQualifiedCharitableDistribution"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                      <div>
                                        <FormLabel className="text-sm font-normal" data-testid="label-has-qcd">
                                          Did you make a Qualified Charitable Distribution (QCD) from your IRA?
                                        </FormLabel>
                                        <FormDescription className="text-xs">
                                          QCD is a tax-free distribution from your IRA to charity
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-has-qcd"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                {hasQualifiedCharitableDistribution && (
                                  <FormField
                                    control={form.control}
                                    name="qcdAmount"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel data-testid="label-qcd-amount">QCD Amount ($)</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0" 
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                            data-testid="input-qcd-amount"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            )}
                            
                            <FormField
                              control={form.control}
                              name="hasDisabilityIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-disability">
                                    Did you receive disability benefits?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-disability"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Government Benefits */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              Government Benefits
                            </CardTitle>
                            <CardDescription>Social Security, Railroad Retirement, and unemployment</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasSocialSecurityIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-social-security">
                                    Did you receive Social Security or Railroad Retirement benefits?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-social-security"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="hasUnemploymentIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-unemployment">
                                    Did you receive unemployment benefits?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-unemployment"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* State/Local Refund */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5" />
                              State/Local Refund
                            </CardTitle>
                            <CardDescription>State or local income tax refunds</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasStateLocalRefund"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-state-refund">
                                    Did you receive a refund of state or local income tax?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-state-refund"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasStateLocalRefund && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="stateLocalRefundAmount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-state-refund-amount">Refund amount ($)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          step="0.01"
                                          placeholder="0.00"
                                          {...field}
                                          data-testid="input-state-refund-amount"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="itemizedLastYear"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal" data-testid="label-itemized-last-year">
                                        Did you itemize deductions last year?
                                      </FormLabel>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-itemized-last-year"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Investment Income */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5" />
                              Investment Income
                            </CardTitle>
                            <CardDescription>Interest, dividends, and capital gains</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasInterestIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-interest">
                                    Did you earn interest or dividends (bank account, bonds, etc.)?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-interest"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="hasCapitalGains"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-capital-gains">
                                    Did you sell stocks, bonds, or real estate?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-capital-gains"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasCapitalGains && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="reportedLossLastYear"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal" data-testid="label-reported-loss">
                                        Did you report a capital loss on last year's return?
                                      </FormLabel>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-reported-loss"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="hasCapitalLossCarryover"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal" data-testid="label-has-carryover">
                                        Do you have a capital loss carryover?
                                      </FormLabel>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-has-carryover"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Alimony */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Heart className="h-5 w-5" />
                              Alimony
                            </CardTitle>
                            <CardDescription>Alimony received</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasAlimonyIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-alimony">
                                    Did you receive alimony?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-alimony"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasAlimonyIncome && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="alimonyAmount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-alimony-amount">Alimony amount ($)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          step="0.01"
                                          placeholder="0.00"
                                          {...field}
                                          data-testid="input-alimony-amount"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Rental Income */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Home className="h-5 w-5" />
                              Rental Income
                            </CardTitle>
                            <CardDescription>Income from renting property</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasRentalIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-rental">
                                    Did you have income from renting out your house or a room?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-rental"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasRentalIncome && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="rentedDwellingAsResidence"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal" data-testid="label-rental-residence">
                                        Did you use the dwelling unit as a personal residence?
                                      </FormLabel>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-rental-residence"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                {rentedDwellingAsResidence && (
                                  <FormField
                                    control={form.control}
                                    name="rentedFewerThan15Days"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                        <FormLabel className="text-sm font-normal" data-testid="label-rental-15-days">
                                          Did you rent it for fewer than 15 days?
                                        </FormLabel>
                                        <FormControl>
                                          <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="switch-rental-15-days"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                )}
                                
                                <FormField
                                  control={form.control}
                                  name="rentalExpenseAmount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-rental-expense">Rental expense amount ($)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          step="0.01"
                                          placeholder="0.00"
                                          {...field}
                                          data-testid="input-rental-expense"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                            
                            <FormField
                              control={form.control}
                              name="hasPersonalPropertyRental"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-property-rental">
                                    Did you have income from renting personal property (like a vehicle)?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-property-rental"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Gambling */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Dice3 className="h-5 w-5" />
                              Gambling
                            </CardTitle>
                            <CardDescription>Gambling winnings and lottery</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasGamblingIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-gambling">
                                    Did you have gambling winnings, including lottery?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-gambling"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Self-Employment */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileSpreadsheet className="h-5 w-5" />
                              Self-Employment (Schedule C)
                            </CardTitle>
                            <CardDescription>Contract work and self-employment income</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasSelfEmploymentIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-self-employment">
                                    Did you receive payments for contract or self-employment work?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-self-employment"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasSelfEmploymentIncome && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="reportedSelfEmploymentLossLastYear"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal" data-testid="label-self-employment-loss">
                                        Did you report a self-employment loss on last year's return?
                                      </FormLabel>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-self-employment-loss"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="scheduleCExpenses"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-schedule-c-expenses">Schedule C expenses ($)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          step="0.01"
                                          placeholder="0.00"
                                          {...field}
                                          data-testid="input-schedule-c-expenses"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Other Income */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <HelpCircle className="h-5 w-5" />
                              Other Income
                            </CardTitle>
                            <CardDescription>Any other money received during the year</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasOtherIncome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
                                  <FormLabel className="text-sm font-normal" data-testid="label-has-other-income">
                                    Did you have any other money received during the year?
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-other-income"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {hasOtherIncome && (
                              <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="otherIncomeDescription"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-other-income-description">Describe other income</FormLabel>
                                      <FormControl>
                                        <Textarea 
                                          placeholder="Please describe the type and source of other income..."
                                          className="min-h-[100px]"
                                          {...field}
                                          data-testid="input-other-income-description"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {currentStep === 4 && (
                      <div className="space-y-6">
                        {/* Education Expenses */}
                        <Card data-testid="card-education">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Education Expenses</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasStudentLoanInterest"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-student-loan">
                                      Did you pay student loan interest?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-student-loan"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="hasTuitionExpenses"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-tuition">
                                      Did you or your dependents have tuition expenses?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-tuition"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Childcare & Dependent Expenses */}
                        <Card data-testid="card-childcare">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Baby className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Childcare & Dependent Expenses</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasChildcareExpenses"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-childcare">
                                      Did you pay for childcare or dependent care?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-childcare"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="hasAdoptionExpenses"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-adoption">
                                      Did you have adoption expenses?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-adoption"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Energy Improvements */}
                        <Card data-testid="card-energy">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Energy Improvements</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="hasEnergyImprovements"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-energy">
                                      Did you make energy-efficient home improvements?
                                    </FormLabel>
                                    <FormDescription data-testid="desc-energy">
                                      Solar panels, heat pumps, insulation upgrades, etc.
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-energy"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Health Insurance */}
                        <Card data-testid="card-health-insurance">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Heart className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Health Insurance</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasHealthCoverage"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-health-coverage">
                                      Did you have health insurance coverage all year?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-health-coverage"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="purchasedMarketplaceInsurance"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-marketplace">
                                      Did you purchase insurance through the Health Insurance Marketplace?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-purchased-marketplace"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {purchasedMarketplaceInsurance && (
                              <div className="ml-4 border-l-2 border-primary/20 pl-4">
                                <FormField
                                  control={form.control}
                                  name="hasForm1095A"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-accent/50">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base" data-testid="label-form-1095a">
                                          Did you receive Form 1095-A?
                                        </FormLabel>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-has-form-1095a"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Charitable Contributions */}
                        <Card data-testid="card-charitable">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Heart className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Charitable Contributions</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="hasCharitableContributions"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-charitable">
                                      Did you make charitable contributions?
                                    </FormLabel>
                                    <FormDescription data-testid="desc-charitable">
                                      Cash or property donations to qualified organizations
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-charitable"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Homeownership */}
                        <Card data-testid="card-homeownership">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Home className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Homeownership</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="hasMortgageInterest"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-mortgage">
                                      Did you pay mortgage interest?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-mortgage"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="soldHome"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-sold-home">
                                      Did you sell your home?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-sold-home"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Medical Expenses */}
                        <Card data-testid="card-medical">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <FileHeart className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Medical Expenses</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="hasMedicalExpenses"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-medical">
                                      Did you have significant medical expenses?
                                    </FormLabel>
                                    <FormDescription data-testid="desc-medical">
                                      Medical, dental, or vision expenses not covered by insurance
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-medical"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Tax Payments */}
                        <Card data-testid="card-tax-payments">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Tax Payments</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="hasEstimatedTaxPayments"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-estimated-tax">
                                      Did you make estimated tax payments?
                                    </FormLabel>
                                    <FormDescription data-testid="desc-estimated-tax">
                                      Quarterly payments made to IRS or state throughout the year
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-estimated-tax"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Retirement Contributions */}
                        <Card data-testid="card-retirement">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <PiggyBank className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Retirement Contributions</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="hasRetirementContributions"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-retirement">
                                      Did you make contributions to a retirement account (IRA, 401k)?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-has-retirement"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Life Events & Special Situations */}
                        <Card data-testid="card-life-events">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Life Events & Special Situations</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="receivedAdvancedChildTaxCredit"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-child-tax-credit">
                                      Did you receive an advance Child Tax Credit payment?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-received-child-tax-credit"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="receivedEconomicImpactPayment"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-stimulus">
                                      Did you receive an Economic Impact Payment (stimulus check)?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-received-stimulus"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="hadDebtForgiven"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-debt-forgiven">
                                      Did you have debt forgiven?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-had-debt-forgiven"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="receivedStateLocalStimulus"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-state-stimulus">
                                      Did you receive state or local stimulus payments?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-received-state-stimulus"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="receivedDisasterRelief"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base" data-testid="label-disaster-relief">
                                      Did you receive disaster relief?
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-received-disaster-relief"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {currentStep === 5 && (
                      <div className="space-y-6">
                        {/* Information Review Summary */}
                        <Card data-testid="summary-personal">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Personal Information</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-muted-foreground">Primary Taxpayer</p>
                                <p className="font-medium" data-testid="review-primary-name">
                                  {form.getValues("primaryFirstName")} {form.getValues("primaryMiddleInitial") && `${form.getValues("primaryMiddleInitial")}.`} {form.getValues("primaryLastName")}
                                </p>
                                <p className="text-xs" data-testid="review-primary-dob">DOB: {form.getValues("primaryDateOfBirth")}</p>
                                <p className="text-xs" data-testid="review-primary-phone">Phone: {form.getValues("primaryTelephone")}</p>
                              </div>
                              {hasSpouse && form.getValues("spouseFirstName") && (
                                <div>
                                  <p className="text-muted-foreground">Spouse</p>
                                  <p className="font-medium" data-testid="review-spouse-name">
                                    {form.getValues("spouseFirstName")} {form.getValues("spouseMiddleInitial") && `${form.getValues("spouseMiddleInitial")}.`} {form.getValues("spouseLastName")}
                                  </p>
                                  <p className="text-xs" data-testid="review-spouse-dob">DOB: {form.getValues("spouseDateOfBirth")}</p>
                                  <p className="text-xs" data-testid="review-spouse-phone">Phone: {form.getValues("spouseTelephone")}</p>
                                </div>
                              )}
                            </div>
                            <Separator />
                            <div>
                              <p className="text-muted-foreground">Address</p>
                              <p className="font-medium" data-testid="review-address">
                                {form.getValues("mailingAddress")} {form.getValues("aptNumber") && `Apt ${form.getValues("aptNumber")}`}
                              </p>
                              <p className="text-xs" data-testid="review-city-state-zip">
                                {form.getValues("city")}, {form.getValues("state")} {form.getValues("zipCode")}
                              </p>
                            </div>
                            {form.getValues("refundMethod") && (
                              <>
                                <Separator />
                                <div>
                                  <p className="text-muted-foreground">Refund Method</p>
                                  <p className="font-medium capitalize" data-testid="review-refund-method">
                                    {form.getValues("refundMethod")?.replace(/_/g, ' ')}
                                  </p>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>

                        {/* Household Summary */}
                        <Card data-testid="summary-household">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Users className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Household</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            {form.getValues("maritalStatusDec31") && (
                              <div>
                                <p className="text-muted-foreground">Marital Status</p>
                                <p className="font-medium capitalize" data-testid="review-marital-status">
                                  {form.getValues("maritalStatusDec31")?.replace(/_/g, ' ')}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-muted-foreground">Dependents</p>
                              <p className="font-medium" data-testid="review-dependent-count">
                                {dependents.length} {dependents.length === 1 ? 'Dependent' : 'Dependents'}
                              </p>
                              {dependents.length > 0 && (
                                <ul className="mt-2 space-y-1 text-xs">
                                  {dependents.map((dep, idx) => (
                                    <li key={idx} className="flex items-center gap-2" data-testid={`review-dependent-${idx}`}>
                                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                                      <span>{dep.firstName} {dep.lastName} - {dep.relationship}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Income Summary */}
                        <Card data-testid="summary-income">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Income Sources</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            {form.getValues("hasW2Income") && (
                              <div className="flex items-center gap-2" data-testid="review-income-w2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>W-2 Income {form.getValues("w2JobCount") ? `(${form.getValues("w2JobCount")} jobs)` : ''}</span>
                              </div>
                            )}
                            {form.getValues("hasRetirementIncome") && (
                              <div className="flex items-center gap-2" data-testid="review-income-retirement">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Retirement Income</span>
                              </div>
                            )}
                            {form.getValues("hasSocialSecurityIncome") && (
                              <div className="flex items-center gap-2" data-testid="review-income-ssn">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Social Security Income</span>
                              </div>
                            )}
                            {form.getValues("hasInterestIncome") && (
                              <div className="flex items-center gap-2" data-testid="review-income-interest">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Interest Income</span>
                              </div>
                            )}
                            {form.getValues("hasDividendIncome") && (
                              <div className="flex items-center gap-2" data-testid="review-income-dividend">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Dividend Income</span>
                              </div>
                            )}
                            {form.getValues("hasRentalIncome") && (
                              <div className="flex items-center gap-2" data-testid="review-income-rental">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Rental Income</span>
                              </div>
                            )}
                            {form.getValues("hasSelfEmploymentIncome") && (
                              <div className="flex items-center gap-2" data-testid="review-income-self-employment">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Self-Employment Income</span>
                              </div>
                            )}
                            {!form.getValues("hasW2Income") && !form.getValues("hasRetirementIncome") && !form.getValues("hasSocialSecurityIncome") && 
                             !form.getValues("hasInterestIncome") && !form.getValues("hasDividendIncome") && !form.getValues("hasRentalIncome") && 
                             !form.getValues("hasSelfEmploymentIncome") && (
                              <p className="text-muted-foreground italic">No income sources reported</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Deductions & Credits Summary */}
                        <Card data-testid="summary-deductions">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Calculator className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">Deductions & Credits</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            {form.getValues("hasStudentLoanInterest") && (
                              <div className="flex items-center gap-2" data-testid="review-deduction-student-loan">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Student Loan Interest</span>
                              </div>
                            )}
                            {form.getValues("hasChildcareExpenses") && (
                              <div className="flex items-center gap-2" data-testid="review-deduction-childcare">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Childcare Expenses</span>
                              </div>
                            )}
                            {form.getValues("hasMortgageInterest") && (
                              <div className="flex items-center gap-2" data-testid="review-deduction-mortgage">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Mortgage Interest</span>
                              </div>
                            )}
                            {form.getValues("hasCharitableContributions") && (
                              <div className="flex items-center gap-2" data-testid="review-deduction-charitable">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Charitable Contributions</span>
                              </div>
                            )}
                            {form.getValues("hasMedicalExpenses") && (
                              <div className="flex items-center gap-2" data-testid="review-deduction-medical">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Medical Expenses</span>
                              </div>
                            )}
                            {form.getValues("hasRetirementContributions") && (
                              <div className="flex items-center gap-2" data-testid="review-deduction-retirement">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span>Retirement Contributions</span>
                              </div>
                            )}
                            {!form.getValues("hasStudentLoanInterest") && !form.getValues("hasChildcareExpenses") && !form.getValues("hasMortgageInterest") && 
                             !form.getValues("hasCharitableContributions") && !form.getValues("hasMedicalExpenses") && !form.getValues("hasRetirementContributions") && (
                              <p className="text-muted-foreground italic">No deductions or credits reported</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Global Carry Forward Consent */}
                        <Card className="border-2 border-primary/20">
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Shield className="h-5 w-5 text-primary" />
                              Global Carry Forward Consent (Form 15080)
                            </CardTitle>
                            <CardDescription className="text-xs">Optional - This consent is valid through November 30, 2027</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg text-xs space-y-2">
                              <p className="font-semibold text-sm">GLOBAL CARRY FORWARD CONSENT</p>
                              <p>
                                Global Carry Forward of data allows TaxSlayer LLC to make your tax return information available to <strong>ANY</strong> volunteer site participating in the IRS's VITA/TCE program that you select to prepare a tax return in the next filing season.
                              </p>
                              <p>
                                This consent is valid through November 30, 2027.
                              </p>
                              <p>
                                The tax return information includes your name, address, date of birth, phone number, SSN, filing status, occupation, employer information, income sources, deductions, credits, dependents, and all other information entered into the tax preparation software.
                              </p>
                              <p>
                                You do not need to provide consent for the VITA/TCE partner preparing your tax return this year. This consent will assist you only if you visit a different VITA or TCE partner next year that uses TaxSlayer.
                              </p>
                              <p className="font-medium">
                                You have the right to receive a signed copy of this form.
                              </p>
                            </div>

                            <FormField
                              control={form.control}
                              name="globalCarryForwardConsent"
                              render={({ field }) => (
                                <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="checkbox-global-carry-forward"
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      I consent to Global Carry Forward
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      This is optional and allows other VITA sites to access your information next year
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Primary Taxpayer Signature */}
                        <Card className="border-2 border-primary">
                          <CardHeader>
                            <CardTitle className="text-base">Primary Taxpayer Electronic Signature</CardTitle>
                            <CardDescription className="text-xs">Required - Sign by typing your full legal name</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="primaryTaxpayerSignature"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Legal Name <span className="text-destructive">*</span></FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Type your full legal name exactly as shown above"
                                      {...field}
                                      data-testid="input-primary-signature"
                                      className="font-serif text-lg"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div>
                              <Label className="text-sm">Signature Date</Label>
                              <Input 
                                value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} 
                                disabled 
                                className="bg-muted"
                                data-testid="input-primary-signature-date"
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name="primaryCertifyAccurate"
                              render={({ field }) => (
                                <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 bg-primary/5">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="checkbox-primary-certify"
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      By typing my name, I certify that all information provided is true and accurate <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      You must check this box to complete your intake
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Spouse Signature (if married) */}
                        {(maritalStatusDec31 === "married" || hasSpouse) && (
                          <Card className="border-2 border-primary">
                            <CardHeader>
                              <CardTitle className="text-base">Spouse Electronic Signature</CardTitle>
                              <CardDescription className="text-xs">Required - Sign by typing your full legal name</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <FormField
                                control={form.control}
                                name="spouseTaxpayerSignature"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Full Legal Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="Type your full legal name exactly as shown above"
                                        {...field}
                                        data-testid="input-spouse-signature"
                                        className="font-serif text-lg"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div>
                                <Label className="text-sm">Signature Date</Label>
                                <Input 
                                  value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} 
                                  disabled 
                                  className="bg-muted"
                                  data-testid="input-spouse-signature-date"
                                />
                              </div>

                              <FormField
                                control={form.control}
                                name="spouseCertifyAccurate"
                                render={({ field }) => (
                                  <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 bg-primary/5">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        data-testid="checkbox-spouse-certify"
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="text-sm font-medium">
                                        By typing my name, I certify that all information provided is true and accurate <span className="text-destructive">*</span>
                                      </FormLabel>
                                      <FormDescription className="text-xs">
                                        You must check this box to complete your intake
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            </CardContent>
                          </Card>
                        )}

                        {/* Completion Instructions */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                              <div className="text-sm space-y-1">
                                <p className="font-medium">Ready to complete your intake?</p>
                                <p className="text-muted-foreground text-xs">
                                  Once you click "Complete Intake", your information will be sent to a VITA volunteer for review. 
                                  You'll be notified when your tax return is ready.
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  If you need to make changes later, you can save as draft and return to complete this form.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </ScrollArea>
                  </fieldset>

                  {/* Review Panel (only shown when in review mode) */}
                  {reviewMode && selectedSession && (
                    <>
                      <Separator className="my-6" />
                      <Card className="border-2 border-primary" data-testid="panel-review">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Navigator Review Panel
                          </CardTitle>
                          <CardDescription>
                            Review the intake form for completeness and validate certification requirements
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Certification Level Detection */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold">Certification Level Required</h3>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={detectCertificationLevel(form.getValues()).level === "advanced" ? "destructive" : "default"}
                                className="text-sm"
                                data-testid="text-cert-level-required"
                              >
                                {detectCertificationLevel(form.getValues()).level.toUpperCase()}
                              </Badge>
                            </div>
                            {detectCertificationLevel(form.getValues()).reasons.length > 0 && (
                              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                                  Advanced Certification Required Because:
                                </p>
                                <ul className="list-disc list-inside text-sm text-amber-800 dark:text-amber-200 space-y-1">
                                  {detectCertificationLevel(form.getValues()).reasons.map((reason, idx) => (
                                    <li key={idx}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Completeness Checklist */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold">Completeness Checklist</h3>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2" data-testid="checkbox-complete-personal">
                                {checkCompleteness(form.getValues()).personalInfo ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="text-sm">All required personal information complete</span>
                              </div>
                              <div className="flex items-center gap-2" data-testid="checkbox-complete-income">
                                {checkCompleteness(form.getValues()).income ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="text-sm">All income sources documented</span>
                              </div>
                              <div className="flex items-center gap-2" data-testid="checkbox-complete-dependents">
                                {checkCompleteness(form.getValues()).dependents ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="text-sm">Dependents information complete (if applicable)</span>
                              </div>
                              <div className="flex items-center gap-2" data-testid="checkbox-complete-signatures">
                                {checkCompleteness(form.getValues()).signatures ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="text-sm">Signatures obtained</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {checkCompleteness(form.getValues()).documents ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                )}
                                <span className="text-sm">Supporting documents uploaded/listed</span>
                              </div>
                            </div>
                          </div>

                          {/* Review Notes */}
                          <div className="space-y-2">
                            <Label htmlFor="review-notes">Review Notes {reviewStatusSelection === "needs_correction" && <span className="text-destructive">*</span>}</Label>
                            <Textarea
                              id="review-notes"
                              placeholder="Add notes about the review, corrections needed, or observations..."
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              rows={4}
                              data-testid="textarea-review-notes"
                            />
                          </div>

                          {/* Review Status Selection */}
                          <div className="space-y-2">
                            <Label htmlFor="review-status">Review Decision *</Label>
                            <Select value={reviewStatusSelection} onValueChange={(value: any) => setReviewStatusSelection(value)}>
                              <SelectTrigger id="review-status" data-testid="select-review-status">
                                <SelectValue placeholder="Select review decision" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approved">Approve - Ready for Tax Preparation</SelectItem>
                                <SelectItem value="needs_correction">Request Corrections from Taxpayer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Review Actions */}
                          <div className="flex gap-3 pt-4">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="default"
                                  disabled={!reviewStatusSelection || reviewStatusSelection !== "approved"}
                                  className="flex-1"
                                  data-testid="button-approve-intake"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Approve & Continue
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Approve VITA Intake?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will mark the intake as approved and ready for tax preparation. The taxpayer will be notified that their intake is being processed.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      if (selectedSessionId) {
                                        reviewMutation.mutate({
                                          id: selectedSessionId,
                                          reviewStatus: "approved",
                                          reviewNotes: reviewNotes,
                                          certificationLevel: detectCertificationLevel(form.getValues()).level,
                                        });
                                      }
                                    }}
                                  >
                                    Approve Intake
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  disabled={!reviewStatusSelection || reviewStatusSelection !== "needs_correction" || !reviewNotes.trim()}
                                  className="flex-1"
                                  data-testid="button-request-corrections"
                                >
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Request Corrections
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Request Corrections?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will notify the taxpayer that corrections are needed. They will receive your notes and be able to update the intake form.
                                    {!reviewNotes.trim() && (
                                      <p className="text-destructive mt-2">Please add review notes explaining what corrections are needed.</p>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      if (selectedSessionId && reviewNotes.trim()) {
                                        reviewMutation.mutate({
                                          id: selectedSessionId,
                                          reviewStatus: "needs_correction",
                                          reviewNotes: reviewNotes,
                                          certificationLevel: detectCertificationLevel(form.getValues()).level,
                                        });
                                      }
                                    }}
                                  >
                                    Send Correction Request
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  <Separator />

                  {/* Navigation Buttons - Hidden in review mode */}
                  {!reviewMode && (
                    <div className="flex items-center justify-between pt-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePrevious}
                          disabled={currentStep === 1}
                          data-testid="button-previous"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSaveAndExit}
                          disabled={!selectedSessionId}
                          data-testid="button-save-draft"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save & Exit
                        </Button>

                        {currentStep < 5 ? (
                          <Button
                            type="button"
                            onClick={handleNext}
                            data-testid="button-next"
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            data-testid="button-complete-intake"
                            disabled={
                              !primaryTaxpayerSignature || 
                              !primaryCertifyAccurate || 
                              ((maritalStatusDec31 === "married" || hasSpouse) && (!spouseTaxpayerSignature || !spouseCertifyAccurate))
                            }
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete Intake
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
