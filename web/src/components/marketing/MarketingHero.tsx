'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/dimension/Reveal';

type MarketingHeroProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footnote?: ReactNode;
  className?: string;
  /** Small mono label above the title, e.g. "◤ FEATURES" */
  sectionLabel?: string;
};

/**
 * Dimension-styled marketing hero — cyber glass band with Emergent typography.
 * Used across Features, Pricing, About, FAQ, Contact, and Pro-Directory.
 */
export function MarketingHero({
  title,
  subtitle,
  children,
  footnote,
  className,
  sectionLabel,
}: MarketingHeroProps) {
  return (
    <section
      className={`relative overflow-hidden py-20 sm:py-28 border-b border-white/10 ${className ?? ''}`}
    >
      <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-pink-500/5 pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 text-center">
        {sectionLabel && (
          <Reveal>
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-4">
              {sectionLabel}
            </div>
          </Reveal>
        )}
        <Reveal delay={sectionLabel ? 0.08 : 0}>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-4xl sm:text-5xl md:text-6xl leading-[0.95] text-white">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal delay={0.15}>
            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          </Reveal>
        )}
        {children && (
          <Reveal delay={0.25}>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">{children}</div>
          </Reveal>
        )}
        {footnote && (
          <Reveal delay={0.35}>
            <p className="mt-4 text-sm text-white/50 font-dim-mono tracking-wide">{footnote}</p>
          </Reveal>
        )}
      </div>
      <div className="neon-line absolute bottom-0 left-0 right-0" aria-hidden />
    </section>
  );
}

export function MarketingBodyPattern() {
  return (
    <>
      <div className="absolute inset-0 cyber-grid opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40 pointer-events-none" />
    </>
  );
}

type DimensionSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function DimensionSection({ children, className, id }: DimensionSectionProps) {
  return (
    <section id={id} className={`relative overflow-hidden py-16 sm:py-20 ${className ?? ''}`}>
      <MarketingBodyPattern />
      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10">{children}</div>
    </section>
  );
}

export function DimensionCard({
  children,
  className,
  highlight,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`glass rounded-xl p-6 sm:p-8 h-full ${highlight ? 'tracing-border glow-cyan' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function DimensionCtaPrimary({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-cyan-400 text-black font-dim-mono text-xs tracking-[0.2em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
    >
      {children}
    </Link>
  );
}

export function DimensionCtaOutline({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const className =
    'inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-white/20 text-white font-dim-mono text-xs tracking-[0.2em] uppercase hover:border-pink-400 hover:text-pink-400 transition-colors';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
