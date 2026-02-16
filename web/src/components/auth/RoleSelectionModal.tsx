'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OnboardingRole = 'listener' | 'artist' | 'service_provider';

interface RoleSelectionModalProps {
  onSelect: (role: OnboardingRole) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function RoleSelectionModal({ onSelect, onCancel, loading, error }: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onSelect(selectedRole);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>Welcome! Choose Your Role</DialogTitle>
          <DialogDescription>How would you like to use Discover Me?</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <button
            type="button"
            onClick={() => setSelectedRole('listener')}
            disabled={loading}
            className={cn(
              'w-full p-4 rounded-xl border-2 text-left transition-all',
              selectedRole === 'listener'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🎧</div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Listener</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Discover new music, like tracks, and chat with the community
                </p>
              </div>
              {selectedRole === 'listener' && (
                <div className="text-primary">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('artist')}
            disabled={loading}
            className={cn(
              'w-full p-4 rounded-xl border-2 text-left transition-all',
              selectedRole === 'artist'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🎤</div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Artist</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload your music, purchase airtime, and grow your audience
                </p>
              </div>
              {selectedRole === 'artist' && (
                <div className="text-primary">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('service_provider')}
            disabled={loading}
            className={cn(
              'w-full p-4 rounded-xl border-2 text-left transition-all',
              selectedRole === 'service_provider'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🛠️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Service provider</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Offer beats, mixing, photography, design, or other creative services to artists
                </p>
              </div>
              {selectedRole === 'service_provider' && (
                <div className="text-primary">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Listeners can upgrade to artists or service providers later from their profile settings.
          </p>
        </div>

        <DialogFooter className="flex gap-3 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!selectedRole || loading}>
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Creating...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
