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
import { useAuthStore } from '@/store/auth-store';

interface KnowledgeEntry {
  id: string;
  title: string;
  problemDescription: string;
  solution: string;
  tags?: string | null;
  createdById: string;
  createdBy?: {
    fullName?: string | null;
    email: string;
  };
  createdAt: string;
}

const emptyForm: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'createdBy' | 'createdById'> = {
  title: '',
  problemDescription: '',
  solution: '',
  tags: '',
};

export default function TechnicianKnowledgePage() {
  const currentUser = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await api.get<KnowledgeEntry[]>('/knowledge');
      setEntries(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      problemDescription: entry.problemDescription,
      solution: entry.solution,
      tags: entry.tags || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
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
      };
      if (editingId) {
        await api.patch(`/knowledge/${editingId}`, payload);
        toast.success('Knowledge entry updated');
      } else {
        await api.post('/knowledge', payload);
        toast.success('Knowledge entry created');
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

  const canModify = (entry: KnowledgeEntry) => {
    if (!currentUser) return false;
    return entry.createdById === currentUser.id;
  };

  return (
    <ProtectedRoute allowedRoles={['technician']}>
      <Layout title="Knowledge Base" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Problem & solution library</h2>
              <p className="text-sm text-muted-foreground">
                Learn from existing fixes or add your own experience-based solutions.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              Add problem & solution
            </Button>
          </div>

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
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id} className="align-top">
                          <TableCell className="py-3">
                            <div className="font-medium">{entry.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {entry.problemDescription}
                            </div>
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
                              {canModify(entry) && (
                                <>
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
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
      </Layout>
    </ProtectedRoute>
  );
}

