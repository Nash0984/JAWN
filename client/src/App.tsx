import { lazy, Suspense } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { PageLoader } from "@/components/PageLoader";

// Tier 1: Eager load - Critical path (auth + home)
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/not-found";

// Core components - always needed
import Navigation from "@/components/Navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { CommandPalette } from "@/components/CommandPalette";
import { TaxpayerLayout } from "@/components/TaxpayerLayout";
import MobileBottomNav from "@/components/MobileBottomNav";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { CountyHeader } from "@/components/CountyHeader";
import { SessionExpiryProvider } from "@/contexts/SessionExpiryContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TenantProvider } from "@/contexts/TenantContext";
import { TenantThemeProvider } from "@/components/TenantThemeProvider";
import Footer from "@/components/Footer";

// Tier 2: Lazy load - Main workflows and dashboards
const Upload = lazy(() => import("@/pages/Upload"));
const Admin = lazy(() => import("@/pages/Admin"));
const Training = lazy(() => import("@/pages/Training"));
const EligibilityChecker = lazy(() => import("@/pages/EligibilityChecker"));
const PolicyManual = lazy(() => import("@/pages/PolicyManual"));
const DocumentVerificationPage = lazy(() => import("@/pages/DocumentVerificationPage"));
const NavigatorWorkspace = lazy(() => import("@/pages/NavigatorWorkspace"));
const ConsentManagement = lazy(() => import("@/pages/ConsentManagement"));
const RulesExtraction = lazy(() => import("@/pages/RulesExtraction"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const ClientVerificationPortal = lazy(() => import("@/pages/ClientVerificationPortal"));
const NavigatorDashboard = lazy(() => import("@/pages/NavigatorDashboard"));
const CaseworkerDashboard = lazy(() => import("@/pages/CaseworkerDashboard"));
const CaseworkerCockpit = lazy(() => import("@/pages/CaseworkerCockpit"));
const SupervisorCockpit = lazy(() => import("@/pages/SupervisorCockpit"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const PolicySources = lazy(() => import("@/pages/PolicySources"));
const AIMonitoring = lazy(() => import("@/pages/AIMonitoring"));
const SecurityMonitoring = lazy(() => import("@/pages/SecurityMonitoring"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const MAIVEDashboard = lazy(() => import("@/pages/MAIVEDashboard"));
const ApiDocs = lazy(() => import("@/pages/ApiDocs"));
const Monitoring = lazy(() => import("@/pages/admin/Monitoring"));
const EFileMonitoring = lazy(() => import("@/pages/admin/EFileMonitoring"));
const DeveloperPortal = lazy(() => import("@/pages/DeveloperPortal"));
const FeedbackManagement = lazy(() => import("@/pages/FeedbackManagement"));
const NotificationCenter = lazy(() => import("@/pages/NotificationCenter"));
const NotificationSettings = lazy(() => import("@/pages/NotificationSettings"));

// Tier 2: Public portal pages
const DocumentChecklist = lazy(() => import("@/pages/public/DocumentChecklist"));
const NoticeExplainer = lazy(() => import("@/pages/public/NoticeExplainer"));
const SimplifiedSearch = lazy(() => import("@/pages/public/SimplifiedSearch"));
const BenefitScreener = lazy(() => import("@/pages/public/BenefitScreener"));
const QuickScreener = lazy(() => import("@/pages/public/QuickScreener"));
const FsaLanding = lazy(() => import("@/pages/public/FsaLanding"));

// Tier 2: Policy and compliance pages
const PolicyChanges = lazy(() => import("@/pages/PolicyChanges").then(m => ({ default: m.PolicyChanges })));
const ComplianceAdmin = lazy(() => import("@/pages/ComplianceAdmin").then(m => ({ default: m.ComplianceAdmin })));
const IntakeCopilot = lazy(() => import("@/pages/IntakeCopilot").then(m => ({ default: m.IntakeCopilot })));
const ScenarioWorkspace = lazy(() => import("@/pages/ScenarioWorkspace"));

// Tier 3: Legal pages - rarely needed immediately
const LegalHub = lazy(() => import("@/pages/legal/index"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/legal/TermsOfService"));
const AccessibilityStatement = lazy(() => import("@/pages/legal/AccessibilityStatement"));
const DataSecurityPolicy = lazy(() => import("@/pages/legal/DataSecurityPolicy"));
const BreachNotificationPolicy = lazy(() => import("@/pages/legal/BreachNotificationPolicy"));
const Disclaimer = lazy(() => import("@/pages/legal/Disclaimer"));
const License = lazy(() => import("@/pages/legal/License"));

// Tier 3: Admin specialized tools
const AbawdVerificationAdmin = lazy(() => import("@/pages/AbawdVerificationAdmin"));
const CrossEnrollmentAdmin = lazy(() => import("@/pages/CrossEnrollmentAdmin"));
const FNSStateOptionsManager = lazy(() => import("@/pages/admin/FNSStateOptionsManager"));
const FederalLawTracker = lazy(() => import("@/pages/admin/FederalLawTracker"));
const StateLawTracker = lazy(() => import("@/pages/admin/StateLawTracker"));
const SmartScheduler = lazy(() => import("@/pages/admin/SmartScheduler"));
const CountyTaxRates = lazy(() => import("@/pages/admin/CountyTaxRates"));
const WebhookManagement = lazy(() => import("@/pages/admin/WebhookManagement"));
const PerDashboard = lazy(() => import("@/pages/admin/PerDashboard"));
const ResearcherManagement = lazy(() => import("@/pages/admin/ResearcherManagement"));
const SecurityDashboard = lazy(() => import("@/pages/admin/SecurityDashboard"));
const UserManagement = lazy(() => import("@/pages/admin/UserManagement"));
const AnalyticsDashboard = lazy(() => import("@/pages/admin/AnalyticsDashboard"));
const BarDashboard = lazy(() => import("@/pages/admin/BarDashboard"));
const DocumentReviewQueue = lazy(() => import("@/pages/DocumentReviewQueue"));
const TaxPreparation = lazy(() => import("@/pages/TaxPreparation"));
const CountyManagement = lazy(() => import("@/pages/CountyManagement"));
const NavigatorPerformance = lazy(() => import("@/pages/NavigatorPerformance"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const CountyAnalytics = lazy(() => import("@/pages/CountyAnalytics"));
const VitaKnowledgeBase = lazy(() => import("@/pages/VitaKnowledgeBase"));
const EvaluationFramework = lazy(() => import("@/pages/EvaluationFramework"));
const HouseholdProfiler = lazy(() => import("@/pages/HouseholdProfiler"));
const VitaIntake = lazy(() => import("@/pages/VitaIntake"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const VitaDocuments = lazy(() => import("@/pages/VitaDocuments"));
const AppointmentsCalendar = lazy(() => import("@/pages/AppointmentsCalendar"));
const IntakeAssistant = lazy(() => import("@/pages/IntakeAssistant").then(m => ({ default: m.IntakeAssistant })));
const TaxpayerDashboard = lazy(() => import("@/pages/TaxpayerDashboard"));
const TaxpayerDocumentRequests = lazy(() => import("@/pages/TaxpayerDocumentRequests"));
const TaxpayerMessaging = lazy(() => import("@/pages/TaxpayerMessaging"));
const TaxpayerSignature = lazy(() => import("@/pages/TaxpayerSignature"));
const Demo = lazy(() => import("@/pages/Demo"));
const APIExplorer = lazy(() => import("@/pages/APIExplorer"));
const Developers = lazy(() => import("@/pages/Developers"));
const EFileDashboard = lazy(() => import("@/pages/EFileDashboard"));
const SupervisorReviewDashboard = lazy(() => import("@/pages/SupervisorReviewDashboard"));

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
      
      <main id="main-content" role="main" className="pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            {/* Public routes */}
            <Route path="/" component={Home} />
            <Route path="/search" component={Home} />
            <Route path="/help" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            
            {/* Demo Dashboard - Public access (no login required) */}
            <Route path="/demo" component={Demo} />
            
            {/* API Explorer - Public access (no login required) */}
            <Route path="/api-explorer" component={APIExplorer} />
            
            {/* Developer Guide - Public access (no login required) */}
            <Route path="/developers" component={Developers} />
            
            {/* Public Portal - No login required */}
            <Route path="/public/documents" component={DocumentChecklist} />
            <Route path="/public/notices" component={NoticeExplainer} />
            <Route path="/public/search" component={SimplifiedSearch} />
            <Route path="/screener" component={BenefitScreener} />
            <Route path="/public/quick-screener" component={QuickScreener} />
            <Route path="/public/fsa" component={FsaLanding} />
            
            {/* AI Intake Assistant - Public access (no login required for demo) */}
            <Route path="/intake-assistant" component={IntakeAssistant} />
            
            {/* Legal Pages - Public access (no login required) */}
            <Route path="/legal" component={LegalHub} />
            <Route path="/legal/privacy" component={PrivacyPolicy} />
            <Route path="/legal/terms" component={TermsOfService} />
            <Route path="/legal/license" component={License} />
            <Route path="/legal/accessibility" component={AccessibilityStatement} />
            <Route path="/legal/security" component={DataSecurityPolicy} />
            <Route path="/legal/breach-notification" component={BreachNotificationPolicy} />
            <Route path="/legal/disclaimer" component={Disclaimer} />
            
            {/* Role-specific dashboards */}
            <Route path="/dashboard/client">
              {() => (
                <ProtectedRoute>
                  <ClientDashboard />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/client/report-changes">
              {() => (
                <ProtectedRoute>
                  <ClientVerificationPortal />
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
                <ProtectedRoute requireStaff>
                  <NavigatorPerformance />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/leaderboard">
              {() => (
                <ProtectedRoute requireStaff>
                  <Leaderboard />
                </ProtectedRoute>
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
                <ProtectedRoute requireStaff>
                  <CaseworkerCockpit />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/caseworker-cockpit">
              {() => <Redirect to="/caseworker/cockpit" />}
            </Route>
            <Route path="/supervisor/cockpit">
              {() => (
                <ProtectedRoute requireStaff>
                  <SupervisorCockpit />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/supervisor/reviews">
              {() => (
                <ProtectedRoute requireStaff>
                  <SupervisorReviewDashboard />
                </ProtectedRoute>
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
            <Route path="/eligibility">
              {() => (
                <ProtectedRoute>
                  <EligibilityChecker />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/manual">
              {() => (
                <ProtectedRoute>
                  <PolicyManual />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/intake">
              {() => (
                <ProtectedRoute>
                  <IntakeCopilot />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/scenarios">
              {() => (
                <ProtectedRoute>
                  <ScenarioWorkspace />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/tax">
              {() => (
                <ProtectedRoute>
                  <TaxPreparation />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/efile">
              {() => (
                <ProtectedRoute>
                  <EFileDashboard />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/vita">
              {() => (
                <ProtectedRoute>
                  <VitaKnowledgeBase />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/vita-intake">
              {() => (
                <ProtectedRoute>
                  <VitaIntake />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/vita-documents/:sessionId">
              {() => (
                <ProtectedRoute>
                  <VitaDocuments />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/appointments">
              {() => (
                <ProtectedRoute requireStaff>
                  <AppointmentsCalendar />
                </ProtectedRoute>
              )}
            </Route>
            
            {/* Taxpayer Self-Service Portal - Protected routes for taxpayers */}
            <Route path="/taxpayer">
              {() => (
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerDashboard />
                  </TaxpayerLayout>
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/taxpayer/documents">
              {() => (
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerDocumentRequests />
                  </TaxpayerLayout>
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/taxpayer/messages">
              {() => (
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerMessaging />
                  </TaxpayerLayout>
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/taxpayer/signature">
              {() => (
                <ProtectedRoute>
                  <TaxpayerLayout>
                    <TaxpayerSignature />
                  </TaxpayerLayout>
                </ProtectedRoute>
              )}
            </Route>
            
            {/* Staff-only routes */}
            <Route path="/verify">
              {() => (
                <ProtectedRoute requireStaff>
                  <DocumentVerificationPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/navigator">
              {() => (
                <ProtectedRoute requireStaff>
                  <NavigatorWorkspace />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/consent">
              {() => (
                <ProtectedRoute requireStaff>
                  <ConsentManagement />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/household-profiler">
              {() => (
                <ProtectedRoute requireStaff>
                  <HouseholdProfiler />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/analytics">
              {() => (
                <ProtectedRoute requireStaff>
                  <Analytics />
                </ProtectedRoute>
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
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/rules">
              {() => (
                <ProtectedRoute requireAdmin>
                  <RulesExtraction />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/sources">
              {() => (
                <ProtectedRoute requireAdmin>
                  <PolicySources />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/ai-monitoring">
              {() => (
                <ProtectedRoute>
                  <AIMonitoring />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/maive">
              {() => (
                <ProtectedRoute requireAdmin>
                  <MAIVEDashboard />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/monitoring">
              {() => (
                <ProtectedRoute requireAdmin>
                  <Monitoring />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/efile-monitoring">
              {() => (
                <ProtectedRoute requireAdmin>
                  <EFileMonitoring />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/security-monitoring">
              {() => (
                <ProtectedRoute requireAdmin>
                  <SecurityMonitoring />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/audit-logs">
              {() => (
                <ProtectedRoute requireAdmin>
                  <AuditLogs />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/policy-changes">
              {() => (
                <ProtectedRoute>
                  <PolicyChanges />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/compliance">
              {() => (
                <ProtectedRoute requireAdmin>
                  <ComplianceAdmin />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/api-docs">
              {() => (
                <ProtectedRoute requireAdmin>
                  <ApiDocs />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/developer">
              {() => (
                <ProtectedRoute>
                  <DeveloperPortal />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/feedback">
              {() => (
                <ProtectedRoute requireAdmin>
                  <FeedbackManagement />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/counties">
              {() => (
                <ProtectedRoute requireAdmin>
                  <CountyManagement />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/county-analytics">
              {() => (
                <ProtectedRoute requireAdmin>
                  <CountyAnalytics />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/abawd-verifications">
              {() => (
                <ProtectedRoute requireStaff>
                  <AbawdVerificationAdmin />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/cross-enrollment">
              {() => (
                <ProtectedRoute requireStaff>
                  <CrossEnrollmentAdmin />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/per">
              {() => (
                <ProtectedRoute requireStaff>
                  <PerDashboard />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/researchers">
              {() => (
                <ProtectedRoute requireAdmin>
                  <ResearcherManagement />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/navigator/document-review">
              {() => (
                <ProtectedRoute requireStaff>
                  <DocumentReviewQueue />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/training">
              {() => (
                <ProtectedRoute requireAdmin>
                  <Training />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/evaluation">
              {() => (
                <ProtectedRoute requireAdmin>
                  <EvaluationFramework />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/fns-state-options">
              {() => (
                <ProtectedRoute requireAdmin>
                  <FNSStateOptionsManager />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/federal-law-tracker">
              {() => (
                <ProtectedRoute requireAdmin>
                  <FederalLawTracker />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/state-law-tracker">
              {() => (
                <ProtectedRoute requireAdmin>
                  <StateLawTracker />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/scheduler">
              {() => (
                <ProtectedRoute requireAdmin>
                  <SmartScheduler />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/county-tax-rates">
              {() => (
                <ProtectedRoute requireAdmin>
                  <CountyTaxRates />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/webhooks">
              {() => (
                <ProtectedRoute requireAdmin>
                  <WebhookManagement />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/security">
              {() => (
                <ProtectedRoute requireAdmin>
                  <SecurityDashboard />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/users">
              {() => (
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/analytics">
              {() => (
                <ProtectedRoute requireAdmin>
                  <AnalyticsDashboard />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/bar">
              {() => (
                <ProtectedRoute requireAdmin>
                  <BarDashboard />
                </ProtectedRoute>
              )}
            </Route>
            
            {/* 404 fallback */}
            <Route component={NotFound} />
          </Switch>
        </Suspense>
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
      <TooltipProvider>
        <Toaster />
        <HelmetProvider>
          <TenantProvider>
            <TenantThemeProvider>
              <BrandingProvider>
                <SessionExpiryProvider>
                  <Router />
                </SessionExpiryProvider>
              </BrandingProvider>
            </TenantThemeProvider>
          </TenantProvider>
        </HelmetProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
