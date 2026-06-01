'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';

interface KnowledgeEntry {
  id: string;
  title: string;
  problemDescription: string;
  solution: string;
  tags?: string | null;
  machineName?: string | null;
  symptom?: string | null;
  rootCause?: string | null;
  severity?: string | null;
  photoPath?: string | null;
  reviewStatus?: string;
  createdBy?: {
    fullName?: string | null;
    email: string;
  };
  createdAt: string;
}

const emptyForm: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'createdBy'> = {
  title: '',
  problemDescription: '',
  solution: '',
  tags: '',
  machineName: '',
  symptom: '',
  rootCause: '',
  severity: '',
  photoPath: null,
  reviewStatus: '',
};

interface PendingEntry extends KnowledgeEntry {
  reviewStatus?: string;
  createdById?: string;
}

export default function AdminKnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const [all, pend] = await Promise.all([
        api.get<KnowledgeEntry[]>('/knowledge'),
        api.get<PendingEntry[]>('/knowledge/pending-review'),
      ]);
      setEntries(all.data);
      setPending(pend.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const approvePending = async (id: string) => {
    try {
      await api.post(`/knowledge/${id}/approve`);
      toast.success('Approved and indexed');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Approve failed');
    }
  };

  const rejectPending = async (id: string) => {
    const reason = window.prompt('Reject reason (optional)') || undefined;
    try {
      await api.post(`/knowledge/${id}/reject`, { reason });
      toast.success('Rejected');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reject failed');
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get('/knowledge/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-entries.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Export failed');
    }
  };

  const exportXlsx = async () => {
    try {
      const res = await api.get('/knowledge/export/xlsx', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-entries.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Excel export failed');
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => {
      return (
        e.title.toLowerCase().includes(q) ||
        e.problemDescription.toLowerCase().includes(q) ||
        e.solution.toLowerCase().includes(q) ||
        (e.tags || '').toLowerCase().includes(q)
      );
    });
  }, [entries, search]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEntries.length / pageSize)),
    [filteredEntries.length],
  );

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage]);

  const startIndex = filteredEntries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredEntries.length);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setModalOpen(true);
  };

  const openEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      problemDescription: entry.problemDescription,
      solution: entry.solution,
      tags: entry.tags || '',
      machineName: entry.machineName || '',
      symptom: entry.symptom || '',
      rootCause: entry.rootCause || '',
      severity: entry.severity || '',
      photoPath: entry.photoPath || null,
      reviewStatus: entry.reviewStatus || '',
    });
    setPhotoFile(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setPhotoFile(null);
  };

  const openDetails = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedEntry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        problemDescription: form.problemDescription,
        solution: form.solution,
        tags: form.tags?.trim() || undefined,
        machineName: form.machineName?.trim() || undefined,
        symptom: form.symptom?.trim() || undefined,
        rootCause: form.rootCause?.trim() || undefined,
        severity: form.severity?.trim() || undefined,
      };
      let entryId = editingId;
      if (editingId) {
        await api.patch(`/knowledge/${editingId}`, payload);
        toast.success('Knowledge entry updated');
      } else {
        const res = await api.post<KnowledgeEntry>('/knowledge', payload);
        entryId = res.data.id;
        toast.success('Knowledge entry created');
      }
      if (photoFile && entryId) {
        const fd = new FormData();
        fd.append('file', photoFile);
        await api.post(`/knowledge/${entryId}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Photo attached.');
      }
      closeModal();
      fetchEntries();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.message)
          ? err.response.data.message.join(', ')
          : 'Request failed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: KnowledgeEntry) => {
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/knowledge/${entry.id}`);
      toast.success('Knowledge entry deleted');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Knowledge Base" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Problem & solution library</h2>
              <p className="text-sm text-muted-foreground">
                Centralize known issues and their fixes to help technicians and AI.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCsv} className="gap-2 w-fit">
                Export CSV
              </Button>
              <Button variant="outline" onClick={exportXlsx} className="gap-2 w-fit">
                Export Excel
              </Button>
              <Button onClick={openCreate} className="gap-2 w-fit">
                <Plus className="h-4 w-4" />
                Add problem & solution
              </Button>
            </div>
          </div>

          {pending.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Pending technician submissions ({pending.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-md border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{p.problemDescription}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        By {p.createdBy?.fullName || p.createdBy?.email || p.createdById}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approvePending(p.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectPending(p.id)}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Knowledge entries</CardTitle>
              <Input
                placeholder="Search by title, problem, solution, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No knowledge entries yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Title</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Created by</TableHead>
                        <TableHead>Created at</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry) => (
                        <TableRow key={entry.id} className="align-top">
                          <TableCell
                            className="py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => openDetails(entry)}
                            title="Click to view details"
                          >
                            <div className="font-medium">{entry.title}</div>
                          </TableCell>
                          <TableCell className="py-3">
                            {entry.tags ? (
                              <div className="flex flex-wrap gap-1">
                                {entry.tags.split(',').map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px]">
                                    {tag.trim()}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground">
                            {entry.createdBy?.fullName || entry.createdBy?.email || '—'}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(entry)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(entry)}
                                title="Delete"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredEntries.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
                      <span className="text-xs text-muted-foreground">
                        Showing {startIndex}-{endIndex} of {filteredEntries.length} entries
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>{editingId ? 'Edit knowledge entry' : 'Add knowledge entry'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={closeModal}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Example: Machine X - Overheating error E42"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="problemDescription">Problem description</Label>
                    <Textarea
                      id="problemDescription"
                      value={form.problemDescription}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, problemDescription: e.target.value }))
                      }
                      placeholder="Describe the symptoms, alarms, logs, and when it happens…"
                      rows={4}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="solution">Solution (step-by-step)</Label>
                    <Textarea
                      id="solution"
                      value={form.solution}
                      onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
                      placeholder="1) Check...\n2) Reset...\n3) Replace...\n4) Test..."
                      rows={6}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      value={form.tags || ''}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      placeholder="machine-x, overheating, error-e42"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machineName">Machine name (optional)</Label>
                    <Input
                      id="machineName"
                      value={form.machineName || ''}
                      onChange={(e) => setForm((f) => ({ ...f, machineName: e.target.value }))}
                      placeholder="e.g. Danao line 3"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="symptom">Symptom (optional)</Label>
                    <Textarea
                      id="symptom"
                      value={form.symptom || ''}
                      onChange={(e) => setForm((f) => ({ ...f, symptom: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rootCause">Root cause (optional)</Label>
                    <Textarea
                      id="rootCause"
                      value={form.rootCause || ''}
                      onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severity (optional)</Label>
                    <Input
                      id="severity"
                      value={form.severity || ''}
                      onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                      placeholder="low / medium / high"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="photo">Field photo (optional, JPEG/PNG/WebP)</Label>
                    <Input
                      id="photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {detailsOpen && selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>{selectedEntry.title}</CardTitle>
                <Button variant="ghost" size="icon" onClick={closeDetails}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEntry.reviewStatus && (
                  <Badge
                    variant={selectedEntry.reviewStatus === 'approved' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {selectedEntry.reviewStatus}
                  </Badge>
                )}
                <div className="space-y-1">
                  <Label>Problem</Label>
                  <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                    {selectedEntry.problemDescription}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Solution</Label>
                  <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                    {selectedEntry.solution}
                  </div>
                </div>
                {(selectedEntry.machineName ||
                  selectedEntry.symptom ||
                  selectedEntry.rootCause ||
                  selectedEntry.severity) && (
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.machineName && <Badge variant="outline">Machine: {selectedEntry.machineName}</Badge>}
                    {selectedEntry.severity && <Badge variant="outline">Severity: {selectedEntry.severity}</Badge>}
                    {selectedEntry.symptom && <Badge variant="outline">Symptom: {selectedEntry.symptom}</Badge>}
                    {selectedEntry.rootCause && <Badge variant="outline">Root cause: {selectedEntry.rootCause}</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

