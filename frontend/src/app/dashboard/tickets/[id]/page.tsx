'use client';

import { useEffect, useState, type ReactNode, type FC } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ConfirmModal from '@/components/ConfirmModal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  FileText,
  ImageIcon,
  Download,
  User,
  Calendar,
  MapPin,
  Wrench,
  Paperclip,
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
  assignedToId?: string | null;
  assignedTo?: { id?: string; fullName: string; email: string };
  assignmentRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  assignmentRequestedById?: string | null;
  assignmentRequestNote?: string | null;
  attachments?: {
    id: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: string;
  }[];
}

interface TechnicianOption {
  id: string;
  fullName?: string | null;
  email: string;
}

function getBackPath(role?: string) {
  const r = role?.toLowerCase?.();
  if (r === 'admin' || r === 'superadmin') return '/dashboard/admin/tickets';
  if (r === 'technician') return '/dashboard/technician/tickets';
  return '/dashboard/worker';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: FC<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </li>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [requestingSelfAssign, setRequestingSelfAssign] = useState(false);
  const [reviewingSelfAssign, setReviewingSelfAssign] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchTicket(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    const canAssign = user?.role === 'admin' || user?.role === 'superadmin';
    if (!canAssign) return;
    fetchTechnicians();
  }, [user?.role]);

  const fetchTicket = async (id: string) => {
    try {
      const response = await api.get(`/tickets/${id}`);
      setTicket(response.data);
      setNewStatus(response.data.status);
      setSelectedTechnicianId(response.data?.assignedTo?.id || '');
    } catch (error: any) {
      console.error('Failed to fetch ticket:', error);
      toast.error(error.response?.data?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const res = await api.get<TechnicianOption[]>('/users/technicians');
      setTechnicians(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTechnicians([]);
    }
  };

  const handleOpenAttachment = async (attachmentId: string, mimeType: string) => {
    try {
      const res = await api.get(`/tickets/attachments/${attachmentId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Optionally revoke later
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      console.error('Failed to open attachment:', error);
      toast.error(error.response?.data?.message || 'Failed to open attachment');
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

  const handleAssignTechnician = async () => {
    if (!ticket || !selectedTechnicianId) return;
    setAssigning(true);
    const toastId = toast.loading('Assigning technician...');
    try {
      await api.post(`/tickets/${ticket.id}/assign`, { technicianId: selectedTechnicianId });
      await fetchTicket(ticket.id);
      toast.success('Technician assigned successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Failed to assign technician:', error);
      toast.error(error.response?.data?.message || 'Failed to assign technician', { id: toastId });
    } finally {
      setAssigning(false);
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
  const canAssignTechnician = user?.role === 'admin' || user?.role === 'superadmin';
  const canRequestSelfAssign = user?.role === 'technician';
  const showSidebar =
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    user?.role === 'technician';

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
          <div className="mx-auto mb-12 max-w-5xl space-y-6 pb-10">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(getBackPath(user?.role))}
                className="gap-1 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to tickets
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                #{ticket.id.slice(0, 8)}
              </span>
            </div>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <CardTitle className="text-2xl font-semibold leading-tight break-words">
                      {ticket.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-medium capitalize',
                          getStatusBadgeClass(ticket.status),
                        )}
                      >
                        {formatLabel(ticket.status)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-medium capitalize',
                          getPriorityBadgeClass(ticket.priority),
                        )}
                      >
                        {ticket.priority}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium capitalize"
                      >
                        {formatLabel(ticket.category)}
                      </Badge>
                    </div>
                    <CardDescription>
                      Opened{' '}
                      {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                        dateStyle: 'long',
                      })}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canUpdateStatus && (
                      <>
                        <Select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="h-9 min-w-[8.5rem] text-sm"
                        >
                          <option value="open">Open</option>
                          <option value="in_review">In review</option>
                          <option value="in_progress">In progress</option>
                          <option value="solved">Solved</option>
                          <option value="closed">Closed</option>
                        </Select>
                        <Button
                          size="sm"
                          onClick={handleStatusUpdate}
                          disabled={updating || newStatus === ticket.status}
                          className="gap-1.5"
                        >
                          {updating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Update
                        </Button>
                      </>
                    )}
                    {canClose && ticket.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCloseTicketClick}
                        disabled={updating}
                        className="gap-1.5"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Close
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDeleteClick}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
              <div className="space-y-6">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
                      {ticket.description}
                    </p>
                  </CardContent>
                </Card>

                {ticket.attachments && ticket.attachments.length > 0 && (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        Attachments
                        <Badge variant="secondary" className="ml-1 font-normal">
                          {ticket.attachments.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {ticket.attachments.map((att) => {
                          const isImage = att.mimeType.startsWith('image/');
                          return (
                            <li
                              key={att.id}
                              className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background">
                                {isImage ? (
                                  <ImageIcon className="h-4 w-4 text-primary" />
                                ) : (
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{att.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(att.fileSize)}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 gap-1.5"
                                onClick={() => handleOpenAttachment(att.id, att.mimeType)}
                              >
                                <Download className="h-3.5 w-3.5" />
                                Open
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              <aside className="space-y-4">
                {canAssignTechnician && (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Assign technician</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select
                        value={selectedTechnicianId}
                        onChange={(e) => setSelectedTechnicianId(e.target.value)}
                        className="h-10 w-full"
                      >
                        <option value="">Select technician</option>
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.fullName?.trim() || tech.email}
                          </option>
                        ))}
                      </Select>
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={handleAssignTechnician}
                        disabled={assigning || !selectedTechnicianId}
                      >
                        {assigning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Assign'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {canRequestSelfAssign && (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Self-assign</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {ticket.assignedToId === user?.id ? (
                        <Badge variant="default">Already assigned to you</Badge>
                      ) : ticket.assignedToId ? (
                        <Badge variant="secondary">Already assigned</Badge>
                      ) : ticket.assignmentRequestStatus === 'pending' &&
                        ticket.assignmentRequestedById === user?.id ? (
                        <Badge variant="outline">Pending admin approval</Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            if (!ticket) return;
                            setRequestingSelfAssign(true);
                            const toastId = toast.loading('Sending request...');
                            try {
                              await api.post(`/tickets/${ticket.id}/request-self-assign`);
                              await fetchTicket(ticket.id);
                              toast.success('Self-assign request sent for admin approval.', {
                                id: toastId,
                              });
                            } catch (error: any) {
                              toast.error(
                                error.response?.data?.message || 'Failed to send request',
                                { id: toastId },
                              );
                            } finally {
                              setRequestingSelfAssign(false);
                            }
                          }}
                          disabled={requestingSelfAssign}
                        >
                          {requestingSelfAssign ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Request assignment'
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {canAssignTechnician && ticket.assignmentRequestStatus === 'pending' && (
                  <Card className="border-primary/30 bg-primary/5 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Pending request</CardTitle>
                      <CardDescription>Technician asked to be assigned</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={reviewingSelfAssign}
                        onClick={async () => {
                          if (!ticket) return;
                          setReviewingSelfAssign(true);
                          const toastId = toast.loading('Approving request...');
                          try {
                            await api.post(`/tickets/${ticket.id}/assignment-request/approve`);
                            await fetchTicket(ticket.id);
                            toast.success('Request approved and technician assigned.', {
                              id: toastId,
                            });
                          } catch (error: any) {
                            toast.error(
                              error.response?.data?.message || 'Failed to approve request',
                              { id: toastId },
                            );
                          } finally {
                            setReviewingSelfAssign(false);
                          }
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={reviewingSelfAssign}
                        onClick={async () => {
                          if (!ticket) return;
                          setReviewingSelfAssign(true);
                          const toastId = toast.loading('Rejecting request...');
                          try {
                            await api.post(`/tickets/${ticket.id}/assignment-request/reject`, {
                              reason: 'Rejected by admin',
                            });
                            await fetchTicket(ticket.id);
                            toast.success('Request rejected.', { id: toastId });
                          } catch (error: any) {
                            toast.error(
                              error.response?.data?.message || 'Failed to reject request',
                              { id: toastId },
                            );
                          } finally {
                            setReviewingSelfAssign(false);
                          }
                        }}
                      >
                        Reject
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Details</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul>
                      <DetailRow
                        icon={User}
                        label="Created by"
                        value={
                          ticket.createdBy?.fullName || ticket.createdBy?.email || '—'
                        }
                      />
                      {ticket.assignedTo && (
                        <DetailRow
                          icon={User}
                          label="Assigned to"
                          value={
                            ticket.assignedTo.fullName || ticket.assignedTo.email
                          }
                        />
                      )}
                      {ticket.subcategory && (
                        <DetailRow
                          icon={TicketIcon}
                          label="Type"
                          value={
                            <span className="capitalize">
                              {formatLabel(ticket.subcategory)}
                            </span>
                          }
                        />
                      )}
                      {ticket.machine && (
                        <DetailRow icon={Wrench} label="Machine" value={ticket.machine} />
                      )}
                      {ticket.area && (
                        <DetailRow icon={MapPin} label="Area" value={ticket.area} />
                      )}
                      <DetailRow
                        icon={Calendar}
                        label="Created"
                        value={new Date(ticket.createdAt).toLocaleString()}
                      />
                      <DetailRow
                        icon={Calendar}
                        label="Last updated"
                        value={new Date(ticket.updatedAt).toLocaleString()}
                      />
                    </ul>
                  </CardContent>
                </Card>
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
