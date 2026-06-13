'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ExternalLink, FileText, Loader2, Search } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  status: string;
  machineName?: string | null;
  createdAt: string;
}

function machineLabel(doc: KnowledgeDocument) {
  const m = doc.machineName?.trim();
  return m && m.length > 0 ? m : 'Machine name not set';
}

function WorkerKnowledgePdfsPageContent() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 3;

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

  const fetchDocs = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.get<KnowledgeDocument[]>('/knowledge-documents');
      setDocs(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      if (!quiet) toast.error(e.response?.data?.message || 'Failed to load PDFs');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDocs();
    const id = setInterval(() => void fetchDocs(true), 8000);
    return () => clearInterval(id);
  }, []);

  const openPdfInNewTab = async (doc: KnowledgeDocument) => {
    setOpeningId(doc.id);
    try {
      const res = await api.get(`/knowledge-documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 120_000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to open PDF');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['worker']}>
      <Layout title="PDF library">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">PDF library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse shared manuals. Open a PDF in a new tab to read it — view only.
            </p>
          </div>

          <Card className="border-border/50 shadow-sm">
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
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No PDFs available yet.
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No PDFs match &quot;{nameFilter.trim()}&quot;.
                </div>
              ) : (
                <>
                <ul className="divide-y divide-border/50">
                  {paginatedDocs.map((d) => (
                    <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.originalName || d.fileName}</p>
                            <p className="text-sm text-muted-foreground">{machineLabel(d)}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {new Date(d.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          disabled={openingId === d.id}
                          onClick={() => void openPdfInNewTab(d)}
                        >
                          {openingId === d.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Opening…
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4" />
                              Open PDF
                            </>
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
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

export default function WorkerKnowledgePdfsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute allowedRoles={['worker']}>
          <Layout title="PDF library">
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
          </Layout>
        </ProtectedRoute>
      }
    >
      <WorkerKnowledgePdfsPageContent />
    </Suspense>
  );
}
