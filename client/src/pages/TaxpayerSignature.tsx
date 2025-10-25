import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PenTool, Eraser, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

export default function TaxpayerSignature() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; // Higher resolution
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const submitSignatureMutation = useMutation({
    mutationFn: async ({ signatureData, documentHash }: { signatureData: string; documentHash: string }) => {
      const response = await apiRequest("POST", "/api/taxpayer/esignatures", {
        signatureData,
        documentHash,
        signatureType: "drawn",
        signerName: user?.fullName || "Taxpayer",
        formType: "irs_consent_8879",
        formName: "IRS e-file Authorization",
        formYear: new Date().getFullYear(),
        disclosureText: ESIGN_DISCLOSURE_TEXT,
        disclosureAccepted: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxpayer/esignatures"] });
      setSignatureSubmitted(true);
      toast({
        title: "Signature Submitted",
        description: "Your electronic signature has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit signature. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      toast({
        title: "No Signature",
        description: "Please draw your signature before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!consentAccepted) {
      toast({
        title: "Consent Required",
        description: "You must accept the e-signature disclosure to continue.",
        variant: "destructive",
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to base64
    const signatureData = canvas.toDataURL("image/png");

    // Generate document hash (simple hash for demo - in production use crypto.subtle)
    const documentHash = await generateHash(signatureData);

    await submitSignatureMutation.mutateAsync({
      signatureData,
      documentHash,
    });
  };

  // Simple hash function (in production, use crypto.subtle.digest)
  const generateHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  if (signatureSubmitted) {
    return (
      <>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="success-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6 mb-6">
                <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold text-foreground dark:text-foreground mb-2">
                Signature Submitted Successfully
              </h2>
              <p className="text-muted-foreground dark:text-muted-foreground text-center max-w-md mb-6">
                Your electronic signature has been recorded and is legally binding. Your navigator will be notified.
              </p>
              <Button asChild>
                <a href="/taxpayer">Return to Dashboard</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-2" data-testid="page-title">
            Electronic Signature
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Sign your tax forms electronically with legal compliance
          </p>
        </div>

        {/* E-SIGN Act Disclosure */}
        <Card className="mb-6 bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-foreground dark:text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              E-SIGN Act Disclosure
            </CardTitle>
            <CardDescription className="text-muted-foreground dark:text-muted-foreground">
              Please read and accept the following disclosure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/30 dark:bg-muted/10 rounded-lg max-h-60 overflow-y-auto border border-border dark:border-border">
              <p className="text-sm text-foreground dark:text-foreground whitespace-pre-line">
                {ESIGN_DISCLOSURE_TEXT}
              </p>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="consent"
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked as boolean)}
                data-testid="checkbox-esign-consent"
                aria-label="Accept e-signature consent"
              />
              <Label
                htmlFor="consent"
                className="text-sm text-foreground dark:text-foreground cursor-pointer leading-relaxed"
              >
                I have read and agree to the E-SIGN Act disclosure. I consent to using electronic signatures
                and understand that my electronic signature is legally binding.
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Signature Canvas */}
        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground dark:text-foreground flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary dark:text-primary" aria-hidden="true" />
                  Sign Here
                </CardTitle>
                <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                  Draw your signature using your mouse or touch screen
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature}
                data-testid="button-clear-signature"
              >
                <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border dark:border-border rounded-lg p-4 bg-background dark:bg-background">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-48 bg-white dark:bg-gray-900 rounded cursor-crosshair touch-none"
                data-testid="canvas-signature"
                aria-label="Signature canvas"
              />
            </div>

            <Alert className="mt-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Your signature will be recorded along with your IP address and timestamp
                for legal compliance. This signature is legally binding and equivalent to a handwritten signature.
              </AlertDescription>
            </Alert>

            <div className="mt-6 flex gap-4">
              <Button
                onClick={handleSubmit}
                disabled={!hasSignature || !consentAccepted || submitSignatureMutation.isPending}
                className="flex-1"
                size="lg"
                data-testid="button-sign-document"
              >
                <PenTool className="mr-2 h-5 w-5" aria-hidden="true" />
                {submitSignatureMutation.isPending ? "Submitting..." : "Submit Signature"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="mt-6 bg-muted/30 dark:bg-muted/10 border-border dark:border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              <strong>Legal Notice:</strong> By submitting your signature, you acknowledge that you have reviewed
              all tax forms and consent to electronic filing. This signature authorizes your tax navigator to
              electronically file your tax return with the IRS and state tax authorities.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// E-SIGN Act compliant disclosure text
const ESIGN_DISCLOSURE_TEXT = `ELECTRONIC SIGNATURE CONSENT AND DISCLOSURE

By checking the box and signing below, you consent to use electronic signatures and electronic records in accordance with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act).

1. CONSENT TO ELECTRONIC SIGNATURES
You agree that your electronic signature on documents is intended to authenticate this document and to have the same force and effect as a manual signature.

2. SCOPE OF CONSENT
This consent applies to all tax-related documents, forms, and communications associated with your tax return preparation and filing, including but not limited to IRS Form 8879 (IRS e-file Signature Authorization).

3. SYSTEM REQUIREMENTS
To access and retain electronic records, you need:
- A device with internet access
- A current web browser (Chrome, Firefox, Safari, or Edge)
- Sufficient storage space to save or print documents
- A valid email address

4. RIGHT TO WITHDRAW CONSENT
You have the right to withdraw your consent to use electronic signatures at any time by contacting your tax navigator. Withdrawal of consent will not affect the legal validity of signatures made before withdrawal.

5. HOW TO REQUEST PAPER COPIES
You may request paper copies of electronically signed documents at any time by contacting your tax navigator.

6. RECORD RETENTION
Your electronic signature will be recorded and stored securely along with:
- Date and time of signature
- IP address
- Device information
- Document hash (for tamper detection)

This information will be retained for at least 7 years in compliance with IRS record-keeping requirements.

7. ELECTRONIC DELIVERY OF DOCUMENTS
By consenting to electronic signatures, you also agree to receive copies of your signed documents electronically.

If you have questions about electronic signatures or this disclosure, please contact your tax navigator before proceeding.`;
