'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  technician: 'Technician',
  worker: 'Worker',
};

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

  const showSidebar =
    currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isAdminOrSuperadmin =
    currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

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
    fetchProfile();
  }, []);

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

  const displayName =
    form.fullName?.trim() || currentUser?.fullName || form.username || form.email || 'Account';

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin', 'technician', 'worker']}>
      <Layout title="Settings" showSidebar={showSidebar}>
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Page title */}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
            <p className="text-muted-foreground mt-1">
              Manage your account and security preferences.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Account card – prominent for admin & superadmin; compact for technician/worker */}
              <Card className="overflow-hidden border-border/60 shadow-sm bg-gradient-to-br from-card to-card/80">
                <div
                  className={cn(
                    'border-b border-border/40 px-6 py-4',
                    isAdminOrSuperadmin ? 'bg-primary/5 py-5' : 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex shrink-0 items-center justify-center rounded-xl',
                        currentUser?.role === 'superadmin'
                          ? 'h-14 w-14 bg-primary/20 text-primary'
                          : isAdminOrSuperadmin
                            ? 'h-14 w-14 bg-muted text-muted-foreground'
                            : 'h-12 w-12 bg-muted text-muted-foreground'
                      )}
                    >
                      {isAdminOrSuperadmin ? (
                        <Shield className="h-7 w-7" />
                      ) : (
                        <User className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className={cn(
                          'font-semibold truncate',
                          isAdminOrSuperadmin ? 'text-lg' : 'text-base'
                        )}
                      >
                        {displayName}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {form.email}
                      </p>
                      <div className="mt-1.5">
                        <Badge
                          variant={
                            currentUser?.role === 'superadmin'
                              ? 'default'
                              : 'secondary'
                          }
                          className={cn(
                            'capitalize font-medium',
                            currentUser?.role === 'superadmin' &&
                              'bg-primary/90 hover:bg-primary'
                          )}
                        >
                          {roleLabels[currentUser?.role ?? ''] ?? currentUser?.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Profile section */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Profile</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          Full name
                        </Label>
                        <Input
                          id="fullName"
                          value={form.fullName}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, fullName: e.target.value }))
                          }
                          placeholder="Your full name"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="flex items-center gap-2 text-muted-foreground">
                          <AtSign className="h-3.5 w-3.5" />
                          Username
                        </Label>
                        <Input
                          id="username"
                          value={form.username}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, username: e.target.value }))
                          }
                          placeholder="username"
                          required
                          className="h-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        disabled
                        className="h-10 bg-muted/60 cursor-not-allowed border-dashed"
                        aria-readonly
                      />
                      <p className="text-xs text-muted-foreground">
                        Email is fixed for your account and cannot be changed.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        Mobile phone
                      </Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={form.phoneNumber}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                        }
                        placeholder="+1 234 567 8900"
                        className="h-10"
                      />
                    </div>

                    {/* Security section inside same form */}
                    <div className="pt-6 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Security</CardTitle>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">New password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={form.password}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, password: e.target.value }))
                          }
                          placeholder="Leave empty to keep current password"
                          minLength={6}
                          className="h-10 max-w-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          At least 6 characters. Leave blank to keep your current password.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Button type="submit" disabled={saving} className="gap-2">
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
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
