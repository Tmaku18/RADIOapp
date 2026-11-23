'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CONFIRM_WORD = 'delete';

export function DeleteAccountCard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const confirmed = confirmText.trim() === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await usersApi.deleteMyAccount();
      toast.success(
        'Your account is scheduled for deletion. Sign in again within 48 hours to restore it and keep your data.',
      );
      await signOut();
      router.replace('/login');
    } catch {
      setError('Could not schedule account deletion. Try again or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card id="delete-account" className="mt-6 border-destructive/40">
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-destructive">Delete account</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>You will be signed out on this device right away.</li>
            <li>
              Your profile, songs, messages, library, and other account data stay
              for 48 hours. They are not deleted immediately.
            </li>
            <li>
              Sign in again within those 48 hours and your account is restored,
              as if you never asked to delete it.
            </li>
            <li>
              After 48 hours the account and its data are permanently deleted.
              That cannot be undone.
            </li>
            <li>
              An App Store or Google Play subscription is not cancelled by
              deleting your Networx account. Cancel that in the store first if
              you do not want to be billed.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-account-confirm">
            Type <span className="font-mono text-foreground">delete</span> to confirm
          </Label>
          <Input
            id="delete-account-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            The word must be lowercase. This keeps a tap or click from deleting
            your account by accident.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          variant="destructive"
          onClick={() => void handleDelete()}
          disabled={deleting || !confirmed}
        >
          {deleting ? 'Scheduling deletion…' : 'Delete account in 48 hours'}
        </Button>
      </CardContent>
    </Card>
  );
}
