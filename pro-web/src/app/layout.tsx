import type { Metadata, Viewport } from 'next';
import { Inter, Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { NETWORX_APP_ICON } from '@/lib/brand-assets';

const APP_NAME = 'PRO-NETWORX';
const APP_DESCRIPTION =
  'Hire and collaborate with artists, producers, studios, designers, and more — powered by NETWORX.';
const SITE_URL = (
  process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com'
).replace(/\/$/, '');

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: APP_NAME,
  title: 'PRO-NETWORX — The Collective Directory',
  description: APP_DESCRIPTION,
  keywords: ['networx', 'artists', 'producers', 'studio', 'directory', 'services', 'collaboration'],
  icons: {
    icon: NETWORX_APP_ICON,
    apple: NETWORX_APP_ICON,
  },
  // manifest intentionally omitted for Pro MVP (PWA optional)
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  openGraph: {
    title: 'PRO-NETWORX — The Collective Directory',
    description: APP_DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: APP_NAME,
    images: [
      {
        url: '/images/og-flyer.png',
        width: 1536,
        height: 1024,
        alt: 'NETWORX — The Butterfly Effect: one connection can change everything.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PRO-NETWORX — The Collective Directory',
    description: APP_DESCRIPTION,
    images: ['/images/og-flyer.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#00F0FF',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geist.variable} ${geistMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="pro-networx-theme" disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
