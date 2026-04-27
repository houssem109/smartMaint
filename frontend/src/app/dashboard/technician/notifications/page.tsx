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

interface NotificationEntry {
  id: string;
  actionType: string;
  entityId: string;
  entityType: string;
  userId: string | null;
  changes: Record<string, any> | null;
  timestamp: string;
  ticketTitle?: string;
}

export default function TechnicianNotificationsPage() {
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
  }, []);

  const formatAction = (entry: NotificationEntry) => {
    if (entry.entityType === 'machine_name_suggestion') {
      const ev = (entry.changes as any)?.event;
      if (ev === 'machine_name_suggestion_approved') return 'Machine name approved';
      if (ev === 'machine_name_suggestion_rejected') return 'Machine name rejected';
      if (ev === 'machine_name_suggestion_superseded') return 'Suggestion closed (another approved)';
    }
    switch (entry.actionType) {
      case 'create':
        return 'New ticket created';
      case 'update':
        return 'Ticket updated';
      case 'delete':
        return 'Ticket moved to trash';
      case 'rollback':
        return 'Ticket restored';
      case 'approve':
        return 'Approved';
      case 'reject':
        return 'Rejected';
      default:
        return entry.actionType;
    }
  };

  const formatDetails = (entry: NotificationEntry): string => {
    const changes = entry.changes;
    if (!changes) return '—';

    if (changes.deletedSnapshot) return 'Ticket soft-deleted (can be restored by admin).';
    if (changes.restoredFromDelete) return 'Ticket restored from trash.';

    if (changes.proposedName && typeof changes.proposedName === 'string') {
      const bits = [`Suggested: ${changes.proposedName}`];
      if (changes.rejectReason) bits.push(`Reason: ${changes.rejectReason}`);
      if (changes.adoptedName) bits.push(`Now: ${changes.adoptedName}`);
      return bits.join(' · ');
    }

    const parts: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'forUserId' || key === 'event' || key === 'documentId') continue;
      if (key === 'attachmentsAdded' && Array.isArray(value)) {
        parts.push(`Attachments added: ${(value as string[]).join(', ')}`);
      } else if (value && typeof value === 'object' && 'from' in (value as any) && 'to' in (value as any)) {
        parts.push(`${key}: ${(value as any).from} → ${(value as any).to}`);
      }
    }
    return parts.join(' | ') || '—';
  };

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="Notifications" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">My Ticket Notifications</h2>
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
                        <TableHead>Ticket</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.map((n) => (
                        <TableRow key={n.id} className="transition-colors">
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(n.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Button variant="link" size="sm" asChild className="px-0">
                              <Link
                                href={
                                  n.entityType === 'machine_name_suggestion' &&
                                  typeof (n.changes as any)?.documentId === 'string'
                                    ? `/dashboard/technician/knowledge-pdfs/${(n.changes as any).documentId}`
                                    : `/dashboard/tickets/${n.entityId}`
                                }
                              >
                                {(() => {
                                  if (n.ticketTitle) return n.ticketTitle;
                                  const changes: any = n.changes;
                                  if (changes?.deletedSnapshot?.ticket?.title) {
                                    return changes.deletedSnapshot.ticket.title;
                                  }
                                  if (changes?.title && typeof changes.title === 'object') {
                                    if ('to' in changes.title) return String(changes.title.to);
                                    if ('from' in changes.title) return String(changes.title.from);
                                  }
                                  if (n.entityType === 'machine_name_suggestion' && changes?.documentOriginalName) {
                                    return String(changes.documentOriginalName);
                                  }
                                  return `Ticket ${n.entityId.slice(0, 8)}…`;
                                })()}
                              </Link>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {formatAction(n)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-lg">
                            {formatDetails(n)}
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

