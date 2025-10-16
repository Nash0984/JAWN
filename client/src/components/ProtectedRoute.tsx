import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import ConsentModal from "@/components/ConsentModal";
import type { UserConsent } from "@shared/schema";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: "client" | "navigator" | "caseworker" | "admin" | "super_admin";
  requireStaff?: boolean; // Requires navigator, caseworker, admin, or super_admin
  requireAdmin?: boolean; // Requires admin or super_admin
}

const CURRENT_POLICY_VERSION = "1.0";

export default function ProtectedRoute({
  children,
  requireRole,
  requireStaff = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, isStaff, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  // Check for user consent
  const { data: latestConsent, isLoading: isConsentLoading } = useQuery<UserConsent | null>({
    queryKey: ["/api/legal/consent/latest"],
    enabled: isAuthenticated && !!user,
  });

  const needsConsent = isAuthenticated && 
    user && 
    !isConsentLoading && 
    (!latestConsent || latestConsent.policyVersion !== CURRENT_POLICY_VERSION);

  useEffect(() => {
    // Wait for auth to load before redirecting
    if (isLoading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // Show loading state while checking auth or consent
  if (isLoading || (isAuthenticated && isConsentLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }

  // Don't render anything while redirecting to login
  if (!isAuthenticated) {
    return null;
  }

  // Show consent modal if user hasn't consented to current policy version
  if (needsConsent && user) {
    return <ConsentModal isOpen={true} userId={user.id} />;
  }

  // Check role-based access
  let hasAccess = true;
  let denialReason = "";

  if (requireAdmin && !isAdmin) {
    hasAccess = false;
    denialReason = "This page requires administrator privileges.";
  } else if (requireStaff && !isStaff) {
    hasAccess = false;
    denialReason = "This page is only accessible to DHS staff (navigators, caseworkers, and administrators).";
  } else if (requireRole && user?.role !== requireRole) {
    hasAccess = false;
    denialReason = `This page requires ${requireRole} role access.`;
  }

  // Show unauthorized message if authenticated but wrong role
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full" data-testid="unauthorized-message">
          <CardHeader>
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>{denialReason}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are currently logged in as a <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>.
                {" "}If you believe you should have access to this page, please contact your administrator.
              </p>
              <div className="flex space-x-2">
                <Button asChild className="flex-1" data-testid="button-home">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render protected content if authorized
  return <>{children}</>;
}
