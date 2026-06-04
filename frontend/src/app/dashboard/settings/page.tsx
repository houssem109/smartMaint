'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Shield,
  Lock,
  Phone,
  AtSign,
  Loader2,
  Save,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  technician: 'Technician',
  worker: 'Worker',
};

function profileInitials(fullName: string, email: string, username: string): string {
  const name = fullName.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const fromEmail = email.split('@')[0]?.trim();
  if (fromEmail && fromEmail.length >= 2) return fromEmail.slice(0, 2).toUpperCase();
  if (username.length >= 2) return username.slice(0, 2).toUpperCase();
  return 'SM';
}

export default function SettingsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    username: '',
    phoneNumber: '',
    password: '',
  });

  const role = currentUser?.role ?? '';
  const isPrivileged = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/me');
        const u = res.data;
        setForm({
          email: u.email ?? '',
          fullName: u.fullName ?? '',
          username: u.username ?? '',
          phoneNumber: u.phoneNumber ?? '',
          password: '',
        });
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        toast.error(e.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  const displayName = useMemo(
    () =>
      form.fullName?.trim() ||
      currentUser?.fullName ||
      form.username ||
      form.email ||
      'Your account',
    [form.fullName, form.username, form.email, currentUser?.fullName],
  );

  const initials = useMemo(
    () => profileInitials(form.fullName, form.email, form.username),
    [form.fullName, form.email, form.username],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        fullName: form.fullName,
        username: form.username,
        phoneNumber: form.phoneNumber,
      };
      if (form.password.trim()) payload.password = form.password;
      await api.patch('/users/me', payload);
      toast.success('Profile updated');
      setForm((f) => ({ ...f, password: '' }));
      if (currentUser && token) {
        setAuth(
          {
            ...currentUser,
            fullName: form.fullName || currentUser.fullName,
            username: form.username || currentUser.username,
          },
          token,
        );
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin', 'technician', 'worker']}>
      <Layout title="Settings">
        <div className="mx-auto max-w-3xl space-y-6">
          {loading ? (
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <div className="accent-band-top h-1 shrink-0" aria-hidden />
              <CardContent className="space-y-4 p-6 pt-8">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-56 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="h-10 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile summary */}
              <Card accentBand className="overflow-hidden border-border/80 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-muted/20 p-6 sm:flex-row sm:items-center">
                    <div
                      className={cn(
                        'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ring-2 ring-background',
                        isPrivileged
                          ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
                          : 'bg-gradient-to-br from-accent/90 to-accent text-accent-foreground',
                      )}
                      aria-hidden
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-semibold tracking-tight">{displayName}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {form.email}
                      </p>
                      <div className="mt-2">
                        <Badge
                          variant={role === 'superadmin' ? 'default' : 'outline'}
                          className={cn(
                            'capitalize font-normal',
                            role === 'superadmin' && 'bg-primary',
                            isPrivileged && role !== 'superadmin' && 'border-primary/30 text-primary',
                          )}
                        >
                          {isPrivileged ? (
                            <Shield className="mr-1 inline h-3 w-3" />
                          ) : (
                            <User className="mr-1 inline h-3 w-3" />
                          )}
                          {roleLabels[role] ?? role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile fields */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Profile</CardTitle>
                    {/*   <CardDescription className="text-xs">
                        How your name appears across SmartMaint
                      </CardDescription> */}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input
                        id="fullName"
                        value={form.fullName}
                        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder="Your full name"
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <div className="relative">
                        <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="username"
                          value={form.username}
                          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                          placeholder="username"
                          required
                          className="pl-9"
                          autoComplete="username"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        disabled
                        className="cursor-not-allowed border-dashed bg-muted/40 pl-9"
                        aria-readonly
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Mobile phone</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={form.phoneNumber}
                        onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                        placeholder="+1 234 567 8900"
                        className="pl-9"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Security</CardTitle>
                      <CardDescription className="text-xs">
                        Update your password to keep your account safe
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-6">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative max-w-md">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Leave empty to keep current password"
                      minLength={6}
                      className="pl-9"
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 6 characters. Leave blank if you do not want to change it.
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-2 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-center text-xs text-muted-foreground sm:mr-auto sm:text-left">
                  Changes apply to your account on this device immediately.
                </p>
                <Button type="submit" disabled={saving} className="gap-2 shadow-sm sm:min-w-[10rem]">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
