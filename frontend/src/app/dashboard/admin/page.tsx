'use client';

import { useEffect, useState } from 'react';
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
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout title="Admin Dashboard" showSidebar={true}>
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTickets}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.openTickets}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeUsers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Tickets</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  🔄 Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No tickets yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.slice(0, 5).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex justify-between items-center p-3 rounded-lg border"
                    >
                      <div>
                        <div className="font-medium">{ticket.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                          {ticket.status}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/tickets/${ticket.id}`}>
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName || user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'destructive'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
