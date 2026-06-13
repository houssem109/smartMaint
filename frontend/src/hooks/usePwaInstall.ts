'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if ('serviceWorker' in navigator) {
      // Service worker optional for install; skip registration to avoid breaking /api on LAN.
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const onDisplayMode = () => {
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onDisplayMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onDisplayMode);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    setCanInstall(false);
    return outcome === 'accepted';
  };

  return { canInstall, isStandalone, install };
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function isAndroidChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent);
}
