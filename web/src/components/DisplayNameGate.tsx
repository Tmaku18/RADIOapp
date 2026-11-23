'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MAKER_ROLE_OPTIONS } from '@/lib/roles';

export type SetupRole = 'listener' | 'artist' | 'service_provider';

interface DisplayNameGateProps {
  suggestedName: string;
  email: string;
  onSubmit: (displayName: string, roles: string[]) => Promise<void>;
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
  const [roles, setRoles] = useState<string[]>(['artist']);
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
      await onSubmit(trimmed, roles);
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
            Choose how you&apos;ll appear. Check every way you make music, or leave them off to listen.
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
            <p className="text-xs text-muted-foreground">
              This name has to be unique. A taken name can&apos;t be used again or copied.
            </p>
            {email && (
              <p className="text-xs text-muted-foreground">Signed in as {email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>I make music as</Label>
            <div className="grid grid-cols-2 gap-2">
              {MAKER_ROLE_OPTIONS.map((option) => {
                const checked = roles.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRoles((current) =>
                          checked
                            ? current.filter((role) => role !== option.id)
                            : [...current, option.id],
                        )
                      }
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
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
