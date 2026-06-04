'use client';

import { useEffect, useState } from 'react';
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

type DocRow = { id: string; originalName: string; machineName?: string | null };

const SEVERITY_OPTIONS = [
  { value: '__all__', label: 'All severities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function ProblemsSolutionsExportPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [machine, setMachine] = useState('');
  const [documentId, setDocumentId] = useState('__all__');
  const [severity, setSeverity] = useState('__all__');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<DocRow[]>('/knowledge-documents');
        setDocs(Array.isArray(res.data) ? res.data : []);
      } catch {
        setDocs([]);
      }
    })();
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const params: Record<string, string> = { format };
      if (machine.trim()) params.machine = machine.trim();
      if (documentId !== '__all__') params.documentId = documentId;
      if (severity !== '__all__') params.severity = severity;
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
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Problems export" showSidebar={true}>
        <div className="max-w-5xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Export problems &amp; solutions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download approved knowledge entries as Excel or CSV. Leave dates empty to include all
              rows.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>
                Dates filter by entry creation date. Machine, PDF, and severity are optional.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="machine">Machine (contains)</Label>
                <Input
                  id="machine"
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Source PDF</Label>
                <Select value={documentId} onValueChange={setDocumentId}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
