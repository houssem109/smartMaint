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

  const canUpdateStatus = user?.role === 'admin' || user?.role === 'technician';
  const canDelete = user?.role === 'admin' || (user?.role === 'worker' && ticket?.createdById === user?.id);
  const canClose = user?.role === 'admin' || user?.role === 'technician';

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
        if (user?.role === 'admin') {
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
      <Layout title="Ticket Details">
        {loading ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Loading ticket...</p>
            </CardContent>
          </Card>
        ) : !ticket ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Ticket not found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="mb-2">{ticket.title}</CardTitle>
                    <div className="flex space-x-2">
                      <Badge variant={getStatusVariant(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant={getPriorityVariant(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="secondary">{ticket.category}</Badge>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {canUpdateStatus && (
                      <>
                        <Select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="w-40"
                        >
                          <option value="open">Open</option>
                          <option value="in_review">In Review</option>
                          <option value="in_progress">In Progress</option>
                          <option value="solved">Solved</option>
                          <option value="closed">Closed</option>
                        </Select>
                        <Button
                          onClick={handleStatusUpdate}
                          disabled={updating || newStatus === ticket.status}
                        >
                          {updating ? 'Updating...' : 'Update Status'}
                        </Button>
                      </>
                    )}
                    {canClose && ticket.status !== 'closed' && (
                      <Button
                        variant="default"
                        onClick={handleCloseTicketClick}
                        disabled={updating}
                      >
                        {updating ? 'Closing...' : 'Close Ticket'}
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="destructive" onClick={handleDeleteClick}>
                        Delete Ticket
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{ticket.description}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Created By</dt>
                      <dd className="text-sm">
                        {ticket.createdBy?.fullName || ticket.createdBy?.email || 'Unknown'}
                      </dd>
                    </div>
                    {ticket.assignedTo && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Assigned To</dt>
                        <dd className="text-sm">
                          {ticket.assignedTo.fullName || ticket.assignedTo.email}
                        </dd>
                      </div>
                    )}
                    {ticket.subcategory && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                        <dd className="text-sm">
                          {ticket.subcategory.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </dd>
                      </div>
                    )}
                    {ticket.machine && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Machine</dt>
                        <dd className="text-sm">{ticket.machine}</dd>
                      </div>
                    )}
                    {ticket.area && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Area</dt>
                        <dd className="text-sm">{ticket.area}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                      <dd className="text-sm">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                      <dd className="text-sm">
                        {new Date(ticket.updatedAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Back Button */}
            <div>
              <Button variant="outline" onClick={() => router.back()}>
                ← Back
              </Button>
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
