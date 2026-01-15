import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: {
    default: 'Hopus Meet | Videoconferência Empresarial',
    template: '%s | Hopus Meet',
  },
  description:
    'Hopus Meet - Plataforma de videoconferência segura e escalável para empresas. Reuniões em tempo real com qualidade profissional.',
  twitter: {
    creator: '@hopus_ai',
    site: '@hopus_ai',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://meet.hopus.ai',
    images: [
      {
        url: '/images/hopus-meet-og.svg',
        width: 1200,
        height: 630,
        type: 'image/svg+xml',
      },
    ],
    siteName: 'Hopus Meet',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.svg',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/apple-touch-icon.svg',
        sizes: '180x180',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#5d00de',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
