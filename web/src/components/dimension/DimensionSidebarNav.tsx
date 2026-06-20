'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  MoreHorizontal,
  Shield,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSidebar } from '@/components/ui/sidebar';
import { NETWORX_APP_ICON } from '@/lib/brand-assets';
import { cn } from '@/lib/utils';

export function DimensionSidebarLogoCard() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Link
      href="/dashboard"
      className={cn(
        'flex items-center gap-3 p-2 rounded-2xl bg-black/40 border border-cyan-400/20 mb-2 hover:bg-black/50 transition-colors',
        collapsed && 'justify-center',
      )}
    >
      <div className="w-10 h-10 rounded-md bg-black border border-cyan-400/40 glow-cyan overflow-hidden p-0.5 shrink-0">
        <Image
          src={NETWORX_APP_ICON}
          alt=""
          width={40}
          height={40}
          className="w-full h-full object-contain"
          priority
          unoptimized
        />
      </div>
      {!collapsed && (
        <div className="leading-tight min-w-0">
          <div className="font-unbounded font-black text-sm text-white">NETWORX</div>
          <div className="font-dim-mono text-[9px] tracking-[0.25em] text-cyan-300/80">
            RADIO
          </div>
        </div>
      )}
    </Link>
  );
}

type DimensionNavTabProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  external?: boolean;
  testId?: string;
};

export function DimensionNavTab({
  href,
  label,
  icon: Icon,
  isActive,
  external,
  testId,
}: DimensionNavTabProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const className = cn(
    'group flex items-center gap-3 px-2.5 py-2 rounded-full transition-colors w-full',
    isActive ? 'bg-cyan-400/10 ring-1 ring-cyan-400/30' : 'hover:bg-white/5',
  );

  const content = (
    <>
      <span
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
          isActive
            ? 'bg-cyan-400 text-black'
            : 'bg-white/[0.04] border border-white/10 text-cyan-300',
        )}
      >
        <Icon className="w-4 h-4" />
      </span>
      {!collapsed && (
        <span
          className={cn(
            'text-sm font-outfit truncate',
            isActive ? 'text-white font-medium' : 'text-white/80',
          )}
        >
          {label}
        </span>
      )}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        data-testid={testId}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} data-testid={testId} className={className}>
      {content}
    </Link>
  );
}

type DimensionNavCollapsibleProps = {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function DimensionNavCollapsible({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: DimensionNavCollapsibleProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full group flex items-center gap-3 px-2.5 py-2 rounded-full hover:bg-white/5"
      >
        <span className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 text-cyan-300 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        {!collapsed && (
          <>
            <span className="text-sm font-outfit text-white/80 flex-1 text-left">
              {title}
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-white/40 transition-transform',
                open && 'rotate-180',
              )}
            />
          </>
        )}
      </button>
      {open && !collapsed && (
        <div className="ml-12 mt-1 space-y-0.5">{children}</div>
      )}
    </div>
  );
}

export function DimensionNavSubLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block py-1.5 px-3 text-xs font-outfit rounded-md transition-colors',
        isActive ? 'text-cyan-300 bg-cyan-400/5' : 'text-white/60 hover:text-white',
      )}
    >
      {label}
    </Link>
  );
}

type DimensionSidebarUserFooterProps = {
  displayName: string;
  roleLabel: string;
  avatarUrl?: string | null;
  emailFallback?: string | null;
  isSigningOut: boolean;
  onSignOut: () => void;
  supportUrl: string;
};

export function DimensionSidebarUserFooter({
  displayName,
  roleLabel,
  avatarUrl,
  emailFallback,
  isSigningOut,
  onSignOut,
  supportUrl,
}: DimensionSidebarUserFooterProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const initials = (displayName || emailFallback || '?').charAt(0).toUpperCase();

  return (
    <div className="mt-auto pt-3 border-t border-white/10 space-y-1.5">
      {!collapsed && (
        <Link
          href="/profile"
          data-testid="sidebar-user-card"
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <Avatar className="w-9 h-9 ring-1 ring-cyan-400/40">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs bg-black/60 text-cyan-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-unbounded font-bold text-sm truncate text-white">
              {displayName || emailFallback}
            </div>
            <div className="font-dim-mono text-[9px] text-cyan-300 tracking-[0.2em] uppercase">
              {roleLabel}
            </div>
          </div>
        </Link>
      )}
      <a
        href={supportUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="sidebar-support-btn"
        className={cn(
          'w-full flex items-center gap-3 px-2.5 py-2 rounded-full hover:bg-white/5 text-white/70 transition-colors',
          collapsed && 'justify-center',
        )}
      >
        <span className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4 text-cyan-300" />
        </span>
        {!collapsed && <span className="text-sm">Support</span>}
      </a>
      <button
        type="button"
        onClick={onSignOut}
        disabled={isSigningOut}
        data-testid="sidebar-signout-btn"
        className={cn(
          'w-full flex items-center gap-3 px-2.5 py-2 rounded-full hover:bg-white/5 text-white/70 transition-colors disabled:opacity-50',
          collapsed && 'justify-center',
        )}
      >
        <span className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
          <LogOut className="w-4 h-4 text-pink-400" />
        </span>
        {!collapsed && (
          <span className="text-sm">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
        )}
      </button>
    </div>
  );
}

export { MoreHorizontal, Shield };
