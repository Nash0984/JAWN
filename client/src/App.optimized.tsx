import { lazy, Suspense } from 'react';
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionExpiryProvider } from "@/contexts/SessionExpiryContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { TenantThemeProvider } from "@/components/TenantThemeProvider";
import { InstallPrompt } from "@/components/InstallPrompt";
import { CommandPalette } from "@/components/CommandPalette";
import Navigation from "@/components/Navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { CountyHeader } from "@/components/CountyHeader";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import { TaxpayerLayout } from "@/components/TaxpayerLayout";

// Lazy load all page components
const Home = lazy(() => import("@/pages/Home"));
const Upload = lazy(() => import("@/pages/Upload"));
const Admin = lazy(() => import("@/pages/Admin"));
const Training = lazy(() => import("@/pages/Training"));
const EligibilityChecker = lazy(() => import("@/pages/EligibilityChecker"));
const PolicyManual = lazy(() => import("@/pages/PolicyManual"));
const DocumentVerificationPage = lazy(() => import("@/pages/DocumentVerificationPage"));
const NavigatorWorkspace = lazy(() => import("@/pages/NavigatorWorkspace"));
const ConsentManagement = lazy(() => import("@/pages/ConsentManagement"));
const RulesExtraction = lazy(() => import("@/pages/RulesExtraction"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const NotFound = lazy(() => import("@/pages/not-found"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const NavigatorDashboard = lazy(() => import("@/pages/NavigatorDashboard"));
const CaseworkerDashboard = lazy(() => import("@/pages/CaseworkerDashboard"));
const CaseworkerCockpit = lazy(() => import("@/pages/CaseworkerCockpit"));
const SupervisorCockpit = lazy(() => import("@/pages/SupervisorCockpit"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const PolicySources = lazy(() => import("@/pages/PolicySources"));
const AIMonitoring = lazy(() => import("@/pages/AIMonitoring"));
const SecurityMonitoring = lazy(() => import("@/pages/SecurityMonitoring"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const ApiDocs = lazy(() => import("@/pages/ApiDocs"));
const Monitoring = lazy(() => import("@/pages/admin/Monitoring"));
const EFileMonitoring = lazy(() => import("@/pages/admin/EFileMonitoring"));
const DeveloperPortal = lazy(() => import("@/pages/DeveloperPortal"));
const FeedbackManagement = lazy(() => import("@/pages/FeedbackManagement"));
const NotificationCenter = lazy(() => import("@/pages/NotificationCenter"));
const NotificationSettings = lazy(() => import("@/pages/NotificationSettings"));
const DocumentChecklist = lazy(() => import("@/pages/public/DocumentChecklist"));
const NoticeExplainer = lazy(() => import("@/pages/public/NoticeExplainer"));
const SimplifiedSearch = lazy(() => import("@/pages/public/SimplifiedSearch"));
const BenefitScreener = lazy(() => import("@/pages/public/BenefitScreener"));
const QuickScreener = lazy(() => import("@/pages/public/QuickScreener"));
const FsaLanding = lazy(() => import("@/pages/public/FsaLanding"));
const PolicyChanges = lazy(() => import("@/pages/PolicyChanges").then(m => ({ default: m.PolicyChanges })));
const ComplianceAdmin = lazy(() => import("@/pages/ComplianceAdmin").then(m => ({ default: m.ComplianceAdmin })));
const IntakeCopilot = lazy(() => import("@/pages/IntakeCopilot").then(m => ({ default: m.IntakeCopilot })));
const ScenarioWorkspace = lazy(() => import("@/pages/ScenarioWorkspace"));
const LegalHub = lazy(() => import("@/pages/legal/index"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/legal/TermsOfService"));
const AccessibilityStatement = lazy(() => import("@/pages/legal/AccessibilityStatement"));
const DataSecurityPolicy = lazy(() => import("@/pages/legal/DataSecurityPolicy"));
const BreachNotificationPolicy = lazy(() => import("@/pages/legal/BreachNotificationPolicy"));
const Disclaimer = lazy(() => import("@/pages/legal/Disclaimer"));
const License = lazy(() => import("@/pages/legal/License"));
const AbawdVerificationAdmin = lazy(() => import("@/pages/AbawdVerificationAdmin"));
const CrossEnrollmentAdmin = lazy(() => import("@/pages/CrossEnrollmentAdmin"));
const SmsConfig = lazy(() => import("@/pages/admin/SmsConfig"));
const FNSStateOptionsManager = lazy(() => import("@/pages/admin/FNSStateOptionsManager"));
const FederalLawTracker = lazy(() => import("@/pages/admin/FederalLawTracker"));
const MarylandStateLawTracker = lazy(() => import("@/pages/admin/MarylandStateLawTracker"));
const SmartScheduler = lazy(() => import("@/pages/admin/SmartScheduler"));
const CountyTaxRates = lazy(() => import("@/pages/admin/CountyTaxRates"));
const WebhookManagement = lazy(() => import("@/pages/admin/WebhookManagement"));
const DocumentReviewQueue = lazy(() => import("@/pages/DocumentReviewQueue"));
const TaxPreparation = lazy(() => import("@/pages/TaxPreparation"));
const CountyManagement = lazy(() => import("@/pages/CountyManagement"));
const NavigatorPerformance = lazy(() => import("@/pages/NavigatorPerformance"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const CountyAnalytics = lazy(() => import("@/pages/CountyAnalytics"));
const ProductivityDashboard = lazy(() => import("@/pages/ProductivityDashboard"));
const VitaKnowledgeBase = lazy(() => import("@/pages/VitaKnowledgeBase"));
const EvaluationFramework = lazy(() => import("@/pages/EvaluationFramework"));
const HouseholdProfiler = lazy(() => import("@/pages/HouseholdProfiler"));
const VitaIntake = lazy(() => import("@/pages/VitaIntake"));
const VitaDocuments = lazy(() => import("@/pages/VitaDocuments"));
const AppointmentsCalendar = lazy(() => import("@/pages/AppointmentsCalendar"));
const TaxpayerDashboard = lazy(() => import("@/pages/TaxpayerDashboard"));
const TaxpayerDocumentRequests = lazy(() => import("@/pages/TaxpayerDocumentRequests"));
const TaxpayerMessaging = lazy(() => import("@/pages/TaxpayerMessaging"));
const TaxpayerSignature = lazy(() => import("@/pages/TaxpayerSignature"));
const Demo = lazy(() => import("@/pages/Demo"));
const APIExplorer = lazy(() => import("@/pages/APIExplorer"));
const TranslationDashboard = lazy(() => import("@/pages/TranslationDashboard"));
const FeedbackDashboard = lazy(() => import("@/pages/FeedbackDashboard"));
const FeedbackDetailView = lazy(() => import("@/pages/FeedbackDetailView"));
const SuggestionVotingList = lazy(() => import("@/pages/SuggestionVotingList"));
const FAQDashboard = lazy(() => import("@/pages/FAQDashboard"));
const FAQPublicView = lazy(() => import("@/pages/FAQPublicView"));
const PolicyManualBrowser = lazy(() => import("@/pages/PolicyManualBrowser"));
const FormBuilderPage = lazy(() => import("@/pages/FormBuilderPage"));
const AdminContentDashboard = lazy(() => import("@/pages/AdminContentDashboard"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="space-y-4">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-64 w-full max-w-md" />
    </div>
  </div>
);

// Wrapper for lazy loaded pages
const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup";

  return (
    <div className="min-h-screen bg-background">
      {/* PWA Install Prompt */}
      <InstallPrompt />
      
      {/* Command Palette - Global Cmd+K navigation */}
      <CommandPalette />
      
      {/* Skip link for accessibility (only on non-auth pages) */}
      {!isAuthPage && <a href="#main-content" className="skip-link">Skip to main content</a>}
      
      {/* Show navigation only on non-auth pages */}
      {!isAuthPage && <Navigation />}
      
      {/* County Branding Header - Only on non-auth pages */}
      {!isAuthPage && <CountyHeader />}
      
      {/* Main content with proper semantic markup and skip link target */}
      <main id="main-content" className="flex-grow" tabIndex={-1}>
        <Switch>
          {/* Home - No authentication required */}
          <Route path="/">
            <LazyPage><Home /></LazyPage>
          </Route>
          
          {/* Auth Routes - No authentication required */}
          <Route path="/login">
            <LazyPage><Login /></LazyPage>
          </Route>
          <Route path="/signup">
            <LazyPage><Signup /></LazyPage>
          </Route>
          
          {/* Public Routes */}
          <Route path="/demo">
            <LazyPage><Demo /></LazyPage>
          </Route>
          <Route path="/api-explorer">
            <LazyPage><APIExplorer /></LazyPage>
          </Route>
          <Route path="/developer">
            <LazyPage><DeveloperPortal /></LazyPage>
          </Route>
          <Route path="/api/docs">
            <LazyPage><ApiDocs /></LazyPage>
          </Route>
          <Route path="/policy-manual">
            <LazyPage><PolicyManual /></LazyPage>
          </Route>
          <Route path="/policy-manual-browser">
            <LazyPage><PolicyManualBrowser /></LazyPage>
          </Route>
          <Route path="/screener">
            <LazyPage><BenefitScreener /></LazyPage>
          </Route>
          <Route path="/public/quick-screener">
            <LazyPage><QuickScreener /></LazyPage>
          </Route>
          <Route path="/public/documents">
            <LazyPage><DocumentChecklist /></LazyPage>
          </Route>
          <Route path="/public/notices">
            <LazyPage><NoticeExplainer /></LazyPage>
          </Route>
          <Route path="/public/search">
            <LazyPage><SimplifiedSearch /></LazyPage>
          </Route>
          <Route path="/public/fsa">
            <LazyPage><FsaLanding /></LazyPage>
          </Route>
          
          {/* Legal Routes */}
          <Route path="/legal">
            <LazyPage><LegalHub /></LazyPage>
          </Route>
          <Route path="/legal/privacy">
            <LazyPage><PrivacyPolicy /></LazyPage>
          </Route>
          <Route path="/legal/terms">
            <LazyPage><TermsOfService /></LazyPage>
          </Route>
          <Route path="/legal/accessibility">
            <LazyPage><AccessibilityStatement /></LazyPage>
          </Route>
          <Route path="/legal/data-security">
            <LazyPage><DataSecurityPolicy /></LazyPage>
          </Route>
          <Route path="/legal/breach-notification">
            <LazyPage><BreachNotificationPolicy /></LazyPage>
          </Route>
          <Route path="/legal/disclaimer">
            <LazyPage><Disclaimer /></LazyPage>
          </Route>
          <Route path="/legal/license">
            <LazyPage><License /></LazyPage>
          </Route>
          
          {/* Protected Routes - Applicant Role */}
          <ProtectedRoute path="/dashboard" roles={["applicant", "navigator", "caseworker", "admin"]}>
            <LazyPage><ClientDashboard /></LazyPage>
          </ProtectedRoute>
          <ProtectedRoute path="/household-profiler" roles={["applicant", "navigator", "caseworker", "admin"]}>
            <LazyPage><HouseholdProfiler /></LazyPage>
          </ProtectedRoute>
          <ProtectedRoute path="/eligibility" roles={["applicant", "navigator", "caseworker", "admin"]}>
            <LazyPage><EligibilityChecker /></LazyPage>
          </ProtectedRoute>
          <ProtectedRoute path="/vita/intake" roles={["applicant", "navigator", "caseworker", "taxpayer", "admin"]}>
            <LazyPage><VitaIntake /></LazyPage>
          </ProtectedRoute>
          <ProtectedRoute path="/vita/documents" roles={["applicant", "navigator", "caseworker", "taxpayer", "admin"]}>
            <LazyPage><VitaDocuments /></LazyPage>
          </ProtectedRoute>
          <ProtectedRoute path="/tax-preparation" roles={["applicant", "navigator", "caseworker", "taxpayer", "admin"]}>
            <LazyPage><TaxPreparation /></LazyPage>
          </ProtectedRoute>
          
          {/* Taxpayer Routes (Wrapped in Layout) */}
          <ProtectedRoute path="/taxpayer" roles={["taxpayer", "applicant", "navigator", "caseworker", "admin"]}>
            <LazyPage>
              <TaxpayerLayout>
                <TaxpayerDashboard />
              </TaxpayerLayout>
            </LazyPage>
          </ProtectedRoute>
          
          {/* Other taxpayer routes follow similar pattern... */}
          
          {/* Admin Routes - Admin Role Only */}
          <ProtectedRoute path="/admin" roles={["admin"]}>
            <LazyPage><Admin /></LazyPage>
          </ProtectedRoute>
          
          {/* More admin routes... */}
          
          {/* 404 Route - Must be last */}
          <Route>
            <LazyPage><NotFound /></LazyPage>
          </Route>
        </Switch>
      </main>
      
      {/* Footer - Only on non-auth pages */}
      {!isAuthPage && <Footer />}
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <SessionExpiryProvider>
          <TenantProvider>
            <BrandingProvider>
              <TenantThemeProvider>
                <TooltipProvider>
                  <Router />
                  <Toaster />
                </TooltipProvider>
              </TenantThemeProvider>
            </BrandingProvider>
          </TenantProvider>
        </SessionExpiryProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}