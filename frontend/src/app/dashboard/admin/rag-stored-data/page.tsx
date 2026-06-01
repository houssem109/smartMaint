'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

type DocRow = { id: string; originalName: string; machineName?: string | null };

type RagRow = {
  documentId: string;
  chunkIndex: number;
  text: string;
  source: string;
  sourcePages?: string | null;
  sectionType?: string | null;
  confidence?: number | null;
  originalName?: string | null;
};

export default function RagStoredDataGlobalPage() {
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get('documentId')?.trim() || '__all__';
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [rows, setRows] = useState<RagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentId, setDocumentId] = useState(initialDocId);
  const [limit, setLimit] = useState('400');
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: Number(limit) || 400 };
      if (documentId !== '__all__') {
        params.documentId = documentId;
      }
      const [d, r] = await Promise.all([
        api.get<DocRow[]>('/knowledge-documents'),
        api.get<{ rows: RagRow[] }>('/knowledge-documents/rag-stored-data-global', { params }),
      ]);
      setDocs(Array.isArray(d.data) ? d.data : []);
      setRows(Array.isArray(r.data?.rows) ? r.data.rows : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load global RAG stored data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [documentId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.originalName ?? '',
        r.documentId,
        r.text,
        r.sourcePages ?? '',
        r.sectionType ?? '',
        r.source ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchTerm]);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="RAG stored data" showSidebar={true}>
        <div className="space-y-6 max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">RAG stored data (all PDFs)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Live chunks currently stored in Qdrant for PDF manuals (
                <code className="text-xs">GET /api/knowledge-documents/rag-stored-data-global</code>).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>Filter by a single PDF or show all PDF chunks.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Source PDF</div>
                <Select value={documentId} onValueChange={setDocumentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All PDFs" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__all__">All PDFs</SelectItem>
                    {docs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.originalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Search in chunks</div>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. capteur, CPU, alarm, E-101"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Rows limit</div>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="400">400</SelectItem>
                    <SelectItem value="800">800</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={() => void load()} disabled={loading}>
                  {loading ? 'Loading…' : 'Apply'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chunks</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading…'
                  : `${filteredRows.length} shown${searchTerm.trim() ? ` (filtered from ${rows.length})` : ` of ${rows.length}`} `}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PDF</TableHead>
                    <TableHead>Chunk</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="min-w-[560px]">Stored text</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                        {loading
                          ? 'Loading rows…'
                          : searchTerm.trim()
                            ? 'No rows match your search.'
                            : 'No rows found for current filter.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={`${r.documentId}-${r.chunkIndex}`} className="align-top">
                        <TableCell className="text-xs max-w-[220px] whitespace-pre-wrap">
                          <Link href={`/dashboard/admin/knowledge-docs/${r.documentId}`} className="text-primary hover:underline">
                            {r.originalName || r.documentId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs font-mono">#{r.chunkIndex + 1}</TableCell>
                        <TableCell className="text-xs">{r.sourcePages || '—'}</TableCell>
                        <TableCell className="text-xs">{r.sectionType || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {typeof r.confidence === 'number' ? `${Math.round(r.confidence * 100)}%` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-pre-wrap">{r.text}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
