import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldAlert, Copy, RefreshCw, X } from 'lucide-react';

interface MFAStatus {
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
}

interface MFASetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export function MFASettings() {
  const { toast } = useToast();
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState<'scan' | 'verify' | 'backup'>('scan');
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [regenerateToken, setRegenerateToken] = useState('');

  // Fetch MFA status
  const { data: mfaStatus, isLoading } = useQuery<MFAStatus>({
    queryKey: ['/api/mfa/status'],
  });

  // Setup MFA mutation
  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mfa/setup', {});
      return await res.json();
    },
    onSuccess: (data) => {
      setSetupData(data);
      setSetupStep('scan');
      setShowSetup(true);
    },
    onError: (error: any) => {
      toast({
        title: 'Setup Failed',
        description: error.message || 'Failed to initialize MFA setup',
        variant: 'destructive',
      });
    },
  });

  // Enable MFA mutation
  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!setupData) throw new Error('No setup data');
      const res = await apiRequest('POST', '/api/mfa/enable', {
        secret: setupData.secret,
        token: verifyToken,
        backupCodes: setupData.backupCodes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      setSetupStep('backup');
      toast({
        title: 'MFA Enabled',
        description: 'Two-factor authentication has been enabled successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Disable MFA mutation
  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mfa/disable', {
        password: disablePassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      setDisablePassword('');
      toast({
        title: 'MFA Disabled',
        description: 'Two-factor authentication has been disabled',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Disable MFA',
        description: error.message || 'Incorrect password',
        variant: 'destructive',
      });
    },
  });

  // Regenerate backup codes mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mfa/regenerate-backup-codes', {
        token: regenerateToken,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setSetupData({ ...setupData!, backupCodes: data.backupCodes });
      setSetupStep('backup');
      setShowSetup(true);
      setRegenerateToken('');
      toast({
        title: 'Backup Codes Regenerated',
        description: 'New backup codes have been generated. Save them securely.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Regeneration Failed',
        description: error.message || 'Invalid MFA token',
        variant: 'destructive',
      });
    },
  });

  const handleCopyBackupCodes = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
    toast({
      title: 'Copied',
      description: 'Backup codes copied to clipboard',
    });
  };

  const handleFinishSetup = () => {
    setShowSetup(false);
    setSetupData(null);
    setSetupStep('scan');
    setVerifyToken('');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading MFA settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>

      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Two-Factor Authentication (2FA)
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </div>
              {mfaStatus?.mfaEnabled ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Disabled
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {!mfaStatus?.mfaEnabled ? (
              <>
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>
                    Two-factor authentication (2FA) provides an additional layer of security by requiring
                    a verification code from your authenticator app in addition to your password.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <h3 className="font-semibold">How it works:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Download an authenticator app (Google Authenticator, Authy, Microsoft Authenticator)</li>
                    <li>Scan the QR code or enter the secret key</li>
                    <li>Enter the 6-digit code from your app to verify</li>
                    <li>Save your backup codes in a secure location</li>
                  </ol>
                </div>

                <Button
                  onClick={() => setupMutation.mutate()}
                  disabled={setupMutation.isPending}
                  className="w-full"
                  data-testid="button-setup-mfa"
                >
                  {setupMutation.isPending ? 'Setting up...' : 'Enable Two-Factor Authentication'}
                </Button>
              </>
            ) : (
              <>
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription>
                    Two-factor authentication is currently enabled for your account.
                    {mfaStatus.mfaEnrolledAt && (
                      <> Enabled on {new Date(mfaStatus.mfaEnrolledAt).toLocaleDateString()}.</>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Regenerate Backup Codes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Generate new backup codes if you've lost access to your old ones. This will invalidate all previous codes.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Enter MFA code to regenerate"
                        value={regenerateToken}
                        onChange={(e) => setRegenerateToken(e.target.value)}
                        maxLength={6}
                        data-testid="input-regenerate-token"
                      />
                      <Button
                        onClick={() => regenerateMutation.mutate()}
                        disabled={!regenerateToken || regenerateMutation.isPending}
                        data-testid="button-regenerate-codes"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                        Regenerate
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2 text-destructive">Disable Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will remove 2FA from your account. You'll only need your password to log in.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="Enter your password to disable"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        data-testid="input-disable-password"
                      />
                      <Button
                        variant="destructive"
                        onClick={() => disableMutation.mutate()}
                        disabled={!disablePassword || disableMutation.isPending}
                        data-testid="button-disable-mfa"
                      >
                        Disable 2FA
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MFA Setup Dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'scan' && 'Scan QR Code'}
              {setupStep === 'verify' && 'Verify Code'}
              {setupStep === 'backup' && 'Save Backup Codes'}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'scan' && 'Scan this QR code with your authenticator app'}
              {setupStep === 'verify' && 'Enter the 6-digit code from your app'}
              {setupStep === 'backup' && 'Save these codes in a secure location'}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'scan' && setupData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img src={setupData.qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <div>
                <Label>Or enter this code manually:</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-2 rounded text-sm font-mono break-all">
                    {setupData.secret}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.secret);
                      toast({ title: 'Copied', description: 'Secret copied to clipboard' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={() => setSetupStep('verify')} className="w-full" data-testid="button-next-verify">
                Next: Verify Code
              </Button>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="verify-token">Verification Code</Label>
                <Input
                  id="verify-token"
                  type="text"
                  placeholder="000000"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-verify-token"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSetupStep('scan')} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => enableMutation.mutate()}
                  disabled={verifyToken.length !== 6 || enableMutation.isPending}
                  className="flex-1"
                  data-testid="button-verify-enable"
                >
                  {enableMutation.isPending ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'backup' && setupData && (
            <div className="space-y-4">
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  Save these backup codes in a secure location. You can use them to access your account if you lose your phone.
                </AlertDescription>
              </Alert>
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="text-center p-2 bg-background rounded">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopyBackupCodes} variant="outline" className="flex-1" data-testid="button-copy-codes">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Codes
                </Button>
                <Button onClick={handleFinishSetup} className="flex-1" data-testid="button-finish-setup">
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
