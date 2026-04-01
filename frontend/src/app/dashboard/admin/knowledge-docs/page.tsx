'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  uploadedBy?: { fullName?: string | null; email: string };
  createdAt: string;
  error?: string | null;
}

export default function KnowledgeDocsPage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    // refresh every 5 seconds
    const id = setInterval(fetchDocs, 5000);
    return () => clearInterval(id);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Choose a PDF first');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      await api.post('/knowledge-documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedFile(null);
      toast.success('PDF uploaded');
      fetchDocs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

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

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Delete this PDF? This will also remove its extracted candidates.')) return;
    try {
      await api.delete(`/knowledge-documents/${docId}`);
      toast.success('PDF deleted');
      fetchDocs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete PDF');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="PDF Library" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Shared PDF Library</h2>
              <p className="text-sm text-muted-foreground">
                Upload manuals and view what Techo extracts (resume view coming next).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                }}
              />
              <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="gap-2">
                <Plus className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Uploaded PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : docs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No PDFs uploaded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.originalName || d.fileName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Uploaded by {d.uploadedBy?.fullName || d.uploadedBy?.email || '—'} •{' '}
                          {new Date(d.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusVariant(d.status) as any} className="text-xs capitalize">
                          {d.status}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/admin/knowledge-docs/${d.id}`}>Open</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                          Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteDocument(d.id)}
                          className="hidden sm:inline-flex"
                        >
                          Delete
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

