'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '@/store/auth-store';
import api, { getApiErrorMessage, getApiDisplayLabel } from '@/lib/api';
import { cn } from '@/lib/utils';
import SmartMaintWordmark from '@/components/SmartMaintWordmark';

const inputClassName =
  'flex h-12 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-base text-[#1E293B] transition-colors placeholder:text-[#64748B] focus-visible:border-[#1E40AF] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50';

type ConnectionState = 'checking' | 'ok' | 'fail';

function dashboardPath(role: string): string {
  const r = role?.toLowerCase?.() ?? role;
  if (r === 'admin' || r === 'superadmin') return '/dashboard/admin';
  if (r === 'technician') return '/dashboard/technician';
  return '/dashboard/worker';
}

async function clearServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [apiTarget, setApiTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setApiTarget(getApiDisplayLabel());
    void clearServiceWorkers();

    let cancelled = false;
    api
      .get('/health')
      .then(() => {
        if (!cancelled) setConnection('ok');
      })
      .catch(() => {
        if (!cancelled) setConnection('fail');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const doLogin = async () => {
    if (submitting) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    setServerError('');

    if (!trimmedEmail) {
      setServerError('Email is required');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setServerError('Enter a valid email');
      return;
    }
    if (!trimmedPassword) {
      setServerError('Password is required');
      return;
    }

    setSubmitting(true);
    setStatusLine('Signing in…');

    try {
      const response = await api.post('/auth/login', {
        email: trimmedEmail,
        password: trimmedPassword,
      });
      const { access_token, user } = response.data;

      if (!access_token || !user) {
        throw new Error('Invalid server response');
      }

      setAuth(user, access_token);
      setStatusLine('Success — opening app…');
      window.location.assign(dashboardPath(user.role));
    } catch (err: unknown) {
      const errorMessage = getApiErrorMessage(err, 'Invalid email or password.');
      setServerError(errorMessage);
      setStatusLine('');
      setSubmitting(false);
    }
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void doLogin();
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F8FAFC] px-4 py-8">
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm">
          <div className="accent-band-top" aria-hidden />

          <div className="p-6 sm:p-8">
            <header className="mb-6">
              <h1 className="m-0">
                <SmartMaintWordmark size="lg" variant="login" />
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">Welcome back</p>
            </header>

            {connection === 'checking' && (
              <p className="mb-4 rounded-md bg-[#F1F5F9] px-3 py-2 text-xs text-[#64748B]">
                Checking connection…
              </p>
            )}
            {connection === 'fail' && (
              <p
                className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800"
                role="alert"
              >
                Cannot reach <strong>{apiTarget}</strong>. Same Wi‑Fi? Docker running?
              </p>
            )}
            {/* {connection === 'ok' && (
              <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                Server connected — tap Login below.
              </p>
            )} */}

            <form onSubmit={onFormSubmit} className="relative z-10 space-y-4" noValidate>
              {(serverError || statusLine) && (
                <p
                  className={cn(
                    'rounded-md px-3 py-2 text-sm',
                    statusLine && !serverError
                      ? 'bg-[#EFF6FF] text-[#1E40AF]'
                      : 'border border-red-200 bg-red-50 text-red-700',
                  )}
                  role="alert"
                  aria-live="polite"
                >
                  {statusLine || serverError}
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#1E293B]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  enterKeyHint="next"
                  placeholder="admin@smartmaint.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-[#1E293B]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    placeholder="admin123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(inputClassName, 'pr-14')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 z-20 -translate-y-1/2 touch-manipulation px-1 text-xs text-[#64748B]"
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void doLogin()}
                className="relative z-20 mt-2 h-12 w-full touch-manipulation rounded-md bg-[#1E40AF] text-base font-semibold text-white active:bg-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {submitting ? 'Signing in…' : 'Login'}
              </button>
            </form>

            {/* <p className="mt-4 text-center text-[11px] leading-relaxed text-[#64748B]">
              admin@smartmaint.com
              <br />
              admin123
            </p> */}
          </div>
        </div>
      </div>
    </div>
  );
}
