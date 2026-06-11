import type { Metadata, Viewport } from 'next';
import { Inter, Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

const APP_NAME = 'PRO-NETWORX';
const APP_DESCRIPTION =
  'Hire and collaborate with artists, producers, studios, designers, and more — powered by NETWORX.';

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
  applicationName: APP_NAME,
  title: 'PRO-NETWORX — The Collective Directory',
  description: APP_DESCRIPTION,
  keywords: ['networx', 'artists', 'producers', 'studio', 'directory', 'services', 'collaboration'],
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
