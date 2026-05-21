'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  machineName?: string | null;
  docType?: string | null;
  gateConfidence?: number | null;
  needsReview?: boolean;
  isWorkRelated?: boolean | null;
  uploadedBy?: { fullName?: string | null; email: string };
  createdAt: string;
  error?: string | null;
  totalPages?: number;
  pagesProcessed?: number;
  progressPercent?: number;
  currentStage?: string | null;
  chunksIndexed?: number;
}

function machineLabel(doc: KnowledgeDocument) {
  const m = doc.machineName?.trim();
  return m && m.length > 0 ? m : 'Machine name not detected — open PDF';
}

interface PdfVisionPref {
  pdfVisionAdminEnabled: boolean;
  enabledFromEnv: boolean;
  enabledEffective: boolean;
}

function KnowledgeDocsPageContent() {
  const searchParams = useSearchParams();
  const supersedeDocId = searchParams.get('supersedes')?.trim() || null;

  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [includeSuperseded, setIncludeSuperseded] = useState(false);
  const [pdfVision, setPdfVision] = useState<PdfVisionPref | null>(null);
  const [pdfVisionSaving, setPdfVisionSaving] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const q = includeSuperseded ? '?includeSuperseded=true' : '';
      const res = await api.get<KnowledgeDocument[]>(`/knowledge-documents${q}`);
      setDocs(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    const id = setInterval(fetchDocs, 5000);
    return () => clearInterval(id);
  }, [includeSuperseded]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<PdfVisionPref>('/knowledge-documents/pipeline-preferences/pdf-vision');
        setPdfVision(r.data);
      } catch {
        setPdfVision(null);
      }
    })();
  }, []);

  const patchPdfVision = async (enabled: boolean) => {
    if (!pdfVision?.enabledFromEnv && enabled) {
      toast.error('Set ENABLE_PDF_VISION=true in server .env and restart the API first.');
      return;
    }
    setPdfVisionSaving(true);
    try {
      const r = await api.patch<PdfVisionPref>('/knowledge-documents/pipeline-preferences/pdf-vision', { enabled });
      setPdfVision(r.data);
      toast.success(enabled ? 'PDF vision on' : 'PDF vision off');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update PDF vision');
    } finally {
      setPdfVisionSaving(false);
    }
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
      const q = supersedeDocId
        ? `?supersedesDocumentId=${encodeURIComponent(supersedeDocId)}`
        : '';
      await api.post(`/knowledge-documents/upload${q}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedFile(null);
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

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    if (status === 'needs_review') return 'secondary';
    if (status === 'superseded') return 'outline';
    return 'outline';
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Delete this PDF? This will also remove its extracted candidates.')) return;
    try {
      await api.delete(`/knowledge-documents/${docId}`);
      toast.success('PDF deleted');
      fetchDocs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete PDF');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="PDF Library" showSidebar={true}>
        <div className="space-y-6">
          {supersedeDocId && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">Replacement upload</span>
              <span className="text-muted-foreground">
                {' '}
                — this PDF will supersede document{' '}
                <code className="text-xs bg-muted px-1 rounded">{supersedeDocId}</code>. Duplicate fingerprint is
                allowed only for that predecessor.
              </span>
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Shared PDF Library</h2>
              <p className="text-sm text-muted-foreground">
                Upload manuals, track progress, and open detail for extraction review (7–8).
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <label
                className={`flex cursor-pointer items-center gap-2 text-sm shrink-0 max-w-md ${
                  pdfVision && !pdfVision.enabledFromEnv ? 'text-muted-foreground opacity-70' : 'text-foreground'
                }`}
                title={
                  pdfVision && !pdfVision.enabledFromEnv
                    ? 'ENABLE_PDF_VISION is false on the server — change .env and restart the API to allow vision.'
                    : 'Disable for text-only PDFs; enable before uploading manuals with diagrams or poor scans.'
                }
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input shrink-0"
                  checked={pdfVision?.pdfVisionAdminEnabled ?? true}
                  disabled={pdfVisionSaving || !pdfVision || !pdfVision.enabledFromEnv}
                  onChange={(e) => void patchPdfVision(e.target.checked)}
                />
                <span>
                  PDF vision (Ollama){' '}
                  {pdfVision && (
                    <span className="text-muted-foreground font-normal">
                      — effective {pdfVision.enabledEffective ? 'on' : 'off'}
                    </span>
                  )}
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground shrink-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input"
                  checked={includeSuperseded}
                  onChange={(e) => setIncludeSuperseded(e.target.checked)}
                />
                Show superseded (history)
              </label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                }}
              />
              <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="gap-2">
                <Plus className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Uploaded PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : docs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No PDFs uploaded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.originalName || d.fileName}</div>
                        <div className="text-sm text-muted-foreground mt-1">{machineLabel(d)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Uploaded by {d.uploadedBy?.fullName || d.uploadedBy?.email || '—'} •{' '}
                          {new Date(d.createdAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {d.docType || '—'} • Gate:{' '}
                          {typeof d.gateConfidence === 'number'
                            ? `${Math.round(d.gateConfidence * 100)}%`
                            : '—'}
                          {d.needsReview ? ' • needs review' : ''}
                        </div>
                        {(typeof d.totalPages === 'number' && d.totalPages > 0) ||
                        typeof d.progressPercent === 'number' ? (
                          <div className="mt-2 space-y-1 max-w-md">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {d.currentStage ? d.currentStage.replace(/_/g, ' ') : 'Progress'}
                                {typeof d.pagesProcessed === 'number' && typeof d.totalPages === 'number'
                                  ? ` · ${d.pagesProcessed}/${d.totalPages} pages`
                                  : ''}
                              </span>
                              <span>{Math.min(100, Math.max(0, d.progressPercent ?? 0))}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, d.progressPercent ?? 0))}%`,
                                }}
                              />
                            </div>
                            {typeof d.chunksIndexed === 'number' && d.chunksIndexed > 0 ? (
                              <div className="text-[11px] text-muted-foreground">
                                Manual chunks indexed: {d.chunksIndexed}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusVariant(d.status) as any} className="text-xs capitalize">
                          {d.status}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/admin/knowledge-docs/${d.id}`}>Open</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                          Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteDocument(d.id)}
                          className="hidden sm:inline-flex"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

export default function KnowledgeDocsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
          <Layout title="PDF Library" showSidebar={true}>
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
          </Layout>
        </ProtectedRoute>
      }
    >
      <KnowledgeDocsPageContent />
    </Suspense>
  );
}

