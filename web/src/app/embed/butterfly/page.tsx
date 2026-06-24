import type { Metadata, Viewport } from 'next';
import { ButterflyEmbed } from './ButterflyEmbed';

// Chrome-less, public hero scene embedded by the mobile app via a WebView.
export const metadata: Metadata = {
  title: 'Networx Butterfly',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050505',
};

export default function ButterflyEmbedPage() {
  return <ButterflyEmbed />;
}
