'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ThemeChoice = 'light' | 'dark' | 'system';

const THEME_OPTIONS: Array<{
  value: ThemeChoice;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

type Props = {
  /** Extra classes for the trigger button (e.g. to suit a colored background). */
  triggerClassName?: string;
  /** Show the word "Theme" beside the icon (recommended for discoverability). */
  showLabel?: boolean;
};

/**
 * Theme switcher usable anywhere — including pre-login pages. The selected theme
 * is persisted by next-themes (storageKey "networx-theme"), so the choice
 * carries through to the authenticated app.
 */
export function ThemeToggle({ triggerClassName, showLabel = true }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  useEffect(() => setMounted(true), []);

  const current: ThemeChoice =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'dark';
  const active = THEME_OPTIONS.find((o) => o.value === current) ?? THEME_OPTIONS[1];
  const ActiveIcon = active.Icon;

  const trigger = (
    <Button
      variant="outline"
      size={showLabel ? 'sm' : 'icon'}
      aria-label={`Theme: ${active.label}. Click to change appearance.`}
      data-testid="theme-toggle"
      className={cn(
        showLabel && 'gap-2 px-3',
        triggerClassName,
      )}
    >
      {mounted ? (
        <>
          <ActiveIcon
            className={cn(
              'size-[18px] shrink-0',
              current === 'light' && 'text-amber-500',
              current === 'dark' && 'text-sky-400',
              current === 'system' && 'text-muted-foreground',
            )}
            aria-hidden
          />
          {showLabel ? (
            <span className="hidden sm:inline text-xs font-medium tracking-wide">
              Theme
            </span>
          ) : null}
        </>
      ) : (
        <Moon className="size-[18px] shrink-0 text-sky-400" aria-hidden />
      )}
    </Button>
  );

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Theme · {active.label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={current} onValueChange={setTheme}>
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon
                className={cn(
                  'mr-2 size-4 shrink-0',
                  value === 'light' && 'text-amber-500',
                  value === 'dark' && 'text-sky-400',
                  value === 'system' && 'text-muted-foreground',
                )}
              />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
