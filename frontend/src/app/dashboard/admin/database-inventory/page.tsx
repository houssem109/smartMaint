'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Row = { table: string; entity: string; scope: 'pdf' | 'shared'; purpose: string };

type Inventory = { checkedAt: string; tables: Row[] };

export default function DatabaseInventoryPage() {
  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Inventory>('/knowledge-documents/database-inventory');
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load database inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Database inventory" showSidebar={true}>
        <div className="space-y-6 max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Database inventory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Curated list of PostgreSQL tables the PDF knowledge pipeline uses, from{' '}
                <code className="text-xs">GET /api/knowledge-documents/database-inventory</code>. See{' '}
                <span className="font-medium">PDF_KNOWLEDGE_ARCHITECTURE.md (section 19)</span> for the full narrative and
                migration references.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tables</CardTitle>
              <CardDescription>
                {data?.checkedAt ? `Snapshot at ${data.checkedAt}` : loading ? 'Loading…' : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="min-w-[240px]">Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.tables ?? []).map((r) => (
                    <TableRow key={r.table}>
                      <TableCell className="font-mono text-xs">{r.table}</TableCell>
                      <TableCell className="font-mono text-xs">{r.entity}</TableCell>
                      <TableCell className="text-xs capitalize">{r.scope}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.purpose}</TableCell>
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
