'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
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
  uploadedBy?: { fullName?: string | null; email: string };
  createdAt: string;
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
  const [loading, setLoading] = useState(true);
  const [proposedName, setProposedName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ document: KnowledgeDocument; resume: { message?: string } }>(
        `/knowledge-documents/${id}`,
      );
      setDoc(res.data.document);
      setResume(res.data.resume);
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
    if (!doc?.status) return;
    if (doc.status !== 'processing' && doc.status !== 'uploaded') return;
    const interval = setInterval(() => fetchDetails().catch(() => undefined), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.status]);

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
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>Chunks indexed: {doc?.chunksIndexed ?? 0}</div>
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
