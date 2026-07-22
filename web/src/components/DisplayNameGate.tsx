'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type SetupRole = 'listener' | 'artist' | 'service_provider';

interface DisplayNameGateProps {
  suggestedName: string;
  email: string;
  onSubmit: (displayName: string, role: SetupRole) => Promise<void>;
  onCancel: () => Promise<void> | void;
}

/**
 * Blocking overlay shown to a newly authenticated user who has no backend
 * profile yet (typically a Google/Apple sign-up).
 */
export function DisplayNameGate({
  suggestedName,
  email,
  onSubmit,
  onCancel,
}: DisplayNameGateProps) {
  const [name, setName] = useState(suggestedName ?? '');
  const [role, setRole] = useState<SetupRole>('artist');
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
      await onSubmit(trimmed, role);
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(
        apiMessage ??
          (err instanceof Error ? err.message : 'Could not save your profile. Please try again.'),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Finish setting up</h1>
          <p className="text-muted-foreground mt-2">
            Choose how you&apos;ll appear and your role. Artists and Producers can upload music.
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
              <p className="text-xs text-muted-foreground">Signed in as {email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gate-role">Role</Label>
            <select
              id="gate-role"
              value={role}
              onChange={(e) => setRole(e.target.value as SetupRole)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="listener">Listener</option>
              <option value="artist">Artist</option>
              <option value="service_provider">Producer</option>
            </select>
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
