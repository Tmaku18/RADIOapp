'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type BottomNavItem = {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
};

const navItems: BottomNavItem[] = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/social', label: 'Social', icon: '📱' },
  { href: '/live', label: 'Live', icon: '🔴' },
  { href: '/profile', label: 'Profile', icon: '👤' },
  {
    href: 'https://discord.gg/a9S5m8fUJy',
    label: 'Support',
    icon: '🛟',
    external: true,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-pb"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href));
        const className = cn(
          'flex flex-col items-center justify-center gap-0.5 py-3 px-4 min-w-[64px] rounded-lg transition-colors',
          isActive
            ? 'text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground',
        );
        if (item.external) {
          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              <span className="chrome-icon text-sm leading-none" aria-hidden>
                {item.icon}
              </span>
              <span className="text-xs">{item.label}</span>
            </a>
          );
        }
        return (
          <Link key={item.href} href={item.href} className={className}>
            <span className="chrome-icon text-sm leading-none" aria-hidden>
              {item.icon}
            </span>
            <span className="text-xs">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
