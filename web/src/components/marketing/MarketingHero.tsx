import type { ReactNode } from 'react';
import { ButterflyPattern } from './ButterflyPattern';

type MarketingHeroProps = {
  title: ReactNode;
  /** Optional supporting line shown under the title. */
  subtitle?: ReactNode;
  /** Optional CTA row / extra content rendered under the subtitle. */
  children?: ReactNode;
  /** Optional small line shown beneath the CTA row. */
  footnote?: ReactNode;
  className?: string;
};

/**
 * Shared marketing page hero: a full-bleed teal band with the NETWORX butterfly
 * pattern, matching the homepage hero. Use at the top of every marketing tab so
 * Features, Pricing, About, FAQ, Contact, and Pro-Directory share one look.
 */
export function MarketingHero({
  title,
  subtitle,
  children,
  footnote,
  className,
}: MarketingHeroProps) {
  return (
    <section
      className={`relative overflow-hidden py-20 sm:py-24 bg-primary text-primary-foreground ${
        className ?? ''
      }`}
    >
      <ButterflyPattern
        className="absolute inset-0"
        colorClassName="text-primary-foreground"
        tile={150}
        opacity={0.14}
      />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-6 text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {children}
          </div>
        )}
        {footnote && (
          <p className="mt-4 text-sm text-primary-foreground/80">{footnote}</p>
        )}
      </div>
    </section>
  );
}

/**
 * Subtle butterfly motif layer for a marketing body section. Drop inside a
 * `relative overflow-hidden` section and render the section content in a
 * sibling `relative z-10` wrapper.
 */
export function MarketingBodyPattern() {
  return (
    <ButterflyPattern
      className="absolute inset-0"
      colorClassName="text-primary"
      tile={150}
      opacity={0.06}
    />
  );
}
