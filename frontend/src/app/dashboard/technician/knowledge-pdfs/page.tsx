'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { FileText, Loader2, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  machineName?: string | null;
  uploadedById?: string;
  uploadedBy?: { fullName?: string | null; email: string };
  createdAt: string;
  totalPages?: number;
  pagesProcessed?: number;
  progressPercent?: number;
  currentStage?: string | null;
  chunksIndexed?: number;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function machineLabel(doc: KnowledgeDocument) {
  const m = doc.machineName?.trim();
  return m && m.length > 0 ? m : 'Machine name not detected — open PDF';
}

function TechnicianKnowledgePdfsPageContent() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 3;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => (d.originalName || d.fileName || '').toLowerCase().includes(q));
  }, [docs, nameFilter]);

  useEffect(() => {
    setPage(1);
  }, [nameFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDocs.length / pageSize)),
    [filteredDocs.length],
  );

  const paginatedDocs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDocs.slice(start, start + pageSize);
  }, [filteredDocs, page]);

  const startIndex = filteredDocs.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, filteredDocs.length);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get<KnowledgeDocument[]>('/knowledge-documents');
      setDocs(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    const id = setInterval(fetchDocs, 8000);
    return () => clearInterval(id);
  }, []);

  const pickPdfFile = (file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file');
      return;
    }
    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Choose a PDF first');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      await api.post('/knowledge-documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearSelectedFile();
      toast.success('PDF uploaded');
      fetchDocs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: KnowledgeDocument) => {
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

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Delete this PDF? You can only delete PDFs you uploaded.')) return;
    try {
      await api.delete(`/knowledge-documents/${docId}`);
      toast.success('PDF deleted');
      fetchDocs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete PDF');
    }
  };

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    return 'outline';
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const canDelete = (d: KnowledgeDocument) =>
    Boolean(currentUserId && d.uploadedById === currentUserId);

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="PDF library">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">PDF library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse all manuals, upload your own, suggest machine names, and review problem/solution
              suggestions for admins.
            </p>
          </div>

          <Card accentBand className="border-border/50 shadow-sm">
            <div className="border-b border-border/50 bg-muted/10 px-4 py-4 sm:px-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => pickPdfFile(e.target.files?.[0] ?? null)}
              />

              {selectedFile ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground"
                      onClick={clearSelectedFile}
                      disabled={uploading}
                    >
                      Change
                    </Button>
                  </div>
                  <Button onClick={handleUpload} disabled={uploading} className="shrink-0 gap-2 sm:min-w-[140px]">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openFilePicker();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickPdfFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  onClick={openFilePicker}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-5 transition-colors sm:justify-start sm:px-5',
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border/70 bg-card/50 hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      Drop a PDF here or <span className="text-primary">browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground">You can delete only PDFs you upload</p>
                  </div>
                </div>
              )}
            </div>

            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Filter by PDF name…"
                  className="pl-9"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : docs.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">No PDFs yet.</div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No PDFs match &quot;{nameFilter.trim()}&quot;.
                </div>
              ) : (
                <>
                <ul className="divide-y divide-border/50">
                  {paginatedDocs.map((d) => {
                    const showProgress =
                      (typeof d.totalPages === 'number' && d.totalPages > 0) ||
                      typeof d.progressPercent === 'number';
                    const progress = Math.min(100, Math.max(0, d.progressPercent ?? 0));

                    return (
                      <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{d.originalName || d.fileName}</p>
                              <Badge variant={statusVariant(d.status) as any} className="shrink-0 text-xs capitalize">
                                {d.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{machineLabel(d)}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.uploadedBy?.fullName || d.uploadedBy?.email || '—'} ·{' '}
                              {new Date(d.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/technician/knowledge-pdfs/${d.id}`}>Open</Link>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                              Download
                            </Button>
                            {canDelete(d) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDeleteDocument(d.id)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                        {showProgress && (
                          <div className="mt-3 max-w-lg space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {d.currentStage ? d.currentStage.replace(/_/g, ' ') : 'Processing'}
                              </span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <span className="text-xs text-muted-foreground">
                    Showing {startIndex}-{endIndex} of {filteredDocs.length} PDFs
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

export default function TechnicianKnowledgePdfsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute allowedRoles={['technician']}>
          <Layout title="PDF library">
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
          </Layout>
        </ProtectedRoute>
      }
    >
      <TechnicianKnowledgePdfsPageContent />
    </Suspense>
  );
}
