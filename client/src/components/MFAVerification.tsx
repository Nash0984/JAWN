import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface MFAVerificationProps {
  username: string;
  userId: string;
  onVerify: (token: string, useBackupCode: boolean) => Promise<void>;
  onCancel: () => void;
}

export function MFAVerification({ username, userId, onVerify, onCancel }: MFAVerificationProps) {
  const [token, setToken] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsVerifying(true);
    setError(null);

    try {
      await onVerify(token, useBackupCode);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setToken('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTokenInput = (value: string) => {
    if (useBackupCode) {
      // Backup codes are alphanumeric
      setToken(value.toUpperCase().slice(0, 8));
    } else {
      // TOTP tokens are 6 digits
      setToken(value.replace(/\D/g, '').slice(0, 6));
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Enter the verification code for {username}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfa-token">
              {useBackupCode ? 'Backup Code' : 'Verification Code'}
            </Label>
            <Input
              id="mfa-token"
              type="text"
              placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
              value={token}
              onChange={(e) => handleTokenInput(e.target.value)}
              maxLength={useBackupCode ? 8 : 6}
              className="text-center text-2xl tracking-widest font-mono"
              autoComplete="off"
              autoFocus
              disabled={isVerifying}
              data-testid="input-mfa-token"
            />
            <p className="text-sm text-muted-foreground">
              {useBackupCode
                ? 'Enter one of your 8-character backup codes'
                : 'Enter the 6-digit code from your authenticator app'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isVerifying}
              className="flex-1"
              data-testid="button-cancel-mfa"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isVerifying ||
                (useBackupCode ? token.length !== 8 : token.length !== 6)
              }
              className="flex-1"
              data-testid="button-verify-mfa"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setToken('');
                setError(null);
              }}
              className="text-sm"
              data-testid="button-toggle-backup"
            >
              {useBackupCode ? 'Use authenticator app instead' : 'Use backup code instead'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
