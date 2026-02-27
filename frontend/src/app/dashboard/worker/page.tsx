'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/native-select';
import { Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
}

export default function WorkerDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
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

  const filteredTickets = tickets.filter((ticket) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const inTitle = ticket.title.toLowerCase().includes(q);
      const inDesc = ticket.description?.toLowerCase().includes(q);
      if (!inTitle && !inDesc) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice((page - 1) * pageSize, page * pageSize);

  return (
    <ProtectedRoute allowedRoles={['worker']}>
      <Layout title="Worker Dashboard">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">My Tickets</h2>
            <Button asChild className="w-fit">
              <Link href="/dashboard/create-ticket">Create New Ticket</Link>
            </Button>
          </div>

          {/* Search + filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="in_review">In review</option>
                    <option value="in_progress">In progress</option>
                    <option value="solved">Solved</option>
                    <option value="closed">Closed</option>
                  </Select>
                  <Select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="">All priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                  <Button variant="outline" onClick={fetchTickets}>
                    🔄
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">Loading tickets...</p>
              </CardContent>
            </Card>
          ) : filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="mb-4 text-muted-foreground">No tickets yet</p>
                <Button variant="link" asChild>
                  <Link href="/dashboard/create-ticket">Create your first ticket</Link>
                </Button>
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
              </CardContent>
            </Card>
          )}

          {!loading && filteredTickets.length > 0 && (
            <div className="flex items-center justify-between px-1 py-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
