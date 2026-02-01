import type { Metadata } from 'next';
import { Raleway, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

const raleway = Raleway({
  variable: '--font-raleway',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RadioApp - Underground Music Radio',
  description: 'Discover underground artists and promote your music on our curated radio stream. Artists upload and pay for airplay while listeners tune into continuous curated music.',
  keywords: ['radio', 'music', 'underground', 'artists', 'streaming', 'promotion'],
  openGraph: {
    title: 'RadioApp - Underground Music Radio',
    description: 'Discover underground artists and promote your music on our curated radio stream.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${raleway.variable} ${geistMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
