'use client';

import { useState } from 'react';
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

const STATUS_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'solved', label: 'Solved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  { value: '__all__', label: 'All types' },
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'it', label: 'IT' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'task', label: 'Task' },
  { value: 'other', label: 'Other' },
];

export default function TicketsExportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('__all__');
  const [category, setCategory] = useState('__all__');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const params: Record<string, string> = { format };
      if (from.trim()) params.from = from.trim();
      if (to.trim()) params.to = to.trim();
      if (status !== '__all__') params.status = status;
      if (category !== '__all__') params.category = category;

      const res = await api.get('/export/tickets', {
        params,
        responseType: 'blob',
      });
      const cd = res.headers['content-disposition'] as string | undefined;
      let filename = `tickets.${format}`;
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
      <Layout title="Tickets export" showSidebar={true}>
        <div className="space-y-6 max-w-2xl">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Export tickets</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Download tickets created in a date range as CSV or Excel. Includes title, type,
              creator, assignee, resolved status, and who marked the ticket solved or closed.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Period &amp; filters</CardTitle>
              <CardDescription>
                Dates filter by ticket creation date. Leave both empty to export all tickets.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type (category)</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <CardTitle className="text-base">Columns included</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Title · Description · Type (category) · Priority · Status · Resolved (Yes/No) · Created by ·
                Assigned to · Resolved by · Created at · Updated at · Machine · Area · Source
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
