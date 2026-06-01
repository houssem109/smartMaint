'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, X, FileJson, FileSpreadsheet } from 'lucide-react';
import { downloadCsv, downloadJson } from '@/lib/export-download';

interface KnowledgeDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  machineName?: string | null;
  docType?: string | null;
  gateConfidence?: number | null;
  needsReview?: boolean;
  isWorkRelated?: boolean | null;
  deepMode?: boolean;
  uploadedBy?: { fullName?: string | null; email: string };
  error?: string | null;
  chunksIndexed?: number;
  createdAt: string;
  supersedesDocumentId?: string | null;
  supersededByDocumentId?: string | null;
}

interface MachineNameSuggestion {
  id: string;
  documentId: string;
  proposedName: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  suggestedBy?: { email: string; fullName?: string | null };
}

interface KnowledgeExtractionCandidate {
  id: string;
  entryType?: string | null;
  title: string;
  problemDescription: string;
  solution: string;
  symptom?: string | null;
  rootCause?: string | null;
  tags: string | null;
  sourcePages?: string | null;
  confidence?: number | null;
  sectionType?: string | null;
  status: string;
  createdById: string;
}

interface PageAnalysisRow {
  id: string;
  pageNumber: number;
  quality: 'good' | 'degraded' | 'poor' | 'unreadable';
  ocrConfidence: number | null;
  qualityWarnings: string[] | null;
  extractionMode?: 'text' | 'ocr' | 'vision';
  visionUsed?: boolean;
  sectionType?: string | null;
  ocrText?: string | null;
}

type PipelineAuditReport = {
  generatedAt: string;
  metrics: {
    totalPages: number;
    pagesWithOcrText: number;
    pagesVisionUsed: number;
    pagesByExtractionMode: Record<string, number>;
    pagesByQuality: Record<string, number>;
    visionFailedPages: number;
    ragChunkCount: number;
    ragMostlyDotsChunks: number;
    ragEmbedWorthyChunks: number;
    candidateTotal: number;
    candidateApproved: number;
    candidateRejected: number;
    approvalRatePercent: number | null;
  };
  visionPreference: { enabledEffective: boolean; pdfVisionAdminEnabled: boolean; enabledFromEnv: boolean };
  chunkAudit: {
    builtCount: number;
    afterNearDuplicateCount: number;
    afterLowValueFilterCount: number;
    droppedLowValueSamples: Array<{ index: number; preview: string; reason: string }>;
    note: string;
  };
  pages: Array<{
    pageNumber: number;
    quality: string;
    extractionMode: string;
    visionUsed: boolean;
    ocrConfidence: number | null;
    sectionType: string | null;
    qualityWarnings: string[] | null;
    ocrTextLength: number;
    popplerTextLength: number;
    ocrTextPreview: string;
    popplerTextPreview: string;
    ocrText: string | null;
    hasVisionBlock: boolean;
  }>;
  ragChunks: Array<{
    chunkIndex: number;
    sectionType: string | null;
    textPreview: string;
    text: string;
    quality: { mostlyDots: boolean; embedWorthy: boolean; alnumRatio: number };
  }>;
};

interface PipelineConfigLite {
  vision?: {
    docBatchPages?: number;
    maxPagesPerBatch?: number;
  };
}

export default function KnowledgeDocDetailsPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();

  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [extractions, setExtractions] = useState<KnowledgeExtractionCandidate[]>([]);
  const [pageAnalysis, setPageAnalysis] = useState<PageAnalysisRow[]>([]);
  const [docBatchPages, setDocBatchPages] = useState(20);
  const [visionMaxPerBatch, setVisionMaxPerBatch] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQualityPage, setCurrentQualityPage] = useState(1);
  const pageSize = 8;
  const qualityPageSize = 10;
  const [saving, setSaving] = useState(false);

  const [officialName, setOfficialName] = useState('');
  const [savingOfficial, setSavingOfficial] = useState(false);
  const [suggestions, setSuggestions] = useState<MachineNameSuggestion[]>([]);
  const [rejectOthersReason, setRejectOthersReason] = useState('');
  const [auditReport, setAuditReport] = useState<PipelineAuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTab, setAuditTab] = useState<'summary' | 'pages' | 'qdrant'>('summary');
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<KnowledgeExtractionCandidate | null>(null);
  const [form, setForm] = useState({
    title: '',
    problemDescription: '',
    solution: '',
    tags: '',
  });

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ document: KnowledgeDocument; resume: any }>(`/knowledge-documents/${id}`);
      setDoc(res.data.document);
      setOfficialName(res.data.document.machineName?.trim() || '');
      if (res.data.document.machineName?.trim()) {
        setSuggestions([]);
      } else {
        try {
          const sres = await api.get<MachineNameSuggestion[]>(
            `/knowledge-documents/${id}/machine-name/suggestions`,
          );
          setSuggestions(sres.data);
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Failed to load name suggestions');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const fetchExtractions = async () => {
    if (!id) return;
    try {
      const res = await api.get<KnowledgeExtractionCandidate[]>(`/knowledge-documents/${id}/extractions`);
      setExtractions(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load extractions');
    }
  };

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detailRes = await api.get<{ document: KnowledgeDocument; resume: any }>(`/knowledge-documents/${id}`);
      setDoc(detailRes.data.document);
      setOfficialName(detailRes.data.document.machineName?.trim() || '');
      const hasMachineName = !!detailRes.data.document.machineName?.trim();

      await Promise.all([
        (async () => {
          const res = await api.get<KnowledgeExtractionCandidate[]>(`/knowledge-documents/${id}/extractions`);
          setExtractions(res.data);
        })(),
        (async () => {
          try {
            const res = await api.get<PageAnalysisRow[]>(`/knowledge-documents/${id}/page-analysis`);
            setPageAnalysis(res.data);
          } catch {
            setPageAnalysis([]);
          }
        })(),
        (async () => {
          try {
            const res = await api.get<PipelineConfigLite>('/knowledge-documents/pipeline-config');
            const b = Number(res.data?.vision?.docBatchPages ?? 20);
            const v = Number(res.data?.vision?.maxPagesPerBatch ?? 20);
            setDocBatchPages(Number.isFinite(b) && b > 0 ? Math.floor(b) : 20);
            setVisionMaxPerBatch(Number.isFinite(v) && v > 0 ? Math.floor(v) : 20);
          } catch {
            setDocBatchPages(20);
            setVisionMaxPerBatch(20);
          }
        })(),
        hasMachineName
          ? Promise.resolve().then(() => setSuggestions([]))
          : (async () => {
              try {
                const res = await api.get<MachineNameSuggestion[]>(
                  `/knowledge-documents/${id}/machine-name/suggestions`,
                );
                setSuggestions(res.data);
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to load name suggestions');
              }
            })(),
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [extractions.length]);

  useEffect(() => {
    setCurrentQualityPage(1);
  }, [pageAnalysis.length]);

  // Keep polling while extraction is running, so the table fills automatically.
  useEffect(() => {
    if (!doc?.status) return;
    if (doc.status !== 'processing' && doc.status !== 'uploaded') return;

    const interval = setInterval(() => {
      fetchAll().catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.status]);

  const counts = useMemo(() => {
    const candidate = extractions.filter((e) => e.status === 'candidate').length;
    const approved = extractions.filter((e) => e.status === 'approved').length;
    const rejected = extractions.filter((e) => e.status === 'rejected').length;
    return { candidate, approved, rejected };
  }, [extractions]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(extractions.length / pageSize)),
    [extractions.length],
  );

  const paginatedExtractions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return extractions.slice(start, start + pageSize);
  }, [extractions, currentPage]);

  const startIndex = extractions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, extractions.length);
  const nonGoodPageRows = useMemo(
    () => pageAnalysis.filter((p) => p.quality !== 'good'),
    [pageAnalysis],
  );
  const totalQualityPages = useMemo(
    () => Math.max(1, Math.ceil(nonGoodPageRows.length / qualityPageSize)),
    [nonGoodPageRows.length],
  );
  const paginatedQualityRows = useMemo(() => {
    const start = (currentQualityPage - 1) * qualityPageSize;
    return nonGoodPageRows.slice(start, start + qualityPageSize);
  }, [nonGoodPageRows, currentQualityPage]);
  const qualityStartIndex =
    nonGoodPageRows.length === 0 ? 0 : (currentQualityPage - 1) * qualityPageSize + 1;
  const qualityEndIndex = Math.min(currentQualityPage * qualityPageSize, nonGoodPageRows.length);
  const totalPagesForBatching =
    (typeof doc?.totalPages === 'number' && doc.totalPages > 0 ? doc.totalPages : pageAnalysis.length) || 0;
  const estimatedBatchCount =
    totalPagesForBatching > 0 ? Math.max(1, Math.ceil(totalPagesForBatching / Math.max(1, docBatchPages))) : 0;

  const statusVariant = (status: string) => {
    if (status === 'done') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'processing') return 'secondary';
    if (status === 'needs_review') return 'secondary';
    if (status === 'superseded') return 'outline';
    return 'outline';
  };

  const extractionStatusVariant = (status: string) => {
    if (status === 'approved') return 'default';
    if (status === 'rejected') return 'destructive';
    return 'secondary';
  };

  const openEditModal = (c: KnowledgeExtractionCandidate) => {
    setEditingCandidate(c);
    setForm({
      title: c.title || '',
      problemDescription: c.problemDescription || '',
      solution: c.solution || '',
      tags: c.tags || '',
    });
    setModalOpen(true);
  };

  const handleApprove = async () => {
    if (!editingCandidate) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/extractions/${editingCandidate.id}/approve`, {
        title: form.title,
        problemDescription: form.problemDescription,
        solution: form.solution,
        tags: form.tags?.trim() || undefined,
      });
      toast.success('Candidate approved and added to Knowledge base');
      setModalOpen(false);
      setEditingCandidate(null);
      fetchDetails();
      fetchExtractions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (c: KnowledgeExtractionCandidate) => {
    if (!window.confirm('Reject this extracted item?')) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/extractions/${c.id}/reject`);
      toast.success('Candidate rejected');
      fetchExtractions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!id) return;
    if (!window.confirm('Delete this PDF document? This will also remove its extracted candidates.')) return;
    try {
      await api.delete(`/knowledge-documents/${id}`);
      toast.success('PDF deleted');
      router.push('/dashboard/admin/knowledge-docs');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete PDF');
    }
  };

  const handleSaveOfficialName = async () => {
    if (!id) return;
    const trimmed = officialName.trim();
    if (!trimmed) {
      toast.error('Machine name cannot be empty');
      return;
    }
    setSavingOfficial(true);
    try {
      await api.patch(`/knowledge-documents/${id}/machine-name`, { machineName: trimmed });
      toast.success('Machine name updated');
      fetchDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSavingOfficial(false);
    }
  };

  const handleApproveSuggestion = async (suggestionId: string) => {
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/machine-name-suggestions/${suggestionId}/approve`, {
        rejectOthersReason: rejectOthersReason.trim() || undefined,
      });
      toast.success('Suggestion approved');
      setRejectOthersReason('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    const reason = window.prompt('Optional reason (shown to technician):') || undefined;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/machine-name-suggestions/${suggestionId}/reject`, {
        reason: reason?.trim() || undefined,
      });
      toast.success('Suggestion rejected');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;
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

  const handleRunOcr = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.post<{
        ok: true;
        processedPages: number;
        pagesSelected?: number;
        chunksIndexed?: number;
      }>(`/knowledge-documents/${id}/run-ocr`);
      const msg =
        `OCR: ${res.data.processedPages}/${res.data.pagesSelected ?? res.data.processedPages} pages` +
        (res.data.chunksIndexed != null ? ` · RAG re-indexed (${res.data.chunksIndexed} chunks)` : '');
      toast.success(msg);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to run OCR');
    } finally {
      setSaving(false);
    }
  };

  const handleRunVision = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.post<{ ok: true; processedPages: number }>(`/knowledge-documents/${id}/run-vision`);
      toast.success(`Vision pass finished. Pages processed: ${res.data.processedPages}`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to run vision');
    } finally {
      setSaving(false);
    }
  };

  const handleReindexManual = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.post<{ ok: true; chunksIndexed: number }>(
        `/knowledge-documents/${id}/reindex-manual-chunks`,
      );
      toast.success(`Manual RAG re-indexed: ${res.data.chunksIndexed} chunk(s)`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Re-index failed');
    } finally {
      setSaving(false);
    }
  };

  const handleContinueExtraction = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/${id}/continue-extraction`);
      toast.success('Extraction resumed — keeps OCR/vision already done');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Continue failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveGate = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/${id}/gate/approve`);
      toast.success('Gate approved — extraction queued');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Approve failed');
    } finally {
      setSaving(false);
    }
  };

  const loadAuditReport = async () => {
    if (!id) return;
    setAuditLoading(true);
    try {
      const res = await api.get<PipelineAuditReport>(`/knowledge-documents/${id}/pipeline-audit-report`, {
        params: { ragLimit: 2000 },
      });
      setAuditReport(res.data);
      toast.success('Pipeline audit loaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load audit report');
    } finally {
      setAuditLoading(false);
    }
  };

  const exportAuditJson = () => {
    if (!auditReport || !doc) return;
    downloadJson(auditReport, `pipeline-audit-${doc.id}.json`);
  };

  const exportAuditExcel = async () => {
    if (!id || !doc) return;
    try {
      const res = await api.get(`/knowledge-documents/${id}/pipeline-audit-export/xlsx`, {
        params: { ragLimit: 2000 },
        responseType: 'blob',
      });
      const base = (doc.originalName || 'document').replace(/\.pdf$/i, '');
      const filename = `pipeline-${base}.xlsx`;
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export Excel report');
    }
  };

  const exportPagesCsv = () => {
    if (!auditReport || !doc) return;
    downloadCsv(
      auditReport.pages.map((p) => ({
        pageNumber: p.pageNumber,
        quality: p.quality,
        extractionMode: p.extractionMode,
        visionUsed: p.visionUsed,
        ocrConfidence: p.ocrConfidence ?? '',
        sectionType: p.sectionType ?? '',
        ocrTextLength: p.ocrTextLength,
        popplerTextLength: p.popplerTextLength,
        hasVisionBlock: p.hasVisionBlock,
        qualityWarnings: (p.qualityWarnings ?? []).join('; '),
        ocrText: p.ocrText ?? '',
      })),
      `pages-ocr-vision-${doc.id}.csv`,
    );
  };

  const exportQdrantCsv = () => {
    if (!auditReport || !doc) return;
    downloadCsv(
      auditReport.ragChunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        sectionType: c.sectionType ?? '',
        mostlyDots: c.quality.mostlyDots,
        embedWorthy: c.quality.embedWorthy,
        alnumRatio: c.quality.alnumRatio,
        text: c.text,
      })),
      `qdrant-chunks-${doc.id}.csv`,
    );
  };

  const handleRejectGate = async () => {
    if (!id) return;
    const reason = window.prompt('Reject reason (optional):') || undefined;
    setSaving(true);
    try {
      await api.post(`/knowledge-documents/${id}/gate/reject`, { reason });
      toast.success('Document rejected at gate');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reject failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Document Details" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight truncate">
                {doc?.originalName || 'Document'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {doc ? `Uploaded by ${doc.uploadedBy?.fullName || doc.uploadedBy?.email || '—'} • ${new Date(doc.createdAt).toLocaleString()}` : ''}
              </p>
              {doc && (
                <p className="text-xs text-muted-foreground mt-1">
                  Type: {doc.docType || '—'} • Gate:{' '}
                  {typeof doc.gateConfidence === 'number'
                    ? `${Math.round(doc.gateConfidence * 100)}%`
                    : '—'}
                  {doc.needsReview ? ' • needs review' : ''} • Mode:{' '}
                  {doc.deepMode === false ? 'fast' : 'deep'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusVariant(doc?.status || 'uploaded') as any} className="text-xs capitalize">
                {doc?.status || 'uploaded'}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchAll}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!doc}>
                Download
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteDocument}
                className="hidden sm:inline-flex"
              >
                Delete
              </Button>
            </div>
          </div>

          {doc?.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="font-medium">PDF warning</div>
              <div className="mt-1 whitespace-pre-wrap">{doc.error}</div>
            </div>
          )}

          {doc?.status === 'needs_review' && (
            <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Gate review</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 items-center">
                <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
                  Relevance gate marked this upload for admin review before extraction continues.
                </p>
                <Button size="sm" onClick={handleApproveGate} disabled={saving}>
                  Approve & continue
                </Button>
                <Button size="sm" variant="outline" onClick={handleRejectGate} disabled={saving}>
                  Reject
                </Button>
              </CardContent>
            </Card>
          )}

          {(doc?.supersedesDocumentId || doc?.supersededByDocumentId) && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Document version chain</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                {doc.supersedesDocumentId && (
                  <div>
                    Supersedes:{' '}
                    <Link
                      href={`/dashboard/admin/knowledge-docs/${doc.supersedesDocumentId}`}
                      className="text-primary font-mono text-xs hover:underline"
                    >
                      {doc.supersedesDocumentId}
                    </Link>
                  </div>
                )}
                {doc.supersededByDocumentId && (
                  <div>
                    Replaced by newer upload:{' '}
                    <Link
                      href={`/dashboard/admin/knowledge-docs/${doc.supersededByDocumentId}`}
                      className="text-primary font-mono text-xs hover:underline"
                    >
                      {doc.supersededByDocumentId}
                    </Link>
                  </div>
                )}
                {!doc.supersededByDocumentId && (
                  <div>
                    <Link
                      href={`/dashboard/admin/knowledge-docs?supersedes=${encodeURIComponent(doc.id)}`}
                      className="text-primary hover:underline"
                    >
                      Upload replacement PDF (same fingerprint allowed for this id)
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Official machine name</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Shown under the filename for admins and technicians. Leave accurate for search and support.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                <Input
                  value={officialName}
                  onChange={(e) => setOfficialName(e.target.value)}
                  placeholder="e.g. Trepak Capper 50C-0100"
                />
                <Button onClick={handleSaveOfficialName} disabled={savingOfficial}>
                  {savingOfficial ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {!doc?.machineName?.trim() && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Machine name suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Note when approving (optional)</Label>
                  <Textarea
                    rows={2}
                    value={rejectOthersReason}
                    onChange={(e) => setRejectOthersReason(e.target.value)}
                    placeholder="If you approve one suggestion, other pending suggestions are rejected with this message (or a default)."
                  />
                </div>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No suggestions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border/50 bg-card/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{s.proposedName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            By {s.suggestedBy?.fullName || s.suggestedBy?.email || '—'} •{' '}
                            {new Date(s.createdAt).toLocaleString()}
                          </div>
                          {s.rejectReason && (
                            <div className="text-xs text-muted-foreground mt-1">Reason: {s.rejectReason}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {s.status}
                          </Badge>
                          {s.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveSuggestion(s.id)}
                                disabled={saving}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectSuggestion(s.id)}
                                disabled={saving}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Chunks indexed</div>
                  <div className="text-lg font-semibold">{doc?.chunksIndexed ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Candidates extracted</div>
                  <div className="text-lg font-semibold">{counts.candidate + counts.approved + counts.rejected}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Approved</div>
                  <div className="text-lg font-semibold">{counts.approved}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground">Rejected</div>
                  <div className="text-lg font-semibold">{counts.rejected}</div>
                </div>
              </div>
              <div className="rounded-md bg-muted/30 border border-border/40 p-3 text-sm text-muted-foreground">
                Extraction should populate the candidates list shortly. If nothing appears, try Refresh.
              </div>
              <div className="rounded-md border border-border/40 p-3 text-sm">
                <div className="font-medium">Batch execution estimate</div>
                <div className="mt-1 text-muted-foreground">
                  {totalPagesForBatching > 0 ? (
                    <>
                      This manual is expected to run in <span className="font-semibold text-foreground">{estimatedBatchCount}</span>{' '}
                      batch(es): {totalPagesForBatching} page(s) / {docBatchPages} pages per batch.
                    </>
                  ) : (
                    <>Batch estimate will appear after page analysis is available.</>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Vision cap per batch: {visionMaxPerBatch} page(s).
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(doc?.status === 'failed' || doc?.status === 'partially_indexed') && (
                  <Button variant="default" size="sm" onClick={handleContinueExtraction} disabled={saving}>
                    Continue extraction
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleReindexManual} disabled={saving}>
                  Re-index manual RAG (Qdrant)
                </Button>
                <span className="text-xs text-muted-foreground">
                  Continue = resume after OpenRouter/OCR fail (no re-upload). Re-index = Qdrant only.
                </span>
              </div>
              {pageAnalysis.length > 0 && (
                <div className="rounded-md border border-border/40 p-3">
                  <div className="text-sm font-medium">Page quality (OCR scaffold)</div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <div>
                      Good:{' '}
                      {pageAnalysis.filter((p) => p.quality === 'good').length} • Degraded:{' '}
                      {pageAnalysis.filter((p) => p.quality === 'degraded').length} • Poor:{' '}
                      {pageAnalysis.filter((p) => p.quality === 'poor').length} • Unreadable:{' '}
                      {pageAnalysis.filter((p) => p.quality === 'unreadable').length}
                    </div>
                    {paginatedQualityRows.map((p) => (
                        <div key={p.id}>
                          Page {p.pageNumber}: {p.quality}
                          {typeof p.ocrConfidence === 'number'
                            ? ` (${Math.round(p.ocrConfidence * 100)}%)`
                            : ''}
                        </div>
                      ))}
                  </div>
                  {nonGoodPageRows.length > 0 && (
                    <div className="mt-2 flex items-center justify-between border-t border-border/30 pt-2">
                      <span className="text-xs text-muted-foreground">
                        Showing {qualityStartIndex}-{qualityEndIndex} of {nonGoodPageRows.length} pages
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentQualityPage <= 1}
                          onClick={() => setCurrentQualityPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {currentQualityPage}/{totalQualityPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentQualityPage >= totalQualityPages}
                          onClick={() =>
                            setCurrentQualityPage((p) => Math.min(totalQualityPages, p + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="my-3 h-px bg-border" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRunOcr} disabled={saving}>
                      Run OCR (VL pages)
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRunVision} disabled={saving}>
                      Run vision (Ollama)
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      OCR: Poppler + PaddleOCR-VL (GPU). Vision: ENABLE_PDF_VISION + llava:latest (or OLLAMA_VISION_MODEL).
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Pipeline data &amp; export (rapport / jury)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Load a full trace: <strong>before</strong> = page OCR/vision text in PostgreSQL;{' '}
                <strong>after</strong> = chunks in Qdrant. Download the{' '}
                <strong>Excel report</strong> for a readable multi-sheet file (summary, pages, search
                chunks, LLM extraction). After fixes, click <strong>Re-index manual RAG</strong> above.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={loadAuditReport} disabled={auditLoading}>
                  {auditLoading ? 'Loading…' : 'Load audit report'}
                </Button>
                <Button size="sm" variant="default" onClick={exportAuditExcel}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                  Excel report (.xlsx)
                </Button>
                <Button size="sm" variant="outline" onClick={exportAuditJson} disabled={!auditReport}>
                  <FileJson className="h-3.5 w-3.5 mr-1" />
                  JSON (full)
                </Button>
                <Button size="sm" variant="outline" onClick={exportPagesCsv} disabled={!auditReport}>
                  CSV pages
                </Button>
                <Button size="sm" variant="outline" onClick={exportQdrantCsv} disabled={!auditReport}>
                  CSV Qdrant
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/admin/rag-stored-data?documentId=${encodeURIComponent(id || '')}`}>
                    Global RAG viewer
                  </Link>
                </Button>
              </div>

              {auditReport && (
                <>
                  <div className="flex gap-2 border-b border-border/40 pb-2">
                    {(['summary', 'pages', 'qdrant'] as const).map((tab) => (
                      <Button
                        key={tab}
                        size="sm"
                        variant={auditTab === tab ? 'default' : 'ghost'}
                        onClick={() => setAuditTab(tab)}
                      >
                        {tab === 'summary' ? 'KPIs' : tab === 'pages' ? 'Pages (before)' : 'Qdrant (after)'}
                      </Button>
                    ))}
                  </div>

                  {auditTab === 'summary' && (
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-md border p-2">
                          <div className="text-xs text-muted-foreground">Vision effective</div>
                          <div className="font-semibold">
                            {auditReport.visionPreference.enabledEffective ? 'ON' : 'OFF'}
                          </div>
                        </div>
                        <div className="rounded-md border p-2">
                          <div className="text-xs text-muted-foreground">Pages with vision</div>
                          <div className="font-semibold">
                            {auditReport.metrics.pagesVisionUsed} / {auditReport.metrics.totalPages}
                          </div>
                        </div>
                        <div className="rounded-md border p-2">
                          <div className="text-xs text-muted-foreground">Bad Qdrant chunks (dots)</div>
                          <div className="font-semibold">{auditReport.metrics.ragMostlyDotsChunks}</div>
                        </div>
                        <div className="rounded-md border p-2">
                          <div className="text-xs text-muted-foreground">Admin approve rate</div>
                          <div className="font-semibold">
                            {auditReport.metrics.approvalRatePercent != null
                              ? `${auditReport.metrics.approvalRatePercent}%`
                              : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-3 text-xs">
                        <div>
                          Chunk filter: built {auditReport.chunkAudit.builtCount} → dedup{' '}
                          {auditReport.chunkAudit.afterNearDuplicateCount} → clean{' '}
                          {auditReport.chunkAudit.afterLowValueFilterCount} (drops TOC dot lines)
                        </div>
                        <div className="mt-1 text-muted-foreground">{auditReport.chunkAudit.note}</div>
                      </div>
                    </div>
                  )}

                  {auditTab === 'pages' && (
                    <div className="max-h-[420px] overflow-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Page</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Vision</TableHead>
                            <TableHead>Quality</TableHead>
                            <TableHead>OCR len</TableHead>
                            <TableHead>Poppler len</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditReport.pages.map((p) => (
                            <Fragment key={p.pageNumber}>
                              <TableRow>
                                <TableCell>{p.pageNumber}</TableCell>
                                <TableCell className="text-xs">{p.extractionMode}</TableCell>
                                <TableCell>{p.visionUsed ? 'yes' : 'no'}</TableCell>
                                <TableCell className="text-xs">{p.quality}</TableCell>
                                <TableCell>{p.ocrTextLength}</TableCell>
                                <TableCell>{p.popplerTextLength}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setExpandedPage(expandedPage === p.pageNumber ? null : p.pageNumber)
                                    }
                                  >
                                    {expandedPage === p.pageNumber ? 'Hide' : 'Text'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {expandedPage === p.pageNumber && (
                                <TableRow>
                                  <TableCell colSpan={7}>
                                    <div className="space-y-2 text-xs">
                                      <div>
                                        <span className="font-medium">OCR / VL text</span>
                                        <pre className="whitespace-pre-wrap max-h-40 overflow-auto bg-muted/20 p-2 rounded mt-1">
                                          {p.ocrText ||
                                            '(empty — run OCR with PaddleOCR-VL; Poppler-only text may still exist below)'}
                                        </pre>
                                      </div>
                                      {p.popplerTextLength > 0 && (
                                        <div>
                                          <span className="font-medium">Poppler text layer</span>
                                          <pre className="whitespace-pre-wrap max-h-32 overflow-auto bg-muted/10 p-2 rounded mt-1">
                                            {p.popplerTextPreview}
                                            {p.popplerTextLength > (p.popplerTextPreview?.length ?? 0) ? '…' : ''}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {auditTab === 'qdrant' && (
                    <div className="max-h-[420px] overflow-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Section</TableHead>
                            <TableHead>OK?</TableHead>
                            <TableHead>Preview</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditReport.ragChunks.slice(0, 200).map((c) => (
                            <TableRow key={c.chunkIndex}>
                              <TableCell>{c.chunkIndex}</TableCell>
                              <TableCell className="text-xs">{c.sectionType ?? '—'}</TableCell>
                              <TableCell>
                                {c.quality.mostlyDots ? (
                                  <Badge variant="destructive">dots</Badge>
                                ) : (
                                  <Badge variant="default">ok</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs max-w-md truncate">{c.textPreview}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Extracted Problem → Solution items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Solution</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          No extraction results yet. Refresh after a minute.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedExtractions.map((c) => (
                      <TableRow key={c.id} className="align-top">
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">{c.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Type: {c.entryType || '—'} • Section: {c.sectionType || '—'} • Confidence:{' '}
                            {typeof c.confidence === 'number'
                              ? `${Math.round(c.confidence * 100)}%`
                              : '—'}
                          </div>
                          {c.sourcePages && (
                            <div className="text-[11px] text-muted-foreground">
                              Source pages: {c.sourcePages}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 90 }}>
                            {c.problemDescription}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 90 }}>
                            {c.solution}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <div className="space-y-2">
                            <Badge variant={extractionStatusVariant(c.status) as any} className="text-xs capitalize">
                              {c.status}
                            </Badge>
                            {c.status === 'candidate' && (
                              <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditModal(c)} disabled={saving} className="gap-2">
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleReject(c)} disabled={saving}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {extractions.length > 0 && (
                <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
                  <span className="text-xs text-muted-foreground">
                    Showing {startIndex}-{endIndex} of {extractions.length} items
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
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/admin/knowledge-docs">Back to library</Link>
            </Button>
          </div>
        </div>

        {modalOpen && editingCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Edit candidate</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)} aria-label="Close edit modal">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Problem description</Label>
                    <Textarea rows={6} value={form.problemDescription} onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Solution</Label>
                    <Textarea rows={8} value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (comma separated)</Label>
                    <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleApprove} disabled={saving} className="flex-1">
                      {saving ? 'Approving…' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

