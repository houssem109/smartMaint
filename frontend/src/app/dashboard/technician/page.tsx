'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  assignedTo?: { fullName: string; email: string };
}

export default function TechnicianDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchTickets();
    // Refresh tickets every 5 seconds
    const interval = setInterval(() => {
      fetchTickets();
    }, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchTickets = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/tickets', { params });
      setTickets(response.data);
    } catch (error: any) {
      console.error('Failed to fetch tickets:', error);
      toast.error(error.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'default',
      in_review: 'secondary',
      in_progress: 'secondary',
      solved: 'default',
      closed: 'outline',
    };
    return variants[status] || 'secondary';
  };

  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      critical: 'destructive',
    };
    return variants[priority] || 'secondary';
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    critical: tickets.filter((t) => t.priority === 'critical').length,
  };

  const priorityQueue = useMemo(() => {
    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...tickets]
      .filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'in_review')
      .sort((a, b) => {
        const pa = priorityWeight[a.priority] ?? 0;
        const pb = priorityWeight[b.priority] ?? 0;
        if (pb !== pa) return pb - pa; // higher priority first
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // older first
      })
      .slice(0, 5);
  }, [tickets]);

  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tickets.slice(start, start + pageSize);
  }, [tickets, currentPage, pageSize]);

  const startIndex = tickets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, tickets.length);

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="Technician Dashboard" showSidebar={true}>
        <div className="space-y-8">
          {/* Header + quick actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">My tickets overview</h2>
              <p className="text-sm text-muted-foreground">
                Track and work on tickets assigned to you in real time.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchTickets}>
                🔄 Refresh
              </Button>
            </div>
          </div>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.open}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.inProgress}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
              </CardContent>
            </Card>
          </div>

          {/* Priority Queue */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Priority queue (next up)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {priorityQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No high-priority tickets in your queue right now.
                </p>
              ) : (
                <ul className="space-y-2">
                  {priorityQueue.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-card/60 px-3 py-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm line-clamp-1">{t.title}</span>
                          <Badge variant={getPriorityVariant(t.priority)} className="text-[10px]">
                            {t.priority}
                          </Badge>
                          <Badge variant={getStatusVariant(t.status)} className="text-[10px] capitalize">
                            {t.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {t.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Created {new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href={`/dashboard/tickets/${t.id}`}>Open</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  {['all', 'open', 'in_progress', 'solved'].map((status) => (
                    <Button
                      key={status}
                      variant={filter === status ? 'default' : 'outline'}
                      onClick={() => {
                        setFilter(status);
                        setCurrentPage(1);
                        setLoading(true);
                      }}
                    >
                      {status.replace('_', ' ').toUpperCase()}
                    </Button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Showing tickets filtered by status
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Tickets Table */}
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">Loading tickets...</p>
              </CardContent>
            </Card>
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">No tickets found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="font-medium">{ticket.title}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {ticket.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityVariant(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/tickets/${ticket.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {tickets.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
                    <span className="text-xs text-muted-foreground">
                      Showing {startIndex}-{endIndex} of {tickets.length} tickets
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
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages || tickets.length === 0}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
