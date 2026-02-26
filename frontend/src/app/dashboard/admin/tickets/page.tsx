'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Plus, RefreshCw } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  subcategory?: string;
  machine?: string;
  area?: string;
  createdAt: string;
  createdBy?: { fullName: string; email: string };
  assignedTo?: { fullName: string; email: string };
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'solved', label: 'Solved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

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

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await api.get<Ticket[]>('/tickets', { params });
      setTickets(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    );
  }, [tickets, search]);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Tickets" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">All Tickets</h2>
            <Button asChild className="w-fit gap-2">
              <Link href="/dashboard/create-ticket">
                <Plus className="h-4 w-4" />
                Add ticket
              </Link>
            </Button>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="space-y-4">
              <CardTitle className="text-lg">Tickets list</CardTitle>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-[180px]"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full sm:w-[160px]"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button variant="outline" size="icon" onClick={fetchTickets} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <p className="mb-2">
                    {tickets.length === 0
                      ? 'No tickets yet.'
                      : 'No tickets match your search or filters.'}
                  </p>
                  {tickets.length === 0 && (
                    <Button asChild variant="outline" className="mt-2">
                      <Link href="/dashboard/create-ticket">Create first ticket</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket) => (
                        <TableRow key={ticket.id} className="transition-colors">
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
                          <TableCell className="capitalize">
                            {ticket.category}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(ticket.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {ticket.assignedTo?.fullName || ticket.assignedTo?.email || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/tickets/${ticket.id}`}>
                                View details
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
