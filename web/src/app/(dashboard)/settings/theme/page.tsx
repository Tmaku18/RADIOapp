'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Sun01Icon,
  DarkModeIcon,
  ComputerIcon,
} from '@hugeicons/core-free-icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'system', label: 'System', description: 'Match your device', icon: ComputerIcon },
  { value: 'dark', label: 'Dark', description: 'The Collective (default)', icon: DarkModeIcon },
  { value: 'light', label: 'Light', description: 'Soft studio light', icon: Sun01Icon },
] as const;

export default function ThemeSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'dark';

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" asChild>
          <Link href="/settings">← Back to Settings</Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Theme</h1>
        <p className="text-muted-foreground">
          Choose how Networx looks on this device. Your choice is saved automatically.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Label>Appearance</Label>
          {mounted ? (
            <div className="grid gap-3">
              {OPTIONS.map((option) => {
                const selected = current === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50',
                      selected && 'border-primary bg-primary/5',
                    )}
                    aria-pressed={selected}
                  >
                    <HugeiconsIcon
                      icon={option.icon}
                      strokeWidth={2}
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading theme…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
