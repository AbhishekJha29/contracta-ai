import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Contracta — Automatic API Contract & Breaking Change Guardian',
  description: 'Analyze backend codebases, extract living OpenAPI contracts, and prevent breaking API drift in CI/CD.',
  icons: {
    icon: '/favicon.ico',
  },
};

import { SessionProvider } from '@/components/session-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-300`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
