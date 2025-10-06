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

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup";

  return (
    <div className="min-h-screen bg-background">
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
