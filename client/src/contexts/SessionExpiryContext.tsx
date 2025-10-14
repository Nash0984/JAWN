import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";
import { onSessionExpiry } from "@/lib/queryClient";

interface SessionExpiryContextType {
  triggerSessionExpiry: () => void;
  dismissDialog: () => void;
  isSessionExpired: boolean;
}

const SessionExpiryContext = createContext<SessionExpiryContextType | undefined>(undefined);

export function useSessionExpiry() {
  const context = useContext(SessionExpiryContext);
  if (!context) {
    throw new Error("useSessionExpiry must be used within SessionExpiryProvider");
  }
  return context;
}

interface SessionExpiryProviderProps {
  children: ReactNode;
}

export function SessionExpiryProvider({ children }: SessionExpiryProviderProps) {
  const [location, setLocation] = useLocation();
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  // Trigger session expiry from anywhere in the app
  const triggerSessionExpiry = useCallback(() => {
    // Don't trigger if already on login/signup pages
    if (location === "/login" || location === "/signup") {
      return;
    }

    // Store current location for return after re-auth
    setReturnUrl(location);
    setIsSessionExpired(true);
    setShowDialog(true);
  }, [location]);

  // Dismiss the dialog
  const dismissDialog = useCallback(() => {
    setShowDialog(false);
  }, []);

  // Handle sign in action
  const handleSignIn = useCallback(() => {
    setShowDialog(false);
    // Navigate to login with returnUrl parameter
    const loginUrl = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login";
    setLocation(loginUrl);
  }, [returnUrl, setLocation]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    setShowDialog(false);
    setIsSessionExpired(false);
    setReturnUrl(null);
  }, []);

  // Reset expiry state when location changes to login
  useEffect(() => {
    if (location === "/login") {
      setIsSessionExpired(false);
    }
  }, [location]);

  // Listen for session expiry events from queryClient
  useEffect(() => {
    const unsubscribe = onSessionExpiry(() => {
      triggerSessionExpiry();
    });

    return () => {
      unsubscribe();
    };
  }, [triggerSessionExpiry]);

  return (
    <SessionExpiryContext.Provider
      value={{
        triggerSessionExpiry,
        dismissDialog,
        isSessionExpired,
      }}
    >
      {children}
      
      {/* Session Expiry Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent 
          className="max-w-md"
          data-testid="dialog-session-expiry"
        >
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
              </div>
              <AlertDialogTitle className="text-xl">
                Your session has expired
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed space-y-3 pt-2">
              <p>
                For your security, you've been logged out due to inactivity. Please sign in again to continue.
              </p>
              <p className="font-medium text-foreground">
                Don't worry — your work has been automatically saved and will be restored when you sign back in.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel
              onClick={handleCancel}
              className="sm:flex-1"
              data-testid="button-cancel-session-expiry"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignIn}
              className="sm:flex-1 bg-maryland-red hover:bg-maryland-red/90 min-h-[44px]"
              data-testid="button-signin-session-expiry"
            >
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SessionExpiryContext.Provider>
  );
}
