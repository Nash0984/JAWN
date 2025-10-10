import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import AdminDashboard from "@/pages/AdminDashboard";
import PolicySources from "@/pages/PolicySources";
import AIMonitoring from "@/pages/AIMonitoring";
import AuditLogs from "@/pages/AuditLogs";
import ApiDocs from "@/pages/ApiDocs";
import FeedbackManagement from "@/pages/FeedbackManagement";
import NotificationCenter from "@/pages/NotificationCenter";
import NotificationSettings from "@/pages/NotificationSettings";
import DocumentChecklist from "@/pages/public/DocumentChecklist";
import NoticeExplainer from "@/pages/public/NoticeExplainer";
import SimplifiedSearch from "@/pages/public/SimplifiedSearch";
import BenefitScreener from "@/pages/public/BenefitScreener";
import { CommandPalette } from "@/components/CommandPalette";
import { PolicyChanges } from "@/pages/PolicyChanges";
import { ComplianceAdmin } from "@/pages/ComplianceAdmin";
import { IntakeCopilot } from "@/pages/IntakeCopilot";
import ScenarioWorkspace from "@/pages/ScenarioWorkspace";
import AbawdVerificationAdmin from "@/pages/AbawdVerificationAdmin";
import CrossEnrollmentAdmin from "@/pages/CrossEnrollmentAdmin";
import DocumentReviewQueue from "@/pages/DocumentReviewQueue";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup";

  return (
    <div className="min-h-screen bg-background">
      {/* Command Palette - Global Cmd+K navigation */}
      <CommandPalette />
      
      {/* Skip link for accessibility (only on non-auth pages) */}
      {!isAuthPage && <a href="#main-content" className="skip-link">Skip to main content</a>}
      
      {/* Show navigation only on non-auth pages */}
      {!isAuthPage && <Navigation />}
      
      <main id="main-content" role="main">
        <Switch>
          {/* Public routes */}
          <Route path="/" component={Home} />
          <Route path="/search" component={Home} />
          <Route path="/help" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          
          {/* Public Portal - No login required */}
          <Route path="/public/documents" component={DocumentChecklist} />
          <Route path="/public/notices" component={NoticeExplainer} />
          <Route path="/public/search" component={SimplifiedSearch} />
          <Route path="/screener" component={BenefitScreener} />
          
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
          <Route path="/dashboard/caseworker">
            {() => (
              <ProtectedRoute requireStaff>
                <CaseworkerDashboard />
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
          <Route path="/admin/feedback">
            {() => (
              <ProtectedRoute requireAdmin>
                <FeedbackManagement />
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
          
          {/* 404 fallback */}
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
