'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { phoneMfaApi } from '@/lib/api';

interface PhoneMfaGateProps {
  phoneVerified: boolean;
  phoneLast4: string | null;
  onVerified: () => Promise<void>;
  onCancel: () => Promise<void> | void;
}

function errorMessage(err: unknown, fallback: string): string {
  const apiMessage = (err as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  if (apiMessage) return apiMessage;
  return err instanceof Error ? err.message : fallback;
}

/**
 * Blocks the signed-in app until this sign-in is confirmed by text.
 * New accounts choose a mobile number. That number can only belong to one account.
 */
export function PhoneMfaGate({
  phoneVerified,
  phoneLast4,
  onVerified,
  onCancel,
}: PhoneMfaGateProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(
    phoneVerified && phoneLast4 ? phoneLast4 : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSent = useRef(false);

  const sendCode = async (nextPhone?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await phoneMfaApi.send(nextPhone);
      setSentTo(response.data.phoneLast4 || phoneLast4);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the text. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!phoneVerified || autoSent.current) return;
    autoSent.current = true;
    void sendCode();
    // The saved number does not change while this gate is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneVerified]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneVerified && phone.trim().length < 7) {
      setError('Enter the mobile number that should own this account.');
      return;
    }
    await sendCode(phoneVerified ? undefined : phone.trim());
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from the text.');
      return;
    }
    setSubmitting(true);
    try {
      await phoneMfaApi.verify(code.trim());
      await onVerified();
    } catch (err) {
      setError(errorMessage(err, 'That code did not work. Try again.'));
      setSubmitting(false);
    }
  };

  const waitingForCode = sentTo != null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Confirm it&apos;s you</h1>
          <p className="text-muted-foreground mt-2">
            {phoneVerified
              ? `We text a code to the number ending in ${phoneLast4 ?? 'your phone'} every time you sign in.`
              : 'Add the mobile number for this account. Each number can only be used once, which keeps out duplicate and fake accounts.'}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!waitingForCode && (
          <form onSubmit={handleSend} className="space-y-4">
            {!phoneVerified && (
              <div className="space-y-2">
                <Label htmlFor="mfa-phone">Mobile number</Label>
                <Input
                  id="mfa-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  autoFocus
                  placeholder="(555) 555-0100"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Sending text…' : 'Text me a code'}
            </Button>
          </form>
        )}

        {waitingForCode && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Code sent to •••{sentTo}</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Checking…' : 'Verify and continue'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={submitting}
              onClick={() => sendCode(phoneVerified ? undefined : phone.trim())}
            >
              Resend text
            </Button>
            {!phoneVerified && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={submitting}
                onClick={() => {
                  setSentTo(null);
                  setCode('');
                  setError(null);
                }}
              >
                Use a different number
              </Button>
            )}
          </form>
        )}

        <Button
          type="button"
          variant="ghost"
          className="w-full mt-2"
          onClick={() => void onCancel()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
