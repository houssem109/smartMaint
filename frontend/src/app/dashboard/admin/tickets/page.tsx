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
import { Search, Plus, RefreshCw, Download } from 'lucide-react';

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
  assignmentRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  assignmentRequestedById?: string | null;
}

interface TechnicianOption {
  id: string;
  fullName?: string | null;
  email: string;
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
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [reviewingRequestTicketId, setReviewingRequestTicketId] = useState<string | null>(null);

  const fetchTechnicians = async () => {
    try {
      const res = await api.get<TechnicianOption[]>('/users/technicians');
      setTechnicians(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTechnicians([]);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (technicianFilter) params.assignedToId = technicianFilter;
      const res = await api.get<Ticket[]>('/tickets', { params });
      setTickets(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter, technicianFilter]);

  useEffect(() => {
    setPage(1);
  }, [assignmentFilter]);

  const filteredTickets = useMemo(() => {
    // Reset to first page when filters/search change
    setPage(1);

    if (!search.trim()) return tickets;
    const q = search.trim().toLowerCase();
    const searched = tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    );
    return searched;
  }, [tickets, search]);

  const assignmentFilteredTickets = useMemo(() => {
    if (assignmentFilter === 'assigned') {
      return filteredTickets.filter((t) => !!t.assignedTo);
    }
    if (assignmentFilter === 'unassigned') {
      return filteredTickets.filter((t) => !t.assignedTo);
    }
    return filteredTickets;
  }, [filteredTickets, assignmentFilter]);

  const totalPages = Math.max(1, Math.ceil(assignmentFilteredTickets.length / pageSize));
  const paginatedTickets = assignmentFilteredTickets.slice((page - 1) * pageSize, page * pageSize);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Tickets" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">All Tickets</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild className="w-fit gap-2">
                <Link href="/dashboard/admin/tickets-export">
                  <Download className="h-4 w-4" />
                  Export
                </Link>
              </Button>
              <Button asChild className="w-fit gap-2">
                <Link href="/dashboard/create-ticket">
                  <Plus className="h-4 w-4" />
                  Add ticket
                </Link>
              </Button>
            </div>
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
                <Select
                  value={technicianFilter}
                  onChange={(e) => setTechnicianFilter(e.target.value)}
                  className="w-full sm:w-[220px]"
                >
                  <option value="">All technicians</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.fullName?.trim() || tech.email}
                    </option>
                  ))}
                </Select>
                <Select
                  value={assignmentFilter}
                  onChange={(e) =>
                    setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'unassigned')
                  }
                  className="w-full sm:w-[180px]"
                >
                  <option value="all">All assignments</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
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
              ) : assignmentFilteredTickets.length === 0 ? (
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
                <>
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
                          <TableHead>Self-assign request</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTickets.map((ticket) => (
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
                            <TableCell>
                              {ticket.assignmentRequestStatus === 'pending' ? (
                                <Badge variant="secondary">Pending</Badge>
                              ) : ticket.assignmentRequestStatus === 'approved' ? (
                                <Badge variant="default">Approved</Badge>
                              ) : ticket.assignmentRequestStatus === 'rejected' ? (
                                <Badge variant="outline">Rejected</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {ticket.assignmentRequestStatus === 'pending' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={reviewingRequestTicketId === ticket.id}
                                      onClick={async () => {
                                        setReviewingRequestTicketId(ticket.id);
                                        try {
                                          await api.post(`/tickets/${ticket.id}/assignment-request/approve`);
                                          toast.success('Self-assign request approved.');
                                          await fetchTickets();
                                        } catch (err: any) {
                                          toast.error(err.response?.data?.message || 'Failed to approve request');
                                        } finally {
                                          setReviewingRequestTicketId(null);
                                        }
                                      }}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={reviewingRequestTicketId === ticket.id}
                                      onClick={async () => {
                                        setReviewingRequestTicketId(ticket.id);
                                        try {
                                          await api.post(`/tickets/${ticket.id}/assignment-request/reject`, {
                                            reason: 'Rejected by admin',
                                          });
                                          toast.success('Self-assign request rejected.');
                                          await fetchTickets();
                                        } catch (err: any) {
                                          toast.error(err.response?.data?.message || 'Failed to reject request');
                                        } finally {
                                          setReviewingRequestTicketId(null);
                                        }
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={`/dashboard/tickets/${ticket.id}`}>
                                    View details
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
