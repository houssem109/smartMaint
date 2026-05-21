'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type QaStatus = 'shipped' | 'partial' | 'gap' | 'aspirational';

type QaPayload = {
  checkedAt: string;
  rows: { id: string; goal: string; status: QaStatus; notes: string }[];
};

function statusBadgeVariant(s: QaStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'shipped') return 'default';
  if (s === 'partial') return 'secondary';
  if (s === 'gap') return 'destructive';
  return 'outline';
}

function statusLabel(s: QaStatus): string {
  if (s === 'shipped') return 'Shipped';
  if (s === 'partial') return 'Partial';
  if (s === 'gap') return 'Gap';
  return 'Aspirational';
}

export default function SuccessCriteriaPage() {
  const [data, setData] = useState<QaPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<QaPayload>('/knowledge-documents/qa-success-criteria');
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load success criteria');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Success criteria" showSidebar={true}>
        <div className="space-y-6 max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Success criteria vs reality</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Original product goals from PDF_KNOWLEDGE_ARCHITECTURE (section 20), scored as{' '}
                <span className="font-medium text-foreground">Shipped</span>,{' '}
                <span className="font-medium text-foreground">Partial</span>,{' '}
                <span className="font-medium text-foreground">Gap</span>, or{' '}
                <span className="font-medium text-foreground">Aspirational</span>. Data from{' '}
                <code className="text-xs">GET /api/knowledge-documents/qa-success-criteria</code> (curated in
                backend; update the service when behavior changes).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">QA matrix</CardTitle>
              <CardDescription>
                {data?.checkedAt ? `Snapshot ${new Date(data.checkedAt).toLocaleString()}` : loading ? 'Loading…' : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[220px]">Goal</TableHead>
                    <TableHead className="min-w-[280px]">Notes (honest)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="align-top">
                        <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm align-top">{r.goal}</TableCell>
                      <TableCell className="text-sm text-muted-foreground align-top">{r.notes}</TableCell>
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
