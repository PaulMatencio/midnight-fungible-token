import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/src/presentation/context/ThemeContext';
import { ToastProvider } from '@/src/presentation/context/ToastContext';
import { WalletProvider } from '@/src/presentation/context/WalletContext';
import { ConfigProvider } from '@/src/presentation/context/ConfigContext';
import { DevOverlayBackHandler } from '@/src/presentation/components/DevOverlayBackHandler';
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
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var t = localStorage.getItem('midnight_theme');
                var isDark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches) || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
            })()`,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <ConfigProvider>
            <ToastProvider>
              <WalletProvider>
                <DevOverlayBackHandler />
                {children}
              </WalletProvider>
            </ToastProvider>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

