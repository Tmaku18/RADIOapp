import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, Geist_Mono, Lora, Caveat } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { PlaybackLayout } from '@/components/playback';

const APP_NAME = 'Networx';
const APP_DESCRIPTION =
  "Discover underground artists and promote your music on Networx. Artists upload and pay for airplay while Prospectors tune into continuous curated music.";

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Story / “4 AM” moments: human, imperfect, handwritten authenticity.
const story = Caveat({
  variable: '--font-story',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: 'Networx - Underground Music Radio',
  description: APP_DESCRIPTION,
  keywords: ['radio', 'music', 'underground', 'artists', 'streaming', 'promotion', 'networx'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  openGraph: {
    title: 'Networx - Underground Music Radio',
    description: APP_DESCRIPTION,
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#00f5ff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${lora.variable} ${geistMono.variable} ${story.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="networx-theme" disableTransitionOnChange>
          <AuthProvider>
            <PlaybackLayout>{children}</PlaybackLayout>
          </AuthProvider>
          <Toaster />
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
