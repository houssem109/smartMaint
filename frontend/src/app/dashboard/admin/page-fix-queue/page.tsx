'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FixItem {
  id: string;
  documentId: string;
  pageNumber: number;
  status: string;
  reason: string | null;
  createdAt: string;
  replacementImagePath?: string | null;
}

function ReplacementPreview({ itemId }: { itemId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let created: string | null = null;
    (async () => {
      try {
        const res = await api.get(`/knowledge-documents/page-fix-queue/${itemId}/replacement-image`, {
          responseType: 'blob',
        });
        const u = URL.createObjectURL(res.data);
        created = u;
        setUrl(u);
      } catch {
        setUrl(null);
      }
    })();
    return () => {
      if (created) URL.revokeObjectURL(created);
    };
  }, [itemId]);

  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <img src={url} alt="" className="max-h-20 max-w-[120px] rounded border border-border object-contain bg-muted/30" />
  );
}

export default function PageFixQueuePage() {
  const [items, setItems] = useState<FixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixId, setFixId] = useState<string | null>(null);
  const [fixText, setFixText] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingImageItemId, setPendingImageItemId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<FixItem[]>('/knowledge-documents/page-fix-queue');
      setItems(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitFix = async (itemId: string) => {
    const text = fixText.trim();
    if (!text) {
      toast.error('Enter replacement text');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/page-fix-queue/${itemId}/fix-text`, { text });
      toast.success('Page text saved');
      setFixId(null);
      setFixText('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Fix failed');
    } finally {
      setSaving(false);
    }
  };

  const submitImage = async (itemId: string, file: File | null) => {
    if (!file) {
      toast.error('Choose a JPEG, PNG, or WebP image');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ ok: true; visionPages: number }>(
        `/knowledge-documents/page-fix-queue/${itemId}/fix-image`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const n = res.data.visionPages ?? 0;
      if (n > 0) {
        toast.success('Replacement image applied; vision updated this page.');
      } else {
        toast.info(
          'Image saved but vision did not update the page. Check ENABLE_PDF_VISION / Ollama, then use Run vision on the document.',
        );
      }
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Image upload failed');
    } finally {
      setSaving(false);
    }
  };

  const dismiss = async (itemId: string) => {
    if (!window.confirm('Dismiss this queue item?')) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/page-fix-queue/${itemId}/dismiss`);
      toast.success('Dismissed');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Dismiss failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Page fix queue" showSidebar={true}>
        <div className="space-y-6 max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Unreadable PDF pages</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Type replacement text or upload a clearer page image (JPEG/PNG/WebP). A thumbnail appears when
                an image is on file. Vision requires ENABLE_PDF_VISION.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Open items</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={saving}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  const id = pendingImageItemId;
                  setPendingImageItemId(null);
                  if (id && f) void submitImage(id, f);
                }}
              />
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No items in the queue.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/admin/knowledge-docs/${it.documentId}`}
                            className="text-primary hover:underline font-mono text-xs"
                          >
                            {it.documentId.slice(0, 8)}…
                          </Link>
                        </TableCell>
                        <TableCell>{it.pageNumber}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                          {it.reason || '—'}
                        </TableCell>
                        <TableCell className="align-middle w-[140px]">
                          {it.replacementImagePath ? <ReplacementPreview itemId={it.id} /> : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {fixId === it.id ? (
                            <div className="flex flex-col gap-2 items-end max-w-md ml-auto">
                              <Textarea
                                rows={4}
                                value={fixText}
                                onChange={(e) => setFixText(e.target.value)}
                                placeholder="Paste corrected page text…"
                                className="w-full min-w-[240px]"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setFixId(null)}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={() => submitFix(it.id)} disabled={saving}>
                                  Save text
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFixId(it.id);
                                  setFixText('');
                                }}
                                disabled={saving}
                              >
                                Fix text
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => {
                                  setPendingImageItemId(it.id);
                                  requestAnimationFrame(() => imageInputRef.current?.click());
                                }}
                              >
                                Upload image
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => dismiss(it.id)} disabled={saving}>
                                Dismiss
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
