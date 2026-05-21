'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DocRow = { id: string; originalName: string; machineName?: string | null };

type ExportRef = {
  checkedAt: string;
  responsibility: string;
  dataSource: string;
  reviewFilter: string;
  queryParams: { name: string; type: string; notes: string }[];
  columns: string[];
  adminUi: string;
  notes: string[];
};

type PreviewRow = {
  id: string;
  title: string;
  problemDescription: string;
  solution: string;
  machineName: string;
  severity: string;
  sourceDocument: string;
  manufacturer: string;
  createdAt: string;
  knowledgeDocumentId: string | null;
};

export default function ProblemsSolutionsExportPage() {
  const [ref, setRef] = useState<ExportRef | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [machine, setMachine] = useState('');
  const [documentId, setDocumentId] = useState<string>('__all__');
  const [severity, setSeverity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [loadingRef, setLoadingRef] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadRef = useCallback(async () => {
    setLoadingRef(true);
    try {
      const [r, d] = await Promise.all([
        api.get<ExportRef>('/export/problems-solutions-reference'),
        api.get<DocRow[]>('/knowledge-documents'),
      ]);
      setRef(r.data);
      setDocs(Array.isArray(d.data) ? d.data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load export reference');
      setRef(null);
    } finally {
      setLoadingRef(false);
    }
  }, []);

  useEffect(() => {
    void loadRef();
  }, [loadRef]);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const params: Record<string, string | number> = { limit: 150 };
      if (machine.trim()) params.machine = machine.trim();
      if (documentId && documentId !== '__all__') params.documentId = documentId;
      if (severity.trim()) params.severity = severity.trim();
      if (from.trim()) params.from = from.trim();
      if (to.trim()) params.to = to.trim();
      const res = await api.get<{ rows: PreviewRow[] }>('/export/problems-solutions-preview', { params });
      setPreviewRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err: any) {
      setPreviewRows([]);
      toast.error(err.response?.data?.message || 'Failed to load exported rows preview');
    } finally {
      setLoadingPreview(false);
    }
  }, [machine, documentId, severity, from, to]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const download = async () => {
    setDownloading(true);
    try {
      const params: Record<string, string> = { format };
      if (machine.trim()) params.machine = machine.trim();
      if (documentId && documentId !== '__all__') params.documentId = documentId;
      if (severity.trim()) params.severity = severity.trim();
      if (from.trim()) params.from = from.trim();
      if (to.trim()) params.to = to.trim();

      const res = await api.get('/export/problems-solutions', {
        params,
        responseType: 'blob',
      });
      const cd = res.headers['content-disposition'] as string | undefined;
      let filename = `problems-solutions.${format}`;
      const m = cd?.match(/filename="([^"]+)"/i);
      if (m?.[1]) filename = m[1];

      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Problems & solutions export" showSidebar={true}>
        <div className="space-y-6 max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Export problems &amp; solutions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Curated export from <code className="text-xs">GET /api/export/problems-solutions</code> (approved{' '}
                <code className="text-xs">knowledge_entries</code>). Reference payload:{' '}
                <code className="text-xs">GET /api/export/problems-solutions-reference</code>.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadRef()} disabled={loadingRef}>
              Refresh meta
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>
                PDF filter uses <code className="text-xs">knowledgeDocumentId</code> on rows promoted after the section 23
                migration; older PDF rows may only match machine / text filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="machine">Machine (contains)</Label>
                <Input
                  id="machine"
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  placeholder="e.g. Danao"
                />
              </div>
              <div className="space-y-2">
                <Label>Source PDF</Label>
                <Select value={documentId} onValueChange={setDocumentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All PDFs" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__all__">All PDFs</SelectItem>
                    {docs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.originalName}
                        {d.machineName ? ` — ${d.machineName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity (exact)</Label>
                <Input
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  placeholder="high / medium / low"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from">From (ISO date)</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To (ISO date)</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as 'xlsx' | 'csv')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={() => void download()} disabled={downloading}>
                  {downloading ? 'Preparing…' : 'Download export'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference (API)</CardTitle>
              <CardDescription>
                {ref?.checkedAt ? `Snapshot ${new Date(ref.checkedAt).toLocaleString()}` : loadingRef ? 'Loading…' : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Responsibility:</span> {ref?.responsibility}
              </p>
              <p>
                <span className="font-medium text-foreground">Data:</span> {ref?.dataSource} — filter:{' '}
                <code className="text-xs">{ref?.reviewFilter}</code>
              </p>
              <div>
                <p className="font-medium text-foreground mb-1">Columns</p>
                <p className="text-xs font-mono">{(ref?.columns ?? []).join(' · ')}</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Param</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ref?.queryParams ?? []).map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-mono text-xs">{p.name}</TableCell>
                        <TableCell className="text-xs">{p.type}</TableCell>
                        <TableCell>{p.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {(ref?.notes ?? []).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Exported data preview (all uploaded PDFs)</CardTitle>
                  <CardDescription>
                    Live rows from <code className="text-xs">knowledge_entries</code> that would be exported with the
                    current filters.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadPreview()} disabled={loadingPreview}>
                  Refresh rows
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source PDF</TableHead>
                      <TableHead>Machine</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Problem</TableHead>
                      <TableHead>Solution</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                          {loadingPreview ? 'Loading rows…' : 'No exported rows match current filters.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      previewRows.map((r) => (
                        <TableRow key={r.id} className="align-top">
                          <TableCell className="text-xs max-w-[220px] whitespace-pre-wrap">
                            {r.sourceDocument || '—'}
                          </TableCell>
                          <TableCell className="text-xs">{r.machineName || '—'}</TableCell>
                          <TableCell className="text-xs max-w-[220px] whitespace-pre-wrap">{r.title || '—'}</TableCell>
                          <TableCell className="text-xs max-w-[280px] whitespace-pre-wrap">{r.problemDescription}</TableCell>
                          <TableCell className="text-xs max-w-[280px] whitespace-pre-wrap">{r.solution}</TableCell>
                          <TableCell className="text-xs">{r.severity || '—'}</TableCell>
                          <TableCell className="text-xs">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
