'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { useThemeStore } from '@/store/theme-store';
import TechoChatWidget from '@/components/TechoChatWidget';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isInstallPage = pathname === '/install';

  useEffect(() => {
    const root = document.documentElement;
    if (isLoginPage || isInstallPage || theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme, isLoginPage, isInstallPage]);

  return (
    <>
      {children}
      {!isLoginPage && !isInstallPage && <TechoChatWidget />}
      <Toaster
        position="top-center"
        theme={theme}
        duration={5000}
        richColors
        closeButton
        toastOptions={{
          className: 'z-[99999]',
          style: { zIndex: 99999 },
        }}
      />
    </>
  );
}
