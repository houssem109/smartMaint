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

interface TicketHistoryEntry {
  id: string;
  actionType: 'create' | 'update' | 'delete' | string;
  entityId: string;
  entityType: string;
  userId: string | null;
  changes: Record<string, any> | null;
  reason: string | null;
  timestamp: string;
}

export default function TicketHistoryPage() {
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get<TicketHistoryEntry[]>('/tickets/history', {
        params: { limit: 100 },
      });
      setHistory(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load ticket history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatAction = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      case 'rollback':
        return 'Restored';
      default:
        return actionType;
    }
  };

  const formatChanges = (entry: TicketHistoryEntry): string => {
    const changes = entry.changes;
    if (!changes) return '—';

    if (changes.deletedSnapshot) {
      return 'Deleted with snapshot stored';
    }
    if (changes.restoredFromDelete) {
      return 'Restored from deletion';
    }

    const parts: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (value && typeof value === 'object' && 'from' in (value as any) && 'to' in (value as any)) {
        parts.push(`${key}: ${(value as any).from} → ${(value as any).to}`);
      } else if (key === 'attachmentsAdded' && Array.isArray(value)) {
        parts.push(`attachments added: ${(value as string[]).join(', ')}`);
      } else {
        parts.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    return parts.join(' | ');
  };

  const isTicket = (entry: TicketHistoryEntry) => entry.entityType === 'ticket';
  const isUser = (entry: TicketHistoryEntry) => entry.entityType === 'user';

  const handleRestore = async (entry: TicketHistoryEntry) => {
    if (entry.actionType !== 'delete') return;
    setRestoringId(entry.id);
    try {
      if (isTicket(entry)) {
        await api.post(`/tickets/${entry.entityId}/restore`);
      } else if (isUser(entry)) {
        await api.post(`/users/${entry.entityId}/restore`);
      } else {
        return;
      }
      toast.success('Entity restored successfully');
      fetchHistory();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to restore');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Ticket History" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Ticket Activity</h2>
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              Refresh
            </Button>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">History log</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : history.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No history entries yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>When</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => (
                        <TableRow key={entry.id} className="transition-colors">
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isTicket(entry) ? (
                              <Button variant="link" size="sm" asChild className="px-0">
                                <Link href={`/dashboard/tickets/${entry.entityId}`}>
                                  Ticket {entry.entityId.slice(0, 8)}…
                                </Link>
                              </Button>
                            ) : isUser(entry) ? (
                              <span className="text-xs">User {entry.entityId.slice(0, 8)}…</span>
                            ) : (
                              <span className="text-xs">
                                {entry.entityType} {entry.entityId.slice(0, 8)}…
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {entry.entityType}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize text-xs">
                              {formatAction(entry.actionType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-lg">
                            {formatChanges(entry)}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.actionType === 'delete' && (isTicket(entry) || isUser(entry)) && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={restoringId === entry.id}
                                onClick={() => handleRestore(entry)}
                              >
                                {restoringId === entry.id ? 'Restoring…' : 'Restore'}
                              </Button>
                            )}
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

