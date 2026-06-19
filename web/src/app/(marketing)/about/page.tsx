import { Metadata } from 'next';
import { MetamorphosisAbout } from '@/components/dimension/MetamorphosisAbout';

export const metadata: Metadata = {
  title: 'About - Networx',
  description:
    'Learn how Networx and ProNetworx help artists grow through always-on radio, livestreaming, real-time fan engagement, analytics, and mentorship.',
};

export const revalidate = 3600;

export default function AboutPage() {
  return <MetamorphosisAbout />;
}
