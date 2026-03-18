'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { hasArtistCapability } from '@/lib/roles';
import { Card, CardContent } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserIcon,
  Notification01Icon,
  LockIcon,
  CreditCardIcon,
  ChartHistogramIcon,
  Settings02Icon,
  HelpCircleIcon,
  File01Icon,
} from '@hugeicons/core-free-icons';

const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';

const settingsSections = [
  {
    title: 'Account',
    items: [
      { label: 'Profile', description: 'Display name, account type (role), photo, bio, headline, location', href: '/profile', icon: UserIcon },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'Theme', description: 'Dark mode, light mode, system', href: '/settings/theme', icon: Settings02Icon },
      { label: 'Playback', description: 'Audio quality, autoplay', href: '/settings/playback', icon: ChartHistogramIcon },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { label: 'Notifications', description: 'Email and push preferences', href: '/settings/notifications', icon: Notification01Icon },
    ],
  },
  {
    title: 'Security & Privacy',
    items: [
      { label: 'Security & Privacy', description: 'Password, blocked users', href: '/settings/security', icon: LockIcon },
    ],
  },
  {
    title: 'Payments & Subscriptions',
    items: [
      { label: 'Payments', description: 'Payment methods, billing', href: '/profile', icon: CreditCardIcon },
    ],
  },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const isArtist = hasArtistCapability(profile?.role);
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings and activity</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {settingsSections.map((section) => (
        <Card key={section.title}>
          <CardContent className="p-0">
            <div className="px-4 py-2 border-b border-border">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{section.title}</h2>
            </div>
            <ul className="divide-y divide-border">
              {section.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <HugeiconsIcon icon={item.icon} className="size-5 text-muted-foreground" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <span className="text-muted-foreground" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {isArtist && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2 border-b border-border">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Creator</h2>
            </div>
            <ul className="divide-y divide-border">
              <li>
                <Link href="/artist/songs" className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <HugeiconsIcon icon={ChartHistogramIcon} className="size-5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">Studio & Songs</p>
                    <p className="text-sm text-muted-foreground">Upload, credits, rotation</p>
                  </div>
                  <span className="text-muted-foreground" aria-hidden>›</span>
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2 border-b border-border">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Admin</h2>
            </div>
            <ul className="divide-y divide-border">
              <li>
                <Link href="/admin" className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <HugeiconsIcon icon={Settings02Icon} className="size-5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">Admin dashboard</p>
                    <p className="text-sm text-muted-foreground">Moderation, fallback, users</p>
                  </div>
                  <span className="text-muted-foreground" aria-hidden>›</span>
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Help & Legal</h2>
          </div>
          <ul className="divide-y divide-border">
            <li>
              <Link href="/faq" className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={HelpCircleIcon} className="size-5 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Help & FAQ</p>
                  <p className="text-sm text-muted-foreground">Answers and support</p>
                </div>
                <span className="text-muted-foreground" aria-hidden>›</span>
              </Link>
            </li>
            <li>
              <a
                href={SUPPORT_DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={HelpCircleIcon} className="size-5 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Discord Support</p>
                  <p className="text-sm text-muted-foreground">Chat with support and community</p>
                </div>
                <span className="text-muted-foreground" aria-hidden>↗</span>
              </a>
            </li>
            <li>
              <Link href="/privacy" className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={File01Icon} className="size-5 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Privacy & Terms</p>
                  <p className="text-sm text-muted-foreground">Privacy policy, terms of service</p>
                </div>
                <span className="text-muted-foreground" aria-hidden>›</span>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
