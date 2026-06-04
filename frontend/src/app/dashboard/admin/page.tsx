'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusDonut from '@/components/dashboard/StatusDonut';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  isActive: boolean;
}

const statCards = [
  { key: 'totalTickets', label: 'Total Tickets', accent: 'border-l-primary' },
  { key: 'openTickets', label: 'Open Tickets', accent: 'border-l-primary', valueClass: 'text-primary' },
  { key: 'inReviewTickets', label: 'In Review', accent: 'border-l-amber-500' },
  { key: 'inProgressTickets', label: 'In Progress', accent: 'border-l-blue-400' },
  {
    key: 'solvedClosed',
    label: 'Solved / Closed',
    accent: 'border-l-accent',
    valueClass: 'text-accent',
  },
] as const;

const STATUS_SEGMENTS = [
  { key: 'open', label: 'Open', stroke: '#1E40AF' },
  { key: 'in_review', label: 'In review', stroke: '#EAB308' },
  { key: 'in_progress', label: 'In progress', stroke: '#60A5FA' },
  { key: 'solved', label: 'Solved', stroke: '#16A34A' },
  { key: 'closed', label: 'Closed', stroke: '#94A3B8' },
] as const;

const ROLE_LABELS: Record<string, string> = {
  worker: 'Workers',
  technician: 'Technicians',
  admin: 'Admins',
  superadmin: 'Super admins',
};

export default function AdminDashboard() {
  const currentUser = useAuthStore((s) => s.user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [ticketsRes, usersRes] = await Promise.all([
        api.get('/tickets'),
        api.get('/users'),
      ]);
      setTickets(ticketsRes.data);
      setUsers(usersRes.data);
    } catch (error: unknown) {
      console.error('Failed to fetch data:', error);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to load data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const openTickets = tickets.filter((t) => t.status === 'open').length;
    const inReviewTickets = tickets.filter((t) => t.status === 'in_review').length;
    const inProgressTickets = tickets.filter((t) => t.status === 'in_progress').length;
    const solvedTickets = tickets.filter((t) => t.status === 'solved').length;
    const closedTickets = tickets.filter((t) => t.status === 'closed').length;
    const totalTickets = tickets.length;
    const resolved = solvedTickets + closedTickets;
    return {
      totalTickets,
      openTickets,
      inReviewTickets,
      inProgressTickets,
      solvedTickets,
      closedTickets,
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      resolutionRate: totalTickets ? Math.round((resolved / totalTickets) * 100) : 0,
      openRate: totalTickets ? Math.round((openTickets / totalTickets) * 100) : 0,
    };
  }, [tickets, users]);

  const statValues: Record<string, number> = {
    totalTickets: stats.totalTickets,
    openTickets: stats.openTickets,
    inReviewTickets: stats.inReviewTickets,
    inProgressTickets: stats.inProgressTickets,
    solvedClosed: stats.solvedTickets + stats.closedTickets,
  };

  const statusSegments = useMemo(
    () =>
      STATUS_SEGMENTS.map(({ key, label, stroke }) => ({
        label,
        stroke,
        value: tickets.filter((t) => t.status === key).length,
      })).filter((s) => s.value > 0 || stats.totalTickets === 0),
    [tickets, stats.totalTickets],
  );

  const priorityStats = useMemo(
    () => ({
      low: tickets.filter((t) => t.priority === 'low').length,
      medium: tickets.filter((t) => t.priority === 'medium').length,
      high: tickets.filter((t) => t.priority === 'high').length,
      critical: tickets.filter((t) => t.priority === 'critical').length,
    }),
    [tickets],
  );

  const ticketsByDay = useMemo(() => {
    const days = 7;
    const buckets: { label: string; short: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = tickets.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= start && created < end;
      }).length;
      buckets.push({
        label: start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        short: start.toLocaleDateString(undefined, { weekday: 'short' }),
        value: count,
      });
    }
    return buckets;
  }, [tickets]);

  const maxDayCount = Math.max(...ticketsByDay.map((d) => d.value), 1);

  const usersByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([role, value]) => ({
        role,
        label: ROLE_LABELS[role] ?? role,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [users]);

  const maxRoleCount = Math.max(...usersByRole.map((r) => r.value), 1);

  const priorityMax = Math.max(
    priorityStats.low,
    priorityStats.medium,
    priorityStats.high,
    priorityStats.critical,
    1,
  );

  const allStatusSegments =
    stats.totalTickets === 0
      ? STATUS_SEGMENTS.map(({ label, stroke }) => ({ label, value: 0, stroke }))
      : statusSegments.length > 0
        ? statusSegments
        : STATUS_SEGMENTS.map(({ label, stroke }) => ({ label, value: 0, stroke }));

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout
        title={currentUser?.role === 'superadmin' ? 'Super Admin Dashboard' : 'Admin Dashboard'}
        showSidebar={true}
      >
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statCards.map(({ key, label, accent, valueClass }) => (
              <Card key={key} className={cn('border-l-[3px] overflow-hidden', accent)}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p
                    className={cn(
                      'text-2xl font-semibold tracking-tight tabular-nums',
                      valueClass,
                    )}
                  >
                    {loading && statValues[key] === 0 ? '—' : statValues[key]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Tickets created</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
              </CardHeader>
              <CardContent>
                {loading && tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
                ) : (
                  <div className="flex items-end justify-between gap-2 h-36 px-1">
                    {ticketsByDay.map((day) => (
                      <div
                        key={day.label}
                        className="flex flex-1 flex-col items-center gap-1.5 min-w-0"
                      >
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {day.value}
                        </span>
                        <div className="w-full flex items-end justify-center h-24">
                          <div
                            className={cn(
                              'w-full max-w-9 rounded-t-md transition-all duration-500',
                              day.value > 0 ? 'bg-primary' : 'bg-border',
                            )}
                            style={{
                              height: `${Math.max((day.value / maxDayCount) * 100, day.value ? 8 : 4)}%`,
                            }}
                            title={`${day.label}: ${day.value}`}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                          {day.short}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Resolution rate
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-accent">
                    {stats.resolutionRate}%
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${stats.resolutionRate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Solved or closed vs total tickets
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Still open
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-primary">
                    {stats.openRate}%
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${stats.openRate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Open tickets vs total tickets
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Status breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {loading && tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
                ) : (
                  <StatusDonut segments={allStatusSegments} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Team by role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {usersByRole.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No users</p>
                ) : (
                  usersByRole.map(({ role, label, value }) => (
                    <div key={role} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{label}</span>
                        <span className="font-medium tabular-nums">{value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${(value / maxRoleCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-2 border-t border-border flex justify-between text-xs text-muted-foreground">
                  <span>Inactive accounts</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {stats.totalUsers - stats.activeUsers}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Tickets by priority</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'Low',
                  value: priorityStats.low,
                  badgeVariant: 'outline' as const,
                  bar: 'bg-muted-foreground/50',
                  accent: 'border-l-muted-foreground/40',
                },
                {
                  label: 'Medium',
                  value: priorityStats.medium,
                  badgeVariant: 'secondary' as const,
                  bar: 'bg-primary/60',
                  accent: 'border-l-primary/50',
                },
                {
                  label: 'High',
                  value: priorityStats.high,
                  badgeVariant: 'default' as const,
                  bar: 'bg-primary',
                  accent: 'border-l-primary',
                },
                {
                  label: 'Critical',
                  value: priorityStats.critical,
                  badgeVariant: 'destructive' as const,
                  bar: 'bg-destructive',
                  accent: 'border-l-destructive',
                },
              ].map(({ label, value, badgeVariant, bar, accent }) => (
                <Card key={label} className={cn('border-l-[3px] overflow-hidden', accent)}>
                  <CardHeader className="pb-1 pt-4 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </CardTitle>
                      <Badge variant={badgeVariant} className="text-[10px] px-1.5 shrink-0">
                        {value}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', bar)}
                        style={{ width: `${(value / priorityMax) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
