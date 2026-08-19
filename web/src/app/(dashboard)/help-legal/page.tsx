'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  HelpCircleIcon,
  File01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';

const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';

type HelpItem = {
  label: string;
  description: string;
  href: string;
  icon: typeof HelpCircleIcon;
  external?: boolean;
};

const helpItems: HelpItem[] = [
  {
    label: 'Help & FAQ',
    description: 'Answers and support',
    href: '/faq',
    icon: HelpCircleIcon,
  },
  {
    label: 'Discord Support',
    description: 'Chat with support and community',
    href: SUPPORT_DISCORD_URL,
    icon: HelpCircleIcon,
    external: true,
  },
  {
    label: 'Contact Us',
    description: 'Get in touch',
    href: '/contact',
    icon: HelpCircleIcon,
  },
];

const legalItems: HelpItem[] = [
  {
    label: 'Legal Center',
    description: 'All policies and agreements',
    href: '/legal',
    icon: File01Icon,
  },
  {
    label: 'Privacy Policy',
    description: 'How we handle your data',
    href: '/privacy',
    icon: File01Icon,
  },
  {
    label: 'Terms of Service',
    description: 'Rules and agreements',
    href: '/terms',
    icon: File01Icon,
  },
  {
    label: 'Refund Policy',
    description: 'Returns and refunds',
    href: '/refunds',
    icon: File01Icon,
  },
  {
    label: 'DMCA Policy',
    description: 'Copyright takedown process',
    href: '/dmca',
    icon: File01Icon,
  },
  {
    label: 'Community Guidelines',
    description: 'Standards for the community',
    href: '/community-guidelines',
    icon: File01Icon,
  },
  {
    label: 'Copyright Policy',
    description: 'Intellectual property rules',
    href: '/copyright-policy',
    icon: File01Icon,
  },
  {
    label: 'Pricing',
    description: 'Plans and pricing',
    href: '/pricing',
    icon: InformationCircleIcon,
  },
];

function HelpLegalList({ items }: { items: HelpItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const content = (
          <>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <HugeiconsIcon
                icon={item.icon}
                className="size-5 text-muted-foreground"
                strokeWidth={2}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <span className="text-muted-foreground" aria-hidden>
              {item.external ? '↗' : '›'}
            </span>
          </>
        );
        const className =
          'flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors';
        return (
          <li key={item.label}>
            {item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            ) : (
              <Link href={item.href} className={className}>
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function HelpLegalPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help & Legal</h1>
        <p className="text-muted-foreground mt-1">
          Support, policies, and how to reach us
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Help
            </h2>
          </div>
          <HelpLegalList items={helpItems} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Legal
            </h2>
          </div>
          <HelpLegalList items={legalItems} />
        </CardContent>
      </Card>
    </div>
  );
}
