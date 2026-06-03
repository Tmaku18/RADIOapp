'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Sun01Icon,
  DarkModeIcon,
  ComputerIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Props = {
  /** Extra classes for the trigger button (e.g. to suit a colored background). */
  triggerClassName?: string;
};

/**
 * Theme switcher usable anywhere — including pre-login pages. The selected theme
 * is persisted by next-themes (storageKey "networx-theme"), so the choice
 * carries through to the authenticated app.
 */
export function ThemeToggle({ triggerClassName }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  useEffect(() => setMounted(true), []);

  const current = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'dark';
  const activeIcon = current === 'light' ? Sun01Icon : current === 'system' ? ComputerIcon : DarkModeIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Change theme"
          className={cn(triggerClassName)}
        >
          {mounted ? (
            <HugeiconsIcon icon={activeIcon} strokeWidth={2} />
          ) : (
            <HugeiconsIcon icon={DarkModeIcon} strokeWidth={2} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={current} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <HugeiconsIcon icon={Sun01Icon} strokeWidth={2} className="mr-2" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <HugeiconsIcon icon={DarkModeIcon} strokeWidth={2} className="mr-2" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <HugeiconsIcon icon={ComputerIcon} strokeWidth={2} className="mr-2" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
