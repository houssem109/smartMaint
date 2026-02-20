'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const toastId = toast.loading('Logging in...');
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user } = response.data;
      
      setAuth(user, access_token);
      toast.success(`Welcome back, ${user.fullName || user.email}!`, { id: toastId });
      
      // Redirect based on role
      setTimeout(() => {
        if (user.role === 'admin') {
          router.push('/dashboard/admin');
        } else if (user.role === 'technician') {
          router.push('/dashboard/technician');
        } else {
          router.push('/dashboard/worker');
        }
      }, 500);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl mb-2">🚀 SmartMaint AI</CardTitle>
          <CardDescription>Maintenance Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@smartmaint.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground text-center mb-2">Default Credentials:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Admin: admin@smartmaint.com / admin123</p>
              <p>Technician: tech@smartmaint.com / tech123</p>
              <p>Worker: worker@smartmaint.com / worker123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
