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
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/Navigation";

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
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/upload" component={Upload} />
          <Route path="/verify" component={DocumentVerificationPage} />
          <Route path="/navigator" component={NavigatorWorkspace} />
          <Route path="/consent" component={ConsentManagement} />
          <Route path="/admin" component={Admin} />
          <Route path="/training" component={Training} />
          <Route path="/eligibility" component={EligibilityChecker} />
          <Route path="/manual" component={PolicyManual} />
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
