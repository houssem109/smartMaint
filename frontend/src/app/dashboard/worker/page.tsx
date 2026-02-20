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

  useEffect(() => {
    fetchTickets();
    // Refresh tickets every 5 seconds
    const interval = setInterval(() => {
      fetchTickets();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get('/tickets');
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

  return (
    <ProtectedRoute allowedRoles={['worker']}>
      <Layout title="Worker Dashboard">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Tickets</h2>
            <Button asChild>
              <Link href="/dashboard/create-ticket">+ Create New Ticket</Link>
            </Button>
          </div>

          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={fetchTickets}>
              🔄 Refresh
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">Loading tickets...</p>
              </CardContent>
            </Card>
          ) : tickets.length === 0 ? (
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
                    {tickets.map((ticket) => (
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
