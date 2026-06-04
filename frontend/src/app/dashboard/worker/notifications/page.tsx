'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  buildNotificationPreview,
  formatNotificationTime,
  type NotificationEntryInput,
} from '@/lib/notification-display';

type NotificationEntry = NotificationEntryInput;

export default function WorkerNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get<NotificationEntry[]>('/tickets/notifications', {
        params: { limit: 50 },
      });
      setNotifications(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ProtectedRoute allowedRoles={['worker']}>
      <Layout title="Notifications" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">My Notifications</h2>
            <Button variant="outline" size="sm" onClick={fetchNotifications}>
              Refresh
            </Button>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>When</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.map((n) => {
                        const item = buildNotificationPreview(n, 'worker');
                        return (
                          <TableRow key={n.id} className="transition-colors">
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatNotificationTime(n.timestamp)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {item.linkable ? (
                                <Button variant="link" size="sm" asChild className="h-auto px-0 py-0">
                                  <Link href={item.href}>{item.entityLabel}</Link>
                                </Button>
                              ) : (
                                item.entityLabel
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.actionVariant} className="text-xs font-normal">
                                {item.headline}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                              {item.detail}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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

