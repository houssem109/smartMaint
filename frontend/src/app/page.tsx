'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (isAuthenticated && user) {
      // Redirect based on role
      if (user.role === 'admin' || user.role === 'superadmin') {
        router.push('/dashboard/admin');
      } else if (user.role === 'technician') {
        router.push('/dashboard/technician');
      } else {
        router.push('/dashboard/worker');
      }
    } else {
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, user, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <p className="text-gray-900">Redirecting...</p>
      </div>
    </main>
  );
}
