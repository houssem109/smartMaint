'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ConfirmModal from '@/components/ConfirmModal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      in_review: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-purple-100 text-purple-800',
      solved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
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
          <div className="text-center py-12">
            <p className="text-gray-900">Loading ticket...</p>
          </div>
        ) : !ticket ? (
          <div className="text-center py-12">
            <p className="text-gray-900">Ticket not found</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{ticket.title}</h2>
                  <div className="flex space-x-2">
                    <span
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(
                        ticket.status,
                      )}`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${getPriorityColor(
                        ticket.priority,
                      )}`}
                    >
                      {ticket.priority}
                    </span>
                    <span className="px-3 py-1 text-sm bg-gray-100 text-gray-900 rounded-full">
                      {ticket.category}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {canUpdateStatus && (
                    <>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 font-semibold"
                      >
                        <option value="open">Open</option>
                        <option value="in_review">In Review</option>
                        <option value="in_progress">In Progress</option>
                        <option value="solved">Solved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button
                        onClick={handleStatusUpdate}
                        disabled={updating || newStatus === ticket.status}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 font-semibold"
                      >
                        {updating ? 'Updating...' : 'Update Status'}
                      </button>
                    </>
                  )}
                  {canClose && ticket.status !== 'closed' && (
                    <button
                      onClick={handleCloseTicketClick}
                      disabled={updating}
                      className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 font-semibold"
                    >
                      {updating ? 'Closing...' : 'Close Ticket'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDeleteClick}
                      className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 font-semibold"
                    >
                      Delete Ticket
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Description</h3>
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-semibold">{ticket.description}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Details</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Created By</dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-semibold">
                      {ticket.createdBy?.fullName || ticket.createdBy?.email || 'Unknown'}
                    </dd>
                  </div>
                  {ticket.assignedTo && (
                    <div>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned To</dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-semibold">
                        {ticket.assignedTo.fullName || ticket.assignedTo.email}
                      </dd>
                    </div>
                  )}
                  {ticket.subcategory && (
                    <div>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-semibold">
                        {ticket.subcategory.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </dd>
                    </div>
                  )}
                  {ticket.machine && (
                    <div>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Machine</dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-semibold">{ticket.machine}</dd>
                    </div>
                  )}
                  {ticket.area && (
                    <div>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Area</dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-semibold">{ticket.area}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Created</dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-semibold">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Updated</dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-semibold">
                      {new Date(ticket.updatedAt).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Back Button */}
            <div>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold"
              >
                ← Back
              </button>
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
