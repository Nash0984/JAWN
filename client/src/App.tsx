import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingWrapper } from "@/components/common";

// Core/Auth pages - Always loaded (small, needed for initial render)
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/Navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

// High-traffic pages - Eagerly loaded
import ClientDashboard from "@/pages/ClientDashboard";
import NavigatorDashboard from "@/pages/NavigatorDashboard";
import CaseworkerDashboard from "@/pages/CaseworkerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import NotificationCenter from "@/pages/NotificationCenter";
import NotificationSettings from "@/pages/NotificationSettings";
import { MFASettings } from "@/pages/MFASettings";

// Public pages - Eagerly loaded (accessed by unauthenticated users)
import DocumentChecklist from "@/pages/public/DocumentChecklist";
import NoticeExplainer from "@/pages/public/NoticeExplainer";
import SimplifiedSearch from "@/pages/public/SimplifiedSearch";
import BenefitScreener from "@/pages/public/BenefitScreener";
import QuickScreener from "@/pages/public/QuickScreener";
import FsaLanding from "@/pages/public/FsaLanding";
import CliffCalculator from "@/pages/CliffCalculator";

// Legal pages - Lazy loaded (infrequently accessed)
const LegalHub = lazy(() => import("@/pages/legal/index"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/legal/TermsOfService"));
const AccessibilityStatement = lazy(() => import("@/pages/legal/AccessibilityStatement"));
const DataSecurityPolicy = lazy(() => import("@/pages/legal/DataSecurityPolicy"));
const BreachNotificationPolicy = lazy(() => import("@/pages/legal/BreachNotificationPolicy"));
const Disclaimer = lazy(() => import("@/pages/legal/Disclaimer"));
const License = lazy(() => import("@/pages/legal/License"));

// Heavy admin/power user pages - Lazy loaded (large bundles, admin-only)
const EFileDashboard = lazy(() => import("@/pages/EFileDashboard"));
const VitaIntake = lazy(() => import("@/pages/VitaIntake"));
const NavigatorWorkspace = lazy(() => import("@/pages/NavigatorWorkspace"));
const EvaluationFramework = lazy(() => import("@/pages/EvaluationFramework"));
const ComplianceAdmin = lazy(() => import("@/pages/ComplianceAdmin"));
const AIMonitoring = lazy(() => import("@/pages/AIMonitoring"));
const RulesExtraction = lazy(() => import("@/pages/RulesExtraction"));
const TaxPreparation = lazy(() => import("@/pages/TaxPreparation"));
const MAIVEDashboard = lazy(() => import("@/pages/MAIVEDashboard"));
const Monitoring = lazy(() => import("@/pages/admin/Monitoring"));
const DeveloperPortal = lazy(() => import("@/pages/DeveloperPortal"));
const APIExplorer = lazy(() => import("@/pages/APIExplorer"));

// Medium-traffic pages - Lazy loaded
const Admin = lazy(() => import("@/pages/Admin"));
const Training = lazy(() => import("@/pages/Training"));
const EligibilityChecker = lazy(() => import("@/pages/EligibilityChecker"));
const PolicyManual = lazy(() => import("@/pages/PolicyManual"));
const DocumentVerificationPage = lazy(() => import("@/pages/DocumentVerificationPage"));
const ConsentManagement = lazy(() => import("@/pages/ConsentManagement"));
const CaseworkerCockpit = lazy(() => import("@/pages/CaseworkerCockpit"));
const SupervisorCockpit = lazy(() => import("@/pages/SupervisorCockpit"));
const PolicySources = lazy(() => import("@/pages/PolicySources"));
const SecurityMonitoring = lazy(() => import("@/pages/SecurityMonitoring"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const ApiDocs = lazy(() => import("@/pages/ApiDocs"));
const EFileMonitoring = lazy(() => import("@/pages/admin/EFileMonitoring"));
const FeedbackManagement = lazy(() => import("@/pages/FeedbackManagement"));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const PolicyChanges = lazy(() => import("@/pages/PolicyChanges").then(m => ({ default: m.PolicyChanges })));
const IntakeCopilot = lazy(() => import("@/pages/IntakeCopilot").then(m => ({ default: m.IntakeCopilot })));
const ScenarioWorkspace = lazy(() => import("@/pages/ScenarioWorkspace"));
const AbawdVerificationAdmin = lazy(() => import("@/pages/AbawdVerificationAdmin"));
const CrossEnrollmentAdmin = lazy(() => import("@/pages/CrossEnrollmentAdmin"));
const FNSStateOptionsManager = lazy(() => import("@/pages/admin/FNSStateOptionsManager"));
const FederalLawTracker = lazy(() => import("@/pages/admin/FederalLawTracker"));
const StateLawTracker = lazy(() => import("@/pages/admin/StateLawTracker"));
const SmartScheduler = lazy(() => import("@/pages/admin/SmartScheduler"));
const CountyTaxRates = lazy(() => import("@/pages/admin/CountyTaxRates"));
const WebhookManagement = lazy(() => import("@/pages/admin/WebhookManagement"));
const DocumentReviewQueue = lazy(() => import("@/pages/DocumentReviewQueue"));
const CountyManagement = lazy(() => import("@/pages/CountyManagement"));
const NavigatorPerformance = lazy(() => import("@/pages/NavigatorPerformance"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const CountyAnalytics = lazy(() => import("@/pages/CountyAnalytics"));
const VitaKnowledgeBase = lazy(() => import("@/pages/VitaKnowledgeBase"));
const HouseholdProfiler = lazy(() => import("@/pages/HouseholdProfiler"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const VitaDocuments = lazy(() => import("@/pages/VitaDocuments"));
const AppointmentsCalendar = lazy(() => import("@/pages/AppointmentsCalendar"));
const IntakeAssistant = lazy(() => import("@/pages/IntakeAssistant").then(m => ({ default: m.IntakeAssistant })));
const TaxpayerDashboard = lazy(() => import("@/pages/TaxpayerDashboard"));
const TaxpayerDocumentRequests = lazy(() => import("@/pages/TaxpayerDocumentRequests"));
const TaxpayerMessaging = lazy(() => import("@/pages/TaxpayerMessaging"));
const TaxpayerSignature = lazy(() => import("@/pages/TaxpayerSignature"));
const TaxpayerLayout = lazy(() => import("@/components/TaxpayerLayout").then(m => ({ default: m.TaxpayerLayout })));
const Demo = lazy(() => import("@/pages/Demo"));
const Developers = lazy(() => import("@/pages/Developers"));
const SupervisorReviewDashboard = lazy(() => import("@/pages/SupervisorReviewDashboard"));

// Shared components
import MobileBottomNav from "@/components/MobileBottomNav";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { CountyHeader } from "@/components/CountyHeader";
import { SessionExpiryProvider } from "@/contexts/SessionExpiryContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TenantProvider } from "@/contexts/TenantContext";
import { TenantThemeProvider } from "@/components/TenantThemeProvider";
import Footer from "@/components/Footer";
// COMMENTED OUT DURING SCHEMA ROLLBACK
// import SmsConfig from "@/pages/admin/SmsConfig";
// import MobileScreening from "@/pages/MobileScreening";

// Lazy loading fallback component
function LazyLoadFallback() {
  return (
    <LoadingWrapper isLoading={true} skeletonType="card">
      <div />
    </LoadingWrapper>
  );
}

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup";

  return (
    <div className="min-h-screen bg-background">
      {/* PWA Install Prompt */}
      <InstallPrompt />
      
      {/* Command Palette - Global Cmd+K navigation - Lazy loaded */}
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      
      {/* Skip link for accessibility (only on non-auth pages) */}
      {!isAuthPage && <a href="#main-content" className="skip-link">Skip to main content</a>}
      
      {/* Show navigation only on non-auth pages */}
      {!isAuthPage && <Navigation />}
      
      {/* County Branding Header - Only on non-auth pages */}
      {!isAuthPage && <CountyHeader />}
      
      <main id="main-content" role="main" className="pb-20 md:pb-0">
        <Switch>
          {/* Public routes */}
          <Route path="/" component={Home} />
          <Route path="/search" component={Home} />
          <Route path="/help" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          
          {/* Demo Dashboard - Public access (no login required) */}
          <Route path="/demo">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <Demo />
              </Suspense>
            )}
          </Route>
          
          {/* API Explorer - Public access (no login required) */}
          <Route path="/api-explorer">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <APIExplorer />
              </Suspense>
            )}
          </Route>
          
          {/* Developer Guide - Public access (no login required) */}
          <Route path="/developers">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <Developers />
              </Suspense>
            )}
          </Route>
          
          {/* Public Portal - No login required */}
          <Route path="/public/documents" component={DocumentChecklist} />
          <Route path="/public/notices" component={NoticeExplainer} />
          <Route path="/public/search" component={SimplifiedSearch} />
          <Route path="/screener" component={BenefitScreener} />
          <Route path="/public/quick-screener" component={QuickScreener} />
          <Route path="/public/fsa" component={FsaLanding} />
          <Route path="/cliff-calculator" component={CliffCalculator} />
          
          {/* AI Intake Assistant - Public access (no login required for demo) */}
          <Route path="/intake-assistant">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <IntakeAssistant />
              </Suspense>
            )}
          </Route>
          
          {/* Mobile SMS Screening - No login required */}
          {/* COMMENTED OUT DURING SCHEMA ROLLBACK */}
          {/* <Route path="/screening/:token" component={MobileScreening} /> */}
          {/* <Route path="/s/:token" component={MobileScreening} /> */}
          
          {/* Legal Pages - Public access (no login required) */}
          <Route path="/legal">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <LegalHub />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/privacy">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <PrivacyPolicy />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/terms">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <TermsOfService />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/license">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <License />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/accessibility">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <AccessibilityStatement />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/security">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <DataSecurityPolicy />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/breach-notification">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <BreachNotificationPolicy />
              </Suspense>
            )}
          </Route>
          <Route path="/legal/disclaimer">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <Disclaimer />
              </Suspense>
            )}
          </Route>
          
          {/* Role-specific dashboards */}
          <Route path="/dashboard/client">
            {() => (
              <ProtectedRoute>
                <ClientDashboard />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/dashboard/navigator">
            {() => (
              <ProtectedRoute requireStaff>
                <NavigatorDashboard />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/performance">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <NavigatorPerformance />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/leaderboard">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <Leaderboard />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/dashboard/caseworker">
            {() => (
              <ProtectedRoute requireStaff>
                <CaseworkerDashboard />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/caseworker/cockpit">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <CaseworkerCockpit />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/supervisor/cockpit">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <SupervisorCockpit />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/supervisor/reviews">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <SupervisorReviewDashboard />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/dashboard/admin">
            {() => (
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            )}
          </Route>
          
          {/* Protected routes - require authentication */}
          <Route path="/notifications">
            {() => (
              <ProtectedRoute>
                <NotificationCenter />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/settings/notifications">
            {() => (
              <ProtectedRoute>
                <NotificationSettings />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/settings/security">
            {() => (
              <ProtectedRoute>
                <MFASettings />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/eligibility">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <EligibilityChecker />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/manual">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <PolicyManual />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/intake">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <IntakeCopilot />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/scenarios">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <ScenarioWorkspace />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/tax">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <TaxPreparation />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/efile">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <EFileDashboard />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/vita">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <VitaKnowledgeBase />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/vita-intake">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <VitaIntake />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/vita-documents/:sessionId">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <VitaDocuments />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/appointments">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <AppointmentsCalendar />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          
          {/* Taxpayer Self-Service Portal - Protected routes for taxpayers */}
          <Route path="/taxpayer">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerDashboard />
                  </TaxpayerLayout>
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/taxpayer/documents">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerDocumentRequests />
                  </TaxpayerLayout>
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/taxpayer/messages">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerMessaging />
                  </TaxpayerLayout>
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/taxpayer/signature">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerSignature />
                  </TaxpayerLayout>
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          
          {/* Staff-only routes */}
          <Route path="/verify">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <DocumentVerificationPage />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/navigator">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <NavigatorWorkspace />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/consent">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <ConsentManagement />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/household-profiler">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <HouseholdProfiler />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/analytics">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <Analytics />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          
          {/* Admin-only routes */}
          <Route path="/upload">
            {() => (
              <ProtectedRoute requireAdmin>
                <Upload />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/admin">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/rules">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <RulesExtraction />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/sources">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <PolicySources />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/ai-monitoring">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <AIMonitoring />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/maive">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <MAIVEDashboard />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/monitoring">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <Monitoring />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/efile-monitoring">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <EFileMonitoring />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/security-monitoring">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <SecurityMonitoring />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/audit-logs">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <AuditLogs />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/policy-changes">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <PolicyChanges />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/compliance">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <ComplianceAdmin />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/api-docs">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <ApiDocs />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/developer">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute>
                  <DeveloperPortal />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/feedback">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <FeedbackManagement />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/counties">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <CountyManagement />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/county-analytics">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <CountyAnalytics />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/abawd-verifications">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <AbawdVerificationAdmin />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/cross-enrollment">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <CrossEnrollmentAdmin />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/navigator/document-review">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireStaff>
                  <DocumentReviewQueue />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/training">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <Training />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/evaluation">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <EvaluationFramework />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          {/* COMMENTED OUT DURING SCHEMA ROLLBACK */}
          {/* <Route path="/admin/sms-config">
            {() => (
              <ProtectedRoute requireAdmin>
                <SmsConfig />
              </ProtectedRoute>
            )}
          </Route> */}
          <Route path="/admin/fns-state-options">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <FNSStateOptionsManager />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/federal-law-tracker">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <FederalLawTracker />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/state-law-tracker">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <StateLawTracker />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/scheduler">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <SmartScheduler />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/county-tax-rates">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <CountyTaxRates />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          <Route path="/admin/webhooks">
            {() => (
              <Suspense fallback={<LazyLoadFallback />}>
                <ProtectedRoute requireAdmin>
                  <WebhookManagement />
                </ProtectedRoute>
              </Suspense>
            )}
          </Route>
          
          {/* 404 fallback */}
          <Route component={NotFound} />
        </Switch>
      </main>
      
      {/* Mobile Bottom Navigation - Only shown on small screens and non-auth pages */}
      {!isAuthPage && <MobileBottomNav />}
      
      {/* Footer - Visible on all pages except auth pages */}
      {!isAuthPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
          <TenantThemeProvider>
            <BrandingProvider>
              <SessionExpiryProvider>
                <TooltipProvider>
                  <Toaster />
                  <Router />
                </TooltipProvider>
              </SessionExpiryProvider>
            </BrandingProvider>
          </TenantThemeProvider>
        </TenantProvider>
    </QueryClientProvider>
  );
}

export default App;
