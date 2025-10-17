import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface IRSConsentReviewProps {
  vitaSessionId: string;
  clientCaseId: string;
  onConsentComplete: () => void;
}

export function IRSConsentReview({ vitaSessionId, clientCaseId, onConsentComplete }: IRSConsentReviewProps) {
  const { toast } = useToast();
  const [typedName, setTypedName] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [hasReadForm, setHasReadForm] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  
  // Fetch IRS consent form by code
  const { data: formData, isLoading: formLoading } = useQuery<any>({
    queryKey: ['/api/consent/forms/irs_use_disclosure'],
  });
  
  // Check if consent already exists for this session
  const { data: existingConsent, isLoading: consentLoading } = useQuery<any>({
    queryKey: ['/api/consent/client-consents/vita-session', vitaSessionId],
  });
  
  const consentForm = formData?.data;
  const hasExistingConsent = existingConsent?.data && existingConsent.data.length > 0;
  
  // Submit consent mutation
  const consentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/consent/client-consents', {
        clientCaseId,
        consentFormId: consentForm.id,
        vitaIntakeSessionId: vitaSessionId,
        benefitProgramsAuthorized: selectedPrograms,
        signatureMetadata: {
          typedName,
          date: new Date().toISOString(),
          method: 'electronic',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Consent Recorded',
        description: 'Your IRS Use & Disclosure authorization has been recorded.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/consent/client-consents/vita-session'] });
      onConsentComplete();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record consent',
        variant: 'destructive',
      });
    },
  });
  
  const benefitPrograms = [
    { code: 'snap', label: 'SNAP (Food Assistance)', icon: '🍎' },
    { code: 'medicaid', label: 'Medicaid (Medical Assistance)', icon: '🏥' },
    { code: 'tca', label: 'TCA/TANF (Cash Assistance)', icon: '💵' },
    { code: 'ohep', label: 'OHEP (Energy Assistance)', icon: '⚡' },
  ];
  
  const toggleProgram = (code: string) => {
    setSelectedPrograms(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };
  
  const canSubmit = typedName.trim().length >= 3 && selectedPrograms.length > 0 && hasReadForm && hasAgreed;
  
  if (formLoading || consentLoading) {
    return <div className="text-center py-8">Loading consent form...</div>;
  }
  
  if (!consentForm) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          IRS consent form not found. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (hasExistingConsent) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          You have already provided IRS Use & Disclosure consent for this tax session.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Shield className="h-6 w-6 text-blue-600 mt-1" />
            <div className="flex-1">
              <CardTitle>{consentForm.formTitle}</CardTitle>
              <CardDescription>{consentForm.purpose}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form Content */}
          <ScrollArea className="h-[400px] border rounded-md p-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>
                {consentForm.formContent}
              </ReactMarkdown>
            </div>
          </ScrollArea>
          
          {/* Benefit Program Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Select Benefit Programs to Authorize:</Label>
            <p className="text-sm text-muted-foreground">
              Check the programs you want to use your tax information for eligibility determination.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {benefitPrograms.map((program) => (
                <div
                  key={program.code}
                  className="flex items-center space-x-3 border rounded-lg p-3"
                  data-testid={`checkbox-program-${program.code}`}
                >
                  <Checkbox
                    id={`program-${program.code}`}
                    checked={selectedPrograms.includes(program.code)}
                    onCheckedChange={() => toggleProgram(program.code)}
                  />
                  <span className="text-lg">{program.icon}</span>
                  <Label
                    htmlFor={`program-${program.code}`}
                    className="cursor-pointer flex-1"
                  >
                    {program.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Electronic Signature */}
          <div className="space-y-3">
            <Label htmlFor="typed-name" className="text-base font-semibold">
              Electronic Signature
            </Label>
            <p className="text-sm text-muted-foreground">
              Type your full legal name below to electronically sign this authorization.
            </p>
            <Input
              id="typed-name"
              placeholder="Type your full legal name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="text-lg font-serif"
              data-testid="input-signature"
            />
          </div>
          
          {/* Acknowledgment Checkboxes */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="read-form"
                checked={hasReadForm}
                onCheckedChange={(checked) => setHasReadForm(checked as boolean)}
                data-testid="checkbox-read-form"
              />
              <Label htmlFor="read-form" className="cursor-pointer leading-relaxed">
                I have read and understand the IRS Use & Disclosure Authorization
              </Label>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="agree"
                checked={hasAgreed}
                onCheckedChange={(checked) => setHasAgreed(checked as boolean)}
                data-testid="checkbox-agree"
              />
              <Label htmlFor="agree" className="cursor-pointer leading-relaxed">
                I voluntarily consent to the use of my tax information as described above
              </Label>
            </div>
          </div>
          
          {/* Submit Button */}
          <Button
            onClick={() => consentMutation.mutate()}
            disabled={!canSubmit || consentMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-submit-consent"
          >
            {consentMutation.isPending ? 'Recording Consent...' : 'Sign and Submit Authorization'}
          </Button>
          
          {/* Legal Footer */}
          <p className="text-xs text-center text-muted-foreground">
            {consentForm.irsPublicationRef} • Version {consentForm.version}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
