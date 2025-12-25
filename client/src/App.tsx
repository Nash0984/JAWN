import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import Admin from "@/pages/Admin";
import Training from "@/pages/Training";
import EligibilityChecker from "@/pages/EligibilityChecker";
import PolicyManual from "@/pages/PolicyManual";
import DocumentVerificationPage from "@/pages/DocumentVerificationPage";
import NavigatorWorkspace from "@/pages/NavigatorWorkspace";
import ConsentManagement from "@/pages/ConsentManagement";
import RulesExtraction from "@/pages/RulesExtraction";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/Navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import ClientDashboard from "@/pages/ClientDashboard";
import NavigatorDashboard from "@/pages/NavigatorDashboard";
import CaseworkerDashboard from "@/pages/CaseworkerDashboard";
import CaseworkerCockpit from "@/pages/CaseworkerCockpit";
import SupervisorCockpit from "@/pages/SupervisorCockpit";
import AdminDashboard from "@/pages/AdminDashboard";
import PolicySources from "@/pages/PolicySources";
import AIMonitoring from "@/pages/AIMonitoring";
import SecurityMonitoring from "@/pages/SecurityMonitoring";
import AuditLogs from "@/pages/AuditLogs";
import MAIVEDashboard from "@/pages/MAIVEDashboard";
import ApiDocs from "@/pages/ApiDocs";
import Monitoring from "@/pages/admin/Monitoring";
import DeveloperPortal from "@/pages/DeveloperPortal";
import FeedbackManagement from "@/pages/FeedbackManagement";
import NotificationCenter from "@/pages/NotificationCenter";
import NotificationSettings from "@/pages/NotificationSettings";
import DocumentChecklist from "@/pages/public/DocumentChecklist";
import NoticeExplainer from "@/pages/public/NoticeExplainer";
import SimplifiedSearch from "@/pages/public/SimplifiedSearch";
import BenefitScreener from "@/pages/public/BenefitScreener";
import QuickScreener from "@/pages/public/QuickScreener";
import FsaLanding from "@/pages/public/FsaLanding";
import { CommandPalette } from "@/components/CommandPalette";
import { PolicyChanges } from "@/pages/PolicyChanges";
import { ComplianceAdmin } from "@/pages/ComplianceAdmin";
import { IntakeCopilot } from "@/pages/IntakeCopilot";
import ScenarioWorkspace from "@/pages/ScenarioWorkspace";
import LegalHub from "@/pages/legal/index";
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsOfService from "@/pages/legal/TermsOfService";
import AccessibilityStatement from "@/pages/legal/AccessibilityStatement";
import DataSecurityPolicy from "@/pages/legal/DataSecurityPolicy";
import BreachNotificationPolicy from "@/pages/legal/BreachNotificationPolicy";
import Disclaimer from "@/pages/legal/Disclaimer";
import License from "@/pages/legal/License";
import AbawdVerificationAdmin from "@/pages/AbawdVerificationAdmin";
import CrossEnrollmentAdmin from "@/pages/CrossEnrollmentAdmin";
// COMMENTED OUT DURING SCHEMA ROLLBACK
// import SmsConfig from "@/pages/admin/SmsConfig";
import FNSStateOptionsManager from "@/pages/admin/FNSStateOptionsManager";
import FederalLawTracker from "@/pages/admin/FederalLawTracker";
import StateLawTracker from "@/pages/admin/StateLawTracker";
import SmartScheduler from "@/pages/admin/SmartScheduler";
import WebhookManagement from "@/pages/admin/WebhookManagement";
import DocumentReviewQueue from "@/pages/DocumentReviewQueue";
import CountyManagement from "@/pages/CountyManagement";
import NavigatorPerformance from "@/pages/NavigatorPerformance";
import Leaderboard from "@/pages/Leaderboard";
import CountyAnalytics from "@/pages/CountyAnalytics";
import EvaluationFramework from "@/pages/EvaluationFramework";
import HouseholdProfiler from "@/pages/HouseholdProfiler";
import Analytics from "@/pages/Analytics";
import AppointmentsCalendar from "@/pages/AppointmentsCalendar";
import { IntakeAssistant } from "@/pages/IntakeAssistant";
import MobileBottomNav from "@/components/MobileBottomNav";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { CountyHeader } from "@/components/CountyHeader";
import { SessionExpiryProvider } from "@/contexts/SessionExpiryContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TenantProvider } from "@/contexts/TenantContext";
import { TenantThemeProvider } from "@/components/TenantThemeProvider";
import Footer from "@/components/Footer";
import Demo from "@/pages/Demo";
import APIExplorer from "@/pages/APIExplorer";
import Developers from "@/pages/Developers";
import SupervisorReviewDashboard from "@/pages/SupervisorReviewDashboard";
// COMMENTED OUT DURING SCHEMA ROLLBACK
// import MobileScreening from "@/pages/MobileScreening";

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
          
          {/* Mobile SMS Screening - No login required */}
          {/* COMMENTED OUT DURING SCHEMA ROLLBACK */}
          {/* <Route path="/screening/:token" component={MobileScreening} /> */}
          {/* <Route path="/s/:token" component={MobileScreening} /> */}
          
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
          <Route path="/appointments">
            {() => (
              <ProtectedRoute requireStaff>
                <AppointmentsCalendar />
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
          <Route path="/admin/webhooks">
            {() => (
              <ProtectedRoute requireAdmin>
                <WebhookManagement />
              </ProtectedRoute>
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
    <HelmetProvider>
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
    </HelmetProvider>
  );
}

export default App;
