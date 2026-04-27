'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  machineName?: string | null;
  uploadedBy?: { fullName?: string | null; email: string };
  createdAt: string;
}

function machineLabel(doc: KnowledgeDocument) {
  const m = doc.machineName?.trim();
  return m && m.length > 0 ? m : 'Machine name not detected — open PDF';
}

export default function TechnicianKnowledgePdfsPage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get<KnowledgeDocument[]>('/knowledge-documents');
      setDocs(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    const id = setInterval(fetchDocs, 8000);
    return () => clearInterval(id);
  }, []);

  const handleDownload = async (doc: KnowledgeDocument) => {
    try {
      const res = await api.get(`/knowledge-documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || doc.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to download PDF');
    }
  };

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    return 'outline';
  };

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="PDF manuals">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Shared PDF manuals</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Same machine labels as admins. You can suggest a machine name if something looks wrong.
            </p>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Library</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : docs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No PDFs yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.originalName || d.fileName}</div>
                        <div className="text-sm text-muted-foreground mt-1">{machineLabel(d)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Uploaded {new Date(d.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusVariant(d.status) as any} className="text-xs capitalize">
                          {d.status}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/technician/knowledge-pdfs/${d.id}`}>Open</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
