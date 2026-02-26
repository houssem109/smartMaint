'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import Layout from './Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Forbidden() {
  const router = useRouter();
  const { user } = useAuthStore();

  const getDashboardPath = () => {
    if (!user) return '/login';
    const role = user.role?.toLowerCase?.();
    if (role === 'admin' || role === 'superadmin') return '/dashboard/admin';
    if (role === 'technician') return '/dashboard/technician';
    return '/dashboard/worker';
  };

  return (
    <Layout title="Access Forbidden">
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10">
                <svg
                  className="h-8 w-8 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-4">
              Access Forbidden
            </h1>
            <p className="text-muted-foreground mb-6 font-semibold">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              This page is restricted to specific user roles. Please contact an administrator if you believe this is an error.
            </p>
            <Button
              onClick={() => router.push(getDashboardPath())}
              className="w-full"
              size="lg"
            >
              Go to My Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
