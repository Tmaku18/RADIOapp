'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, proNetworxApi } from '@/lib/api';
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

function isProfileEmpty(me: { about?: string | null; skillsHeadline?: string | null; currentTitle?: string | null }) {
  const a = me.about?.trim();
  const s = me.skillsHeadline?.trim();
  const t = me.currentTitle?.trim();
  return !a && !s && !t;
}

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

  // First-time catalysts: when they hit directory with an empty profile, send them to onboarding to fill out
  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role !== 'service_provider' && profile.role !== 'admin') return;
    if (pathname !== '/pro-networx/directory') return; // only when landing on directory
    (async () => {
      try {
        const res = await proNetworxApi.getMeProfile();
        const data = res.data;
        if (data && isProfileEmpty(data)) {
          router.replace('/pro-networx/onboarding');
        }
      } catch {
        // No profile yet (e.g. new catalyst) -> send to onboarding
        router.replace('/pro-networx/onboarding');
      }
    })();
  }, [loading, user, profile, pathname, router]);

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
              Offer your services to artists on ProNetworx — mixing, beats, design, photography, and more. Your Catalyst profile is separate from your radio profile and gives you a LinkedIn®-style presence in the directory.
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
