'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ConfirmModal from '@/components/ConfirmModal';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  BookOpen,
  Loader2,
  Clock,
  User,
  Tag,
  Wrench,
  CircleAlert,
  Lightbulb,
  ImageIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

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

function getSeverityVariant(
  severity?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = severity?.toLowerCase();
  if (s === 'high' || s === 'critical') return 'destructive';
  if (s === 'medium') return 'default';
  return 'outline';
}

function ModalOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      {children}
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-muted/15 p-4">
      <div>
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function DetailBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

export default function AdminKnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);

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
        (e.tags || '').toLowerCase().includes(q) ||
        (e.machineName || '').toLowerCase().includes(q)
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

  const totalCount = filteredEntries.length;
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

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
    setDetailsOpen(false);
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/knowledge/${deleteTarget.id}`);
      toast.success('Knowledge entry deleted');
      if (selectedEntry?.id === deleteTarget.id) closeDetails();
      setDeleteTarget(null);
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
            <h2 className="text-xl font-semibold tracking-tight">Knowledge base</h2>
            <Button onClick={openCreate} className="w-fit gap-2">
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          </div>

          {pending.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Pending review
                  <Badge variant="secondary" className="ml-1 font-normal">
                    {pending.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Technician submissions — approve to publish to the knowledge base.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {p.problemDescription}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Submitted by {p.createdBy?.fullName || p.createdBy?.email || 'technician'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
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
            <CardHeader className="space-y-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                Published entries
              </CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search title, problem, solution, tags, machine…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void fetchEntries()}
                  title="Refresh"
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading…
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {entries.length === 0
                      ? 'No knowledge entries yet.'
                      : 'No entries match your search.'}
                  </p>
                  {entries.length === 0 && (
                    <Button variant="outline" onClick={openCreate} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add first entry
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Title</TableHead>
                          <TableHead>Machine</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedEntries.map((entry) => (
                          <TableRow
                            key={entry.id}
                            className="cursor-pointer transition-colors hover:bg-muted/40"
                            onClick={() => openDetails(entry)}
                          >
                            <TableCell>
                              <div className="font-medium">{entry.title}</div>
                              {entry.severity && (
                                <Badge
                                  variant={getSeverityVariant(entry.severity)}
                                  className="mt-1 text-[10px] capitalize"
                                >
                                  {entry.severity}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.machineName || '—'}
                            </TableCell>
                            <TableCell>
                              {entry.tags ? (
                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                  {entry.tags.split(',').slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                                      {tag.trim()}
                                    </Badge>
                                  ))}
                                  {entry.tags.split(',').length > 3 && (
                                    <span className="text-[10px] text-muted-foreground">+more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.createdBy?.fullName || entry.createdBy?.email || '—'}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(entry);
                                  }}
                                  title="Delete"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between px-1 pt-3 text-sm text-muted-foreground">
                    <span>
                      Showing {rangeStart}–{rangeEnd} of {totalCount}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {modalOpen && (
          <ModalOverlay onClose={closeModal}>
            <Card
              accentBand
              className="max-h-[90vh] w-full max-w-2xl border-border/50 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {editingId ? 'Edit knowledge entry' : 'Add knowledge entry'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {editingId
                        ? 'Update problem, solution, and metadata.'
                        : 'Publish a new problem and solution for search and technicians.'}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={closeModal} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="max-h-[calc(90vh-7rem)] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-5 pb-2">
                  <FormSection title="Main content" description="Required fields">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Motor overheating — error E42"
                        className="h-11"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="problemDescription">Problem</Label>
                      <Textarea
                        id="problemDescription"
                        value={form.problemDescription}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, problemDescription: e.target.value }))
                        }
                        rows={4}
                        className="min-h-[100px] resize-y"
                        placeholder="What went wrong?"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="solution">Solution</Label>
                      <Textarea
                        id="solution"
                        value={form.solution}
                        onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
                        rows={5}
                        className="min-h-[120px] resize-y"
                        placeholder="Steps taken to fix it"
                        required
                      />
                    </div>
                  </FormSection>

                  <FormSection title="Classification" description="Optional but helpful for search">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tags" className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                          Tags
                        </Label>
                        <Input
                          id="tags"
                          value={form.tags || ''}
                          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                          placeholder="motor, electrical"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="machineName" className="flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                          Machine
                        </Label>
                        <Input
                          id="machineName"
                          value={form.machineName || ''}
                          onChange={(e) => setForm((f) => ({ ...f, machineName: e.target.value }))}
                          placeholder="e.g. Line 2 filler"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="severity">Severity</Label>
                        <Input
                          id="severity"
                          value={form.severity || ''}
                          onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                          placeholder="low, medium, high"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="photo" className="flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          Photo
                        </Label>
                        <Input
                          id="photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="text-sm"
                          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                        />
                        {photoFile && (
                          <p className="text-xs text-muted-foreground truncate">{photoFile.name}</p>
                        )}
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="Extra detail" description="Optional">
                    <div className="space-y-2">
                      <Label htmlFor="symptom">Symptom</Label>
                      <Textarea
                        id="symptom"
                        value={form.symptom || ''}
                        onChange={(e) => setForm((f) => ({ ...f, symptom: e.target.value }))}
                        rows={2}
                        className="resize-y"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rootCause">Root cause</Label>
                      <Textarea
                        id="rootCause"
                        value={form.rootCause || ''}
                        onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))}
                        rows={2}
                        className="resize-y"
                      />
                    </div>
                  </FormSection>

                  <div className="flex gap-3 border-t border-border/50 pt-4">
                    <Button type="submit" disabled={saving} className="min-w-[140px] gap-2">
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : editingId ? (
                        'Save changes'
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Create entry
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ModalOverlay>
        )}

        {detailsOpen && selectedEntry && (
          <ModalOverlay onClose={closeDetails}>
            <Card
              accentBand
              className="max-h-[90vh] w-full max-w-2xl border-border/50 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <CardTitle className="text-xl leading-snug break-words">
                      {selectedEntry.title}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-x-1 gap-y-1">
                      <User className="inline h-3.5 w-3.5 shrink-0" />
                      <span>
                        {selectedEntry.createdBy?.fullName ||
                          selectedEntry.createdBy?.email ||
                          'Unknown'}
                      </span>
                      <span>·</span>
                      <span>{new Date(selectedEntry.createdAt).toLocaleString()}</span>
                    </CardDescription>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.machineName && (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <Wrench className="h-3 w-3" />
                          {selectedEntry.machineName}
                        </Badge>
                      )}
                      {selectedEntry.severity && (
                        <Badge
                          variant={getSeverityVariant(selectedEntry.severity)}
                          className="capitalize"
                        >
                          {selectedEntry.severity}
                        </Badge>
                      )}
                      {selectedEntry.reviewStatus && (
                        <Badge variant="secondary" className="capitalize font-normal">
                          {selectedEntry.reviewStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={closeDetails} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="max-h-[calc(90vh-8rem)] space-y-5 overflow-y-auto pb-6">
                <DetailBlock icon={CircleAlert} label="Problem">
                  {selectedEntry.problemDescription}
                </DetailBlock>
                <DetailBlock icon={Lightbulb} label="Solution">
                  {selectedEntry.solution}
                </DetailBlock>
                {(selectedEntry.symptom ||
                  selectedEntry.rootCause ||
                  selectedEntry.tags) && (
                  <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Additional info
                    </p>
                    {selectedEntry.symptom && (
                      <p className="text-sm">
                        <span className="font-medium text-muted-foreground">Symptom · </span>
                        <span className="text-foreground/90">{selectedEntry.symptom}</span>
                      </p>
                    )}
                    {selectedEntry.rootCause && (
                      <p className="text-sm">
                        <span className="font-medium text-muted-foreground">Root cause · </span>
                        <span className="text-foreground/90">{selectedEntry.rootCause}</span>
                      </p>
                    )}
                    {selectedEntry.tags && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedEntry.tags.split(',').map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-normal">
                            {tag.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </ModalOverlay>
        )}

        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Delete knowledge entry"
          message={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.title}"? This cannot be undone.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Layout>
    </ProtectedRoute>
  );
}
