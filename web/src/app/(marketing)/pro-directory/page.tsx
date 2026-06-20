import { Metadata } from 'next';
import { ProDirectoryClient } from './ProDirectoryClient';

export const metadata: Metadata = {
  title: 'Pro-Directory | Networx',
  description:
    'Search and hire Industry Catalysts — photographers, producers, engineers, and more on Pro-Networx.',
  alternates: { canonical: '/pro-directory' },
};

export const revalidate = 3600;

export default function ProDirectoryPage() {
  return <ProDirectoryClient />;
}
