'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

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
}

type SignalFilter = 'all' | Signal;

export default function ExtractionFeedbackPage() {
  const [rows, setRows] = useState<ExtractionFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signal, setSignal] = useState<SignalFilter>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ExtractionFeedbackRow[]>('/knowledge-documents/extraction-feedback/recent', {
        params: { limit: 300 },
      });
      setRows(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load extraction feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (signal === 'all') return rows;
    return rows.filter((r) => r.signal === signal);
  }, [rows, signal]);

  const counts = useMemo(() => {
    const c = { approve: 0, approve_edit: 0, reject: 0 };
    for (const r of rows) {
      if (r.signal === 'approve') c.approve += 1;
      else if (r.signal === 'approve_edit') c.approve_edit += 1;
      else if (r.signal === 'reject') c.reject += 1;
    }
    return c;
  }, [rows]);

  const signalBadge = (s: Signal) => {
    if (s === 'approve') return <Badge className="bg-emerald-600/90 hover:bg-emerald-600">approve</Badge>;
    if (s === 'approve_edit') return <Badge className="bg-amber-600/90 hover:bg-amber-600">approve_edit</Badge>;
    return <Badge variant="destructive">reject</Badge>;
  };

  const editSummary = (r: ExtractionFeedbackRow) => {
    if (!r.editDelta || typeof r.editDelta !== 'object') return '—';
    const keys = Object.keys(r.editDelta).filter((k) => r.editDelta![k] != null);
    return keys.length ? keys.join(', ') : '—';
  };

  const formatWhen = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Extraction feedback" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Extraction feedback log</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Admin approve / approve with edits / reject on PDF extraction candidates. Stored in{' '}
                <code className="text-xs">extraction_feedback_events</code>.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Filter by signal</CardTitle>
              <CardDescription>
                Loaded {rows.length} events · approve {counts.approve} · edits {counts.approve_edit} · reject{' '}
                {counts.reject}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(['all', 'approve', 'approve_edit', 'reject'] as const).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={signal === key ? 'default' : 'outline'}
                  onClick={() => setSignal(key)}
                >
                  {key === 'all' ? 'All' : key}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">When</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Doc type</TableHead>
                    <TableHead>Section / entry</TableHead>
                    <TableHead className="text-right">Conf.</TableHead>
                    <TableHead>Reason / edit</TableHead>
                    <TableHead className="w-[140px]">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No rows match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground align-top">
                          {formatWhen(r.createdAt)}
                        </TableCell>
                        <TableCell className="align-top">{signalBadge(r.signal)}</TableCell>
                        <TableCell className="align-top text-sm">{r.docType ?? '—'}</TableCell>
                        <TableCell className="align-top text-sm">
                          <div>{r.sectionType ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.entryType ?? ''}</div>
                        </TableCell>
                        <TableCell className="align-top text-sm text-right tabular-nums">
                          {r.confidence != null && Number.isFinite(r.confidence) ? r.confidence.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="align-top text-sm max-w-[280px]">
                          <div className="truncate" title={r.reason ?? ''}>
                            {r.signal === 'reject' ? (
                              r.reason || '—'
                            ) : (
                              <span className="text-muted-foreground">{editSummary(r)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Link
                            href={`/dashboard/admin/knowledge-docs/${r.documentId}`}
                            className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
                          >
                            Open doc
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
