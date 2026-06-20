import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pro-Networx | Networx',
  description:
    'Pro-Networx is the networking app for every kind of creative — post your work, get hired, and connect with designers, photographers, beat makers, and more.',
  alternates: { canonical: '/pro' },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
