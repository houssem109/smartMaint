'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
type Signal = 'approve' | 'approve_edit' | 'reject';

interface ExtractionFeedbackRow {
  id: string;
  documentId: string;
  candidateId: string;
  signal: Signal;
  docType: string | null;
  sectionType: string | null;
  entryType: string | null;
  confidence: number | null;
  adminId: string | null;
  reason: string | null;
  editDelta: Record<string, unknown> | null;
  createdAt: string;
  candidateTitle?: string | null;
  candidateProblem?: string | null;
  candidateSolution?: string | null;
  documentOriginalName?: string | null;
}

type SignalFilter = 'all' | Signal;

const PAGE_SIZE = 10;

interface FeedbackListResponse {
  items: ExtractionFeedbackRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: { approve: number; approve_edit: number; reject: number };
}

const DECISION_LABELS: Record<Signal, string> = {
  approve: 'Saved to knowledge base',
  approve_edit: 'Edited, then saved',
  reject: 'Not saved (rejected)',
};

const DECISION_SHORT: Record<Signal, string> = {
  approve: 'Approved',
  approve_edit: 'Edited & saved',
  reject: 'Rejected',
};

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function rowPreview(row: ExtractionFeedbackRow): string {
  if (row.candidateTitle?.trim()) return truncate(row.candidateTitle, 72);
  if (row.candidateProblem?.trim()) return truncate(row.candidateProblem, 72);
  if (row.candidateSolution?.trim()) return truncate(row.candidateSolution, 72);
  if (row.documentOriginalName?.trim()) {
    return `Suggestion from ${truncate(row.documentOriginalName, 48)}`;
  }
  return 'Click to view details';
}

function displayTitle(row: ExtractionFeedbackRow): string {
  if (row.candidateTitle?.trim()) return row.candidateTitle.trim();
  if (row.candidateProblem?.trim()) return truncate(row.candidateProblem, 100);
  return 'PDF suggestion';
}

function FeedbackDetailDialog({
  row,
  loading,
  onClose,
}: {
  row: ExtractionFeedbackRow | null;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [row, onClose]);

  if (!row) return null;

  const hasProblem = Boolean(row.candidateProblem?.trim());
  const hasSolution = Boolean(row.candidateSolution?.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="accent-band-top shrink-0" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
          <div className="min-w-0 space-y-1">
            <p id="feedback-dialog-title" className="text-lg font-semibold leading-snug">
              {DECISION_LABELS[row.signal]}
            </p>
            <p className="text-sm text-muted-foreground">
              {DECISION_SHORT[row.signal]}
              {' · '}
              {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading full text…
            </div>
          )}

          {row.documentOriginalName && (
            <p className="text-xs font-medium text-muted-foreground">
              PDF: {row.documentOriginalName}
            </p>
          )}

          <p className="text-base font-semibold leading-snug">{displayTitle(row)}</p>

          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/15 p-4">
            <p className="leading-relaxed">
              <span className="font-medium text-foreground">Problem — </span>
              <span className={hasProblem ? 'text-foreground' : 'text-muted-foreground'}>
                {hasProblem ? row.candidateProblem!.trim() : 'No problem text stored for this review.'}
              </span>
            </p>
            <p className="leading-relaxed">
              <span className="font-medium text-foreground">Solution — </span>
              <span className={hasSolution ? 'text-foreground' : 'text-muted-foreground'}>
                {hasSolution ? row.candidateSolution!.trim() : 'No solution text stored for this review.'}
              </span>
            </p>
          </div>

          {row.signal === 'reject' && row.reason?.trim() && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Why rejected: {row.reason.trim()}
            </p>
          )}
          {row.signal === 'approve_edit' && (
            <p className="text-sm text-muted-foreground">
              You changed the text before saving it to the knowledge base.
            </p>
          )}
          {!loading && !hasProblem && !hasSolution && row.signal !== 'reject' && (
            <p className="text-xs text-muted-foreground">
              This is an older review record. Text may only appear in the knowledge base or on the PDF page.
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border/50 px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button type="button" size="sm" asChild>
            <Link href={`/dashboard/admin/knowledge-docs/${row.documentId}`}>Open PDF</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ExtractionFeedbackPage() {
  const [rows, setRows] = useState<ExtractionFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ approve: 0, approve_edit: 0, reject: 0 });
  const [detailRow, setDetailRow] = useState<ExtractionFeedbackRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<FeedbackListResponse>(
        '/knowledge-documents/extraction-feedback/recent',
        {
          params: {
            page,
            pageSize: PAGE_SIZE,
            ...(signal !== 'all' ? { signal } : {}),
          },
        },
      );
      if (page > res.data.totalPages && res.data.total > 0) {
        setPage(res.data.totalPages);
        return;
      }
      setRows(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setCounts(res.data.counts);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load extraction feedback';
      setLoadError(msg);
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, signal]);

  useEffect(() => {
    void load();
  }, [load]);

  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  const onFilterChange = (key: SignalFilter) => {
    setSignal(key);
    setPage(1);
  };

  const signalBadge = (s: Signal) => {
    if (s === 'approve') {
      return <Badge variant="default">{DECISION_SHORT.approve}</Badge>;
    }
    if (s === 'approve_edit') {
      return (
        <Badge className="bg-amber-600/90 hover:bg-amber-600">{DECISION_SHORT.approve_edit}</Badge>
      );
    }
    return <Badge variant="destructive">{DECISION_SHORT.reject}</Badge>;
  };

  const formatWhen = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const openRow = useCallback(async (row: ExtractionFeedbackRow) => {
    setDetailRow(row);
    setDetailLoading(true);
    try {
      const res = await api.get<ExtractionFeedbackRow>(
        `/knowledge-documents/extraction-feedback/${row.id}`,
      );
      setDetailRow(res.data);
      setRows((prev) => prev.map((r) => (r.id === res.data.id ? { ...r, ...res.data } : r)));
    } catch {
      toast.error('Could not load full details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDialog = useCallback(() => {
    setDetailRow(null);
    setDetailLoading(false);
  }, []);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="PDF review log" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">PDF review log</h2>
              
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loadError && (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Show only</CardTitle>
              <CardDescription>
                {counts.approve + counts.approve_edit + counts.reject} total · {counts.approve} approved ·{' '}
                {counts.approve_edit} edited · {counts.reject} rejected
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(['all', 'approve', 'approve_edit', 'reject'] as const).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={signal === key ? 'default' : 'outline'}
                  onClick={() => onFilterChange(key)}
                >
                  {key === 'all' ? 'All' : DECISION_SHORT[key]}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
           
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">When</TableHead>
                    <TableHead className="w-[130px]">Decision</TableHead>
                    <TableHead className="min-w-[140px]">PDF file</TableHead>
                    <TableHead>What it was about</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && !loadError && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        {total === 0 && signal === 'all'
                          ? 'Nothing here yet. Open a PDF, review suggestions, then approve or reject.'
                          : 'No rows match this filter.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => void openRow(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void openRow(r);
                          }
                        }}
                        tabIndex={0}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground align-top">
                          {formatWhen(r.createdAt)}
                        </TableCell>
                        <TableCell className="align-top">{signalBadge(r.signal)}</TableCell>
                        <TableCell className="align-top text-sm">
                          <p className="line-clamp-2 font-medium leading-snug">
                            {r.documentOriginalName?.trim() || 'Unknown PDF'}
                          </p>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <p className="line-clamp-2 leading-snug">{rowPreview(r)}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {!loading && !loadError && total > 0 && (
                <div className="flex flex-col gap-2 border-t border-border/50 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {startIndex}–{endIndex} of {total}
                    {signal !== 'all' ? ` (${DECISION_SHORT[signal]} only)` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <FeedbackDetailDialog row={detailRow} loading={detailLoading} onClose={closeDialog} />
      </Layout>
    </ProtectedRoute>
  );
}
