'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ConfirmModal from '@/components/ConfirmModal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/native-select';
import {
  Ticket as TicketIcon,
  ArrowLeft,
  Loader2,
  Save,
  Lock,
  Trash2,
} from 'lucide-react';

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
  updatedAt: string;
  createdById?: string;
  createdBy?: { fullName: string; email: string };
  assignedTo?: { fullName: string; email: string };
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchTicket(params.id as string);
    }
  }, [params.id]);

  const fetchTicket = async (id: string) => {
    try {
      const response = await api.get(`/tickets/${id}`);
      setTicket(response.data);
      setNewStatus(response.data.status);
    } catch (error: any) {
      console.error('Failed to fetch ticket:', error);
      toast.error(error.response?.data?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!ticket || newStatus === ticket.status) return;

    setUpdating(true);
    const toastId = toast.loading('Updating ticket status...');
    try {
      await api.patch(`/tickets/${ticket.id}`, { status: newStatus });
      await fetchTicket(ticket.id);
      toast.success('Ticket status updated successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Failed to update ticket:', error);
      toast.error(error.response?.data?.message || 'Failed to update ticket status', { id: toastId });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    const classes: Record<string, string> = {
      open: 'bg-blue-500 text-white border-0 hover:bg-blue-600',
      in_review: 'bg-amber-500 text-white border-0 hover:bg-amber-600',
      in_progress: 'bg-sky-500 text-white border-0 hover:bg-sky-600',
      solved: 'bg-emerald-600 text-white border-0 hover:bg-emerald-700',
      closed: 'bg-slate-500 text-white border-0 hover:bg-slate-600',
    };
    return classes[status] ?? 'bg-secondary text-secondary-foreground';
  };

  const getPriorityBadgeClass = (priority: string): string => {
    const classes: Record<string, string> = {
      low: 'bg-slate-500 text-white border-0 hover:bg-slate-600',
      medium: 'bg-blue-500 text-white border-0 hover:bg-blue-600',
      high: 'bg-amber-500 text-white border-0 hover:bg-amber-600',
      critical: 'bg-red-600 text-white border-0 hover:bg-red-700',
    };
    return classes[priority] ?? 'bg-secondary text-secondary-foreground';
  };

  const canUpdateStatus = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'technician';
  const canDelete = user?.role === 'admin' || user?.role === 'superadmin' || (user?.role === 'worker' && ticket?.createdById === user?.id);
  const canClose = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'technician';
  const showSidebar = user?.role === 'admin' || user?.role === 'superadmin';

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!ticket) return;

    setShowDeleteModal(false);
    const toastId = toast.loading('Deleting ticket...');
    try {
      await api.delete(`/tickets/${ticket.id}`);
      toast.success('Ticket deleted successfully!', { id: toastId });
      setTimeout(() => {
        // Redirect to user's own dashboard based on role
        if (user?.role === 'admin' || user?.role === 'superadmin') {
          router.push('/dashboard/admin');
        } else if (user?.role === 'technician') {
          router.push('/dashboard/technician');
        } else {
          router.push('/dashboard/worker');
        }
      }, 1000);
    } catch (error: any) {
      console.error('Failed to delete ticket:', error);
      toast.error(error.response?.data?.message || 'Failed to delete ticket', { id: toastId });
    }
  };

  const handleCloseTicketClick = () => {
    setShowCloseModal(true);
  };

  const handleCloseTicket = async () => {
    if (!ticket) return;

    setShowCloseModal(false);
    setUpdating(true);
    const toastId = toast.loading('Closing ticket...');
    try {
      await api.patch(`/tickets/${ticket.id}`, { status: 'closed' });
      await fetchTicket(ticket.id);
      toast.success('Ticket closed successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Failed to close ticket:', error);
      toast.error(error.response?.data?.message || 'Failed to close ticket', { id: toastId });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="Ticket Details" showSidebar={showSidebar}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-base">Loading ticket…</p>
          </div>
        ) : !ticket ? (
          <Card className="max-w-md mx-auto border-border/50">
            <CardContent className="py-12 text-center">
              <TicketIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-base">Ticket not found</p>
              <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-5xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2 text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {/* Title row: title (left) + status & actions (right) */}
            <header className="mb-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-foreground break-words flex-1 min-w-0">
                  {ticket.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canUpdateStatus && (
                    <>
                      <Select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="h-9 min-w-[7rem] rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="in_review">In Review</option>
                        <option value="in_progress">In Progress</option>
                        <option value="solved">Solved</option>
                        <option value="closed">Closed</option>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleStatusUpdate}
                        disabled={updating || newStatus === ticket.status}
                        className="gap-1.5 h-9"
                      >
                        {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Update
                      </Button>
                    </>
                  )}
                  {canClose && ticket.status !== 'closed' && (
                    <Button size="sm" variant="outline" onClick={handleCloseTicketClick} disabled={updating} className="gap-1.5 h-9">
                      <Lock className="h-3.5 w-3.5" />
                      Close
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="destructive" onClick={handleDeleteClick} className="gap-1.5 h-9">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm mt-2">
                <Badge variant="outline" className={getStatusBadgeClass(ticket.status) + ' text-xs font-medium px-2.5 py-0.5'}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className={getPriorityBadgeClass(ticket.priority) + ' text-xs font-medium px-2.5 py-0.5'}>
                  {ticket.priority}
                </Badge>
                <Badge variant="outline" className="bg-violet-500/90 text-white border-0 text-xs font-medium px-2.5 py-0.5">
                  {ticket.category}
                </Badge>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </div>
            </header>

            <div className="border-t border-border/60 my-4" />

            {/* Main: description (left) + details sidebar (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 pt-2">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Description
                </h2>
                <p className="whitespace-pre-wrap text-foreground leading-relaxed text-base">
                  {ticket.description}
                </p>
              </section>

              <aside className="lg:pl-0">
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Details
                  </h2>
                  <ul className="space-y-2.5 text-sm">
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">Created by</span>
                      <span className="font-medium text-right">
                        {ticket.createdBy?.fullName || ticket.createdBy?.email || '—'}
                      </span>
                    </li>
                    {ticket.assignedTo && (
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Assigned to</span>
                        <span className="font-medium text-right">
                          {ticket.assignedTo.fullName || ticket.assignedTo.email}
                        </span>
                      </li>
                    )}
                    {ticket.subcategory && (
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Type</span>
                        <span className="font-medium text-right capitalize">
                          {ticket.subcategory.replace(/_/g, ' ')}
                        </span>
                      </li>
                    )}
                    {ticket.machine && (
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Machine</span>
                        <span className="font-medium text-right">{ticket.machine}</span>
                      </li>
                    )}
                    {ticket.area && (
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Area</span>
                        <span className="font-medium text-right">{ticket.area}</span>
                      </li>
                    )}
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">Created</span>
                      <span className="font-medium text-right">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">Updated</span>
                      <span className="font-medium text-right">
                        {new Date(ticket.updatedAt).toLocaleString()}
                      </span>
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* Confirmation Modals */}
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete Ticket"
          message="Are you sure you want to delete this ticket? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />

        <ConfirmModal
          isOpen={showCloseModal}
          title="Close Ticket"
          message="Are you sure you want to close this ticket? It will be marked as resolved."
          confirmText="Close Ticket"
          cancelText="Cancel"
          type="warning"
          onConfirm={handleCloseTicket}
          onCancel={() => setShowCloseModal(false)}
        />
      </Layout>
    </ProtectedRoute>
  );
}
