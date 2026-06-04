'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { useThemeStore } from '@/store/theme-store';
import TechoChatWidget from '@/components/TechoChatWidget';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useThemeStore();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    const root = document.documentElement;
    if (isLoginPage || theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme, isLoginPage]);

  return (
    <html lang="en" className={theme}>
      <body>
        {children}
        {!isLoginPage && <TechoChatWidget />}
        <Toaster
          position="bottom-left"
          theme={theme}
          duration={4000}
          richColors
        />
      </body>
    </html>
  );
}
