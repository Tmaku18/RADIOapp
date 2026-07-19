'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DisplayNameGateProps {
  suggestedName: string;
  email: string;
  onSubmit: (displayName: string) => Promise<void>;
  onCancel: () => Promise<void> | void;
}

/**
 * Blocking overlay shown to a newly authenticated user who has no backend
 * profile yet (typically a Google/Apple sign-up). A display name is mandatory,
 * so the account is only created once a non-empty name is chosen here.
 */
export function DisplayNameGate({
  suggestedName,
  email,
  onSubmit,
  onCancel,
}: DisplayNameGateProps) {
  const [name, setName] = useState(suggestedName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a display name to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(
        apiMessage ??
          (err instanceof Error ? err.message : 'Could not save your name. Please try again.'),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Choose your display name
          </h1>
          <p className="text-muted-foreground mt-2">
            This is how you&apos;ll appear across Networx. You can change it later
            in settings.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gate-display-name">Display name</Label>
            <Input
              id="gate-display-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How you want to be shown"
            />
            {email && (
              <p className="text-xs text-muted-foreground">
                Signed in as {email}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving...' : 'Continue'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => onCancel()}
          disabled={submitting}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
        >
          Cancel and sign out
        </button>
      </div>
    </div>
  );
}
