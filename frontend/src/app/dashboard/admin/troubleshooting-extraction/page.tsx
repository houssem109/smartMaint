'use client';

import { useCallback, useEffect, useState } from 'react';
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

type RefEndpoint = { method: string; path: string; note: string };

type TroubleshootingRef = {
  checkedAt: string;
  responsibility: string;
  implementation: { service: string; method: string; bullQueue: string; bullJobType: string };
  systemPromptRelativePaths: string[];
  envKeys: string[];
  textWindowNote: string;
  persistence: {
    table: string;
    entity: string;
    statusValues: string[];
    requiredCandidateFields: string[];
    optionalCandidateFields: string[];
  };
  pageSectionLabels: string[];
  chunkSectionLabels: string[];
  extractionUserMessageSchema: string;
  entryTypesFromLlm: string[];
  relatedEndpoints: RefEndpoint[];
  notes: string[];
};

export default function TroubleshootingExtractionPage() {
  const [data, setData] = useState<TroubleshootingRef | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TroubleshootingRef>('/knowledge-documents/troubleshooting-extraction-reference');
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load troubleshooting extraction reference');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Troubleshooting extraction" showSidebar={true}>
        <div className="space-y-6 max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Problem / solution extraction</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Read-only snapshot from{' '}
                <code className="text-xs">GET /api/knowledge-documents/troubleshooting-extraction-reference</code> —
                aligns <code className="text-xs">PDF_KNOWLEDGE_ARCHITECTURE.md</code> (section 22) with the Nest implementation
                (no separate troubleshooting microservice).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Responsibility</CardTitle>
              <CardDescription>
                {data?.checkedAt ? `Snapshot ${new Date(data.checkedAt).toLocaleString()}` : loading ? 'Loading…' : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{data?.responsibility}</p>
              {data?.implementation ? (
                <ul className="list-disc pl-5 space-y-1 text-foreground/90">
                  <li>
                    <span className="font-medium">Service:</span> {data.implementation.service}
                  </li>
                  <li>
                    <span className="font-medium">Entry point:</span> {data.implementation.method}
                  </li>
                  <li>
                    <span className="font-medium">Bull:</span> {data.implementation.bullQueue} /{' '}
                    {data.implementation.bullJobType}
                  </li>
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt &amp; env</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground mb-1">System prompt paths</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {(data?.systemPromptRelativePaths ?? []).map((p) => (
                    <li key={p}>
                      <code className="text-xs">{p}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Tuning env vars</p>
                <p className="text-muted-foreground">
                  {(data?.envKeys ?? []).map((k) => (
                    <code className="text-xs mr-2" key={k}>
                      {k}
                    </code>
                  ))}
                </p>
              </div>
              <p className="text-muted-foreground border-l-2 border-primary/30 pl-3">{data?.textWindowNote}</p>
              <p className="text-muted-foreground text-xs">{data?.extractionUserMessageSchema}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Persistence</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                <code className="text-xs">{data?.persistence.table}</code> ({data?.persistence.entity}) — status:{' '}
                {(data?.persistence.statusValues ?? []).join(', ')}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Required LLM fields:</span>{' '}
                {(data?.persistence.requiredCandidateFields ?? []).join(', ')}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Optional:</span>{' '}
                {(data?.persistence.optionalCandidateFields ?? []).join(', ')}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Page section labels</CardTitle>
                <CardDescription>
                  <code className="text-xs">detectSectionType</code> on page text
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs font-mono text-muted-foreground">
                {(data?.pageSectionLabels ?? []).join(', ')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chunk section labels</CardTitle>
                <CardDescription>
                  <code className="text-xs">classifyChunkSection</code> hint per chunk
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs font-mono text-muted-foreground">
                {(data?.chunkSectionLabels ?? []).join(', ')}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">LLM entryType values</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {(data?.entryTypesFromLlm ?? []).join(', ')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related HTTP routes</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="min-w-[200px]">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.relatedEndpoints ?? []).map((e) => (
                    <TableRow key={`${e.method}${e.path}`}>
                      <TableCell className="font-mono text-xs">{e.method}</TableCell>
                      <TableCell className="font-mono text-xs">{e.path}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Implementation notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {(data?.notes ?? []).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
