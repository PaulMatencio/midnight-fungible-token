import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/src/presentation/context/ToastContext';
import { WalletProvider } from '@/src/presentation/context/WalletContext';
import { ConfigProvider } from '@/src/presentation/context/ConfigContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'FungibleToken DApp | Midnight Network',
  description: 'Production-grade React 19 / Next.js Progressive DApp for Midnight Compact FungibleToken Smart Contract',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Midnight Token',
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <ConfigProvider>
          <ToastProvider>
            <WalletProvider>
              {children}
            </WalletProvider>
          </ToastProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}

