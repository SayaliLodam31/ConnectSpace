import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { CookieConsentBanner } from '@/components/ui/cookie-banner';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3017'),
  title: {
    default: 'ConnectSpace | Connect and Collaborate',
    template: '%s | ConnectSpace',
  },
  description:
    'Real-time enterprise video conferencing, screen sharing, chat, secure file sharing, and interactive whiteboard powered by WebRTC and Supabase.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  applicationName: 'ConnectSpace',
  keywords: ['video conferencing', 'webrtc', 'collaboration', 'whiteboard', 'remote work', 'meetings'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900`}>
        <ToastProvider>
          {children}
          <CookieConsentBanner />
        </ToastProvider>
      </body>
    </html>
  );
}

