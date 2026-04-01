'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, X } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  uploadedBy?: { fullName?: string | null; email: string };
  error?: string | null;
  chunksIndexed?: number;
  createdAt: string;
}

interface KnowledgeExtractionCandidate {
  id: string;
  title: string;
  problemDescription: string;
  solution: string;
  tags: string | null;
  status: string;
  createdById: string;
}

export default function KnowledgeDocDetailsPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();

  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [extractions, setExtractions] = useState<KnowledgeExtractionCandidate[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<KnowledgeExtractionCandidate | null>(null);
  const [form, setForm] = useState({
    title: '',
    problemDescription: '',
    solution: '',
    tags: '',
  });

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ document: KnowledgeDocument; resume: any }>(`/knowledge-documents/${id}`);
      setDoc(res.data.document);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const fetchExtractions = async () => {
    if (!id) return;
    try {
      const res = await api.get<KnowledgeExtractionCandidate[]>(`/knowledge-documents/${id}/extractions`);
      setExtractions(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load extractions');
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchDetails(), fetchExtractions()]);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [extractions.length]);

  // Keep polling while extraction is running, so the table fills automatically.
  useEffect(() => {
    if (!doc?.status) return;
    if (doc.status !== 'processing' && doc.status !== 'uploaded') return;

    const interval = setInterval(() => {
      fetchAll().catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.status]);

  const counts = useMemo(() => {
    const candidate = extractions.filter((e) => e.status === 'candidate').length;
    const approved = extractions.filter((e) => e.status === 'approved').length;
    const rejected = extractions.filter((e) => e.status === 'rejected').length;
    return { candidate, approved, rejected };
  }, [extractions]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(extractions.length / pageSize)),
    [extractions.length],
  );

  const paginatedExtractions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return extractions.slice(start, start + pageSize);
  }, [extractions, currentPage]);

  const startIndex = extractions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, extractions.length);

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    return 'outline';
  };

  const extractionStatusVariant = (status: string) => {
    if (status === 'approved') return 'default';
    if (status === 'rejected') return 'destructive';
    return 'secondary';
  };

  const openEditModal = (c: KnowledgeExtractionCandidate) => {
    setEditingCandidate(c);
    setForm({
      title: c.title || '',
      problemDescription: c.problemDescription || '',
      solution: c.solution || '',
      tags: c.tags || '',
    });
    setModalOpen(true);
  };

  const handleApprove = async () => {
    if (!editingCandidate) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/extractions/${editingCandidate.id}/approve`, {
        title: form.title,
        problemDescription: form.problemDescription,
        solution: form.solution,
        tags: form.tags?.trim() || undefined,
      });
      toast.success('Candidate approved and added to Knowledge base');
      setModalOpen(false);
      setEditingCandidate(null);
      fetchDetails();
      fetchExtractions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (c: KnowledgeExtractionCandidate) => {
    if (!window.confirm('Reject this extracted item?')) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/extractions/${c.id}/reject`);
      toast.success('Candidate rejected');
      fetchExtractions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!id) return;
    if (!window.confirm('Delete this PDF document? This will also remove its extracted candidates.')) return;
    try {
      await api.delete(`/knowledge-documents/${id}`);
      toast.success('PDF deleted');
      router.push('/dashboard/admin/knowledge-docs');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete PDF');
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

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Document Details" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight truncate">
                {doc?.originalName || 'Document'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {doc ? `Uploaded by ${doc.uploadedBy?.fullName || doc.uploadedBy?.email || '—'} • ${new Date(doc.createdAt).toLocaleString()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusVariant(doc?.status || 'uploaded') as any} className="text-xs capitalize">
                {doc?.status || 'uploaded'}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchAll}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!doc}>
                Download
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteDocument}
                className="hidden sm:inline-flex"
              >
                Delete
              </Button>
            </div>
          </div>

          {doc?.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="font-medium">PDF warning</div>
              <div className="mt-1 whitespace-pre-wrap">{doc.error}</div>
            </div>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Chunks indexed</div>
                  <div className="text-lg font-semibold">{doc?.chunksIndexed ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Candidates extracted</div>
                  <div className="text-lg font-semibold">{counts.candidate + counts.approved + counts.rejected}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Approved</div>
                  <div className="text-lg font-semibold">{counts.approved}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Rejected</div>
                  <div className="text-lg font-semibold">{counts.rejected}</div>
                </div>
              </div>
              <div className="rounded-md bg-muted/30 border border-border/40 p-3 text-sm text-muted-foreground">
                Extraction should populate the candidates list shortly. If nothing appears, try Refresh.
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Extracted Problem → Solution items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Solution</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          No extraction results yet. Refresh after a minute.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedExtractions.map((c) => (
                      <TableRow key={c.id} className="align-top">
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">{c.title}</div>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 90 }}>
                            {c.problemDescription}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 90 }}>
                            {c.solution}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <div className="space-y-2">
                            <Badge variant={extractionStatusVariant(c.status) as any} className="text-xs capitalize">
                              {c.status}
                            </Badge>
                            {c.status === 'candidate' && (
                              <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditModal(c)} disabled={saving} className="gap-2">
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleReject(c)} disabled={saving}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {extractions.length > 0 && (
                <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
                  <span className="text-xs text-muted-foreground">
                    Showing {startIndex}-{endIndex} of {extractions.length} items
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/admin/knowledge-docs">Back to library</Link>
            </Button>
          </div>
        </div>

        {modalOpen && editingCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Edit candidate</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)} aria-label="Close edit modal">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Problem description</Label>
                    <Textarea rows={6} value={form.problemDescription} onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Solution</Label>
                    <Textarea rows={8} value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (comma separated)</Label>
                    <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleApprove} disabled={saving} className="flex-1">
                      {saving ? 'Approving…' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

