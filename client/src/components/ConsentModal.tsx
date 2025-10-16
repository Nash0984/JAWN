import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ConsentModalProps {
  isOpen: boolean;
  userId: string;
}

const POLICY_VERSION = "1.0";

export default function ConsentModal({ isOpen, userId }: ConsentModalProps) {
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const consentMutation = useMutation({
    mutationFn: async () => {
      // Get IP address and user agent from client
      const userAgent = navigator.userAgent;
      
      return await apiRequest("POST", "/api/legal/consent", {
        userId,
        policyType: "both",
        policyVersion: POLICY_VERSION,
        userAgent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal/consent/latest"] });
      toast({
        title: "Consent Recorded",
        description: "You have accepted the Terms of Service and Privacy Policy.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record consent. Please try again.",
        variant: "destructive",
      });
      console.error("Consent error:", error);
    },
  });

  const handleAccept = () => {
    if (privacyChecked && termsChecked) {
      consentMutation.mutate();
    }
  };

  const canAccept = privacyChecked && termsChecked;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} data-testid="consent-modal">
      <DialogContent 
        className="max-w-3xl max-h-[90vh]" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="consent-modal-content"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-consent-title">
            Welcome to Maryland Benefits Platform
          </DialogTitle>
          <DialogDescription data-testid="text-consent-description">
            Before you continue, please review and accept our Terms of Service and Privacy Policy
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {/* Privacy Policy Summary */}
            <div className="border rounded-lg p-4" data-testid="section-privacy-summary">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Privacy Policy</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    We are committed to protecting your personal and protected health information (PHI) in compliance with HIPAA regulations:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>AES-256-GCM encryption for sensitive data</li>
                    <li>No third-party sharing of personal information</li>
                    <li>HIPAA Privacy Rule compliance for all PHI</li>
                    <li>Your right to access, correct, and delete your data</li>
                  </ul>
                  <Link href="/legal/privacy" target="_blank">
                    <Button variant="link" className="p-0 h-auto mt-2" data-testid="link-privacy-full">
                      Read Full Privacy Policy
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Terms of Service Summary */}
            <div className="border rounded-lg p-4" data-testid="section-terms-summary">
              <div className="flex items-start gap-3 mb-3">
                <FileText className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Terms of Service</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    By using this platform, you agree to:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Provide accurate and truthful information</li>
                    <li>Use the platform only for lawful purposes</li>
                    <li>Understand this is NOT an official government website</li>
                    <li>Accept that eligibility screening is for informational purposes only</li>
                    <li>Review all applications and documents before submission</li>
                  </ul>
                  <Link href="/legal/terms" target="_blank">
                    <Button variant="link" className="p-0 h-auto mt-2" data-testid="link-terms-full">
                      Read Full Terms of Service
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="space-y-4 pt-4 border-t">
          {/* Privacy Checkbox */}
          <div className="flex items-start space-x-3" data-testid="checkbox-privacy-container">
            <Checkbox
              id="privacy-consent"
              checked={privacyChecked}
              onCheckedChange={(checked) => setPrivacyChecked(checked as boolean)}
              data-testid="checkbox-privacy"
            />
            <Label
              htmlFor="privacy-consent"
              className="text-sm font-normal leading-relaxed cursor-pointer"
              data-testid="label-privacy"
            >
              I have read and agree to the{" "}
              <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </Label>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start space-x-3" data-testid="checkbox-terms-container">
            <Checkbox
              id="terms-consent"
              checked={termsChecked}
              onCheckedChange={(checked) => setTermsChecked(checked as boolean)}
              data-testid="checkbox-terms"
            />
            <Label
              htmlFor="terms-consent"
              className="text-sm font-normal leading-relaxed cursor-pointer"
              data-testid="label-terms"
            >
              I have read and agree to the{" "}
              <Link href="/legal/terms" target="_blank" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!canAccept || consentMutation.isPending}
            className="w-full sm:w-auto"
            data-testid="button-accept-consent"
          >
            {consentMutation.isPending ? "Recording..." : "Accept and Continue"}
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-muted-foreground" data-testid="text-consent-version">
          Policy Version {POLICY_VERSION} • Last Updated: October 16, 2025
        </p>
      </DialogContent>
    </Dialog>
  );
}
