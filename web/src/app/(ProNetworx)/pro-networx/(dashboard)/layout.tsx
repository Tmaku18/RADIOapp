'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const CATALYST_PROMPT_DISMISSED_KEY = 'pronetworx_catalyst_prompt_dismissed';

export default function ProNetworxDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [showCatalystPrompt, setShowCatalystPrompt] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (loading || !profile || !user) return;
    if (profile.role === 'service_provider' || profile.role === 'admin') return;
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(CATALYST_PROMPT_DISMISSED_KEY) === '1') return;
    setShowCatalystPrompt(true);
  }, [loading, profile, user]);

  const handleNotNow = () => {
    try {
      sessionStorage.setItem(CATALYST_PROMPT_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setShowCatalystPrompt(false);
  };

  const handleYesSignMeUp = async () => {
    setUpgrading(true);
    try {
      await usersApi.upgradeToCatalyst();
      await refreshProfile();
      setShowCatalystPrompt(false);
      router.push('/pro-networx/onboarding');
    } catch (err) {
      console.error('Upgrade to Catalyst failed:', err);
      setShowCatalystPrompt(false);
    } finally {
      setUpgrading(false);
    }
  };

  if (!loading && !user) {
    const redirect = encodeURIComponent(pathname || '/pro-networx/directory');
    router.replace(`/login?redirect=${redirect}`);
    return null;
  }

  return (
    <>
      {children}
      <Dialog open={showCatalystPrompt} onOpenChange={(open) => !open && handleNotNow()}>
        <DialogContent showCloseButton={!upgrading} onPointerDownOutside={upgrading ? (e) => e.preventDefault() : undefined}>
          <DialogHeader>
            <DialogTitle>Are you ready to sign up as a Catalyst?</DialogTitle>
            <DialogDescription>
              Offer your services to artists on ProNetworx — mixing, beats, design, photography, and more. Your Catalyst profile is separate from your radio profile and gives you a LinkedIn-style presence in the directory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleNotNow} disabled={upgrading}>
              Not now
            </Button>
            <Button onClick={handleYesSignMeUp} disabled={upgrading}>
              {upgrading ? 'Signing you up…' : 'Yes, sign me up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
