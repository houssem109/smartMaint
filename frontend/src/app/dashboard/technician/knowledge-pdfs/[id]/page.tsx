'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ConfirmModal from '@/components/ConfirmModal';
import api, { API_URL } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  candidateTechReviews,
  findTechReviewByTechnician,
  techReviewLabel,
  type KnowledgeExtractionCandidate,
} from '@/lib/knowledge-extraction';
import { useAuthStore } from '@/store/auth-store';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  status: string;
  machineName?: string | null;
  error?: string | null;
  chunksIndexed?: number;
  progressPercent?: number;
  currentStage?: string | null;
  totalPages?: number;
  pagesProcessed?: number;
  lastProcessedPage?: number;
  uploadedBy?: { fullName?: string | null; email: string };
  createdAt: string;
}

interface DocStatusPayload {
  documentId: string;
  status: string;
  currentStage: string | null;
  progressPercent: number;
  totalPages: number;
  pagesProcessed: number;
  lastProcessedPage: number;
  chunksIndexed: number;
  error: string | null;
  qualitySnapshot: Record<string, number>;
}

function machineLabel(doc: KnowledgeDocument | null) {
  if (!doc) return '…';
  const m = doc.machineName?.trim();
  return m && m.length > 0 ? m : 'Machine name not detected — suggest below';
}

export default function TechnicianKnowledgePdfDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  const [resume, setResume] = useState<{ message?: string } | null>(null);
  const [liveStatus, setLiveStatus] = useState<DocStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposedName, setProposedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extractions, setExtractions] = useState<KnowledgeExtractionCandidate[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<KnowledgeExtractionCandidate | null>(null);
  const [editTarget, setEditTarget] = useState<KnowledgeExtractionCandidate | null>(null);
  const [editForm, setEditForm] = useState({ title: '', problemDescription: '', solution: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const pageSize = 1;

  const fetchStatus = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<DocStatusPayload>(`/knowledge-documents/${id}/status`);
      setLiveStatus(res.data);
    } catch {
      /* optional */
    }
  }, [id]);

  const fetchExtractions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<KnowledgeExtractionCandidate[]>(
        `/knowledge-documents/${id}/extractions`,
      );
      setExtractions(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load suggestions');
    }
  }, [id]);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ document: KnowledgeDocument; resume: { message?: string } }>(
        `/knowledge-documents/${id}`,
      );
      setDoc(res.data.document);
      setResume(res.data.resume);
      await fetchStatus();
      await fetchExtractions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!doc?.id) return;
    setLiveStatus((prev) => ({
      documentId: doc.id,
      status: doc.status,
      currentStage: doc.currentStage ?? prev?.currentStage ?? null,
      progressPercent: doc.progressPercent ?? prev?.progressPercent ?? 0,
      totalPages: doc.totalPages ?? prev?.totalPages ?? 0,
      pagesProcessed: doc.pagesProcessed ?? prev?.pagesProcessed ?? 0,
      lastProcessedPage: doc.lastProcessedPage ?? prev?.lastProcessedPage ?? 0,
      chunksIndexed: doc.chunksIndexed ?? prev?.chunksIndexed ?? 0,
      error: doc.error ?? prev?.error ?? null,
      qualitySnapshot: prev?.qualitySnapshot ?? {},
    }));
  }, [doc]);

  useEffect(() => {
    if (!id) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const socket: Socket = io(`${API_URL}/documents`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const onProgress = (payload: Record<string, unknown>) => {
      if (String(payload.documentId) !== id) return;
      setLiveStatus((prev) => {
        const base: DocStatusPayload = prev ?? {
          documentId: id,
          status: 'uploaded',
          currentStage: null,
          progressPercent: 0,
          totalPages: 0,
          pagesProcessed: 0,
          lastProcessedPage: 0,
          chunksIndexed: 0,
          error: null,
          qualitySnapshot: {},
        };
        return { ...base, ...payload } as DocStatusPayload;
      });
    };

    socket.on('connect', () => {
      socket.emit('subscribe', { documentId: id });
    });
    socket.on('document:progress', onProgress);

    return () => {
      socket.emit('unsubscribe', { documentId: id });
      socket.off('document:progress', onProgress);
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (!doc?.status) return;
    const active =
      doc.status === 'processing' ||
      doc.status === 'uploaded' ||
      doc.status === 'gated' ||
      doc.status === 'needs_review';
    if (!active) return;
    const interval = setInterval(() => {
      fetchDetails().catch(() => undefined);
      fetchStatus().catch(() => undefined);
      fetchExtractions().catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [doc?.status, fetchStatus, fetchExtractions]);

  const pendingExtractions = useMemo(
    () => extractions.filter((e) => e.status === 'candidate'),
    [extractions],
  );

  const techReviewedCount = useMemo(
    () =>
      pendingExtractions.filter((e) => findTechReviewByTechnician(e, currentUserId)).length,
    [pendingExtractions, currentUserId],
  );

  const totalListPages = useMemo(
    () => Math.max(1, Math.ceil(pendingExtractions.length / pageSize)),
    [pendingExtractions.length],
  );

  const paginatedExtractions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return pendingExtractions.slice(start, start + pageSize);
  }, [pendingExtractions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pendingExtractions.length]);

  useEffect(() => {
    if (currentPage > totalListPages) setCurrentPage(totalListPages);
  }, [currentPage, totalListPages]);

  const submitTechReview = async (
    c: KnowledgeExtractionCandidate,
    action: 'approve' | 'approve_edit' | 'reject',
    payload?: { title?: string; problemDescription?: string; solution?: string; reason?: string },
  ) => {
    setBusyId(c.id);
    try {
      await api.post(`/knowledge-documents/extractions/${c.id}/tech-review`, {
        action,
        ...payload,
      });
      const msg =
        action === 'approve'
          ? 'Marked as approved — admin will finalize'
          : action === 'approve_edit'
            ? 'Edit sent to admin for final review'
            : 'Marked as rejected — admin will finalize';
      toast.success(msg);
      await fetchExtractions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save recommendation');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;
    try {
      const res = await api.get(`/knowledge-documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || doc.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to download PDF');
    }
  };

  const handleSuggest = async () => {
    if (!id || !proposedName.trim()) {
      toast.error('Enter a suggested machine name');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/knowledge-documents/${id}/machine-name/suggest`, {
        proposedName: proposedName.trim(),
      });
      toast.success('Suggestion sent to admins');
      setProposedName('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (c: KnowledgeExtractionCandidate) => {
    setEditTarget(c);
    setEditForm({
      title: c.title || '',
      problemDescription: c.problemDescription || '',
      solution: c.solution || '',
    });
  };

  const confirmEditSubmit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await submitTechReview(editTarget, 'approve_edit', {
        title: editForm.title.trim(),
        problemDescription: editForm.problemDescription.trim(),
        solution: editForm.solution.trim(),
      });
      setEditTarget(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    return 'outline';
  };

  if (loading && !doc) {
    return (
      <ProtectedRoute allowedRoles={['technician']}>
        <Layout title="PDF detail">
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="PDF detail">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {doc?.originalName || 'Document'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{machineLabel(doc)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {doc
                  ? `Uploaded by ${doc.uploadedBy?.fullName || doc.uploadedBy?.email || '—'} · ${new Date(doc.createdAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={statusVariant(doc?.status || 'uploaded') as any} className="text-xs capitalize">
                {doc?.status || '…'}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!doc}>
                Download
              </Button>
            </div>
          </div>

          {doc?.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {doc.error}
            </div>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Processing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-foreground">
                  <span>{liveStatus?.currentStage || doc?.currentStage || '—'}</span>
                  <span>{liveStatus?.progressPercent ?? doc?.progressPercent ?? 0}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(100, liveStatus?.progressPercent ?? doc?.progressPercent ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
              <div>{resume?.message || '—'}</div>
            </CardContent>
          </Card>

          {!doc?.machineName?.trim() && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Suggest machine name</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You cannot set the official name — only suggest one for an admin to approve.
                </p>
                <div className="max-w-md space-y-2">
                  <Label htmlFor="proposed">Proposed name</Label>
                  <Input
                    id="proposed"
                    value={proposedName}
                    onChange={(e) => setProposedName(e.target.value)}
                    placeholder="e.g. Trepak Capper 50C-0100"
                  />
                </div>
                <Button onClick={handleSuggest} disabled={submitting}>
                  {submitting ? 'Sending…' : 'Submit suggestion'}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg font-semibold">Review suggestions</CardTitle>
                {pendingExtractions.length > 0 && (
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {currentPage} / {totalListPages}
                  </span>
                )}
              </div>
              {pendingExtractions.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {pendingExtractions.length} awaiting admin
                  {techReviewedCount > 0 ? ` · ${techReviewedCount} you reviewed` : ''}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                One review per suggestion — you cannot change it after submitting. An admin makes the final decision.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {extractions.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No suggestions yet. Check back after processing finishes.
                </p>
              ) : pendingExtractions.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  All suggestions on this PDF were finalized by an admin.
                </p>
              ) : (
                (() => {
                  const c = paginatedExtractions[0];
                  if (!c) return null;
                  const busy = busyId === c.id;
                  const myReview = findTechReviewByTechnician(c, currentUserId);
                  const alreadyReviewed = Boolean(myReview);
                  const otherReviews = candidateTechReviews(c).filter(
                    (r) => r.technicianId !== currentUserId,
                  );
                  return (
                    <article>
                      <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:gap-6">
                        <aside className="shrink-0 space-y-3 sm:w-52">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Your review
                          </p>
                          {myReview ? (
                            <p className="text-sm font-medium text-primary">{techReviewLabel(myReview)}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Not submitted yet</p>
                          )}
                          {otherReviews.length > 0 && (
                            <div className="space-y-2 border-t border-border/40 pt-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Other technicians
                              </p>
                              <ul className="space-y-1">
                                {otherReviews.map((r) => (
                                  <li key={r.id} className="text-xs text-muted-foreground">
                                    {techReviewLabel(r)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </aside>
                        <div className="min-w-0 flex-1 space-y-5">
                          <div>
                            <h3 className="text-lg font-medium leading-snug">{c.title || 'Untitled'}</h3>
                            {c.sourcePages && (
                              <p className="mt-1 text-sm text-muted-foreground">Page {c.sourcePages}</p>
                            )}
                          </div>
                          <div className="space-y-4 text-sm leading-relaxed">
                            <p className="whitespace-pre-wrap text-foreground/90">
                              <span className="font-medium text-foreground">Problem — </span>
                              {c.problemDescription || '—'}
                            </p>
                            <p className="whitespace-pre-wrap text-foreground/90">
                              <span className="font-medium text-foreground">Solution — </span>
                              {c.solution || '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-border/40 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        {alreadyReviewed ? (
                          <p className="text-sm text-muted-foreground">
                            You already submitted your recommendation for this suggestion.
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              className="min-w-[7rem] gap-1.5"
                              onClick={() => submitTechReview(c, 'approve')}
                              disabled={busy}
                            >
                              {busy ? (
                                'Saving…'
                              ) : (
                                <>
                                  <Check className="h-4 w-4" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button variant="outline" onClick={() => openEditModal(c)} disabled={busy}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setRejectTarget(c)}
                              disabled={busy}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 sm:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1 || busy}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalListPages, p + 1))}
                            disabled={currentPage === totalListPages || busy}
                          >
                            Skip
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })()
              )}
            </CardContent>
          </Card>

          <ConfirmModal
            isOpen={!!rejectTarget}
            title="Recommend rejection?"
            message="This does not remove the suggestion — an admin makes the final decision. Your recommendation is recorded."
            confirmText="Recommend reject"
            cancelText="Cancel"
            type="danger"
            onConfirm={() => {
              if (rejectTarget) void submitTechReview(rejectTarget, 'reject');
              setRejectTarget(null);
            }}
            onCancel={() => setRejectTarget(null)}
          />

          {editTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-border/50 shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>Edit suggestion</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setEditTarget(null)} aria-label="Close">
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Problem description</Label>
                    <Textarea
                      rows={6}
                      value={editForm.problemDescription}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, problemDescription: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Solution</Label>
                    <Textarea
                      rows={8}
                      value={editForm.solution}
                      onChange={(e) => setEditForm((f) => ({ ...f, solution: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit}>
                      Cancel
                    </Button>
                    <Button onClick={() => void confirmEditSubmit()} disabled={savingEdit} className="flex-1">
                      {savingEdit ? 'Sending…' : 'Send edit to admin'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Button asChild variant="outline">
            <Link href="/dashboard/technician/knowledge-pdfs">Back to PDF library</Link>
          </Button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
