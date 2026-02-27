'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TicketIcon, Users, ClipboardList, UserCheck } from 'lucide-react';

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

export default function AdminDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Refresh data every 5 seconds
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
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalTickets: tickets.length,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    inReviewTickets: tickets.filter((t) => t.status === 'in_review').length,
    inProgressTickets: tickets.filter((t) => t.status === 'in_progress').length,
    solvedTickets: tickets.filter((t) => t.status === 'solved').length,
    closedTickets: tickets.filter((t) => t.status === 'closed').length,
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
  };

  const priorityStats = useMemo(() => {
    return {
      low: tickets.filter((t) => t.priority === 'low').length,
      medium: tickets.filter((t) => t.priority === 'medium').length,
      high: tickets.filter((t) => t.priority === 'high').length,
      critical: tickets.filter((t) => t.priority === 'critical').length,
    };
  }, [tickets]);

  const statusTotalForBar =
    stats.openTickets +
      stats.inReviewTickets +
      stats.inProgressTickets +
      stats.solvedTickets +
      stats.closedTickets || 1;

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Admin Dashboard" showSidebar={true}>
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-border/50 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tickets
                </CardTitle>
                <TicketIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight">{stats.totalTickets}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open Tickets
                </CardTitle>
                <ClipboardList className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight text-primary">{stats.openTickets}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  In Review
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.inReviewTickets}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  In Progress
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.inProgressTickets}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Solved / Closed
                </CardTitle>
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {stats.solvedTickets + stats.closedTickets}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Ticket status distribution (simple bar chart) */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Ticket status distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading status data…</p>
              ) : (
                <>
                  {[
                    { label: 'Open', value: stats.openTickets, color: 'bg-primary' },
                    {
                      label: 'In review',
                      value: stats.inReviewTickets,
                      color: 'bg-yellow-500 dark:bg-yellow-400',
                    },
                    {
                      label: 'In progress',
                      value: stats.inProgressTickets,
                      color: 'bg-blue-500 dark:bg-blue-400',
                    },
                    {
                      label: 'Solved',
                      value: stats.solvedTickets,
                      color: 'bg-emerald-500 dark:bg-emerald-400',
                    },
                    {
                      label: 'Closed',
                      value: stats.closedTickets,
                      color: 'bg-muted-foreground',
                    },
                  ].map(({ label, value, color }) => {
                    const pct = Math.round((value / statusTotalForBar) * 100);
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{label}</span>
                          <span className="font-medium text-foreground">
                            {value} {stats.totalTickets ? `(${pct}%)` : ''}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`${color} h-2 rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {/* Priority breakdown */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Tickets by priority</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Low',
                  value: priorityStats.low,
                  badgeVariant: 'outline',
                },
                {
                  label: 'Medium',
                  value: priorityStats.medium,
                  badgeVariant: 'secondary',
                },
                {
                  label: 'High',
                  value: priorityStats.high,
                  badgeVariant: 'default',
                },
                {
                  label: 'Critical',
                  value: priorityStats.critical,
                  badgeVariant: 'destructive',
                },
              ].map(({ label, value, badgeVariant }) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/60 bg-card/60 px-3 py-3 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Badge variant={badgeVariant as any} className="text-[11px]">
                      {value}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
