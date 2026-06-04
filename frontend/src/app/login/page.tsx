'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import SmartMaintWordmark from '@/components/SmartMaintWordmark';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const inputClassName =
  'flex h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-base text-[#1E293B] transition-colors placeholder:text-[#64748B] focus-visible:border-[#1E40AF] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    const toastId = toast.loading('Signing in...');

    try {
      const response = await api.post('/auth/login', data);
      const { access_token, user } = response.data;

      setAuth(user, access_token);
      toast.success(`Welcome, ${user.fullName || user.email}`, { id: toastId });

      setTimeout(() => {
        if (user.role === 'admin' || user.role === 'superadmin') {
          router.push('/dashboard/admin');
        } else if (user.role === 'technician') {
          router.push('/dashboard/technician');
        } else {
          router.push('/dashboard/worker');
        }
      }, 400);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Invalid email or password.';
      setServerError(errorMessage);
      toast.error(errorMessage, { id: toastId, duration: 6000 });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-8">
      <div className="w-full max-w-[400px]">
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="accent-band-top" aria-hidden />

          <div className="p-6 sm:p-8">
            <header className="mb-6">
              <h1 className="m-0">
                <SmartMaintWordmark size="lg" variant="login" />
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">Welcome back</p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <p className="text-sm text-red-600" role="alert">
                  {serverError}
                </p>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[#1E293B]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={cn(
                    inputClassName,
                    errors.email && 'border-red-500 focus-visible:border-red-500',
                  )}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[#1E293B]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={cn(
                      inputClassName,
                      'pr-14',
                      errors.password &&
                        'border-red-500 focus-visible:border-red-500',
                    )}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] hover:text-[#1E293B]"
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-10 w-full rounded-md bg-[#1E40AF] text-sm font-medium text-white transition-colors hover:bg-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Signing in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
