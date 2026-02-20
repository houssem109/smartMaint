'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useThemeStore } from '@/store/theme-store';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <html lang="en" className={theme}>
      <body>
        {children}
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
