'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusDonut from '@/components/dashboard/StatusDonut';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
}

const statCards = [
  { key: 'total', label: 'Assigned to you', accent: 'border-l-primary' },
  { key: 'open', label: 'Open', accent: 'border-l-primary', valueClass: 'text-primary' },
  { key: 'inProgress', label: 'In progress', accent: 'border-l-blue-400' },
  { key: 'inReview', label: 'In review', accent: 'border-l-amber-500', valueClass: 'text-amber-600 dark:text-amber-500' },
] as const;

const STATUS_SEGMENTS = [
  { key: 'open', label: 'Open', stroke: '#1E40AF' },
  { key: 'in_review', label: 'In review', stroke: '#EAB308' },
  { key: 'in_progress', label: 'In progress', stroke: '#60A5FA' },
  { key: 'solved', label: 'Solved', stroke: '#16A34A' },
  { key: 'closed', label: 'Closed', stroke: '#94A3B8' },
] as const;

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'solved', label: 'Solved' },
] as const;

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    open: 'default',
    in_review: 'secondary',
    in_progress: 'secondary',
    solved: 'default',
    closed: 'outline',
  };
  return map[status] ?? 'secondary';
}

function getPriorityVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    low: 'outline',
    medium: 'secondary',
    high: 'default',
    critical: 'destructive',
  };
  return map[priority] ?? 'secondary';
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function TechnicianDashboard() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const fetchTickets = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get<Ticket[]>('/tickets', { params });
      setTickets(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchTickets();
    const interval = setInterval(() => void fetchTickets(true), 5000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open').length;
    const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const inReview = tickets.filter((t) => t.status === 'in_review').length;
    const solved = tickets.filter((t) => t.status === 'solved').length;
    const closed = tickets.filter((t) => t.status === 'closed').length;
    const critical = tickets.filter((t) => t.priority === 'critical').length;
    const active = tickets.filter((t) =>
      ['open', 'in_progress', 'in_review'].includes(t.status),
    ).length;
    const resolved = solved + closed;
    const total = tickets.length;
    return {
      total,
      open,
      inProgress,
      inReview,
      critical,
      active,
      resolved,
      completionRate: total ? Math.round((resolved / total) * 100) : 0,
      activeRate: total ? Math.round((active / total) * 100) : 0,
    };
  }, [tickets]);

  const statValues: Record<string, number> = {
    total: stats.total,
    open: stats.open,
    inProgress: stats.inProgress,
    inReview: stats.inReview,
  };

  const statusSegments = useMemo(() => {
    if (stats.total === 0) {
      return STATUS_SEGMENTS.map(({ label, stroke }) => ({ label, value: 0, stroke }));
    }
    return STATUS_SEGMENTS.map(({ key, label, stroke }) => ({
      label,
      stroke,
      value: tickets.filter((t) => t.status === key).length,
    })).filter((s) => s.value > 0);
  }, [tickets, stats.total]);

  const priorityStats = useMemo(
    () => ({
      low: tickets.filter((t) => t.priority === 'low').length,
      medium: tickets.filter((t) => t.priority === 'medium').length,
      high: tickets.filter((t) => t.priority === 'high').length,
      critical: tickets.filter((t) => t.priority === 'critical').length,
    }),
    [tickets],
  );

  const priorityMax = Math.max(
    priorityStats.low,
    priorityStats.medium,
    priorityStats.high,
    priorityStats.critical,
    1,
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

  const priorityQueue = useMemo(() => {
    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return [...tickets]
      .filter((t) => ['open', 'in_progress', 'in_review'].includes(t.status))
      .sort((a, b) => {
        const pa = priorityWeight[a.priority] ?? 0;
        const pb = priorityWeight[b.priority] ?? 0;
        if (pb !== pa) return pb - pa;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .slice(0, 5);
  }, [tickets]);

  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tickets.slice(start, start + pageSize);
  }, [tickets, currentPage]);

  const startIndex = tickets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, tickets.length);

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="Technician Dashboard">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => void fetchTickets(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map(({ key, label, accent, valueClass }) => (
              <Card key={key} className={cn('overflow-hidden border-l-[3px]', accent)}>
                <CardHeader className="px-4 pb-1 pt-4">
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

          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">By priority</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                <Card key={label} className={cn('overflow-hidden border-l-[3px]', accent)}>
                  <CardHeader className="px-4 pb-1 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </CardTitle>
                      <Badge variant={badgeVariant} className="shrink-0 px-1.5 text-[10px]">
                        {value}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 pb-4 pt-0">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
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

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">All assigned tickets</CardTitle>
                <div
                  className="flex rounded-lg border border-border/60 bg-background p-1"
                  role="tablist"
                  aria-label="Filter by status"
                >
                  {FILTER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={filter === value}
                      onClick={() => {
                        setFilter(value);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                        filter === value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading && tickets.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <AlertTriangle className="mb-3 h-9 w-9 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No tickets found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try another filter or check ticket requests.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href="/dashboard/technician/ticket-requests">Request tickets</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTickets.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          className="cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                        >
                          <TableCell>
                            <div className="font-medium">{ticket.title}</div>
                            <div className="max-w-xs truncate text-sm text-muted-foreground">
                              {ticket.description}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(ticket.status)} className="capitalize">
                              {formatStatus(ticket.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getPriorityVariant(ticket.priority)} className="capitalize">
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{ticket.category}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      Showing {startIndex}–{endIndex} of {tickets.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/60 shadow-sm lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Your tickets over time</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Last 7 days (by created date)</p>
              </CardHeader>
              <CardContent>
                {loading && tickets.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex h-36 items-end justify-between gap-2 px-1">
                    {ticketsByDay.map((day) => (
                      <div
                        key={day.label}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                      >
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {day.value}
                        </span>
                        <div className="flex h-24 w-full items-end justify-center">
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
                        <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                          {day.short}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Workload</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Completed
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-accent">
                    {stats.completionRate}%
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${stats.completionRate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Solved or closed vs all assigned</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Still active</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-primary">
                    {stats.activeRate}%
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${stats.activeRate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.active} ticket{stats.active === 1 ? '' : 's'} need attention
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Status breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {loading && tickets.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <StatusDonut segments={statusSegments} centerLabel="assigned" />
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Priority queue</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Top items to work on next</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {priorityQueue.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No active tickets in your queue.
                  </p>
                ) : (
                  priorityQueue.map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/tickets/${t.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="line-clamp-1 text-sm font-medium leading-snug">{t.title}</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={getPriorityVariant(t.priority)} className="text-[10px] capitalize">
                            {t.priority}
                          </Badge>
                          <Badge variant={getStatusVariant(t.status)} className="text-[10px] capitalize">
                            {formatStatus(t.status)}
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
