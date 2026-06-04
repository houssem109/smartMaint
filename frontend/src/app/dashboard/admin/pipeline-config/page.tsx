'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type PipelineConfig = {
  checkedAt: string;
  pdfUpload: {
    maxBytes: number;
    uploadDir: string;
  };
  gate: {
    tier1AcceptAbove: number;
    tier1RejectBelow: number;
    tier2WorkSimMin: number;
    tier2NonWorkSimMin: number;
    tier2PageCount: number;
    heuristicPageCount: number;
    llmCharLimit: number;
    gateModel: string | null;
  };
  ocr: {
    enabled: boolean;
    maxPagesPerDocument: number;
    manualMaxPages: number;
    autoReindex: boolean;
    inlineBeforeIndex: boolean;
    renderDpi: number;
    skipSharpPreprocess: boolean;
    isVl: boolean;
    engine: string;
    paddleOcrUrl: string;
    pdftoppmPath: string;
  };
  vision: {
    enabled: boolean;
    enabledFromEnv: boolean;
    adminToggleOn: boolean;
    maxPages: number;
    maxPagesPerBatch: number;
    docBatchPages: number;
    figureVisionEnabled: boolean;
    triggerOcrConfidenceBelow: number;
    minOcrTextChars: number;
    pageExplainBeforeIndex?: boolean;
    pageExplainMaxPages?: number;
  };
  fieldPhotos?: { visionEnabled: boolean };
  extraction: {
    maxChunks: number;
    maxCandidatesTotal: number;
    maxCandidatesPerChunk: number;
    chunkSize: number;
    overlap: number;
  };
  ollama: { baseUrl: string; chatModel: string; embedModel: string; visionModel: string };
  qdrant: { url: string; collection: string };
  chatWidget: { enableImageVision: boolean };
  bullJobs: { removeOnComplete: number; removeOnFail: number };
};

function fmtBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KiB`;
  return `${n} B`;
}

function KeyVal({ k, v }: { k: string; v: string | number | boolean | null }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground min-w-[200px]">{k}</span>
      <span className="font-mono text-xs break-all">{v === null ? '—' : String(v)}</span>
    </div>
  );
}

export default function PipelineConfigPage() {
  const [cfg, setCfg] = useState<PipelineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [visionSaving, setVisionSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PipelineConfig>('/knowledge-documents/pipeline-config');
      setCfg(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load pipeline config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchPdfVisionAdmin = async (enabled: boolean) => {
    if (!cfg?.vision.enabledFromEnv && enabled) {
      toast.error('Set ENABLE_PDF_VISION=true in server .env and restart the API first.');
      return;
    }
    setVisionSaving(true);
    try {
      const res = await api.patch<{
        pdfVisionAdminEnabled: boolean;
        enabledFromEnv: boolean;
        enabledEffective: boolean;
      }>('/knowledge-documents/pipeline-preferences/pdf-vision', { enabled });
      setCfg((c) =>
        c
          ? {
              ...c,
              vision: {
                ...c.vision,
                enabled: res.data.enabledEffective,
                enabledFromEnv: res.data.enabledFromEnv,
                adminToggleOn: res.data.pdfVisionAdminEnabled,
              },
            }
          : c,
      );
      toast.success(enabled ? 'PDF vision enabled for new processing' : 'PDF vision disabled');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update PDF vision toggle');
    } finally {
      setVisionSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Pipeline environment" showSidebar={true}>
        <div className="space-y-6 max-w-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Pipeline environment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Effective values for PDF ingestion, gate, OCR, vision, extraction, RAG, and chat image vision.
                Most knobs come from <code className="text-xs">.env</code> (restart API to apply). The{' '}
                <span className="font-medium text-foreground">PDF vision</span> card below includes a live admin toggle
                (stored in the database).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && !cfg && <p className="text-sm text-destructive">Could not load configuration.</p>}

          {cfg && (
            <>
              <p className="text-xs text-muted-foreground">Snapshot: {new Date(cfg.checkedAt).toLocaleString()}</p>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">PDF upload</CardTitle>
                  <CardDescription>Storage limits (relative paths are under the API process cwd)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="KNOWLEDGE_PDF_MAX_BYTES (effective)" v={fmtBytes(cfg.pdfUpload.maxBytes)} />
                  <KeyVal k="KNOWLEDGE_PDF_UPLOAD_DIR" v={cfg.pdfUpload.uploadDir} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Upload gate</CardTitle>
                  <CardDescription>From gate.config.ts — Tier 1/2/3 tuning</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="GATE_TIER1_ACCEPT_ABOVE" v={cfg.gate.tier1AcceptAbove} />
                  <KeyVal k="GATE_TIER1_REJECT_BELOW" v={cfg.gate.tier1RejectBelow} />
                  <KeyVal k="GATE_TIER2_WORK_SIM_MIN" v={cfg.gate.tier2WorkSimMin} />
                  <KeyVal k="GATE_TIER2_NONWORK_SIM_MIN" v={cfg.gate.tier2NonWorkSimMin} />
                  <KeyVal k="GATE_TIER2_PAGE_COUNT" v={cfg.gate.tier2PageCount} />
                  <KeyVal k="GATE_HEURISTIC_PAGE_COUNT" v={cfg.gate.heuristicPageCount} />
                  <KeyVal k="GATE_LLM_CHAR_LIMIT" v={cfg.gate.llmCharLimit} />
                  <KeyVal k="OLLAMA_GATE_MODEL (optional)" v={cfg.gate.gateModel} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">OCR (PaddleOCR-VL + GPU)</CardTitle>
                  <CardDescription>
                    Poppler renders pages to PNG; <code className="text-xs">paddle-ocr</code> runs PaddleOCR-VL on your
                    NVIDIA GPU. Rebuild:{' '}
                    <code className="text-xs">docker compose up -d --build paddle-ocr</code>. Check GPU:{' '}
                    <code className="text-xs">http://localhost:8008/gpu-check</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="ENABLE_PDF_OCR" v={cfg.ocr.enabled} />
                  <KeyVal k="PADDLE_OCR_ENGINE" v={cfg.ocr.engine} />
                  <KeyVal k="VL mode (isVl)" v={cfg.ocr.isVl} />
                  <KeyVal k="PDF_OCR_MAX_PAGES (auto)" v={cfg.ocr.maxPagesPerDocument} />
                  <KeyVal k="PDF_OCR_MANUAL_MAX_PAGES (0=all)" v={cfg.ocr.manualMaxPages} />
                  <KeyVal k="PDF_OCR_AUTO_REINDEX" v={cfg.ocr.autoReindex} />
                  <KeyVal k="PDF_OCR_INLINE_BEFORE_INDEX" v={cfg.ocr.inlineBeforeIndex} />
                  <KeyVal k="PDF_OCR_RENDER_DPI" v={cfg.ocr.renderDpi} />
                  <KeyVal k="PDF_OCR_SKIP_SHARP_PREPROCESS" v={cfg.ocr.skipSharpPreprocess} />
                  <KeyVal k="PADDLE_OCR_URL" v={cfg.ocr.paddleOcrUrl} />
                  <KeyVal k="PDFTOPPM_PATH (default)" v={cfg.ocr.pdftoppmPath} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">PDF vision</CardTitle>
                  <CardDescription>
                    Pull a multimodal model on the Ollama host first (e.g.{' '}
                    <code className="text-xs">ollama pull llava</code>). The effective tag is{' '}
                    <code className="text-xs">OLLAMA_VISION_MODEL</code> (defaults to{' '}
                    <code className="text-xs">llava:latest</code>
                    ).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-sm ${
                      !cfg.vision.enabledFromEnv ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border border-input"
                      checked={cfg.vision.adminToggleOn}
                      disabled={visionSaving || !cfg.vision.enabledFromEnv}
                      onChange={(e) => void patchPdfVisionAdmin(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-foreground">Run PDF vision (Ollama)</span>
                      <span className="block text-muted-foreground mt-0.5">
                        Turn off for text-only PDFs (no diagrams). Still requires{' '}
                        <code className="text-xs">ENABLE_PDF_VISION=true</code> in .env. Effective now:{' '}
                        <span className="font-mono">{String(cfg.vision.enabled)}</span> (env{' '}
                        <span className="font-mono">{String(cfg.vision.enabledFromEnv)}</span> × admin{' '}
                        <span className="font-mono">{String(cfg.vision.adminToggleOn)}</span>).
                      </span>
                    </span>
                  </label>
                  <KeyVal k="ENABLE_PDF_VISION (env)" v={cfg.vision.enabledFromEnv} />
                  <KeyVal k="Vision effective (env × admin)" v={cfg.vision.enabled} />
                  <KeyVal k="PDF_VISION_MAX_PAGES" v={cfg.vision.maxPages} />
                  <KeyVal k="PDF_VISION_MAX_PAGES_PER_BATCH (effective)" v={cfg.vision.maxPagesPerBatch} />
                  <KeyVal k="DOC_BATCH_PAGES (effective)" v={cfg.vision.docBatchPages} />
                  <KeyVal k="ENABLE_FIGURE_VISION (effective)" v={cfg.vision.figureVisionEnabled} />
                  <KeyVal k="PDF_VISION_TRIGGER_OCR_CONFIDENCE_BELOW" v={cfg.vision.triggerOcrConfidenceBelow} />
                  <KeyVal k="PDF_VISION_MIN_OCR_TEXT_CHARS" v={cfg.vision.minOcrTextChars} />
                  <KeyVal k="PDF_PAGE_EXPLAIN_BEFORE_INDEX" v={cfg.vision.pageExplainBeforeIndex ?? true} />
                  <KeyVal k="PDF_PAGE_EXPLAIN_MAX_PAGES" v={cfg.vision.pageExplainMaxPages ?? 150} />
                  <KeyVal k="OLLAMA_VISION_MODEL (effective)" v={cfg.ollama.visionModel} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Field photos (technician entries)</CardTitle>
                  <CardDescription>
                    On photo upload, vision writes <code className="text-xs">photoVisionDescription</code> for Qdrant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="ENABLE_FIELD_PHOTO_VISION" v={cfg.fieldPhotos?.visionEnabled ?? true} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Structured extraction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="DOC_EXTRACTION_MAX_CHUNKS" v={cfg.extraction.maxChunks} />
                  <KeyVal k="DOC_EXTRACTION_MAX_CANDIDATES" v={cfg.extraction.maxCandidatesTotal} />
                  <KeyVal k="DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK" v={cfg.extraction.maxCandidatesPerChunk} />
                  <KeyVal k="DOC_EXTRACTION_CHUNK_SIZE" v={cfg.extraction.chunkSize} />
                  <KeyVal k="DOC_EXTRACTION_CHUNK_OVERLAP" v={cfg.extraction.overlap} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ollama, Qdrant, Techo chat</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="OLLAMA_BASE_URL" v={cfg.ollama.baseUrl} />
                  <KeyVal k="OLLAMA_MODEL (chat / extraction LLM default)" v={cfg.ollama.chatModel} />
                  <KeyVal k="OLLAMA_EMBED_MODEL" v={cfg.ollama.embedModel} />
                  <KeyVal k="QDRANT_URL" v={cfg.qdrant.url} />
                  <KeyVal k="QDRANT_COLLECTION" v={cfg.qdrant.collection} />
                  <KeyVal k="ENABLE_CHAT_IMAGE_VISION" v={cfg.chatWidget.enableImageVision} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Bull jobs</CardTitle>
                  <CardDescription>Hard-coded on queue.add today</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <KeyVal k="removeOnComplete" v={cfg.bullJobs.removeOnComplete} />
                  <KeyVal k="removeOnFail" v={cfg.bullJobs.removeOnFail} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
