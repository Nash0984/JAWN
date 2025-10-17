import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IRSConsentReviewProps {
  sessionId: string;
  clientCaseId: string;
  onConsentComplete: () => void;
}

export function IRSConsentReview({ sessionId, clientCaseId, onConsentComplete }: IRSConsentReviewProps) {
  const [snap, setSnap] = useState(false);
  const [medicaid, setMedicaid] = useState(false);
  const [tca, setTca] = useState(false);
  const [ohep, setOhep] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();
  
  // Fetch IRS consent form
  const { data: formData, isLoading: isLoadingForm, error: formError } = useQuery({
    queryKey: ['/api/consent/forms/irs_use_disclosure'],
  });
  
  const consentMutation = useMutation({
    mutationFn: async () => {
      const benefitPrograms = [
        snap && 'snap',
        medicaid && 'medicaid',
        tca && 'tca',
        ohep && 'ohep'
      ].filter(Boolean);
      
      return await apiRequest('POST', '/api/consent/client-consents/vita', {
        consentFormId: formData?.data?.id,
        sessionId,
        clientCaseId,
        benefitPrograms,
        signatureData: signatureName,
        signatureMethod: 'electronic'
      });
    },
    onSuccess: () => {
      toast({
        title: "Consent Recorded",
        description: "IRS authorization successfully recorded",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/consent/vita-session', sessionId] });
      onConsentComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error Recording Consent",
        description: error.message || "Failed to record consent. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const canSubmit = agreedToTerms && signatureName.trim().length > 0;
  
  if (isLoadingForm) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="loading-consent-form">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 text-blue-600 mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading consent form...</p>
        </div>
      </div>
    );
  }
  
  if (formError || !formData?.data) {
    return (
      <Alert variant="destructive" data-testid="error-consent-form">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unable to load IRS consent form. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="irs-consent-review">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-consent-title">IRS Use & Disclosure Authorization</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Required to share tax information with benefit programs
          </p>
        </div>
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This consent allows us to use your tax information to determine benefit eligibility and streamline your applications.
          Your information is protected and encrypted.
        </AlertDescription>
      </Alert>
      
      <ScrollArea className="h-[400px] border rounded-lg p-4 bg-muted/50" data-testid="scroll-consent-content">
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {formData.data.formContent}
          </pre>
        </div>
      </ScrollArea>
      
      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="font-semibold text-base">Select Benefit Programs (check all that apply):</Label>
          <p className="text-sm text-muted-foreground">
            Choose which programs you authorize us to share your tax information with.
          </p>
          
          <div className="space-y-3 ml-2">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="snap-checkbox"
                checked={snap} 
                onCheckedChange={(checked) => setSnap(checked as boolean)} 
                data-testid="checkbox-snap" 
              />
              <Label htmlFor="snap-checkbox" className="font-normal cursor-pointer">
                SNAP (Supplemental Nutrition Assistance Program)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="medicaid-checkbox"
                checked={medicaid} 
                onCheckedChange={(checked) => setMedicaid(checked as boolean)} 
                data-testid="checkbox-medicaid" 
              />
              <Label htmlFor="medicaid-checkbox" className="font-normal cursor-pointer">
                Medicaid (Medical Assistance)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="tca-checkbox"
                checked={tca} 
                onCheckedChange={(checked) => setTca(checked as boolean)} 
                data-testid="checkbox-tca" 
              />
              <Label htmlFor="tca-checkbox" className="font-normal cursor-pointer">
                TCA (Temporary Cash Assistance / TANF)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="ohep-checkbox"
                checked={ohep} 
                onCheckedChange={(checked) => setOhep(checked as boolean)} 
                data-testid="checkbox-ohep" 
              />
              <Label htmlFor="ohep-checkbox" className="font-normal cursor-pointer">
                OHEP (Office of Home Energy Programs)
              </Label>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signature" className="font-semibold">
            Electronic Signature (type your full legal name):
          </Label>
          <Input
            id="signature"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Type your full legal name"
            data-testid="input-signature"
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            By typing your name, you are providing your electronic signature.
          </p>
        </div>
        
        <div className="flex items-start gap-2 p-4 border rounded-lg bg-muted/30">
          <Checkbox
            id="agree-terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
            data-testid="checkbox-agree"
          />
          <Label htmlFor="agree-terms" className="text-sm font-normal cursor-pointer leading-relaxed">
            I have read and understand this authorization. I voluntarily consent to the use and disclosure of my tax information as described above.
          </Label>
        </div>
      </div>
      
      <div className="flex gap-3">
        <Button
          onClick={() => consentMutation.mutate()}
          disabled={!canSubmit || consentMutation.isPending}
          className="flex-1"
          data-testid="button-submit-consent"
        >
          {consentMutation.isPending ? 'Recording Consent...' : 'Submit Authorization'}
        </Button>
      </div>
      
      {!canSubmit && (
        <p className="text-xs text-muted-foreground text-center" data-testid="text-validation-message">
          Please sign with your full name and agree to the terms to continue.
        </p>
      )}
    </div>
  );
}
