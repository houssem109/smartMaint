'use client';

import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api, { API_URL } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  return m && m.length > 0 ? m : 'Machine name not detected — open PDF';
}

export default function TechnicianKnowledgePdfDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  const [resume, setResume] = useState<{ message?: string } | null>(null);
  const [liveStatus, setLiveStatus] = useState<DocStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposedName, setProposedName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<DocStatusPayload>(`/knowledge-documents/${id}/status`);
      setLiveStatus(res.data);
    } catch {
      /* optional */
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
    }, 5000);
    return () => clearInterval(interval);
  }, [doc?.status, fetchStatus]);

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

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    return 'outline';
  };

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="PDF detail">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight truncate">
                {doc?.originalName || 'Document'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{machineLabel(doc)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {doc
                  ? `Uploaded by ${doc.uploadedBy?.fullName || doc.uploadedBy?.email || '—'} • ${new Date(doc.createdAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  Pages: {liveStatus?.pagesProcessed ?? doc?.pagesProcessed ?? 0} /{' '}
                  {liveStatus?.totalPages ?? doc?.totalPages ?? '—'}
                </div>
                <div>Chunks indexed: {liveStatus?.chunksIndexed ?? doc?.chunksIndexed ?? 0}</div>
              </div>
              {liveStatus?.qualitySnapshot &&
                Object.keys(liveStatus.qualitySnapshot).length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(liveStatus.qualitySnapshot).map(([q, n]) => (
                      <span key={q} className="rounded-md border border-border/60 px-2 py-0.5">
                        {q}: {n}
                      </span>
                    ))}
                  </div>
                )}
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
                  Admins review suggestions. You will be notified when yours is approved or rejected.
                </p>
                <div className="space-y-2 max-w-md">
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

          <Button asChild variant="outline">
            <Link href="/dashboard/technician/knowledge-pdfs">Back to PDF manuals</Link>
          </Button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
