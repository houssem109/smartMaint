'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import Forbidden from './Forbidden';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [showForbidden, setShowForbidden] = useState(false);

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check role-based access
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      setShowForbidden(true);
      toast.error('Access forbidden: You do not have permission to access this page.');
      
      // Redirect to appropriate dashboard after a short delay
      setTimeout(() => {
        if (user.role === 'admin') {
          router.push('/dashboard/admin');
        } else if (user.role === 'technician') {
          router.push('/dashboard/technician');
        } else {
          router.push('/dashboard/worker');
        }
      }, 3000);
    }
  }, [isHydrated, isAuthenticated, user, allowedRoles, router]);

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-900 dark:text-white font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  // Show forbidden page if user doesn't have required role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
