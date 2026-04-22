import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const ibmPlex = IBM_Plex_Sans({
  variable: '--font-ibm-plex',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '600'],
});

export const metadata: Metadata = {
  title: 'Garabadge — Operations Dashboard',
  description: 'Smart waste disposal management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmPlex.variable} ${ibmPlexMono.variable}`} style={{ height: '100%' }}>
      <body style={{
        fontFamily: 'var(--font-ibm-plex), system-ui, sans-serif',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        height: '100%',
        overflow: 'hidden',
      }}>
        {children}
      </body>
    </html>
  );
}