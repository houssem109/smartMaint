import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { KnowledgeExtractionTechReview } from './entities/knowledge-extraction-tech-review.entity';
import { MachineNameSuggestion } from './entities/machine-name-suggestion.entity';
import { KnowledgeDocumentPageAnalysis } from './entities/knowledge-document-page-analysis.entity';
import { KnowledgeDocumentJob } from './entities/knowledge-document-job.entity';
import { PipelinePreferences } from './entities/pipeline-preferences.entity';
import { ExtractionFeedbackEvent } from './entities/extraction-feedback-event.entity';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { getOllamaVisionModel } from '../ai/ollama-vision.util';
import { DocumentChunkRowMeta, RagService } from '../ai/rag.service';
import { AuditLog, ActionType } from '../common/entities/audit-log.entity';
import { join, resolve } from 'path';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, readdirSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Queue } from 'bull';
import { createHash } from 'crypto';
import sharp from 'sharp';
import {
  EXTRACTION_JOB,
  EXTRACTION_QUEUE,
  GATE_JOB,
  GATE_QUEUE,
  INDEXING_JOB,
  INDEXING_QUEUE,
  OCR_JOB,
  OCR_QUEUE,
  VISION_JOB,
  VISION_QUEUE,
} from './queues.constants';
import { MachineProfilesService } from '../machine-profiles/machine-profiles.service';
import { DocumentProgressGateway } from './document-progress.gateway';
import { UserRole } from '../users/entities/user.entity';
import { getKnowledgePdfMaxBytes, getKnowledgePdfUploadDir } from './pdf-ingestion.config';
import { assertValidPdfForIngestion } from './pdf-ingestion.util';
import {
  getOcrRenderDpi,
  getPaddleOcrUrl,
  getPdfOcrManualMaxPages,
  getPdfOcrMaxPagesAuto,
  isPaddleOcrVl,
  isPdfOcrAutoReindexEnabled,
  isPdfOcrInlineBeforeIndexEnabled,
  runOcrOnPng,
  shouldSkipSharpPreprocess,
} from './pdf-ocr.util';
import {
  getGateHeuristicPageCount,
  getGateLlmCharLimit,
  getGateTier1AcceptAbove,
  getGateTier1RejectBelow,
  getGateTier2NonWorkSimMin,
  getGateTier2PageCount,
  getGateTier2WorkSimMin,
  getOllamaGateModel,
} from './gate.config';
import {
  getPdfVisionMaxPages,
  getVisionMinOcrTextChars,
  getVisionTriggerOcrConfidenceBelow,
  isPdfVisionEnabled,
} from './pdf-vision.config';
import {
  buildPageExplanationVisionPrompt,
  getPdfPageExplanationMaxPages,
  getPdfPageExplanationMode,
  isPdfPageExplanationBeforeIndexEnabled,
} from './page-explanation.config';
import { parsePdfWithPoppler } from './pdf-text.util';
import { chunkQualityFlags, isLowValueChunkText } from './pdf-chunk-quality.util';
import {
  extractVisionPreferredPageText,
  formatPageChunkPrefix,
  isDiagramHeavyDocument,
  shouldReplacePageTextWithVision,
  shouldSkipPopplerOnlyForRow,
} from './pdf-page-index-text.util';
import {
  buildPipelineAuditExcelBuffer,
  pipelineAuditExcelFilename,
} from './pipeline-audit-export.util';

const execFileAsync = promisify(execFile);

function safeUnlinkUpload(path: string | undefined | null): void {
  if (!path) return;
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // ignore
  }
}

@Injectable()
export class KnowledgeDocumentsService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeDocumentsService.name);
  private workProfileEmbedding: number[] | null = null;
  private nonWorkProfileEmbedding: number[] | null = null;
  /** Admin UI toggle (DB). Effective vision = this AND {@link isPdfVisionEnabled} env. */
  private pdfVisionAdminEnabled = true;

  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocumentsRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeExtractionCandidate)
    private readonly extractionCandidatesRepository: Repository<KnowledgeExtractionCandidate>,
    @InjectRepository(KnowledgeExtractionTechReview)
    private readonly extractionTechReviewsRepository: Repository<KnowledgeExtractionTechReview>,
    @InjectRepository(MachineNameSuggestion)
    private readonly machineNameSuggestionsRepository: Repository<MachineNameSuggestion>,
    @InjectRepository(KnowledgeDocumentPageAnalysis)
    private readonly pageAnalysisRepository: Repository<KnowledgeDocumentPageAnalysis>,
    @InjectRepository(KnowledgeDocumentJob)
    private readonly knowledgeDocumentJobRepository: Repository<KnowledgeDocumentJob>,
    @InjectRepository(ExtractionFeedbackEvent)
    private readonly extractionFeedbackRepository: Repository<ExtractionFeedbackEvent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(KnowledgeEntry)
    private readonly knowledgeEntryRepository: Repository<KnowledgeEntry>,
    @InjectRepository(PipelinePreferences)
    private readonly pipelinePreferencesRepository: Repository<PipelinePreferences>,
    @InjectQueue(GATE_QUEUE)
    private readonly gateQueue: Queue,
    @InjectQueue(EXTRACTION_QUEUE)
    private readonly extractionQueue: Queue,
    @InjectQueue(INDEXING_QUEUE)
    private readonly indexingQueue: Queue,
    @InjectQueue(OCR_QUEUE)
    private readonly ocrQueue: Queue,
    @InjectQueue(VISION_QUEUE)
    private readonly visionQueue: Queue,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly machineProfilesService: MachineProfilesService,
    private readonly documentProgressGateway: DocumentProgressGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadPdfVisionAdminPreference();
  }

  private async loadPdfVisionAdminPreference(): Promise<void> {
    try {
      let row = await this.pipelinePreferencesRepository.findOne({
        where: { id: PipelinePreferences.SINGLETON_ID },
      });
      if (!row) {
        row = this.pipelinePreferencesRepository.create({
          id: PipelinePreferences.SINGLETON_ID,
          pdfVisionEnabled: true,
        });
        await this.pipelinePreferencesRepository.save(row);
      }
      this.pdfVisionAdminEnabled = row.pdfVisionEnabled;
    } catch (e: any) {
      this.logger.warn(
        `Could not load pipeline_preferences (vision toggle); defaulting admin vision ON: ${e?.message ?? e}`,
      );
      this.pdfVisionAdminEnabled = true;
    }
  }

  /** True when env allows vision AND admin toggle is on (DB). */
  private isEffectivePdfVision(): boolean {
    return isPdfVisionEnabled() && this.pdfVisionAdminEnabled;
  }

  getPdfVisionPreferenceReadModel(): {
    pdfVisionAdminEnabled: boolean;
    enabledFromEnv: boolean;
    enabledEffective: boolean;
  } {
    return {
      pdfVisionAdminEnabled: this.pdfVisionAdminEnabled,
      enabledFromEnv: isPdfVisionEnabled(),
      enabledEffective: this.isEffectivePdfVision(),
    };
  }

  async setPdfVisionAdminEnabled(enabled: boolean, userId: string): Promise<{
    pdfVisionAdminEnabled: boolean;
    enabledFromEnv: boolean;
    enabledEffective: boolean;
  }> {
    if (enabled && !isPdfVisionEnabled()) {
      throw new BadRequestException(
        'Cannot turn PDF vision on: set ENABLE_PDF_VISION=true in server environment and restart the API.',
      );
    }
    let row = await this.pipelinePreferencesRepository.findOne({
      where: { id: PipelinePreferences.SINGLETON_ID },
    });
    if (!row) {
      row = this.pipelinePreferencesRepository.create({
        id: PipelinePreferences.SINGLETON_ID,
        pdfVisionEnabled: true,
      });
    }
    row.pdfVisionEnabled = enabled;
    row.updatedById = userId;
    await this.pipelinePreferencesRepository.save(row);
    this.pdfVisionAdminEnabled = enabled;
    return this.getPdfVisionPreferenceReadModel();
  }

  async createFromUpload(params: {
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    uploadedById: string;
  }): Promise<KnowledgeDocument> {
    const doc = this.knowledgeDocumentsRepository.create({
      ...params,
      status: 'uploaded',
      error: null,
      docType: null,
      isWorkRelated: null,
      gateConfidence: null,
      deepMode: true,
      needsReview: false,
      totalPages: 0,
      pagesProcessed: 0,
      lastProcessedPage: 0,
      progressPercent: 0,
      currentStage: 'uploaded',
      fingerprint: null,
    });
    return this.knowledgeDocumentsRepository.save(doc);
  }

  async ingestAndQueue(params: {
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    uploadedById: string;
    /** When fingerprint matches this document, ingest is allowed and clears that row’s fingerprint (11). */
    supersedesDocumentId?: string | null;
  }): Promise<{ document: KnowledgeDocument; jobId: string }> {
    const maxBytes = getKnowledgePdfMaxBytes();
    let fileBuffer: Buffer;
    try {
      fileBuffer = readFileSync(params.filePath);
    } catch {
      throw new BadRequestException('Uploaded file could not be read');
    }

    try {
      assertValidPdfForIngestion(fileBuffer, maxBytes);
    } catch (e) {
      safeUnlinkUpload(params.filePath);
      throw e;
    }

    let parsed: any;
    try {
      parsed = await parsePdfWithPoppler(fileBuffer);
    } catch {
      safeUnlinkUpload(params.filePath);
      throw new BadRequestException('Invalid or corrupted PDF (parse failed)');
    }
    const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
    const totalPages = Number(parsed?.numpages ?? 0) || 0;

    // Fingerprint based on first five page-equivalent text slices.
    const pages = this.derivePageTexts(parsed, fullText);
    const firstFive = pages.slice(0, 5).join('\n\f\n');
    const fingerprint = createHash('sha256').update(firstFive || fullText.slice(0, 10000)).digest('hex');

    const supersedeId = params.supersedesDocumentId?.trim() || null;
    if (supersedeId) {
      const predecessor = await this.knowledgeDocumentsRepository.findOne({ where: { id: supersedeId } });
      if (!predecessor) {
        safeUnlinkUpload(params.filePath);
        throw new BadRequestException('supersedesDocumentId does not reference an existing document');
      }
      if (predecessor.supersededByDocumentId) {
        safeUnlinkUpload(params.filePath);
        throw new BadRequestException(
          'That document is already superseded; point supersedesDocumentId at the latest active revision.',
        );
      }
    }

    const duplicate = await this.knowledgeDocumentsRepository.findOne({
      where: { fingerprint },
      order: { createdAt: 'DESC' },
    });
    if (duplicate) {
      if (!supersedeId || duplicate.id !== supersedeId) {
        safeUnlinkUpload(params.filePath);
        throw new BadRequestException(`Duplicate document detected (existing id: ${duplicate.id})`);
      }
      await this.knowledgeDocumentsRepository.update({ id: supersedeId }, { fingerprint: null });
    }

    const dupAfterClear = await this.knowledgeDocumentsRepository.findOne({
      where: { fingerprint },
      order: { createdAt: 'DESC' },
    });
    if (dupAfterClear && (!supersedeId || dupAfterClear.id !== supersedeId)) {
      safeUnlinkUpload(params.filePath);
      throw new BadRequestException(
        'Fingerprint conflict with another document. Use supersedesDocumentId only for the exact duplicate row.',
      );
    }

    const doc = await this.knowledgeDocumentsRepository.save(
      this.knowledgeDocumentsRepository.create({
        fileName: params.fileName,
        originalName: params.originalName,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
        filePath: params.filePath,
        uploadedById: params.uploadedById,
        supersedesDocumentId: supersedeId,
        status: 'uploaded',
        error: null,
        docType: null,
        isWorkRelated: null,
        gateConfidence: null,
        deepMode: true,
        needsReview: false,
        totalPages,
        pagesProcessed: 0,
        lastProcessedPage: 0,
        progressPercent: 0,
        currentStage: 'uploaded',
        fingerprint,
      }),
    );

    if (supersedeId) {
      await this.knowledgeDocumentsRepository.update(
        { id: supersedeId },
        { supersededByDocumentId: doc.id, status: 'superseded' },
      );
      try {
        await this.ragService.purgeManualIndexForDocument(supersedeId);
      } catch (e) {
        this.logger.warn(
          `RAG purge after supersede failed for ${supersedeId}: ${(e as Error).message}`,
        );
      }
    }

    const tracking = await this.knowledgeDocumentJobRepository.save(
      this.knowledgeDocumentJobRepository.create({
        documentId: doc.id,
        queueName: GATE_QUEUE,
        jobType: GATE_JOB,
        status: 'queued',
        progressPercent: 0,
        error: null,
        bullJobId: null,
      }),
    );

    const bullJob = await this.gateQueue.add(
      GATE_JOB,
      { documentId: doc.id, trackingJobId: tracking.id },
      { removeOnComplete: 100, removeOnFail: 100 },
    );

    tracking.bullJobId = String(bullJob.id);
    await this.knowledgeDocumentJobRepository.save(tracking);

    await this.updateProgress(doc.id, {
      currentStage: 'queued',
      progressPercent: 1,
      totalPages,
      pagesProcessed: 0,
      lastProcessedPage: 0,
    });

    return { document: doc, jobId: tracking.id };
  }

  async findAll(opts?: {
    includeSuperseded?: boolean;
    uploadedById?: string;
  }): Promise<KnowledgeDocument[]> {
    const where: Record<string, unknown> = opts?.includeSuperseded
      ? {}
      : { status: Not('superseded') };
    if (opts?.uploadedById) {
      where.uploadedById = opts.uploadedById;
    }
    return this.knowledgeDocumentsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['uploadedBy'],
    });
  }

  async findOne(id: string): Promise<KnowledgeDocument> {
    const doc = await this.knowledgeDocumentsRepository.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async getExtractionsForDocument(documentId: string): Promise<KnowledgeExtractionCandidate[]> {
    await this.findOne(documentId); // ensure exists
    const rows = await this.extractionCandidatesRepository
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.techReviews', 'techReview')
      .leftJoinAndSelect('techReview.technician', 'technician')
      .leftJoinAndSelect('candidate.reviewedBy', 'reviewedBy')
      .where('candidate.documentId = :documentId', { documentId })
      .orderBy('candidate.createdAt', 'DESC')
      .addOrderBy('techReview.createdAt', 'ASC')
      .getMany();

    for (const row of rows) {
      if (row.techReviews?.length) {
        row.techReviews.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      }
    }

    return rows;
  }

  async submitTechExtractionReview(
    candidateId: string,
    technicianId: string,
    payload: {
      action: 'approve' | 'approve_edit' | 'reject';
      title?: string;
      problemDescription?: string;
      solution?: string;
      reason?: string;
    },
  ): Promise<KnowledgeExtractionTechReview> {
    const candidate = await this.extractionCandidatesRepository.findOne({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Extraction candidate not found');
    if (candidate.status !== 'candidate') {
      throw new BadRequestException('This suggestion was already finalized by an admin');
    }

    const existing = await this.extractionTechReviewsRepository.findOne({
      where: { candidateId, technicianId },
    });
    if (existing) {
      throw new BadRequestException('You already reviewed this suggestion');
    }

    const action = payload.action;
    let editedTitle: string | null = null;
    let editedProblemDescription: string | null = null;
    let editedSolution: string | null = null;
    let rejectReason: string | null = null;

    if (action === 'approve_edit') {
      const title = payload.title?.trim();
      const problemDescription = payload.problemDescription?.trim();
      const solution = payload.solution?.trim();
      if (!title || !problemDescription || !solution) {
        throw new BadRequestException('Title, problem, and solution are required when editing');
      }
      editedTitle = title;
      editedProblemDescription = problemDescription;
      editedSolution = solution;
    } else if (action === 'reject') {
      rejectReason = payload.reason?.trim() || null;
    }

    const review = await this.extractionTechReviewsRepository.save(
      this.extractionTechReviewsRepository.create({
        candidateId,
        technicianId,
        action,
        editedTitle,
        editedProblemDescription,
        editedSolution,
        rejectReason,
      }),
    );

    const doc = await this.knowledgeDocumentsRepository.findOne({ where: { id: candidate.documentId } });
    const withRelations = await this.extractionTechReviewsRepository.findOne({
      where: { id: review.id },
      relations: ['technician', 'candidate'],
    });
    const techUser = withRelations?.technician;
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.UPDATE,
        entityType: 'knowledge_extraction_candidate',
        entityId: candidate.id,
        userId: technicianId,
        changes: {
          event: 'extraction_candidate_tech_reviewed',
          techReviewId: review.id,
          techReviewStatus: action,
          documentId: candidate.documentId,
          documentOriginalName: doc?.originalName ?? null,
          techReviewerName: techUser?.fullName?.trim() || techUser?.email || null,
          title: candidate.title,
        },
        reason: payload.reason?.trim() || null,
      }),
    );

    return withRelations as KnowledgeExtractionTechReview;
  }

  async getExtractionStats(documentId: string): Promise<{
    extractedCandidates: number;
    approvedCandidates: number;
    rejectedCandidates: number;
  }> {
    // Ensure the document exists (throws NotFoundException if missing)
    await this.findOne(documentId);

    const extractedCandidates = await this.extractionCandidatesRepository.count({ where: { documentId } });
    const approvedCandidates = await this.extractionCandidatesRepository.count({
      where: { documentId, status: 'approved' },
    });
    const rejectedCandidates = await this.extractionCandidatesRepository.count({
      where: { documentId, status: 'rejected' },
    });

    return { extractedCandidates, approvedCandidates, rejectedCandidates };
  }

  async getPageAnalysis(documentId: string): Promise<KnowledgeDocumentPageAnalysis[]> {
    await this.findOne(documentId);
    return this.pageAnalysisRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
  }

  async getRagStoredData(documentId: string, limit = 120): Promise<{
    documentId: string;
    chunkCount: number;
    chunks: Awaited<ReturnType<RagService['listDocumentChunks']>>;
  }> {
    await this.findOne(documentId);
    const chunks = await this.ragService.listDocumentChunks(documentId, limit);
    return { documentId, chunkCount: chunks.length, chunks };
  }

  async getRagStoredDataGlobal(limit = 400, documentId?: string): Promise<{
    count: number;
    rows: Array<
      Awaited<ReturnType<RagService['listAllDocumentChunks']>>[number] & {
        originalName: string | null;
      }
    >;
  }> {
    const chunks = await this.ragService.listAllDocumentChunks(limit, documentId);
    const docIds = [...new Set(chunks.map((c) => c.documentId).filter(Boolean))];
    const docs = docIds.length
      ? await this.knowledgeDocumentsRepository.find({
          where: { id: In(docIds) },
          select: ['id', 'originalName'],
        })
      : [];
    const docName = new Map(docs.map((d) => [d.id, d.originalName]));
    const rows = chunks.map((c) => ({
      ...c,
      originalName: docName.get(c.documentId) ?? null,
    }));
    return { count: rows.length, rows };
  }

  /**
   * Full trace for admin reports: per-page OCR/vision text, Qdrant payloads, chunk audit, KPIs.
   */
  async getPipelineAuditReport(documentId: string, ragLimit = 2000): Promise<{
    generatedAt: string;
    document: KnowledgeDocument;
    status: Awaited<ReturnType<KnowledgeDocumentsService['getDocumentStatus']>>;
    extractionStats: Awaited<ReturnType<KnowledgeDocumentsService['getExtractionStats']>>;
    visionPreference: ReturnType<KnowledgeDocumentsService['getPdfVisionPreferenceReadModel']>;
    pipelineConfig: ReturnType<KnowledgeDocumentsService['getPipelineConfigSnapshot']>;
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
      title: string | null;
      confidence: number | null;
      textPreview: string;
      text: string;
      quality: ReturnType<typeof chunkQualityFlags>;
    }>;
    chunkAudit: {
      builtCount: number;
      afterNearDuplicateCount: number;
      afterLowValueFilterCount: number;
      droppedLowValueSamples: Array<{ index: number; preview: string; reason: string }>;
      note: string;
    };
  }> {
    const doc = await this.findOne(documentId);
    const status = await this.getDocumentStatus(documentId);
    const extractionStats = await this.getExtractionStats(documentId);
    const pageRows = await this.getPageAnalysis(documentId);
    const rag = await this.getRagStoredData(documentId, ragLimit);
    const popplerPageTexts = await this.loadPopplerPageTextsForDocument(doc);

    const pagesByExtractionMode: Record<string, number> = {};
    const pagesByQuality: Record<string, number> = { good: 0, degraded: 0, poor: 0, unreadable: 0 };
    let pagesWithOcrText = 0;
    let pagesVisionUsed = 0;
    let visionFailedPages = 0;

    const pages = pageRows.map((row) => {
      const mode = row.extractionMode || 'text';
      pagesByExtractionMode[mode] = (pagesByExtractionMode[mode] ?? 0) + 1;
      pagesByQuality[row.quality] = (pagesByQuality[row.quality] ?? 0) + 1;
      const ocrText = row.ocrText ?? null;
      if (ocrText && ocrText.trim().length > 0) pagesWithOcrText += 1;
      if (row.visionUsed) pagesVisionUsed += 1;
      const warnings = row.qualityWarnings ?? [];
      if (warnings.some((w) => String(w).includes('vision_model_failed') || String(w).includes('vision_render_failed'))) {
        visionFailedPages += 1;
      }
      const previewLen = 280;
      const popplerText = popplerPageTexts[row.pageNumber - 1] ?? '';
      return {
        pageNumber: row.pageNumber,
        quality: row.quality,
        extractionMode: mode,
        visionUsed: row.visionUsed,
        ocrConfidence: row.ocrConfidence,
        sectionType: row.sectionType,
        qualityWarnings: warnings.length > 0 ? warnings : null,
        ocrTextLength: ocrText?.length ?? 0,
        popplerTextLength: popplerText.length,
        ocrTextPreview: ocrText ? ocrText.slice(0, previewLen) : '',
        popplerTextPreview: popplerText ? popplerText.slice(0, previewLen) : '',
        ocrText,
        hasVisionBlock: !!ocrText?.includes('--- Vision description ---'),
      };
    });

    const ragChunks = rag.chunks.map((c) => {
      const quality = chunkQualityFlags(c.text);
      return {
        chunkIndex: c.chunkIndex,
        sectionType: c.sectionType ?? null,
        title: c.title ?? null,
        confidence: c.confidence ?? null,
        textPreview: c.text.slice(0, 200),
        text: c.text,
        quality,
      };
    });
    const ragMostlyDotsChunks = ragChunks.filter((c) => c.quality.mostlyDots).length;

    let chunkAudit = {
      builtCount: 0,
      afterNearDuplicateCount: 0,
      afterLowValueFilterCount: 0,
      droppedLowValueSamples: [] as Array<{ index: number; preview: string; reason: string }>,
      note: 'Rebuilds routing from stored page_analysis + Poppler text (same logic as re-index).',
    };
    try {
      const fileBuffer = readFileSync(doc.filePath);
      const parsed: any = await parsePdfWithPoppler(fileBuffer);
      const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
      const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
      const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);
      const built = await this.buildRoutedChunks(doc.id, fullText, chunkSize, overlap);
      const prioritized = this.prioritizeChunksForExtraction(built, doc.docType ?? 'general_reference');
      const deduped = this.filterNearDuplicateChunks(prioritized);
      const cleaned = this.filterEmbedWorthyChunks(deduped);
      const dropped: Array<{ index: number; preview: string; reason: string }> = [];
      for (let i = 0; i < deduped.length; i++) {
        if (!cleaned.includes(deduped[i])) {
          dropped.push({
            index: i,
            preview: deduped[i].slice(0, 120),
            reason: 'mostly_dots_or_separators',
          });
        }
      }
      chunkAudit = {
        builtCount: built.length,
        afterNearDuplicateCount: deduped.length,
        afterLowValueFilterCount: cleaned.length,
        droppedLowValueSamples: dropped.slice(0, 40),
        note: chunkAudit.note,
      };
    } catch (e: any) {
      chunkAudit.note = `Chunk audit rebuild failed: ${e?.message ?? e}`;
    }

    const candidateTotal =
      extractionStats.extractedCandidates;
    const approvalRatePercent =
      candidateTotal > 0
        ? Math.round((extractionStats.approvedCandidates / candidateTotal) * 1000) / 10
        : null;

    return {
      generatedAt: new Date().toISOString(),
      document: doc,
      status,
      extractionStats,
      visionPreference: this.getPdfVisionPreferenceReadModel(),
      pipelineConfig: this.getPipelineConfigSnapshot(),
      metrics: {
        totalPages: pageRows.length,
        pagesWithOcrText,
        pagesVisionUsed,
        pagesByExtractionMode,
        pagesByQuality,
        visionFailedPages,
        ragChunkCount: rag.chunkCount,
        ragMostlyDotsChunks,
        ragEmbedWorthyChunks: ragChunks.filter((c) => c.quality.embedWorthy).length,
        candidateTotal,
        candidateApproved: extractionStats.approvedCandidates,
        candidateRejected: extractionStats.rejectedCandidates,
        approvalRatePercent,
      },
      pages,
      ragChunks,
      chunkAudit,
    };
  }

  async exportPipelineAuditExcel(
    documentId: string,
    ragLimit = 2000,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.getPipelineAuditReport(documentId, ragLimit);
    const candidates = await this.getExtractionsForDocument(documentId);
    const buffer = await buildPipelineAuditExcelBuffer(report, candidates);
    return { buffer, filename: pipelineAuditExcelFilename(report.document) };
  }

  async getDocumentStatus(documentId: string): Promise<{
    documentId: string;
    status: string;
    currentStage: string | null;
    progressPercent: number;
    totalPages: number;
    pagesProcessed: number;
    lastProcessedPage: number;
    chunksIndexed: number;
    error: string | null;
    qualitySnapshot: Record<string, number>;
  }> {
    const doc = await this.findOne(documentId);
    const qualitySnapshot = await this.qualitySnapshotForDocument(documentId);
    return {
      documentId: doc.id,
      status: doc.status,
      currentStage: doc.currentStage,
      progressPercent: doc.progressPercent ?? 0,
      totalPages: doc.totalPages ?? 0,
      pagesProcessed: doc.pagesProcessed ?? 0,
      lastProcessedPage: doc.lastProcessedPage ?? 0,
      chunksIndexed: doc.chunksIndexed ?? 0,
      error: doc.error ?? null,
      qualitySnapshot,
    };
  }

  private async qualitySnapshotForDocument(documentId: string): Promise<Record<string, number>> {
    const rows = await this.pageAnalysisRepository
      .createQueryBuilder('p')
      .select('p.quality', 'quality')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.documentId = :id', { id: documentId })
      .groupBy('p.quality')
      .getRawMany<{ quality: string; cnt: string }>();
    const base: Record<string, number> = { good: 0, degraded: 0, poor: 0, unreadable: 0 };
    for (const r of rows) {
      const q = String(r.quality || 'unknown');
      const n = parseInt(String(r.cnt), 10) || 0;
      if (q in base) base[q] = n;
      else base[q] = n;
    }
    return base;
  }

  async updateProgress(
    documentId: string,
    patch: Partial<
      Pick<
        KnowledgeDocument,
        'currentStage' | 'progressPercent' | 'pagesProcessed' | 'lastProcessedPage' | 'totalPages'
      >
    >,
  ): Promise<void> {
    await this.knowledgeDocumentsRepository.update({ id: documentId }, patch);
    try {
      this.documentProgressGateway.emitDocumentProgress(documentId, patch as Record<string, unknown>);
    } catch {
      // best-effort live updates
    }
  }

  async markTrackingJobActive(trackingJobId?: string, bullJobId?: string): Promise<void> {
    if (!trackingJobId) return;
    await this.knowledgeDocumentJobRepository.update(
      { id: trackingJobId },
      { status: 'active', bullJobId: bullJobId ?? null },
    );
  }

  async markTrackingJobCompleted(trackingJobId?: string): Promise<void> {
    if (!trackingJobId) return;
    await this.knowledgeDocumentJobRepository.update(
      { id: trackingJobId },
      { status: 'completed', progressPercent: 100, error: null },
    );
  }

  async markTrackingJobFailed(trackingJobId: string | undefined, error: string): Promise<void> {
    if (!trackingJobId) return;
    await this.knowledgeDocumentJobRepository.update(
      { id: trackingJobId },
      { status: 'failed', error: error.slice(0, 1000) },
    );
  }

  /**
   * Ops: Redis reachability + per-queue Bull job counts (admin-only via controller).
   */
  async getBullQueuesHealth(): Promise<{
    ok: boolean;
    redis: { ok: boolean; error?: string };
    queues: Record<
      string,
      | {
          waiting: number;
          active: number;
          completed: number;
          failed: number;
          delayed: number;
        }
      | { error: string }
    >;
    checkedAt: string;
  }> {
    const pairs: Array<[string, Queue]> = [
      [GATE_QUEUE, this.gateQueue],
      [EXTRACTION_QUEUE, this.extractionQueue],
      [OCR_QUEUE, this.ocrQueue],
      [VISION_QUEUE, this.visionQueue],
      [INDEXING_QUEUE, this.indexingQueue],
    ];

    let redisOk = false;
    let redisError: string | undefined;
    try {
      const pong = await this.gateQueue.client.ping();
      redisOk = pong === 'PONG';
      if (!redisOk) redisError = `Unexpected PING reply: ${String(pong)}`;
    } catch (e: any) {
      redisError = e?.message ? String(e.message) : String(e);
    }

    const queues: Record<
      string,
      | {
          waiting: number;
          active: number;
          completed: number;
          failed: number;
          delayed: number;
        }
      | { error: string }
    > = {};

    for (const [name, q] of pairs) {
      if (!redisOk) {
        queues[name] = { error: 'redis_unavailable' };
        continue;
      }
      try {
        const c = await q.getJobCounts();
        queues[name] = {
          waiting: c.waiting ?? 0,
          active: c.active ?? 0,
          completed: c.completed ?? 0,
          failed: c.failed ?? 0,
          delayed: c.delayed ?? 0,
        };
      } catch (e: any) {
        queues[name] = { error: e?.message ? String(e.message) : String(e) };
      }
    }

    const queueOk = !Object.values(queues).some((v) => 'error' in v);

    return {
      ok: redisOk && queueOk,
      redis: redisOk ? { ok: true } : { ok: false, error: redisError },
      queues,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Admin read-only snapshot of env-driven PDF pipeline knobs (16). No secrets (no DB/JWT).
   */
  getPipelineConfigSnapshot(): {
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
      pageExplainBeforeIndex: boolean;
      pageExplainMaxPages: number;
      pageExplainMode: string;
    };
    fieldPhotos: { visionEnabled: boolean };
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
  } {
    const num = (key: string, fallback: number) => {
      const n = Number(process.env[key]);
      return Number.isFinite(n) ? n : fallback;
    };
    return {
      checkedAt: new Date().toISOString(),
      pdfUpload: {
        maxBytes: getKnowledgePdfMaxBytes(),
        uploadDir: getKnowledgePdfUploadDir(),
      },
      gate: {
        tier1AcceptAbove: getGateTier1AcceptAbove(),
        tier1RejectBelow: getGateTier1RejectBelow(),
        tier2WorkSimMin: getGateTier2WorkSimMin(),
        tier2NonWorkSimMin: getGateTier2NonWorkSimMin(),
        tier2PageCount: getGateTier2PageCount(),
        heuristicPageCount: getGateHeuristicPageCount(),
        llmCharLimit: getGateLlmCharLimit(),
        gateModel: getOllamaGateModel() ?? null,
      },
      ocr: {
        enabled: String(process.env.ENABLE_PDF_OCR ?? 'false').toLowerCase() === 'true',
        maxPagesPerDocument: getPdfOcrMaxPagesAuto(),
        manualMaxPages: getPdfOcrManualMaxPages(),
        autoReindex: isPdfOcrAutoReindexEnabled(),
        inlineBeforeIndex: isPdfOcrInlineBeforeIndexEnabled(),
        renderDpi: getOcrRenderDpi(),
        skipSharpPreprocess: shouldSkipSharpPreprocess(),
        engine: process.env.PADDLE_OCR_ENGINE?.trim() || 'paddleocr-vl',
        isVl: isPaddleOcrVl(),
        paddleOcrUrl: getPaddleOcrUrl(),
        pdftoppmPath: process.env.PDFTOPPM_PATH?.trim() || 'pdftoppm',
      },
      vision: {
        enabled: this.isEffectivePdfVision(),
        enabledFromEnv: isPdfVisionEnabled(),
        adminToggleOn: this.pdfVisionAdminEnabled,
        maxPages: getPdfVisionMaxPages(),
        maxPagesPerBatch: this.getVisionMaxPagesPerBatch(),
        docBatchPages: this.getDocBatchPages(),
        figureVisionEnabled: this.isFigureVisionEnabled(),
        triggerOcrConfidenceBelow: getVisionTriggerOcrConfidenceBelow(),
        minOcrTextChars: getVisionMinOcrTextChars(),
        pageExplainBeforeIndex: isPdfPageExplanationBeforeIndexEnabled(),
        pageExplainMaxPages: getPdfPageExplanationMaxPages(),
        pageExplainMode: getPdfPageExplanationMode(),
      },
      fieldPhotos: {
        visionEnabled: String(process.env.ENABLE_FIELD_PHOTO_VISION ?? 'true').toLowerCase() !== 'false',
      },
      extraction: {
        maxChunks: num('DOC_EXTRACTION_MAX_CHUNKS', 50),
        maxCandidatesTotal: num('DOC_EXTRACTION_MAX_CANDIDATES', 200),
        maxCandidatesPerChunk: num('DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK', 10),
        chunkSize: num('DOC_EXTRACTION_CHUNK_SIZE', 12000),
        overlap: num('DOC_EXTRACTION_CHUNK_OVERLAP', 1500),
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434',
        chatModel: process.env.OLLAMA_MODEL?.trim() || 'llama3.1',
        embedModel: process.env.OLLAMA_EMBED_MODEL?.trim() || 'nomic-embed-text',
        visionModel: getOllamaVisionModel(),
      },
      qdrant: {
        url: process.env.QDRANT_URL?.trim() || 'http://localhost:6333',
        collection: process.env.QDRANT_COLLECTION?.trim() || 'manual_chunks',
      },
      chatWidget: {
        enableImageVision: String(process.env.ENABLE_CHAT_IMAGE_VISION ?? 'true').toLowerCase() !== 'false',
      },
      bullJobs: { removeOnComplete: 100, removeOnFail: 100 },
    };
  }

  /**
   * Read-only inventory of PostgreSQL tables the PDF knowledge pipeline touches (19).
   * Rows are curated to match `PDF_KNOWLEDGE_ARCHITECTURE.md`; not derived from live DB introspection.
   */
  getDatabaseInventory(): {
    checkedAt: string;
    tables: { table: string; entity: string; scope: 'pdf' | 'shared'; purpose: string }[];
  } {
    return {
      checkedAt: new Date().toISOString(),
      tables: [
        {
          table: 'knowledge_documents',
          entity: 'KnowledgeDocument',
          scope: 'pdf',
          purpose: 'PDF uploads, progress, gate, fingerprint, supersession, machineProfileId FK',
        },
        {
          table: 'knowledge_document_page_analysis',
          entity: 'KnowledgeDocumentPageAnalysis',
          scope: 'pdf',
          purpose: 'Per-page OCR text, quality, extractionMode (text|ocr|vision), visionUsed',
        },
        {
          table: 'knowledge_extraction_candidates',
          entity: 'KnowledgeExtractionCandidate',
          scope: 'pdf',
          purpose: 'LLM extraction candidates pending admin approve/reject',
        },
        {
          table: 'knowledge_document_jobs',
          entity: 'KnowledgeDocumentJob',
          scope: 'pdf',
          purpose: 'Bull job tracking rows (gate/extract/index/ocr/vision) + progress fields',
        },
        {
          table: 'vector_chunk_hashes',
          entity: 'VectorChunkHash',
          scope: 'pdf',
          purpose: 'SHA256 of normalized manual chunk text per documentId for embed dedup (11)',
        },
        {
          table: 'machine_profiles',
          entity: 'MachineProfile',
          scope: 'pdf',
          purpose: 'Machine catalog; linked from knowledge_documents.machineProfileId',
        },
        {
          table: 'machine_name_suggestions',
          entity: 'MachineNameSuggestion',
          scope: 'pdf',
          purpose: 'Technician-proposed machine names until admin approves one',
        },
        {
          table: 'extraction_feedback_events',
          entity: 'ExtractionFeedbackEvent',
          scope: 'pdf',
          purpose: 'Analytics on candidate approve/reject (14)',
        },
        {
          table: 'pipeline_preferences',
          entity: 'PipelinePreferences',
          scope: 'pdf',
          purpose: 'Singleton row: admin **`pdfVisionEnabled`** toggle (effective vision = env ENABLE_PDF_VISION AND this flag)',
        },
        {
          table: 'knowledge_entries',
          entity: 'KnowledgeEntry',
          scope: 'shared',
          purpose:
            'Technician + approved curated rows; photoPath; optional FK knowledgeDocumentId → PDF for 23 export filter & source column',
        },
        {
          table: 'audit_logs',
          entity: 'AuditLog',
          scope: 'shared',
          purpose: 'Security/ops audit trail (includes pipeline actions where instrumented)',
        },
        {
          table: 'users',
          entity: 'User',
          scope: 'shared',
          purpose: 'uploadedById, admin fix actors, knowledge createdById, etc.',
        },
        {
          table: 'tickets',
          entity: 'Ticket',
          scope: 'shared',
          purpose: 'Techo ticketId linkage for chat history',
        },
        {
          table: 'conversations',
          entity: 'Conversation',
          scope: 'shared',
          purpose: 'Stored chat turns for tickets / Techo',
        },
        {
          table: 'attachments',
          entity: 'Attachment',
          scope: 'shared',
          purpose: 'Ticket file attachments (separate from knowledge PDFs)',
        },
      ],
    };
  }

  async enqueueExtractionJob(documentId: string, opts?: { resume?: boolean }): Promise<string> {
    const tracking = await this.knowledgeDocumentJobRepository.save(
      this.knowledgeDocumentJobRepository.create({
        documentId,
        queueName: EXTRACTION_QUEUE,
        jobType: EXTRACTION_JOB,
        status: 'queued',
        progressPercent: 0,
        error: null,
        bullJobId: null,
      }),
    );
    const bullJob = await this.extractionQueue.add(
      EXTRACTION_JOB,
      { documentId, trackingJobId: tracking.id, resume: opts?.resume ?? false },
      { removeOnComplete: 100, removeOnFail: 100 },
    );
    tracking.bullJobId = String(bullJob.id);
    await this.knowledgeDocumentJobRepository.save(tracking);
    return tracking.id;
  }

  async enqueueOcrJob(documentId: string, pageNumbers: number[]): Promise<string> {
    const tracking = await this.knowledgeDocumentJobRepository.save(
      this.knowledgeDocumentJobRepository.create({
        documentId,
        queueName: OCR_QUEUE,
        jobType: OCR_JOB,
        status: 'queued',
        progressPercent: 0,
        error: null,
        bullJobId: null,
      }),
    );
    const bullJob = await this.ocrQueue.add(
      OCR_JOB,
      { documentId, trackingJobId: tracking.id, pageNumbers },
      { removeOnComplete: 100, removeOnFail: 100 },
    );
    tracking.bullJobId = String(bullJob.id);
    await this.knowledgeDocumentJobRepository.save(tracking);
    return tracking.id;
  }

  async enqueueVisionJob(documentId: string, pageNumbers: number[]): Promise<string> {
    const tracking = await this.knowledgeDocumentJobRepository.save(
      this.knowledgeDocumentJobRepository.create({
        documentId,
        queueName: VISION_QUEUE,
        jobType: VISION_JOB,
        status: 'queued',
        progressPercent: 0,
        error: null,
        bullJobId: null,
      }),
    );
    const bullJob = await this.visionQueue.add(
      VISION_JOB,
      { documentId, trackingJobId: tracking.id, pageNumbers },
      { removeOnComplete: 100, removeOnFail: 100 },
    );
    tracking.bullJobId = String(bullJob.id);
    await this.knowledgeDocumentJobRepository.save(tracking);
    return tracking.id;
  }

  async enqueueIndexingJob(
    documentId: string,
    payload: { knowledgeEntryId: string; candidateId?: string },
  ): Promise<string> {
    const tracking = await this.knowledgeDocumentJobRepository.save(
      this.knowledgeDocumentJobRepository.create({
        documentId,
        queueName: INDEXING_QUEUE,
        jobType: INDEXING_JOB,
        status: 'queued',
        progressPercent: 0,
        error: null,
        bullJobId: null,
      }),
    );
    const bullJob = await this.indexingQueue.add(
      INDEXING_JOB,
      { documentId, trackingJobId: tracking.id, ...payload },
      { removeOnComplete: 100, removeOnFail: 100 },
    );
    tracking.bullJobId = String(bullJob.id);
    await this.knowledgeDocumentJobRepository.save(tracking);
    return tracking.id;
  }

  async runOcrForDocumentPages(documentId: string, pageNumbers: number[]): Promise<number> {
    if (!pageNumbers.length) return 0;
    const doc = await this.findOne(documentId);
    return this.ocrPagesFromPdf(doc.filePath, doc.id, pageNumbers);
  }

  /** After async OCR/vision enrichment, refresh Qdrant from updated page_analysis. */
  async maybeAutoReindexAfterEnrichment(documentId: string, reason: string): Promise<void> {
    if (!isPdfOcrAutoReindexEnabled()) return;
    try {
      const doc = await this.findOne(documentId);
      const reindexable = ['done', 'partially_indexed', 'processing'].includes(doc.status);
      if (!reindexable) return;
      const { chunksIndexed } = await this.reindexManualChunksForDocument(documentId);
      this.logger.log(`Auto re-indexed ${documentId} (${chunksIndexed} chunks) after ${reason}`);
    } catch (e: any) {
      this.logger.warn(`Auto re-index skipped for ${documentId} after ${reason}: ${e?.message ?? e}`);
    }
  }

  /**
   * Employee 3 (6): render each page, call vision model, merge text into **`ocrText`**, set **`visionUsed`**.
   */
  async runVisionForDocumentPages(
    documentId: string,
    pageNumbers: number[],
    opts?: { maxPages?: number; promptMode?: 'default' | 'page_explanation'; skipCompleted?: boolean },
  ): Promise<number> {
    if (!this.isEffectivePdfVision() || !pageNumbers.length) return 0;
    const batchCap = opts?.maxPages ?? this.getVisionMaxPagesPerBatch();
    if (batchCap <= 0) return 0;

    const doc = await this.findOne(documentId);
    let pages = [...new Set(pageNumbers)].sort((a, b) => a - b);
    if (opts?.skipCompleted !== false) {
      pages = await this.filterPageNumbersNeedingVision(documentId, pages);
    }
    pages = pages.slice(0, batchCap);
    if (!pages.length) return 0;

    const workDir = join(tmpdir(), `smartmaint-vision-${documentId}-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });
    const concurrency = this.getVisionConcurrency();
    let done = 0;

    // Detect primary language of the manual once (from raw text) so we can
    // tell the vision model NOT to insert characters from other scripts
    // (Gemini Flash sometimes hallucinates Arabic on dot-leaders in TOC pages).
    const docLanguage = await this.detectDocumentPrimaryLanguage(doc.filePath);
    const langLabel = this.languageLabel(docLanguage);
    const allowedScripts = this.allowedScriptsFor(docLanguage);

    const explanationMode = opts?.promptMode === 'page_explanation';
    const pageRowsForDoc = await this.pageAnalysisRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
    const diagramHeavyDoc = isDiagramHeavyDocument(pageRowsForDoc);
    const scriptGuard =
      `The document language is ${langLabel}. Transcribe ONLY in ${langLabel} (and standard ASCII numerals/symbols).\n` +
      `Do NOT insert characters from other scripts unless clearly visible on the page in that script.\n`;
    const baseVisionPrompt = explanationMode
      ? scriptGuard
      : 'You are reading a page from an industrial maintenance or electrical manual.\n' +
        scriptGuard +
        'When you see leader dots ("....") connecting a heading to a page number, render them as a single ellipsis "..." — never as letters from another alphabet.\n' +
        '1) Transcribe all readable text (headings, table cells, labels, fault or alarm codes).\n' +
        '2) When the manual shows small square **button icons** in a sentence (return/enter, up, down), write canonical labels in the flow: [RETURN], [UP], [DOWN] (not random symbols).\n' +
        '3) Dark sidebar or callout boxes often show what the **operator sees on the machine display** (e.g. Goto, Conf, ULoc, SP). Transcribe those labels exactly.\n' +
        '4) For diagrams or schematics, briefly describe components, connections, and identifiers.\n' +
        '5) Output plain text only (no markdown code fences).';

    // Detect display fonts once for the whole target list (parallel), so the
    // per-page worker does not spawn `pdffonts` again.
    const displayFontPages = await this.detectDisplayFontPagesParallel(doc.filePath, pages);

    const processOne = async (pageNumber: number): Promise<boolean> => {
      const usesDisplayFont = displayFontPages.has(pageNumber);
      const pageRow = pageRowsForDoc.find((r) => r.pageNumber === pageNumber);
      const schematicPage =
        diagramHeavyDoc ||
        pageRow?.quality === 'unreadable' ||
        pageRow?.quality === 'poor' ||
        pageRow?.sectionType === 'wiring';
      const visionPrompt = explanationMode
        ? baseVisionPrompt +
          buildPageExplanationVisionPrompt(langLabel, usesDisplayFont, { schematicPage })
        : baseVisionPrompt +
          (schematicPage
            ? '\nThis page is an electrical schematic or MCC circuit diagram. Describe components, terminals, wire IDs, and connections in plain searchable text.'
            : '') +
          (usesDisplayFont
            ? '\nThis page uses seven-segment/LCD readouts. Transcribe display digits and short codes EXACTLY (examples: 0, 10, 20, ULoc, C). ' +
              'When symbols represent keys/buttons, use canonical labels: UP_ARROW, DOWN_ARROW, ON_OFF_BUTTON.'
            : '\nIf the page shows seven-segment or LCD-style digital readouts, transcribe those digits and short codes EXACTLY as displayed (e.g. 0, 10, 20, ULoc, C).');
      await this.pageAnalysisRepository.update(
        { documentId, pageNumber },
        { extractionMode: 'vision', visionUsed: false },
      );

      let b64: string;
      try {
        const dpi = usesDisplayFont ? 380 : schematicPage ? 300 : 200;
        const pngPath = await this.renderPdfPageToPng(doc.filePath, pageNumber, workDir, dpi);
        b64 = readFileSync(pngPath).toString('base64');
      } catch (e: any) {
        this.logger.warn(`Vision render failed page ${pageNumber}: ${e?.message ?? e}`);
        await this.appendPageQualityWarning(documentId, pageNumber, 'vision_render_failed');
        return false;
      }

      let description: string;
      try {
        description = await this.aiService.describeImageBase64ForPdf(b64, visionPrompt);
        if (usesDisplayFont) {
          description = this.normalizeDisplayVisionText(description);
        }
        description = this.stripDisallowedScripts(description, allowedScripts);
      } catch (e: any) {
        this.logger.warn(`Vision model failed page ${pageNumber}: ${e?.message ?? e}`);
        await this.appendPageQualityWarning(documentId, pageNumber, 'vision_model_failed');
        await this.pageAnalysisRepository.update(
          { documentId, pageNumber },
          { extractionMode: 'vision', visionUsed: false },
        );
        return false;
      }

      const row = await this.pageAnalysisRepository.findOne({ where: { documentId, pageNumber } });
      const previous = (row?.ocrText ?? '').trim();
      const warnings = Array.isArray(row?.qualityWarnings) ? [...(row!.qualityWarnings as string[])] : [];
      const warnedGlyph = warnings.some((w) => String(w).startsWith('glyph_corruption_likely'));
      const previousGlyphCorrupted = this.detectGlyphCorruption(previous).corrupted;
      const shouldReplaceRawWithVision = shouldReplacePageTextWithVision(row, previous, {
        usesDisplayFont,
        warnedGlyph,
        previousGlyphCorrupted,
        minGoodChars: this.getMinGoodOcrCharsForVisionSkip(),
      });
      const merged = shouldReplaceRawWithVision
        ? description
        : previous.length > 0
          ? `${previous}\n\n--- Vision description ---\n${description}`
          : description;

      if (shouldReplaceRawWithVision) {
        if (!warnings.includes('vision_replaced_raw_text')) warnings.push('vision_replaced_raw_text');
      } else {
        if (!warnings.includes('vision_layer')) warnings.push('vision_layer');
      }

      const qualityAfterVision =
        row?.quality === 'unreadable' || row?.quality === 'poor' ? ('degraded' as const) : row?.quality;

      await this.pageAnalysisRepository.update(
        { documentId, pageNumber },
        {
          ocrText: merged.slice(0, 500000),
          visionUsed: true,
          extractionMode: 'vision',
          processingMode: 'region',
          qualityWarnings: warnings,
          ...(qualityAfterVision ? { quality: qualityAfterVision } : {}),
          ...(schematicPage && row?.sectionType !== 'wiring' ? { sectionType: 'wiring' } : {}),
        },
      );
      return true;
    };

    try {
      for (let i = 0; i < pages.length; i += concurrency) {
        const slice = pages.slice(i, i + concurrency);
        const results = await Promise.allSettled(slice.map((p) => processOne(p)));
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value === true) done += 1;
        }
      }
    } finally {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return done;
  }

  private getVisionConcurrency(): number {
    const n = Number(process.env.PDF_VISION_CONCURRENCY ?? 4);
    if (!Number.isFinite(n)) return 4;
    return Math.max(1, Math.min(16, Math.floor(n)));
  }

  private async appendPageQualityWarning(documentId: string, pageNumber: number, code: string): Promise<void> {
    const row = await this.pageAnalysisRepository.findOne({ where: { documentId, pageNumber } });
    if (!row) return;
    const w = Array.isArray(row.qualityWarnings) ? [...(row.qualityWarnings as string[])] : [];
    if (!w.includes(code)) w.push(code);
    await this.pageAnalysisRepository.update({ documentId, pageNumber }, { qualityWarnings: w });
  }

  private async renderPdfPageToPng(
    pdfPath: string,
    pageNumber: number,
    workDir: string,
    dpi = 200,
  ): Promise<string> {
    const pdftoppm = process.env.PDFTOPPM_PATH?.trim() || 'pdftoppm';
    const prefix = join(workDir, `page-${pageNumber}`);
    await execFileAsync(
      pdftoppm,
      ['-f', String(pageNumber), '-l', String(pageNumber), '-png', '-r', String(dpi), pdfPath, prefix],
      { windowsHide: true },
    );

    // pdftoppm names files as `<prefix>-<NN>.png` where NN is the actual page
    // number (not its relative index), zero-padded to the digit-width pdftoppm
    // chooses based on the document size — e.g. page 23 of a 100-page PDF is
    // `page-23-023.png`, page 23 of a 50-page PDF is `page-23-23.png`, page 5
    // of a 9-page PDF is `page-5-5.png`. Some versions also accept `-1.png`
    // for the first page in a single-page range. Probe likely candidates then
    // fall back to scanning the work directory.
    const baseName = `page-${pageNumber}`;
    const candidates = new Set<string>([
      `${prefix}-${pageNumber}.png`,
      `${prefix}-${String(pageNumber).padStart(2, '0')}.png`,
      `${prefix}-${String(pageNumber).padStart(3, '0')}.png`,
      `${prefix}-${String(pageNumber).padStart(4, '0')}.png`,
      `${prefix}-${String(pageNumber).padStart(5, '0')}.png`,
      `${prefix}-1.png`,
      `${prefix}.png`,
    ]);
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    try {
      const files = readdirSync(workDir);
      const match = files.find((f) => f.startsWith(`${baseName}-`) && f.endsWith('.png'));
      if (match) return join(workDir, match);
    } catch {
      // ignore directory read errors and fall through to throw below
    }
    throw new Error(
      `pdftoppm did not produce a PNG for page ${pageNumber} (looked under prefix ${prefix})`,
    );
  }

  private async maybeEnqueueVisionPagesAfterOcr(documentId: string, ocrPageNumbers: number[]): Promise<void> {
    if (!this.isEffectivePdfVision() || !ocrPageNumbers.length) return;
    const maxV = this.getVisionMaxPagesPerBatch();
    if (maxV <= 0) return;

    const rows = await this.pageAnalysisRepository.find({
      where: { documentId, pageNumber: In(ocrPageNumbers) },
    });

    const confBelow = getVisionTriggerOcrConfidenceBelow();
    const minChars = getVisionMinOcrTextChars();
    const candidates: number[] = [];

    for (const r of rows) {
      const text = (r.ocrText ?? '').trim();
      const conf = r.ocrConfidence;
      const shortText = text.length < minChars;
      const lowConf = conf == null || conf < confBelow;
      const wiringSparse = r.sectionType === 'wiring' && text.length < Math.max(minChars, 120);
      const glyphCorrupted =
        (r.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely')) ||
        this.detectGlyphCorruption(text).corrupted;
      if (lowConf || shortText || wiringSparse || glyphCorrupted) {
        candidates.push(r.pageNumber);
      }
    }

    const uniq = [...new Set(candidates)].sort((a, b) => a - b).slice(0, maxV);
    if (!uniq.length) return;

    try {
      await this.enqueueVisionJob(documentId, uniq);
    } catch (e: any) {
      this.logger.warn(`Vision enqueue after OCR failed: ${e?.message ?? e}`);
    }
  }

  async runGateStage(documentId: string): Promise<'accepted' | 'needs_review' | 'rejected'> {
    const doc = await this.findOne(documentId);
    await this.updateProgress(doc.id, { currentStage: 'gate_processing', progressPercent: 10 });

    const fileBuffer = readFileSync(doc.filePath);
    let parsed: any;
    try {
      parsed = await parsePdfWithPoppler(fileBuffer);
    } catch {
      doc.status = 'failed';
      doc.error = 'Gate failed: invalid/corrupted PDF';
      await this.knowledgeDocumentsRepository.save(doc);
      return 'rejected';
    }

    const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
    const pages = this.derivePageTexts(parsed, fullText);
    const pageTexts = pages.length > 0 ? pages : [fullText];
    const gate = await this.classifyUploadGateThreeTier(pageTexts, doc.originalName);

    doc.isWorkRelated = gate.isWorkRelated;
    doc.docType = gate.docType;
    doc.gateConfidence = gate.confidence;
    doc.needsReview = gate.decision === 'needs_review';
    if (gate.detectedMachineName && (!doc.machineName || !doc.machineName.trim())) {
      doc.machineName = gate.detectedMachineName;
    }

    // Machine profile auto-detection during gate (no extra parsing cost).
    const mpSample = pageTexts
      .slice(0, getGateHeuristicPageCount())
      .join('\n\n')
      .slice(0, 12000);
    const mpDetection = await this.detectMachineProfile(mpSample, doc.originalName);
    const profileMachineName =
      (mpDetection.machineName && mpDetection.machineName.trim()) ||
      (gate.detectedMachineName && gate.detectedMachineName.trim()) ||
      null;
    const profileManufacturer =
      (mpDetection.manufacturer && mpDetection.manufacturer.trim()) ||
      (gate.detectedManufacturer && gate.detectedManufacturer.trim()) ||
      null;
    if (profileMachineName) {
      const mp = await this.machineProfilesService.findOrCreate({
        machineName: profileMachineName,
        manufacturer: profileManufacturer,
        family: mpDetection.family,
        modelNumber: mpDetection.modelNumber,
        components: mpDetection.components,
      });
      doc.machineProfileId = mp.id;
      doc.machineUnknown = false;
      if (!doc.machineName || !doc.machineName.trim()) {
        doc.machineName = mp.machineName;
      }
    } else {
      doc.machineUnknown = true;
      doc.machineProfileId = null;
    }

    if (gate.decision === 'rejected') {
      doc.status = 'rejected';
      doc.error = `Rejected by gate: ${gate.reason}`;
      await this.knowledgeDocumentsRepository.save(doc);
      await this.updateProgress(doc.id, { currentStage: 'rejected', progressPercent: 100 });
      return 'rejected';
    }

    if (gate.decision === 'needs_review') {
      doc.status = 'needs_review';
      doc.error = `Needs review: ${gate.reason}`;
      await this.knowledgeDocumentsRepository.save(doc);
      await this.updateProgress(doc.id, { currentStage: 'needs_review', progressPercent: 20 });
      return 'needs_review';
    }

    doc.status = 'gated';
    doc.error = null;
    await this.knowledgeDocumentsRepository.save(doc);
    await this.updateProgress(doc.id, { currentStage: 'gated', progressPercent: 22 });
    return 'accepted';
  }

  async approveGateAndContinue(documentId: string, adminId: string): Promise<{ ok: true; extractionJobId: string }> {
    const doc = await this.findOne(documentId);
    if (doc.status !== 'needs_review') {
      throw new BadRequestException('Document is not in needs_review state');
    }
    doc.status = 'gated';
    doc.needsReview = false;
    doc.error = null;
    await this.knowledgeDocumentsRepository.save(doc);
    const extractionJobId = await this.enqueueExtractionJob(documentId);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.APPROVE,
        entityType: 'knowledge_document',
        entityId: documentId,
        userId: adminId,
        changes: { event: 'gate_approved', extractionJobId },
        reason: null,
      }),
    );
    return { ok: true, extractionJobId };
  }

  async rejectGate(documentId: string, adminId: string, reason?: string): Promise<{ ok: true }> {
    const doc = await this.findOne(documentId);
    doc.status = 'rejected';
    doc.error = reason?.trim() || 'Rejected by admin at gate review';
    doc.needsReview = false;
    await this.knowledgeDocumentsRepository.save(doc);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.REJECT,
        entityType: 'knowledge_document',
        entityId: documentId,
        userId: adminId,
        changes: { event: 'gate_rejected' },
        reason: doc.error,
      }),
    );
    return { ok: true };
  }

  async runOcrForDocument(
    documentId: string,
    adminId: string,
  ): Promise<{ ok: true; processedPages: number; pagesSelected: number; chunksIndexed?: number }> {
    const doc = await this.findOne(documentId);
    if (!doc.deepMode) {
      throw new BadRequestException('OCR runs only in deep mode');
    }

    const enabled = String(process.env.ENABLE_PDF_OCR ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new BadRequestException('OCR is disabled (set ENABLE_PDF_OCR=true)');
    }

    const pageRows = await this.getPageAnalysis(documentId);
    const glyphCorruptedPages = await this.detectGlyphCorruptedPagesForDocument(doc, pageRows);
    const pageTexts = await this.loadPopplerPageTextsForDocument(doc);
    const pageNumbers = this.selectPageNumbersForOcr(pageRows, {
      mode: 'manual',
      pageTexts,
      glyphCorruptedPages,
    });
    if (pageNumbers.length === 0) return { ok: true, processedPages: 0, pagesSelected: 0 };

    const processed = await this.ocrPagesFromPdf(doc.filePath, documentId, pageNumbers);

    let chunksIndexed: number | undefined;
    if (isPdfOcrAutoReindexEnabled() && processed > 0) {
      const reindex = await this.reindexManualChunksForDocument(documentId);
      chunksIndexed = reindex.chunksIndexed;
    }

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.UPDATE,
        entityType: 'knowledge_document',
        entityId: doc.id,
        userId: adminId,
        changes: { event: 'ocr_run', processedPages: processed, pagesSelected: pageNumbers.length, chunksIndexed },
        reason: null,
      }),
    );

    return { ok: true, processedPages: processed, pagesSelected: pageNumbers.length, chunksIndexed };
  }

  async runVisionForDocument(
    documentId: string,
    adminId: string,
  ): Promise<{ ok: true; processedPages: number }> {
    const doc = await this.findOne(documentId);
    if (!doc.deepMode) {
      throw new BadRequestException('Vision runs only in deep mode');
    }
    if (!this.isEffectivePdfVision()) {
      throw new BadRequestException(
        'PDF vision is off: enable ENABLE_PDF_VISION in server env and turn the admin “PDF vision” toggle on (Pipeline env / PDF Library).',
      );
    }

    const pageRows = await this.getPageAnalysis(documentId);
    const batchSize = this.getDocBatchPages();
    const maxPerBatch = this.getVisionMaxPagesPerBatch();
    if (maxPerBatch <= 0) return { ok: true, processedPages: 0 };
    const glyphCorruptedPages = this.isGlyphCorruptionVisionEnabled()
      ? await this.detectGlyphCorruptedPagesForDocument(doc, pageRows)
      : new Set<number>();
    const displayFontPages = new Set<number>();
    for (const row of pageRows) {
      if (await this.pageUsesDisplayFont(doc.filePath, row.pageNumber)) {
        displayFontPages.add(row.pageNumber);
      }
    }

    let processed = 0;
    const batches = this.splitRowsIntoBatches(pageRows, batchSize);
    for (const batchRows of batches) {
      const targets = batchRows
        .filter(
          (p) =>
            displayFontPages.has(p.pageNumber) ||
            p.quality !== 'good' ||
            (p.ocrConfidence != null && p.ocrConfidence < getVisionTriggerOcrConfidenceBelow()) ||
            glyphCorruptedPages.has(p.pageNumber),
        )
        .sort((a, b) => Number(displayFontPages.has(b.pageNumber)) - Number(displayFontPages.has(a.pageNumber)))
        .slice(0, maxPerBatch);
      if (!targets.length) continue;
      processed += await this.runVisionForDocumentPages(
        documentId,
        targets.map((t) => t.pageNumber),
      );
    }
    if (processed === 0) return { ok: true, processedPages: 0 };
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.UPDATE,
        entityType: 'knowledge_document',
        entityId: doc.id,
        userId: adminId,
        changes: { event: 'vision_run', processedPages: processed },
        reason: null,
      }),
    );

    return { ok: true, processedPages: processed };
  }

  private pageLikelyHasDiagram(pageText: string): boolean {
    const t = String(pageText || '').trim();
    if (!t || t.length < 40) return true;
    return (
      /\bfig(?:ure|\.)\s*\d+/i.test(t) ||
      /(sch[ée]ma|schematic|diagram|wiring|raccordement|c[âa]blage|dimensions|mcc|ladder|circuit)/i.test(t)
    );
  }

  private isFigureVisionEnabled(): boolean {
    return String(process.env.ENABLE_FIGURE_VISION ?? 'true').toLowerCase() !== 'false';
  }

  private getDocBatchPages(): number {
    const n = Number(process.env.DOC_BATCH_PAGES ?? 20);
    if (!Number.isFinite(n)) return 20;
    return Math.max(1, Math.min(500, Math.floor(n)));
  }

  private getVisionMaxPagesPerBatch(): number {
    const n = Number(process.env.PDF_VISION_MAX_PAGES_PER_BATCH ?? getPdfVisionMaxPages());
    if (!Number.isFinite(n)) return getPdfVisionMaxPages();
    return Math.max(1, Math.min(500, Math.floor(n)));
  }

  private splitRowsIntoBatches<T extends { pageNumber: number }>(rows: T[], batchSize: number): T[][] {
    const sorted = [...rows].sort((a, b) => a.pageNumber - b.pageNumber);
    const batches: T[][] = [];
    for (let i = 0; i < sorted.length; i += batchSize) {
      batches.push(sorted.slice(i, i + batchSize));
    }
    return batches;
  }

  private async pageUsesDisplayFont(pdfPath: string, pageNumber: number): Promise<boolean> {
    try {
      const bin = process.env.PDFFONTS_PATH?.trim() || 'pdffonts';
      const { stdout } = await execFileAsync(
        bin,
        ['-f', String(pageNumber), '-l', String(pageNumber), pdfPath],
        { windowsHide: true },
      );
      return /(7segment|seven.?segment|segment|lcd|dseg|digital|display)/i.test(String(stdout ?? ''));
    } catch {
      return false;
    }
  }

  private async detectDisplayFontPagesParallel(
    pdfPath: string,
    pageNumbers: number[],
  ): Promise<Set<number>> {
    const set = new Set<number>();
    const concurrency = Math.max(2, Math.min(16, this.getVisionConcurrency() * 2));
    for (let i = 0; i < pageNumbers.length; i += concurrency) {
      const slice = pageNumbers.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        slice.map(async (p) => ({ p, hit: await this.pageUsesDisplayFont(pdfPath, p) })),
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.hit) set.add(r.value.p);
      }
    }
    return set;
  }

  private normalizeDisplayVisionText(text: string): string {
    let out = String(text || '').normalize('NFC');
    out = out.replace(/\btouches?\s+ou\s+afin/gi, 'touches UP_ARROW ou DOWN_ARROW afin');
    out = out.replace(/\b>\+\"\?'\b/g, 'ULoc');
    out = out.replace(/=\s*@\b/g, '= 0');
    out = out.replace(/=\s*2@'\b/g, '= 10');
    out = out.replace(/=\s*5@\b/g, '= 20');
    out = out.replace(/\b(?:▲|△)\b/g, 'UP_ARROW');
    out = out.replace(/\b(?:▼|▽)\b/g, 'DOWN_ARROW');
    return out;
  }

  /**
   * Best-effort language detection from the first few thousand chars of the
   * PDF text layer. Used only to constrain the vision model — not stored.
   */
  private async detectDocumentPrimaryLanguage(pdfPath: string): Promise<'fr' | 'en' | 'unknown'> {
    try {
      const buf = readFileSync(pdfPath);
      const parsed: any = await parsePdfWithPoppler(buf);
      const sample = String(parsed?.text ?? '').slice(0, 8000).toLowerCase();
      if (!sample.trim()) return 'unknown';

      const score = (words: string[]): number =>
        words.reduce((acc, w) => acc + (sample.includes(` ${w} `) ? 1 : 0), 0);

      const frScore =
        score([
          'le', 'la', 'les', 'des', 'pour', 'avec', 'configuration', 'paramètres', 'paramètre',
          'réglage', 'sortie', 'entrée', 'tableau', 'mode', 'écran', 'généraux', 'définition',
          'définitions', 'contrôleur', 'contrôleurs', 'fonction', 'fonctionnement',
        ]) + (sample.match(/[éèêàâîôûç]/g)?.length ?? 0) / 50;

      const enScore = score([
        'the', 'and', 'with', 'configuration', 'parameters', 'setting', 'output', 'input',
        'table', 'mode', 'screen', 'general', 'definition', 'controller', 'function', 'operation',
      ]);

      const ranking: [number, 'fr' | 'en' | 'unknown'][] = [
        [frScore, 'fr'],
        [enScore, 'en'],
      ];
      ranking.sort((a, b) => b[0] - a[0]);
      const [top] = ranking;
      if (top[0] >= 3) return top[1];
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private languageLabel(code: string): string {
    switch (code) {
      case 'fr':
        return 'French';
      case 'en':
        return 'English';
      default:
        return 'French or English (same as the page)';
    }
  }

  /**
   * Returns a set of Unicode block flags the vision output is allowed to keep.
   * Anything outside these blocks (and outside basic Latin / Latin-1 supplement
   * / Latin extended) is stripped from the model's response.
   */
  private allowedScriptsFor(_code: string): Set<'latin' | 'arabic' | 'cjk' | 'cyrillic'> {
    return new Set<'latin' | 'arabic' | 'cjk' | 'cyrillic'>(['latin']);
  }

  private stripDisallowedScripts(
    text: string,
    allowed: Set<'latin' | 'arabic' | 'cjk' | 'cyrillic'>,
  ): string {
    if (!text) return text;
    let out = text.normalize('NFC');

    out = out.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

    if (!allowed.has('arabic')) {
      out = out.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '');
    }
    if (!allowed.has('cjk')) {
      out = out.replace(/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u4E00-\u9FFF\uAC00-\uD7AF]/g, '');
    }
    if (!allowed.has('cyrillic')) {
      out = out.replace(/[\u0400-\u04FF\u0500-\u052F]/g, '');
    }

    out = out.replace(/[ \t]+\n/g, '\n');
    out = out.replace(/[ \t]{2,}/g, ' ');
    out = out.replace(/\n{3,}/g, '\n\n');
    return out.trim();
  }

  async deleteDocument(
    documentId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const doc = await this.findOne(documentId);

    if (role === UserRole.TECHNICIAN) {
      if (doc.uploadedById !== userId) {
        throw new ForbiddenException('You can only delete PDFs you uploaded');
      }
    }

    try {
      await this.ragService.purgeManualIndexForDocument(doc.id);
    } catch {
      // best-effort
    }
    // Delete candidates and name suggestions first to avoid FK issues on older DBs.
    await this.extractionCandidatesRepository.delete({ documentId: doc.id });
    await this.machineNameSuggestionsRepository.delete({ documentId: doc.id });

    await this.knowledgeDocumentsRepository.delete({ id: doc.id });

    // Best-effort file removal (DB FK cascade already removes candidates).
    try {
      if (doc.filePath && existsSync(doc.filePath)) {
        unlinkSync(doc.filePath);
      }
    } catch {
      // ignore file deletion errors (e.g., already deleted)
    }
  }

  async approveExtractionCandidate(
    candidateId: string,
    adminId: string,
    approverRole: UserRole,
    payload?: {
      title?: string;
      problemDescription?: string;
      solution?: string;
      tags?: string;
    },
  ): Promise<KnowledgeExtractionCandidate> {
    const candidate = await this.extractionCandidatesRepository.findOne({
      where: { id: candidateId },
    });

    if (!candidate) throw new NotFoundException('Extraction candidate not found');

    const normalizedTags =
      payload?.tags ??
      candidate.tags ??
      undefined;
    const tags = typeof normalizedTags === 'string' && normalizedTags.trim().length > 0 ? normalizedTags : undefined;

    const title = payload?.title ?? candidate.title;
    const problemDescription = payload?.problemDescription ?? candidate.problemDescription;
    const solution = payload?.solution ?? candidate.solution;

    const entry = await this.knowledgeService.create(
      {
        title,
        problemDescription,
        solution,
        tags,
        entryType: candidate.entryType ?? undefined,
        source: 'pdf_extraction',
        knowledgeDocumentId: candidate.documentId,
      },
      adminId,
      approverRole,
      { skipAutoIndex: true },
    );

    candidate.status = 'approved';
    candidate.reviewedById = adminId;
    await this.extractionCandidatesRepository.save(candidate);

    try {
      await this.enqueueIndexingJob(candidate.documentId, { knowledgeEntryId: entry.id, candidateId: candidate.id });
    } catch {
      // best-effort: entry exists even if indexing queue is down
    }

    const doc = await this.knowledgeDocumentsRepository.findOne({ where: { id: candidate.documentId } });
    const edited =
      (payload?.title != null && payload.title !== candidate.title) ||
      (payload?.problemDescription != null && payload.problemDescription !== candidate.problemDescription) ||
      (payload?.solution != null && payload.solution !== candidate.solution);
    try {
      await this.extractionFeedbackRepository.save(
        this.extractionFeedbackRepository.create({
          documentId: candidate.documentId,
          candidateId: candidate.id,
          signal: edited ? 'approve_edit' : 'approve',
          docType: doc?.docType ?? null,
          sectionType: candidate.sectionType ?? null,
          entryType: candidate.entryType ?? null,
          confidence: candidate.confidence,
          adminId,
          reason: null,
          editDelta: {
            snapshot: {
              title: title ?? null,
              problemDescription: problemDescription ?? null,
              solution: solution ?? null,
            },
            ...(edited
              ? {
                  changed: {
                    title: payload?.title ?? null,
                    problemDescription: payload?.problemDescription ?? null,
                    solution: payload?.solution ?? null,
                  },
                }
              : {}),
          },
        }),
      );
    } catch {
      // best-effort analytics
    }

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.APPROVE,
        entityType: 'knowledge_extraction_candidate',
        entityId: candidate.id,
        userId: adminId,
        changes: {
          event: 'extraction_candidate_approved',
          knowledgeEntryId: entry.id,
          documentId: candidate.documentId,
          reviewedById: adminId,
          title: title ?? candidate.title,
          problemDescription: problemDescription?.slice(0, 2000) ?? null,
          solution: solution?.slice(0, 2000) ?? null,
          documentOriginalName: doc?.originalName ?? null,
          edited: edited,
        },
        reason: null,
      }),
    );

    return candidate;
  }

  async rejectExtractionCandidate(
    candidateId: string,
    adminId: string,
    reason?: string,
  ): Promise<KnowledgeExtractionCandidate> {
    const candidate = await this.extractionCandidatesRepository.findOne({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Extraction candidate not found');

    candidate.status = 'rejected';
    candidate.reviewedById = adminId;
    const saved = await this.extractionCandidatesRepository.save(candidate);
    const doc = await this.knowledgeDocumentsRepository.findOne({ where: { id: candidate.documentId } });
    try {
      await this.extractionFeedbackRepository.save(
        this.extractionFeedbackRepository.create({
          documentId: candidate.documentId,
          candidateId: candidate.id,
          signal: 'reject',
          docType: doc?.docType ?? null,
          sectionType: candidate.sectionType ?? null,
          entryType: candidate.entryType ?? null,
          confidence: candidate.confidence,
          adminId,
          reason: reason?.trim() || null,
          editDelta: {
            snapshot: {
              title: candidate.title ?? null,
              problemDescription: candidate.problemDescription ?? null,
              solution: candidate.solution ?? null,
            },
          },
        }),
      );
    } catch {
      // best-effort analytics
    }
    const docReject = await this.knowledgeDocumentsRepository.findOne({
      where: { id: candidate.documentId },
    });
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.REJECT,
        entityType: 'knowledge_extraction_candidate',
        entityId: candidate.id,
        userId: adminId,
        changes: {
          event: 'extraction_candidate_rejected',
          documentId: candidate.documentId,
          reviewedById: adminId,
          title: candidate.title,
          problemDescription: candidate.problemDescription?.slice(0, 2000) ?? null,
          solution: candidate.solution?.slice(0, 2000) ?? null,
          documentOriginalName: docReject?.originalName ?? null,
        },
        reason: reason?.trim() || null,
      }),
    );
    return saved;
  }

  private pickNonEmptyString(...values: (string | null | undefined)[]): string | null {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }

  private resolveFeedbackTextSnapshot(
    editDelta: Record<string, unknown> | null | undefined,
    candidate?: KnowledgeExtractionCandidate | null,
    audit?: Record<string, unknown> | null,
    knowledgeEntry?: KnowledgeEntry | null,
  ): { title: string | null; problemDescription: string | null; solution: string | null } {
    let fromDelta: {
      title?: string;
      problemDescription?: string;
      solution?: string;
    } = {};
    if (editDelta && typeof editDelta === 'object') {
      const snap = editDelta.snapshot as Record<string, unknown> | undefined;
      if (snap && typeof snap === 'object') {
        fromDelta = {
          title: typeof snap.title === 'string' ? snap.title : undefined,
          problemDescription:
            typeof snap.problemDescription === 'string' ? snap.problemDescription : undefined,
          solution: typeof snap.solution === 'string' ? snap.solution : undefined,
        };
      } else {
        const changed = editDelta.changed as Record<string, unknown> | undefined;
        fromDelta = {
          title:
            (typeof editDelta.title === 'string' ? editDelta.title : undefined) ??
            (typeof changed?.title === 'string' ? changed.title : undefined),
          problemDescription:
            (typeof editDelta.problemDescription === 'string'
              ? editDelta.problemDescription
              : undefined) ??
            (typeof changed?.problemDescription === 'string'
              ? changed.problemDescription
              : undefined),
          solution:
            (typeof editDelta.solution === 'string' ? editDelta.solution : undefined) ??
            (typeof changed?.solution === 'string' ? changed.solution : undefined),
        };
      }
    }
    return {
      title: this.pickNonEmptyString(
        fromDelta.title,
        candidate?.title,
        audit?.title as string,
        knowledgeEntry?.title,
      ),
      problemDescription: this.pickNonEmptyString(
        fromDelta.problemDescription,
        candidate?.problemDescription,
        audit?.problemDescription as string,
        knowledgeEntry?.problemDescription,
      ),
      solution: this.pickNonEmptyString(
        fromDelta.solution,
        candidate?.solution,
        audit?.solution as string,
        knowledgeEntry?.solution,
      ),
    };
  }

  private findKnowledgeEntryForFeedbackEvent(
    event: ExtractionFeedbackEvent,
    entryByCandidate: Map<string, KnowledgeEntry>,
    entriesByDocument: Map<string, KnowledgeEntry[]>,
  ): KnowledgeEntry | null {
    const linked = entryByCandidate.get(event.candidateId);
    if (linked) return linked;
    if (event.signal === 'reject') return null;
    const list = entriesByDocument.get(event.documentId) ?? [];
    if (list.length === 0) return null;
    const eventMs = new Date(event.createdAt).getTime();
    let best: KnowledgeEntry | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const ent of list) {
      const diff = Math.abs(new Date(ent.createdAt).getTime() - eventMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = ent;
      }
    }
    if (best && bestDiff <= 15 * 60 * 1000) return best;
    return list[0] ?? null;
  }

  private async enrichExtractionFeedbackEvents(events: ExtractionFeedbackEvent[]): Promise<
    Array<
      ExtractionFeedbackEvent & {
        candidateTitle: string | null;
        candidateProblem: string | null;
        candidateSolution: string | null;
        documentOriginalName: string | null;
      }
    >
  > {
    if (events.length === 0) return [];

    const candidateIds = [...new Set(events.map((e) => e.candidateId))];
    const docIds = [...new Set(events.map((e) => e.documentId))];
    const approveDocIds = [
      ...new Set(events.filter((e) => e.signal !== 'reject').map((e) => e.documentId)),
    ];

    const [candidates, docs, auditLogs, kbEntries] = await Promise.all([
      this.extractionCandidatesRepository.find({ where: { id: In(candidateIds) } }),
      this.knowledgeDocumentsRepository.find({
        where: { id: In(docIds) },
        select: ['id', 'originalName', 'fileName'],
      }),
      this.auditLogRepository.find({
        where: {
          entityType: 'knowledge_extraction_candidate',
          entityId: In(candidateIds),
        },
        order: { timestamp: 'DESC' },
      }),
      approveDocIds.length > 0
        ? this.knowledgeEntryRepository
            .createQueryBuilder('k')
            .where('k.knowledgeDocumentId IN (:...docIds)', { docIds: approveDocIds })
            .andWhere('k.source = :source', { source: 'pdf_extraction' })
            .orderBy('k.createdAt', 'DESC')
            .getMany()
        : Promise.resolve([] as KnowledgeEntry[]),
    ]);

    const candById = new Map(candidates.map((c) => [c.id, c]));
    const docById = new Map(docs.map((d) => [d.id, d]));
    const auditByCandidate = new Map<string, Record<string, unknown>>();
    for (const log of auditLogs) {
      if (!auditByCandidate.has(log.entityId)) {
        auditByCandidate.set(log.entityId, (log.changes ?? {}) as Record<string, unknown>);
      }
    }

    const knowledgeEntryIds = [
      ...new Set(
        auditLogs
          .map((l) => (l.changes as Record<string, unknown> | null)?.knowledgeEntryId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const linkedEntries =
      knowledgeEntryIds.length > 0
        ? await this.knowledgeEntryRepository.find({ where: { id: In(knowledgeEntryIds) } })
        : [];
    const entryById = new Map(linkedEntries.map((e) => [e.id, e]));
    const entryByCandidate = new Map<string, KnowledgeEntry>();
    for (const log of auditLogs) {
      const ch = (log.changes ?? {}) as Record<string, unknown>;
      const kid = ch.knowledgeEntryId;
      if (typeof kid !== 'string' || entryByCandidate.has(log.entityId)) continue;
      const ent = entryById.get(kid);
      if (ent) entryByCandidate.set(log.entityId, ent);
    }

    const entriesByDocument = new Map<string, KnowledgeEntry[]>();
    for (const ent of kbEntries) {
      const docId = ent.knowledgeDocumentId;
      if (!docId) continue;
      if (!entriesByDocument.has(docId)) entriesByDocument.set(docId, []);
      entriesByDocument.get(docId)!.push(ent);
    }

    return events.map((e) => {
      const c = candById.get(e.candidateId);
      const d = docById.get(e.documentId);
      const audit = auditByCandidate.get(e.candidateId);
      const kbEntry = this.findKnowledgeEntryForFeedbackEvent(e, entryByCandidate, entriesByDocument);
      const snap = this.resolveFeedbackTextSnapshot(e.editDelta, c, audit, kbEntry);
      return {
        ...e,
        candidateTitle: snap.title,
        candidateProblem: snap.problemDescription,
        candidateSolution: snap.solution,
        documentOriginalName:
          d?.originalName ?? d?.fileName ?? (audit?.documentOriginalName as string) ?? null,
      };
    });
  }

  async getExtractionFeedbackDetail(eventId: string): Promise<
    ExtractionFeedbackEvent & {
      candidateTitle: string | null;
      candidateProblem: string | null;
      candidateSolution: string | null;
      documentOriginalName: string | null;
    }
  > {
    const event = await this.extractionFeedbackRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Feedback event not found');
    const [enriched] = await this.enrichExtractionFeedbackEvents([event]);
    return enriched;
  }

  async listRecentExtractionFeedback(options?: {
    page?: number;
    pageSize?: number;
    signal?: 'approve' | 'approve_edit' | 'reject';
  }): Promise<{
    items: Array<
      ExtractionFeedbackEvent & {
        candidateTitle: string | null;
        candidateProblem: string | null;
        candidateSolution: string | null;
        documentOriginalName: string | null;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    counts: { approve: number; approve_edit: number; reject: number };
  }> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(Math.max(1, options?.pageSize ?? 10), 100);
    const skip = (page - 1) * pageSize;
    const signal = options?.signal;
    const where = signal ? { signal } : {};

    const emptyCounts = { approve: 0, approve_edit: 0, reject: 0 };

    try {
      const [events, total, countsRaw] = await Promise.all([
        this.extractionFeedbackRepository.find({
          where,
          order: { createdAt: 'DESC' },
          skip,
          take: pageSize,
        }),
        this.extractionFeedbackRepository.count({ where }),
        this.extractionFeedbackRepository
          .createQueryBuilder('e')
          .select('e.signal', 'signal')
          .addSelect('COUNT(*)::int', 'cnt')
          .groupBy('e.signal')
          .getRawMany<{ signal: string; cnt: number }>(),
      ]);

      const counts = { ...emptyCounts };
      for (const row of countsRaw) {
        if (row.signal === 'approve') counts.approve = Number(row.cnt) || 0;
        else if (row.signal === 'approve_edit') counts.approve_edit = Number(row.cnt) || 0;
        else if (row.signal === 'reject') counts.reject = Number(row.cnt) || 0;
      }

      const items =
        events.length === 0 ? [] : await this.enrichExtractionFeedbackEvents(events);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        counts,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /extraction_feedback_events|relation.*does not exist|No metadata for "ExtractionFeedbackEvent"/i.test(
          msg,
        )
      ) {
        throw new BadRequestException(
          'Extraction feedback is not configured. Restart the backend after deploy, or run migrations (1700000000016).',
        );
      }
      throw err;
    }
  }

  /**
   * Rebuilds manual PDF chunks from current `page_analysis` (prefers `ocrText`) and upserts Qdrant.
   * Used after admin page text/image fixes so RAG matches fixed content (bounded like extraction).
   */
  async reindexManualChunksForDocument(documentId: string): Promise<{ ok: true; chunksIndexed: number }> {
    const doc = await this.findOne(documentId);
    if (!doc.filePath || !existsSync(doc.filePath)) {
      throw new BadRequestException('PDF file missing for re-index');
    }

    const fileBuffer = readFileSync(doc.filePath);
    const parsed: any = await parsePdfWithPoppler(fileBuffer);
    const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
    const relevantText = fullText;

    const maxChunksToProcess = Number(process.env.DOC_EXTRACTION_MAX_CHUNKS ?? 50);
    const indexMax = Number(process.env.DOC_INDEX_MAX_CHUNKS ?? 2000);
    const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
    const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);

    const chunks = await this.buildRoutedChunks(doc.id, relevantText, chunkSize, overlap);
    const prioritizedChunks = this.prioritizeChunksForExtraction(chunks, doc.docType ?? 'general_reference');
    const dedupedChunks = this.filterNearDuplicateChunks(prioritizedChunks);
    const embedWorthyChunks = this.filterEmbedWorthyChunks(dedupedChunks);
    const chunksToIndex = embedWorthyChunks.slice(0, indexMax);

    let manufacturer: string | null = null;
    if (doc.machineProfileId) {
      try {
        const mp = await this.machineProfilesService.findOne(doc.machineProfileId);
        manufacturer = mp.manufacturer ?? null;
      } catch {
        manufacturer = null;
      }
    }

    await this.ragService.indexDocumentChunks(doc.id, chunksToIndex, {
      machineProfileId: doc.machineProfileId,
      machineName: doc.machineName,
      manufacturer,
      docType: doc.docType,
      language: null,
    });

    doc.chunksIndexed = chunksToIndex.length;
    await this.knowledgeDocumentsRepository.save(doc);

    return { ok: true, chunksIndexed: chunksToIndex.length };
  }

  async getAdminPipelineSummary(): Promise<{
    extractionCandidatesPending: number;
  }> {
    const extractionCandidatesPending = await this.extractionCandidatesRepository.count({
      where: { status: 'candidate' },
    });
    return { extractionCandidatesPending };
  }

  async updateMachineName(documentId: string, machineName: string, _adminId: string): Promise<KnowledgeDocument> {
    const doc = await this.findOne(documentId);
    const trimmed = machineName.trim();
    if (!trimmed) throw new BadRequestException('Machine name cannot be empty');
    doc.machineName = trimmed;
    return this.knowledgeDocumentsRepository.save(doc);
  }

  async listMachineNameSuggestions(documentId: string): Promise<MachineNameSuggestion[]> {
    const doc = await this.findOne(documentId);
    if (doc.machineName != null && String(doc.machineName).trim() !== '') {
      return [];
    }
    return this.machineNameSuggestionsRepository.find({
      where: { documentId },
      relations: ['suggestedBy', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async suggestMachineName(
    documentId: string,
    proposedName: string,
    technicianId: string,
  ): Promise<MachineNameSuggestion> {
    const doc = await this.findOne(documentId);
    if (doc.machineName != null && String(doc.machineName).trim() !== '') {
      throw new BadRequestException('Machine name is already set; suggestions are not needed');
    }
    const trimmed = proposedName.trim();
    if (!trimmed) throw new BadRequestException('Proposed name cannot be empty');

    const row = this.machineNameSuggestionsRepository.create({
      documentId: doc.id,
      suggestedById: technicianId,
      proposedName: trimmed,
      status: 'pending',
      rejectReason: null,
      reviewedById: null,
      reviewedAt: null,
    });
    const saved = await this.machineNameSuggestionsRepository.save(row);

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.CREATE,
        entityType: 'knowledge_document',
        entityId: doc.id,
        userId: technicianId,
        changes: {
          event: 'machine_name_suggestion',
          suggestionId: saved.id,
          proposedName: saved.proposedName,
          documentOriginalName: doc.originalName,
        },
        reason: null,
      }),
    );

    return saved;
  }

  async approveMachineNameSuggestion(
    suggestionId: string,
    adminId: string,
    rejectOthersReason?: string,
  ): Promise<{ document: KnowledgeDocument; approved: MachineNameSuggestion }> {
    const suggestion = await this.machineNameSuggestionsRepository.findOne({
      where: { id: suggestionId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Only pending suggestions can be approved');
    }

    const doc = await this.findOne(suggestion.documentId);
    const sharedReason =
      rejectOthersReason?.trim() || 'Another suggestion was approved for this document.';
    const now = new Date();

    const pendingOthers = await this.machineNameSuggestionsRepository.find({
      where: { documentId: doc.id, status: 'pending' },
    });

    doc.machineName = suggestion.proposedName.trim();
    await this.knowledgeDocumentsRepository.save(doc);

    suggestion.status = 'approved';
    suggestion.reviewedById = adminId;
    suggestion.reviewedAt = now;
    suggestion.rejectReason = null;
    await this.machineNameSuggestionsRepository.save(suggestion);

    for (const o of pendingOthers) {
      if (o.id === suggestion.id) continue;
      o.status = 'rejected';
      o.rejectReason = sharedReason;
      o.reviewedById = adminId;
      o.reviewedAt = now;
      await this.machineNameSuggestionsRepository.save(o);

      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actionType: ActionType.REJECT,
          entityType: 'machine_name_suggestion',
          entityId: o.id,
          userId: adminId,
          changes: {
            forUserId: o.suggestedById,
            reviewedById: adminId,
            documentId: doc.id,
            documentOriginalName: doc.originalName,
            proposedName: o.proposedName,
            rejectReason: sharedReason,
            event: 'machine_name_suggestion_superseded',
          },
          reason: sharedReason,
        }),
      );
    }

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.APPROVE,
        entityType: 'machine_name_suggestion',
        entityId: suggestion.id,
        userId: adminId,
        changes: {
          forUserId: suggestion.suggestedById,
          reviewedById: adminId,
          documentId: doc.id,
          documentOriginalName: doc.originalName,
          proposedName: suggestion.proposedName,
          adoptedName: suggestion.proposedName,
          event: 'machine_name_suggestion_approved',
        },
        reason: null,
      }),
    );

    return { document: doc, approved: suggestion };
  }

  async rejectMachineNameSuggestion(
    suggestionId: string,
    adminId: string,
    reason?: string,
  ): Promise<MachineNameSuggestion> {
    const suggestion = await this.machineNameSuggestionsRepository.findOne({
      where: { id: suggestionId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Only pending suggestions can be rejected');
    }

    const doc = await this.findOne(suggestion.documentId);
    const now = new Date();
    const r = reason?.trim() || null;

    suggestion.status = 'rejected';
    suggestion.rejectReason = r;
    suggestion.reviewedById = adminId;
    suggestion.reviewedAt = now;
    await this.machineNameSuggestionsRepository.save(suggestion);

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.REJECT,
        entityType: 'machine_name_suggestion',
        entityId: suggestion.id,
        userId: adminId,
        changes: {
          forUserId: suggestion.suggestedById,
          reviewedById: adminId,
          documentId: doc.id,
          documentOriginalName: doc.originalName,
          proposedName: suggestion.proposedName,
          rejectReason: r,
          event: 'machine_name_suggestion_rejected',
        },
        reason: r,
      }),
    );

    return suggestion;
  }

  async continueDocumentExtraction(
    documentId: string,
    adminId: string,
  ): Promise<{ ok: true; jobId: string }> {
    const doc = await this.findOne(documentId);
    if (!['failed', 'partially_indexed'].includes(doc.status)) {
      throw new BadRequestException(
        'Continue is only for failed or partially_indexed documents (keeps OCR/vision already done)',
      );
    }
    const rows = await this.getPageAnalysis(documentId);
    if (rows.length === 0) {
      throw new BadRequestException('No page analysis saved — use gate approve or re-upload instead');
    }
    const jobId = await this.enqueueExtractionJob(documentId, { resume: true });
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.UPDATE,
        entityType: 'knowledge_document',
        entityId: doc.id,
        userId: adminId,
        changes: { event: 'extraction_continue', jobId },
        reason: doc.error,
      }),
    );
    return { ok: true, jobId };
  }

  async processDocumentExtraction(documentId: string, opts?: { resume?: boolean }): Promise<void> {
    const doc = await this.findOne(documentId);
    const resume = opts?.resume === true;

    try {
      doc.status = 'processing';
      doc.error = null;
      await this.knowledgeDocumentsRepository.save(doc);
      await this.updateProgress(doc.id, {
        currentStage: resume ? 'extraction_resume' : 'extraction_start',
        progressPercent: resume ? 10 : 5,
      });
      const promptPathCandidates = [
        join(process.cwd(), 'src', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
        join(__dirname, '..', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
        join(__dirname, 'prompts', 'techo-pdf-extractor-system.prompt.md'),
      ];

      const extractionPrompt = (() => {
        for (const p of promptPathCandidates) {
          try {
            return readFileSync(p, 'utf8');
          } catch {
            // try next candidate
          }
        }
        throw new Error('Could not load extractor prompt file');
      })();

      const fileBuffer = readFileSync(doc.filePath);
      const parsed: any = await parsePdfWithPoppler(fileBuffer);
      const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
      const totalPages = Number(parsed?.numpages ?? doc.totalPages ?? 0) || 0;
      await this.updateProgress(doc.id, {
        currentStage: 'page_quality_scoring',
        progressPercent: 12,
        totalPages,
        pagesProcessed: 0,
      });
      const existingRows = resume ? await this.getPageAnalysis(doc.id) : [];
      const canResumePages =
        resume && existingRows.length > 0 && existingRows.length === (totalPages || existingRows.length);
      if (!canResumePages) {
        await this.pageAnalysisRepository.delete({ documentId: doc.id });
        await this.savePageAnalysis(doc.id, parsed, fullText);
      }

      // Section 6 (3-Employee model):
      // Employee 2 (OCR) runs in the ocr-queue asynchronously.
      try {
        const ocrEnabled = String(process.env.ENABLE_PDF_OCR ?? 'false').toLowerCase() === 'true';
        if (doc.deepMode) {
          const rows = await this.getPageAnalysis(doc.id);
          const batches = this.splitRowsIntoBatches(rows, this.getDocBatchPages());
          const explainBeforeIndex =
            isPdfPageExplanationBeforeIndexEnabled() && this.isEffectivePdfVision();
          if (ocrEnabled) {
            const pageTexts = this.derivePageTexts(parsed, fullText);
            const glyphCorrupted = await this.detectGlyphCorruptedPagesForDocument(doc, rows);
            let toOcr = this.selectPageNumbersForOcr(rows, {
              mode: 'auto',
              pageTexts,
              glyphCorruptedPages: glyphCorrupted,
            });
            if (explainBeforeIndex) {
              // Vision explains schematics better than OCR; skip unreadable pages here.
              toOcr = toOcr.filter((p) => {
                const row = rows.find((r) => r.pageNumber === p);
                return row?.quality !== 'unreadable';
              });
            }
            if (canResumePages) {
              toOcr = this.filterPageNumbersNeedingOcr(rows, toOcr);
            }
            if (toOcr.length > 0) {
              if (isPdfOcrInlineBeforeIndexEnabled()) {
                await this.updateProgress(doc.id, {
                  currentStage: 'ocr_before_index',
                  progressPercent: 16,
                });
                try {
                  await this.ocrPagesFromPdf(doc.filePath, doc.id, toOcr);
                } catch (e: any) {
                  this.logger.warn(`Inline OCR before index failed: ${e?.message ?? e}`);
                  doc.error = `OCR failed before index: ${e?.message ?? e}`.slice(0, 2000);
                }
              } else {
                await this.enqueueOcrJob(doc.id, toOcr);
              }
            }
          } else if (this.isEffectivePdfVision()) {
            // OCR off: still allow vision-only pass on low-quality pages (bounded).
            const toVision = batches.flatMap((batchRows) =>
              batchRows
                .filter((r) => r.quality === 'poor' || r.quality === 'unreadable' || r.quality === 'degraded')
                .slice(0, this.getVisionMaxPagesPerBatch())
                .map((r) => r.pageNumber),
            );
            if (toVision.length > 0) {
              await this.enqueueVisionJob(doc.id, [...new Set(toVision)].sort((a, b) => a - b));
            }
          }

          if (explainBeforeIndex) {
            try {
              await this.updateProgress(doc.id, {
                currentStage: 'page_explanation_before_index',
                progressPercent: 18,
              });
              await this.runPageExplanationPassBeforeIndex(doc.id, parsed, fullText);
            } catch (e: any) {
              this.logger.warn(`Page explanation before index failed: ${e?.message ?? e}`);
            }
          } else if (this.isEffectivePdfVision()) {
            const maxVisionPagesPerBatch = this.getVisionMaxPagesPerBatch();
            const pageTextsForFigures = this.derivePageTexts(parsed, fullText);

            // CRITICAL pages for inline vision:
            // 1) pages where extracted text shows glyph corruption
            // 2) display-font pages in sections that strongly affect extraction
            //    quality (fault/alarm/procedure/warning/specification)
            const inlineVisionPages = new Set<number>();
            const extractionCriticalSections = new Set([
              'fault_table',
              'alarm_list',
              'procedure_steps',
              'warning_notice',
              'specification',
            ]);
            const displayFontPages = await this.detectDisplayFontPagesParallel(
              doc.filePath,
              rows.map((r) => r.pageNumber),
            );
            if (this.isGlyphCorruptionVisionEnabled()) {
              for (const batchRows of batches) {
                let perBatch = 0;
                for (const r of batchRows) {
                  if (
                    (r.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely'))
                  ) {
                    inlineVisionPages.add(r.pageNumber);
                    perBatch += 1;
                    if (perBatch >= maxVisionPagesPerBatch) break;
                  }
                }
              }
            }
            for (const batchRows of batches) {
              let perBatch = [...inlineVisionPages].filter((p) =>
                batchRows.some((r) => r.pageNumber === p),
              ).length;
              if (perBatch >= maxVisionPagesPerBatch) continue;
              for (const r of batchRows) {
                if (inlineVisionPages.has(r.pageNumber)) continue;
                const pageText = pageTextsForFigures[r.pageNumber - 1] ?? '';
                if (!this.pageLikelyNeedsUiVision(pageText, r.sectionType)) continue;
                inlineVisionPages.add(r.pageNumber);
                perBatch += 1;
                if (perBatch >= maxVisionPagesPerBatch) break;
              }
            }
            for (const batchRows of batches) {
              let perBatch = [...inlineVisionPages].filter((p) =>
                batchRows.some((r) => r.pageNumber === p),
              ).length;
              if (perBatch >= maxVisionPagesPerBatch) continue;
              for (const r of batchRows) {
                if (inlineVisionPages.has(r.pageNumber)) continue;
                if (!displayFontPages.has(r.pageNumber)) continue;
                if (!extractionCriticalSections.has(String(r.sectionType ?? ''))) continue;
                inlineVisionPages.add(r.pageNumber);
                perBatch += 1;
                if (perBatch >= maxVisionPagesPerBatch) break;
              }
            }

            if (inlineVisionPages.size > 0) {
              try {
                await this.updateProgress(doc.id, {
                  currentStage: 'vision_inline_critical_pages',
                  progressPercent: 18,
                });
                const inlineSorted = [...inlineVisionPages].sort((a, b) => a - b);
                await this.runVisionForDocumentPages(doc.id, inlineSorted);
              } catch (e: any) {
                this.logger.warn(`Inline vision for critical pages failed: ${e?.message ?? e}`);
              }
            }

            // Display-font pages that did NOT show corruption symptoms can be
            // vision-enriched asynchronously without blocking extraction.
            const asyncDisplayPages = new Set(
              [...displayFontPages].filter((p) => !inlineVisionPages.has(p)),
            );
            for (const batchRows of batches) {
              const enriched = new Set<number>();
              for (const r of batchRows) {
                if (asyncDisplayPages.has(r.pageNumber)) {
                  enriched.add(r.pageNumber);
                  if (enriched.size >= maxVisionPagesPerBatch) break;
                }
              }
              const pages = [...enriched].sort((a, b) => a - b);
              if (pages.length > 0) {
                await this.enqueueVisionJob(doc.id, pages);
              }
            }

            if (this.isFigureVisionEnabled()) {
              for (const batchRows of batches) {
                const figurePages = new Set<number>();
                for (const r of batchRows) {
                  if (inlineVisionPages.has(r.pageNumber)) continue;
                  if (asyncDisplayPages.has(r.pageNumber)) continue;
                  if (
                    r.sectionType === 'wiring' ||
                    this.pageLikelyHasDiagram(pageTextsForFigures[r.pageNumber - 1] ?? '')
                  ) {
                    figurePages.add(r.pageNumber);
                    if (figurePages.size >= maxVisionPagesPerBatch) break;
                  }
                }
                const enrichmentPages = [...figurePages].sort((a, b) => a - b).slice(0, maxVisionPagesPerBatch);
                if (enrichmentPages.length > 0) {
                  await this.enqueueVisionJob(doc.id, enrichmentPages);
                }
              }
            }
          }
        }
      } catch {
        // OCR / vision queue is best-effort; keep pipeline running.
      }
      // Deep mode is the default architecture mode (full pipeline).
      doc.deepMode = true;
      await this.knowledgeDocumentsRepository.save(doc);

      if (doc.machineName == null || String(doc.machineName).trim() === '') {
        let extractedName: string | null = null;
        try {
          extractedName = await this.extractMachineNameFromManual(fullText);
        } catch {
          extractedName = null;
        }
        if (extractedName) {
          doc.machineName = extractedName;
          await this.knowledgeDocumentsRepository.save(doc);
        }
      }

      const relevantText = fullText;

      // NOTE: Extraction time depends on how many chunks we send to the LLM.
      // For MVP we keep this bounded so it doesn't take forever on large manuals.
      // Defaults are intentionally higher so you can extract "many" problems from manuals.
      // You can further tune these in env vars if you want.
      const maxChunksToProcess = Number(process.env.DOC_EXTRACTION_MAX_CHUNKS ?? 50);
      const indexMax = Number(process.env.DOC_INDEX_MAX_CHUNKS ?? 2000);
      const maxCandidatesTotal = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES ?? 200);
      const maxCandidatesPerChunk = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK ?? 10);
      const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
      const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);

      const chunks = await this.buildRoutedChunks(doc.id, relevantText, chunkSize, overlap);
      const prioritizedChunks = this.prioritizeChunksForExtraction(chunks, doc.docType ?? 'general_reference');
      const dedupedChunks = this.filterNearDuplicateChunks(prioritizedChunks);
      const embedWorthyChunks = this.filterEmbedWorthyChunks(dedupedChunks);

      const ocrScaffold = this.getOcrScaffoldMetadata(fullText);
      if (ocrScaffold.quality === 'poor') {
        doc.error = 'Scan quality looks poor; OCR/vision fallback recommended in next phase.';
        await this.knowledgeDocumentsRepository.save(doc);
      }

      const candidatesToSave: KnowledgeExtractionCandidate[] = [];
      const chunksToUse = embedWorthyChunks.slice(0, maxChunksToProcess);
      const chunksToIndex = embedWorthyChunks.slice(0, indexMax);
      const chunkRagMeta: (DocumentChunkRowMeta | undefined)[] = new Array(chunksToUse.length);
      await this.updateProgress(doc.id, { currentStage: 'structured_extraction', progressPercent: 25 });
      const dedupe = new Set<string>();

      for (const [chunkIndex, chunk] of chunksToUse.entries()) {
        if (candidatesToSave.length >= maxCandidatesTotal) break;
        const sectionType = this.classifyChunkSection(chunk, doc.docType ?? 'general_reference');

        const userContent =
          `Extract structured maintenance knowledge candidates from this text.\n` +
          `Return JSON ONLY with key "candidates".\n` +
          `Each candidate must use keys: entryType, title, problemDescription, solution, symptom, rootCause, tags, sourcePages, confidence.\n` +
          `Preserve the original language(s) of the source text exactly; do not translate.\n` +
          `entryType must be one of: fault, procedure, safety, wiring, spec.\n` +
          `Section type hint: ${sectionType}\n` +
          `Chunk index: ${chunkIndex}\n\n` +
          chunk;

        const messages = [
          { role: 'system' as const, content: extractionPrompt },
          { role: 'user' as const, content: userContent },
        ];

        const raw = await this.aiService.chatPdf(messages);

        const parsedJson = this.tryParseJson(raw);
        const candidates = parsedJson?.candidates;
        if (!Array.isArray(candidates)) continue;

        const newCandidates: KnowledgeExtractionCandidate[] = [];

        for (const c of candidates.slice(0, maxCandidatesPerChunk)) {
          if (!c?.title || !c?.problemDescription || !c?.solution) continue;
          const fp = `${String(c.title).trim().toLowerCase()}|${String(c.problemDescription)
            .trim()
            .toLowerCase()}|${String(c.solution).trim().toLowerCase()}`;
          if (dedupe.has(fp)) continue;
          dedupe.add(fp);
          const parsedConfidence = Number(c.confidence);
          const confidence = Number.isFinite(parsedConfidence)
            ? Math.max(0, Math.min(1, parsedConfidence))
            : null;
          const sourcePagesRaw =
            Array.isArray(c.sourcePages) ? c.sourcePages.join(',') : c.sourcePages ? String(c.sourcePages) : null;

          const candidate = this.extractionCandidatesRepository.create({
            documentId: doc.id,
            entryType: c.entryType ? String(c.entryType) : this.defaultEntryTypeFromSection(sectionType),
            title: String(c.title),
            problemDescription: String(c.problemDescription),
            solution: String(c.solution),
            symptom: c.symptom ? String(c.symptom) : null,
            rootCause: c.rootCause ? String(c.rootCause) : null,
            tags: Array.isArray(c.tags) ? c.tags.join(',') : c.tags ? String(c.tags) : null,
            sourcePages: sourcePagesRaw,
            confidence,
            sectionType,
            status: 'candidate',
            createdById: doc.uploadedById,
            reviewedById: null,
          });

          candidatesToSave.push(candidate);
          newCandidates.push(candidate);
        }

        // Save progressively so the UI can show counts while we keep extracting.
        if (newCandidates.length > 0) {
          await this.extractionCandidatesRepository.save(newCandidates);
        }

        if (newCandidates.length > 0) {
          const best = newCandidates.reduce((a, b) =>
            (Number(b.confidence) || 0) > (Number(a.confidence) || 0) ? b : a,
          );
          chunkRagMeta[chunkIndex] = {
            sectionType,
            title: best.title ? String(best.title).slice(0, 400) : null,
            sourcePages: best.sourcePages ?? null,
            confidence: best.confidence ?? null,
            entryType: best.entryType ?? null,
          };
        } else {
          chunkRagMeta[chunkIndex] = { sectionType };
        }

        const pct = Math.min(78, 25 + Math.round(((chunkIndex + 1) / Math.max(1, chunksToUse.length)) * 53));
        await this.updateProgress(doc.id, {
          progressPercent: pct,
          pagesProcessed: Math.min(totalPages || chunksToUse.length, chunkIndex + 1),
          lastProcessedPage: chunkIndex + 1,
        });
      }

      // Ensure final persist (idempotent-ish since we save progressively already).
      // If candidatesToSave is empty, this is a no-op.
      if (candidatesToSave.length > 0) {
        await this.extractionCandidatesRepository.save(candidatesToSave);
      }

      doc.status = 'done';
      doc.error = null;
      doc.chunksIndexed = 0;
      await this.knowledgeDocumentsRepository.save(doc);
      await this.updateProgress(doc.id, { currentStage: 'indexing', progressPercent: 85 });

      // Part A (RAG): index the manual chunks into Qdrant.
      // Keep extraction MVP working even if indexing fails.
      try {
        let manufacturer: string | null = null;
        if (doc.machineProfileId) {
          try {
            const mp = await this.machineProfilesService.findOne(doc.machineProfileId);
            manufacturer = mp.manufacturer ?? null;
          } catch {
            manufacturer = null;
          }
        }
        await this.ragService.indexDocumentChunks(
          doc.id,
          chunksToIndex,
          {
            machineProfileId: doc.machineProfileId,
            machineName: doc.machineName,
            manufacturer,
            docType: doc.docType,
            language: null,
          },
          chunkRagMeta,
        );
        doc.chunksIndexed = chunksToIndex.length;
        doc.status = 'done';
        if (chunksToIndex.length === 0) {
          doc.status = 'partially_indexed';
          doc.error =
            doc.error ??
            'No searchable chunks were indexed (often: Paddle OCR or vision failed on glyph/LCD pages). Re-run OCR/vision after fixing paddle-ocr, then re-index.';
        }
        await this.knowledgeDocumentsRepository.save(doc);
        await this.updateProgress(doc.id, {
          currentStage: chunksToIndex.length > 0 ? 'done' : 'partially_indexed',
          progressPercent: chunksToIndex.length > 0 ? 100 : 92,
          pagesProcessed: totalPages || chunksToIndex.length,
          lastProcessedPage: totalPages || chunksToIndex.length,
        });
      } catch (indexErr: any) {
        doc.error = `Indexing failed: ${indexErr?.message ? String(indexErr.message) : 'unknown error'}`;
        doc.chunksIndexed = 0;
        doc.status = 'partially_indexed';
        await this.knowledgeDocumentsRepository.save(doc);
        await this.updateProgress(doc.id, { currentStage: 'partially_indexed', progressPercent: 92 });
      }
    } catch (e: any) {
      doc.status = 'failed';
      doc.error = e?.message ? String(e.message) : 'PDF extraction failed';
      await this.knowledgeDocumentsRepository.save(doc);
      await this.updateProgress(doc.id, { currentStage: 'failed', progressPercent: 100 });
    }
  }

  private heuristicDocType(text: string, originalName: string): string {
    const corpus = `${originalName} ${text}`.toLowerCase();
    if (/(wiring|diagram|schematic|circuit|mcc|single line|electrical)/i.test(corpus)) {
      return 'electrical_circuit_guide';
    }
    if (/(wincc|hmi|screen|siemens|operator panel)/i.test(corpus)) {
      return 'hmi_software_guide';
    }
    if (/(safety|consigne|sécurité|warning|hazard|ppe|lockout|tagout)/i.test(corpus)) {
      return 'safety_document';
    }
    if (/(manual|troubleshooting|fault|alarm|maintenance|machine|service)/i.test(corpus)) {
      return 'machine_manual';
    }
    return 'general_reference';
  }

  private quickRelevanceHeuristic(text: string, originalName: string): { score: number; reason: string } {
    const corpus = `${originalName} ${text}`.toLowerCase();
    const positive = [
      'machine',
      'maintenance',
      'fault',
      'alarm',
      'circuit',
      'wiring',
      'mcc',
      'motor',
      'plc',
      'hmi',
      'manual',
      'safety',
      'consigne',
      'service',
    ];
    const negative = ['recipe', 'kitchen', 'game', 'gaming', 'travel', 'movie', 'football', 'cooking'];
    let score = 0;
    for (const t of positive) if (corpus.includes(t)) score += 0.08;
    for (const t of negative) if (corpus.includes(t)) score -= 0.18;
    const normalized = Math.max(0, Math.min(1, 0.5 + score));
    const reason =
      normalized >= 0.8
        ? 'Strong industrial/maintenance signal'
        : normalized < 0.55
          ? 'Low work-related signal'
          : 'Mixed signal';
    return { score: normalized, reason };
  }

  private async classifyUploadGateThreeTier(
    pageTexts: string[],
    originalName: string,
  ): Promise<{
    isWorkRelated: boolean;
    docType: string;
    confidence: number;
    reason: string;
    decision: 'accepted' | 'needs_review' | 'rejected';
    detectedMachineName?: string | null;
    detectedManufacturer?: string | null;
    language?: string | null;
  }> {
    const joinFirstPages = (count: number) =>
      pageTexts.slice(0, Math.min(count, pageTexts.length)).join('\n\n');

    const tier1Pages = getGateHeuristicPageCount();
    const tier2Pages = getGateTier2PageCount();
    const heuristicBody = joinFirstPages(tier1Pages).slice(0, 12000);
    const tier2EmbedBody = joinFirstPages(tier2Pages).slice(0, 5000);
    const llmBody = joinFirstPages(tier1Pages).slice(0, getGateLlmCharLimit());

    const heur = this.quickRelevanceHeuristic(heuristicBody, originalName);
    const heuristicType = this.heuristicDocType(heuristicBody, originalName);
    const acceptAbove = getGateTier1AcceptAbove();
    const rejectBelow = getGateTier1RejectBelow();

    // Tier 1: heuristic fast decision.
    if (heur.score > acceptAbove) {
      return {
        isWorkRelated: true,
        docType: heuristicType,
        confidence: heur.score,
        reason: `Tier1 heuristic accept: ${heur.reason}`,
        decision: 'accepted',
        detectedMachineName: null,
        detectedManufacturer: null,
        language: null,
      };
    }
    if (heur.score < rejectBelow) {
      return {
        isWorkRelated: false,
        docType: 'irrelevant',
        confidence: heur.score,
        reason: `Tier1 heuristic reject: ${heur.reason}`,
        decision: 'rejected',
        detectedMachineName: null,
        detectedManufacturer: null,
        language: null,
      };
    }

    // Tier 2: embedding similarity to work/non-work profiles (first N pages only — 2).
    try {
      const [sampleVec, workVec, nonWorkVec] = await Promise.all([
        this.ragService.embedText(tier2EmbedBody),
        this.getWorkProfileEmbedding(),
        this.getNonWorkProfileEmbedding(),
      ]);
      const workSim = this.cosineSimilarity(sampleVec, workVec);
      const nonWorkSim = this.cosineSimilarity(sampleVec, nonWorkVec);
      const workMin = getGateTier2WorkSimMin();
      const nonWorkMin = getGateTier2NonWorkSimMin();
      if (workSim > workMin) {
        return {
          isWorkRelated: true,
          docType: heuristicType,
          confidence: Math.max(workSim, heur.score),
          reason: `Tier2 embedding accept (workSim=${workSim.toFixed(2)})`,
          decision: 'accepted',
          detectedMachineName: null,
          detectedManufacturer: null,
          language: null,
        };
      }
      if (nonWorkSim > nonWorkMin) {
        return {
          isWorkRelated: false,
          docType: 'irrelevant',
          confidence: Math.max(nonWorkSim, 1 - heur.score),
          reason: `Tier2 embedding reject (nonWorkSim=${nonWorkSim.toFixed(2)})`,
          decision: 'rejected',
          detectedMachineName: null,
          detectedManufacturer: null,
          language: null,
        };
      }
    } catch {
      // continue to tier 3
    }

    // Tier 3: LLM classifier
    const messages = [
      {
        role: 'system' as const,
        content:
          'Classify if a PDF is related to industrial maintenance work. Return JSON only with keys: ' +
          '{"isWorkRelated": boolean, "docType": string, "confidence": number, "reason": string, ' +
          '"language": string|null, "detectedMachineName": string|null, "detectedManufacturer": string|null}. ' +
          'language should be an ISO 639-1 code when possible (e.g. "fr", "en", "ar"). ' +
          'docType must be one of: machine_manual, electrical_circuit_guide, hmi_software_guide, safety_document, operations_procedure, general_reference, irrelevant.',
      },
      {
        role: 'user' as const,
        content:
          `Filename: ${originalName}\n` +
          `Heuristic doc type guess: ${heuristicType}\n` +
          `Text sample:\n${llmBody}`,
      },
    ];

    try {
      const raw = await this.aiService.chatPdf(messages);
      const parsed = this.tryParseJson(raw) ?? {};
      const aiConfidence = Number(parsed.confidence);
      const aiIsWorkRelated = parsed.isWorkRelated === true;
      const aiDocType = typeof parsed.docType === 'string' ? parsed.docType : heuristicType;
      const aiReason = typeof parsed.reason === 'string' ? parsed.reason : heur.reason;
      const detectedMachineName =
        typeof parsed.detectedMachineName === 'string' && parsed.detectedMachineName.trim()
          ? parsed.detectedMachineName.trim()
          : null;
      const detectedManufacturer =
        typeof parsed.detectedManufacturer === 'string' && parsed.detectedManufacturer.trim()
          ? parsed.detectedManufacturer.trim()
          : null;
      const language =
        typeof parsed.language === 'string' && parsed.language.trim() ? parsed.language.trim().slice(0, 12) : null;

      const hasValidAi = Number.isFinite(aiConfidence) && aiConfidence >= 0 && aiConfidence <= 1;
      if (hasValidAi) {
        // Blend AI + heuristic.
        const blended = Math.max(0, Math.min(1, aiConfidence * 0.75 + heur.score * 0.25));
        const decision =
          blended >= 0.8
            ? aiIsWorkRelated
              ? 'accepted'
              : 'rejected'
            : blended < 0.55
              ? aiIsWorkRelated
                ? 'needs_review'
                : 'rejected'
              : 'needs_review';
        return {
          isWorkRelated: aiIsWorkRelated,
          docType: aiDocType,
          confidence: blended,
          reason: aiReason,
          decision,
          detectedMachineName,
          detectedManufacturer,
          language,
        };
      }
    } catch {
      // fallback below
    }

    const fallbackIsWork = heur.score >= 0.55;
    return {
      isWorkRelated: fallbackIsWork,
      docType: fallbackIsWork ? heuristicType : 'irrelevant',
      confidence: heur.score,
      reason: `Heuristic fallback: ${heur.reason}`,
      decision: fallbackIsWork ? 'needs_review' : 'rejected',
      detectedMachineName: null,
      detectedManufacturer: null,
      language: null,
    };
  }

  private async getWorkProfileEmbedding(): Promise<number[]> {
    if (this.workProfileEmbedding) return this.workProfileEmbedding;
    const profileText = [
      'industrial machine maintenance manual fault troubleshooting alarm wiring plc inverter motor sensor actuator',
      'safety procedure lockout tagout machine operation corrective action preventive maintenance',
      'electrical circuit schematic relay mcc panel voltage current terminal diagram',
    ].join('\n');
    this.workProfileEmbedding = await this.ragService.embedText(profileText);
    return this.workProfileEmbedding;
  }

  private async getNonWorkProfileEmbedding(): Promise<number[]> {
    if (this.nonWorkProfileEmbedding) return this.nonWorkProfileEmbedding;
    const profileText = [
      'recipe cooking kitchen food ingredients meal restaurant',
      'gaming game walkthrough sport football movie entertainment travel',
      'personal blog lifestyle social media',
    ].join('\n');
    this.nonWorkProfileEmbedding = await this.ragService.embedText(profileText);
    return this.nonWorkProfileEmbedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    if (!denom) return 0;
    return dot / denom;
  }

  private classifyChunkSection(chunk: string, docType: string): string {
    const text = `${docType} ${chunk}`.toLowerCase();
    if (/(fault|alarm|error|troubleshoot|failure|cause)/i.test(text)) return 'fault_table';
    if (/(alarm|alarme|a-\d+|alarm list)/i.test(text)) return 'alarm_list';
    if (/(wiring|schematic|circuit|terminal|connector|mcc|single line)/i.test(text)) return 'wiring';
    if (/(warning|danger|hazard|sécurité|ppe|lockout|tagout)/i.test(text)) return 'warning_notice';
    if (/(step|procedure|setup|calibration|commissioning|install)/i.test(text)) return 'procedure_steps';
    if (/(specification|rating|voltage|current|dimension|torque)/i.test(text)) return 'specification';
    return 'general_text';
  }

  private defaultEntryTypeFromSection(sectionType: string): string {
    if (sectionType === 'fault_table') return 'fault';
    if (sectionType === 'alarm_list') return 'fault';
    if (sectionType === 'wiring') return 'wiring';
    if (sectionType === 'warning_notice') return 'safety';
    if (sectionType === 'procedure_steps') return 'procedure';
    if (sectionType === 'specification') return 'spec';
    return 'procedure';
  }

  private splitTextIntoPageBuckets(text: string, expectedPages: number): string[] {
    const byFormFeed = String(text || '')
      .split('\f')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (byFormFeed.length >= Math.max(1, expectedPages)) {
      return byFormFeed;
    }
    if (expectedPages <= 1) return [String(text || '')];
    const src = String(text || '');
    const perPage = Math.max(1, Math.ceil(src.length / expectedPages));
    const buckets: string[] = [];
    for (let i = 0; i < expectedPages; i++) {
      buckets.push(src.slice(i * perPage, (i + 1) * perPage));
    }
    return buckets;
  }

  private async buildRoutedChunks(
    documentId: string,
    text: string,
    chunkSize: number,
    overlap: number,
  ): Promise<string[]> {
    // Use per-page routing if available; else fall back to generic chunking.
    const pageRows = await this.pageAnalysisRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
    if (!pageRows || pageRows.length === 0) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const chunk = text.slice(i, i + chunkSize);
        if (chunk.trim().length > 0) chunks.push(chunk);
      }
      return chunks;
    }

    // Derive page texts from the same string (consistent with derivePageTexts),
    // with a fallback when pdf-parse does not include form-feed separators.
    const pages = this.splitTextIntoPageBuckets(text, pageRows.length);
    const chunks: string[] = [];
    const minGoodChars = this.getMinGoodOcrCharsForVisionSkip();
    for (let i = 0; i < pageRows.length; i++) {
      const row = pageRows[i];
      const rawPageText = (pages[i] ?? '').trim();
      const rawGlyphCorrupted =
        this.detectGlyphCorruption(rawPageText).corrupted ||
        (row?.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely'));
      const hasOcr = !!(row?.ocrText && row.ocrText.trim().length > 0);
      // Never index Poppler LCD-font garbage when VL/vision has not run yet.
      if (!hasOcr && rawGlyphCorrupted) {
        continue;
      }
      if (shouldSkipPopplerOnlyForRow(row, rawPageText, hasOcr, minGoodChars)) {
        continue;
      }
      let pageText = extractVisionPreferredPageText(
        hasOcr ? row!.ocrText! : rawPageText,
        rawPageText,
        row,
        rawGlyphCorrupted,
      ).trim();
      if (!pageText) continue;
      const st = row?.sectionType ?? this.detectSectionType(pageText);
      const pageNumber = row?.pageNumber ?? i + 1;
      const prefix = formatPageChunkPrefix(pageNumber, st, !!row?.visionUsed);
      pageText = `${prefix}\n${pageText}`;

      if (st === 'fault_table' || st === 'alarm_list') {
        // Try line-based splitting for tables/lists.
        for (const line of pageText.split(/\r?\n/)) {
          const l = line.trim();
          if (!l) continue;
          if (l.length < 20) continue;
          // keep likely entries: codes or separators
          if (/(E-\d+|A-\d+|\|)/i.test(l)) {
            chunks.push(l);
          }
        }
        continue;
      }

      if (st === 'warning_notice') {
        // keep the full warning block per page
        chunks.push(pageText.slice(0, 6000));
        continue;
      }

      if (st === 'procedure_steps') {
        // keep full procedure per page (simple baseline)
        chunks.push(pageText.slice(0, 9000));
        continue;
      }

      if (st === 'wiring' || st === 'specification') {
        chunks.push(pageText.slice(0, 9000));
        continue;
      }

      // general fallback
      for (let off = 0; off < pageText.length; off += chunkSize - overlap) {
        const ch = pageText.slice(off, off + chunkSize);
        if (ch.trim()) chunks.push(ch);
      }
    }

    return chunks;
  }

  private prioritizeChunksForExtraction(chunks: string[], docType: string): string[] {
    const scored = chunks.map((chunk) => {
      const sectionType = this.classifyChunkSection(chunk, docType);
      const text = chunk.toLowerCase();

      // Table of contents / headings are prioritized to make the doc useful quickly.
      const looksLikeToc =
        /(table of contents|contents|sommaire|index)/i.test(text) ||
        (text.includes('.....') && /\b\d{1,4}\b/.test(text));

      const score = (() => {
        if (looksLikeToc) return 100;
        if (sectionType === 'fault_table') return 90;
        if (sectionType === 'alarm_list') return 85;
        if (sectionType === 'procedure_steps') return 80;
        if (sectionType === 'warning_notice') return 75;
        if (sectionType === 'specification') return 60;
        if (sectionType === 'wiring') return 55;
        return 10;
      })();

      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.chunk);
  }

  private getNearDuplicateJaccardThreshold(): number {
    const raw = Number(process.env.DOC_CHUNK_NEAR_DUPLICATE_JACCARD ?? 0.97);
    if (!Number.isFinite(raw)) return 0.97;
    return Math.max(0.75, Math.min(0.995, raw));
  }

  private normalizeChunkForSimilarity(text: string): string {
    return String(text || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^a-z0-9\u00c0-\u017f]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private jaccardSetSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    const small = a.size <= b.size ? a : b;
    const big = a.size <= b.size ? b : a;
    for (const x of small) {
      if (big.has(x)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private filterEmbedWorthyChunks(chunks: string[]): string[] {
    return chunks.filter((c) => !isLowValueChunkText(c));
  }

  /** Pages with HMI/button instructions benefit from vision even when Poppler text looks "good". */
  private pageLikelyNeedsUiVision(pageText: string, sectionType?: string | null): boolean {
    const t = String(pageText || '');
    if (!t.trim()) return false;
    if (sectionType === 'procedure_steps' || sectionType === 'warning_notice') {
      if (/(appuyez|press|touchez|touch|button|touche)/i.test(t)) return true;
    }
    if (/\bGoto\b|\bConf\b|\bULoc\b|\bSP\s*:/i.test(t)) return true;
    if (/\[RETURN\]|\[UP\]|\[DOWN\]/i.test(t)) return false;
    if (/(▲|▼|△|▽)/.test(t) && /(appuyez|press|configuration|mode)/i.test(t)) return true;
    return false;
  }

  private filterNearDuplicateChunks(chunks: string[]): string[] {
    const threshold = this.getNearDuplicateJaccardThreshold();
    const kept: string[] = [];
    const tokenSets: Set<string>[] = [];
    for (const chunk of chunks) {
      if (isLowValueChunkText(chunk)) continue;
      const norm = this.normalizeChunkForSimilarity(chunk);
      const tokens = norm.split(' ').filter((t) => t.length >= 3);
      const tokenSet = new Set(tokens);
      if (tokenSet.size === 0) {
        if (!isLowValueChunkText(chunk)) {
          kept.push(chunk);
          tokenSets.push(tokenSet);
        }
        continue;
      }
      let duplicate = false;
      for (let i = 0; i < tokenSets.length; i++) {
        const sim = this.jaccardSetSimilarity(tokenSet, tokenSets[i]);
        if (sim >= threshold) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) {
        kept.push(chunk);
        tokenSets.push(tokenSet);
      }
    }
    return kept;
  }

  private normalizeExtractedText(text: string): string {
    return String(text || '')
      .replace(/\u0000/g, '')
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
      .normalize('NFC');
  }

  private async detectGlyphCorruptedPagesForDocument(
    doc: KnowledgeDocument,
    pageRows: KnowledgeDocumentPageAnalysis[],
  ): Promise<Set<number>> {
    const flagged = new Set<number>();
    for (const row of pageRows) {
      const warned = (row.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely'));
      if (warned || this.detectGlyphCorruption(row.ocrText ?? '').corrupted) {
        flagged.add(row.pageNumber);
      }
    }
    if (!doc.filePath || !existsSync(doc.filePath)) return flagged;
    try {
      const fileBuffer = readFileSync(doc.filePath);
      const parsed: any = await parsePdfWithPoppler(fileBuffer);
      const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
      const pageTexts = this.derivePageTexts(parsed, fullText);
      for (const row of pageRows) {
        const raw = pageTexts[row.pageNumber - 1] ?? '';
        if (this.detectGlyphCorruption(raw).corrupted) {
          flagged.add(row.pageNumber);
        }
      }
    } catch {
      // best effort only
    }
    return flagged;
  }

  private getOcrScaffoldMetadata(fullText: string): { quality: 'good' | 'degraded' | 'poor'; reason: string } {
    const len = fullText.trim().length;
    if (len < 600) {
      return {
        quality: 'poor',
        reason: 'Very low text density; likely scanned/diagram-heavy PDF.',
      };
    }
    if (len < 2500) {
      return {
        quality: 'degraded',
        reason: 'Low text density; OCR/vision pass should be prioritized.',
      };
    }
    return { quality: 'good', reason: 'Text layer looks sufficient for first-pass extraction.' };
  }

  private async savePageAnalysis(documentId: string, parsed: any, fullText: string): Promise<void> {
    const pageTexts = this.derivePageTexts(parsed, fullText);
    const rows: KnowledgeDocumentPageAnalysis[] = [];
    for (const [idx, pageText] of pageTexts.entries()) {
      const qualityEval = this.scorePageQuality(pageText);
      const sectionType = this.detectSectionType(pageText);
      const glyph = this.detectGlyphCorruption(pageText);
      let quality = qualityEval.quality;
      const warnings = [...qualityEval.warnings];
      if (glyph.corrupted) {
        warnings.push(`glyph_corruption_likely(${glyph.suspectTokenCount})`);
        if (quality === 'good') quality = 'degraded';
      }
      rows.push(
        this.pageAnalysisRepository.create({
          documentId,
          pageNumber: idx + 1,
          quality,
          ocrConfidence: qualityEval.ocrConfidence,
          ocrText: null,
          visionUsed: false,
          processingMode: 'raw',
          qualityWarnings: warnings,
          sectionType,
          extractionMode: 'text',
        }),
      );
    }
    if (rows.length > 0) {
      await this.pageAnalysisRepository.save(rows);
    }

  }

  private async loadPopplerPageTextsForDocument(doc: KnowledgeDocument): Promise<string[]> {
    if (!doc.filePath || !existsSync(doc.filePath)) return [];
    try {
      const parsed: any = await parsePdfWithPoppler(readFileSync(doc.filePath));
      const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
      return this.derivePageTexts(parsed, fullText);
    } catch {
      return [];
    }
  }

  /**
   * Pages that need a ChatGPT-style vision explanation before the first Qdrant index.
   */
  private getMinGoodOcrCharsForVisionSkip(): number {
    return Number(process.env.PDF_PAGE_EXPLAIN_MIN_CHARS ?? 200);
  }

  private filterPageNumbersNeedingOcr(rows: KnowledgeDocumentPageAnalysis[], pageNumbers: number[]): number[] {
    const minOcr = Number(process.env.PDF_OCR_REOCR_BELOW_CHARS ?? 120);
    const rowMap = new Map(rows.map((r) => [r.pageNumber, r]));
    return pageNumbers.filter((p) => {
      const row = rowMap.get(p);
      if (!row) return true;
      return (row.ocrText ?? '').trim().length < minOcr;
    });
  }

  private async filterPageNumbersNeedingVision(documentId: string, pageNumbers: number[]): Promise<number[]> {
    if (!pageNumbers.length) return [];
    const minGood = this.getMinGoodOcrCharsForVisionSkip();
    const rows = await this.pageAnalysisRepository.find({
      where: { documentId, pageNumber: In(pageNumbers) },
    });
    const rowMap = new Map(rows.map((r) => [r.pageNumber, r]));
    return pageNumbers.filter((p) => {
      const row = rowMap.get(p);
      if (!row) return true;
      if (row.visionUsed && (row.ocrText ?? '').trim().length >= minGood) return false;
      return true;
    });
  }

  private selectPageNumbersForPageExplanation(
    pageRows: KnowledgeDocumentPageAnalysis[],
    pageTexts: string[],
    glyphCorrupted: Set<number>,
    displayFontPages: Set<number>,
  ): number[] {
    const minGoodChars = Number(process.env.PDF_PAGE_EXPLAIN_MIN_CHARS ?? 200);
    const selected: number[] = [];

    for (const row of pageRows) {
      const pageText = pageTexts[row.pageNumber - 1] ?? '';
      const ocrLen = (row.ocrText ?? '').trim().length;
      if (row.visionUsed && ocrLen >= minGoodChars) continue;

      const needs =
        glyphCorrupted.has(row.pageNumber) ||
        displayFontPages.has(row.pageNumber) ||
        row.quality === 'poor' ||
        row.quality === 'unreadable' ||
        row.quality === 'degraded' ||
        row.sectionType === 'wiring' ||
        this.pageLikelyHasDiagram(pageText) ||
        this.pageLikelyNeedsUiVision(pageText, row.sectionType) ||
        ocrLen < minGoodChars;

      if (needs) selected.push(row.pageNumber);
    }

    const uniq = [...new Set(selected)].sort((a, b) => a - b);
    const cap = getPdfPageExplanationMaxPages();
    return cap > 0 ? uniq.slice(0, cap) : uniq;
  }

  private async runPageExplanationPassBeforeIndex(
    documentId: string,
    parsed: unknown,
    fullText: string,
  ): Promise<void> {
    const doc = await this.findOne(documentId);
    const rows = await this.getPageAnalysis(documentId);
    const pageTexts = this.derivePageTexts(parsed, fullText);
    const glyphCorrupted = await this.detectGlyphCorruptedPagesForDocument(doc, rows);
    const displayFontPages = await this.detectDisplayFontPagesParallel(
      doc.filePath,
      rows.map((r) => r.pageNumber),
    );
    const pages = this.selectPageNumbersForPageExplanation(rows, pageTexts, glyphCorrupted, displayFontPages);
    if (!pages.length) return;

    const batchSize = Math.max(1, this.getVisionMaxPagesPerBatch());
    const totalVision = pages.length;
    let visionDone = 0;
    for (let i = 0; i < pages.length; i += batchSize) {
      const slice = pages.slice(i, i + batchSize);
      visionDone += await this.runVisionForDocumentPages(documentId, slice, {
        maxPages: slice.length,
        promptMode: 'page_explanation',
      });
      await this.updateProgress(documentId, {
        currentStage: 'page_explanation_before_index',
        progressPercent: this.progressInBand(visionDone, totalVision, 24, 65),
        pagesProcessed: visionDone,
        lastProcessedPage: slice[slice.length - 1],
        totalPages: doc.totalPages || totalVision,
      });
    }
  }

  /**
   * Choose pages for OCR. Manual run is broader (figures, empty ocrText). Auto run caps with PDF_OCR_MAX_PAGES.
   */
  private selectPageNumbersForOcr(
    pageRows: KnowledgeDocumentPageAnalysis[],
    options: {
      mode: 'auto' | 'manual';
      pageTexts?: string[];
      glyphCorruptedPages?: Set<number>;
    },
  ): number[] {
    const minPopplerChars = Number(process.env.PDF_OCR_MIN_POPPLER_CHARS ?? 80);
    const minOcrChars = Number(process.env.PDF_OCR_REOCR_BELOW_CHARS ?? 120);
    const selected: number[] = [];

    for (const row of pageRows) {
      const pageText = options.pageTexts?.[row.pageNumber - 1] ?? '';
      const ocrLen = (row.ocrText ?? '').trim().length;
      const popplerLen = pageText.trim().length;

      let include = false;
      if (options.mode === 'auto') {
        include =
          row.quality === 'poor' ||
          row.quality === 'unreadable' ||
          row.quality === 'degraded' ||
          (options.glyphCorruptedPages?.has(row.pageNumber) ?? false);
      } else {
        include =
          row.quality !== 'good' ||
          (options.glyphCorruptedPages?.has(row.pageNumber) ?? false) ||
          ocrLen < minOcrChars ||
          (popplerLen > 0 && popplerLen < minPopplerChars) ||
          this.pageLikelyHasDiagram(pageText);
      }
      if (include) selected.push(row.pageNumber);
    }

    const uniq = [...new Set(selected)].sort((a, b) => a - b);
    const cap = options.mode === 'manual' ? getPdfOcrManualMaxPages() : getPdfOcrMaxPagesAuto();
    if (cap > 0) return uniq.slice(0, cap);
    return uniq;
  }

  /** Map completed units into a progress % band (used so the UI moves during long OCR/vision). */
  private progressInBand(completed: number, total: number, startPct: number, endPct: number): number {
    if (total <= 0) return startPct;
    const ratio = Math.min(1, Math.max(0, completed / total));
    return Math.floor(startPct + ratio * (endPct - startPct));
  }

  private async ocrPagesFromPdf(pdfPath: string, documentId: string, pageNumbers: number[]): Promise<number> {
    const workDir = join(tmpdir(), `smartmaint-ocr-${documentId}-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });
    const dpi = getOcrRenderDpi();
    const skipSharp = shouldSkipSharpPreprocess();
    const totalOcr = pageNumbers.length;
    const doc = await this.findOne(documentId);

    let processed = 0;
    let ocrFailures = 0;
    try {
      for (const page of pageNumbers) {
        try {
          const pngPath = await this.renderPdfPageToPng(pdfPath, page, workDir, dpi);

          const first = await runOcrOnPng(pngPath);
          let bestText = first.text;
          let bestConf = first.confidence;
          let bestMode: 'raw' | 'preprocessed' = 'raw';

          if (!skipSharp) {
            const preprocessedPath = join(workDir, `page-${page}-pre.png`);
            await sharp(pngPath)
              .grayscale()
              .normalize()
              .median(1)
              .sharpen()
              .threshold(180)
              .png()
              .toFile(preprocessedPath);
            const second = await runOcrOnPng(preprocessedPath);
            if ((second.confidence ?? 0) > (bestConf ?? 0)) {
              bestText = second.text;
              bestConf = second.confidence;
              bestMode = 'preprocessed';
            }
          }

          await this.pageAnalysisRepository.update(
            { documentId, pageNumber: page },
            {
              ocrText: bestText || null,
              ocrConfidence: bestConf,
              processingMode: bestMode,
              extractionMode: 'ocr',
            },
          );

          processed += 1;
        } catch (e: any) {
          ocrFailures += 1;
          this.logger.warn(`OCR failed page ${page} doc ${documentId}: ${e?.message ?? e}`);
          await this.appendPageQualityWarning(documentId, page, 'ocr_failed');
        }

        const doneUnits = processed + ocrFailures;
        await this.updateProgress(documentId, {
          currentStage: 'ocr_before_index',
          progressPercent: this.progressInBand(doneUnits, totalOcr, 16, 24),
          pagesProcessed: processed,
          lastProcessedPage: page,
          totalPages: doc.totalPages || totalOcr,
        });
      }

      if (ocrFailures > 0 && processed === 0) {
        throw new Error(`OCR failed on all ${ocrFailures} page(s); check paddle-ocr logs`);
      }

      await this.maybeEnqueueVisionPagesAfterOcr(documentId, pageNumbers);
    } finally {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore temp cleanup errors
      }
    }

    return processed;
  }

  private async detectMachineProfile(
    textSample: string,
    originalName: string,
  ): Promise<{
    machineName: string | null;
    manufacturer: string | null;
    family: string | null;
    modelNumber: string | null;
    components: string[] | null;
  }> {
    const messages = [
      {
        role: 'system' as const,
        content:
          'Extract machine profile details from an industrial PDF cover/intro text. Return JSON only with keys: ' +
          '{"machineName": string|null, "manufacturer": string|null, "family": string|null, "modelNumber": string|null, "components": string[]|null}. ' +
          'If unsure, use null. Components should be short phrases (e.g. "PLC Siemens S7-300").',
      },
      {
        role: 'user' as const,
        content: `Filename: ${originalName}\n\nText sample:\n${textSample.slice(0, getGateLlmCharLimit())}`,
      },
    ];
    try {
      const raw = await this.aiService.chatPdf(messages);
      const parsed = this.tryParseJson(raw) ?? {};
      const machineName =
        typeof parsed.machineName === 'string' && parsed.machineName.trim() ? parsed.machineName.trim() : null;
      const manufacturer =
        typeof parsed.manufacturer === 'string' && parsed.manufacturer.trim() ? parsed.manufacturer.trim() : null;
      const family =
        typeof parsed.family === 'string' && parsed.family.trim() ? parsed.family.trim() : null;
      const modelNumber =
        typeof parsed.modelNumber === 'string' && parsed.modelNumber.trim() ? parsed.modelNumber.trim() : null;
      const components =
        Array.isArray(parsed.components) ? parsed.components.map((c: any) => String(c)).filter(Boolean) : null;
      return { machineName, manufacturer, family, modelNumber, components };
    } catch {
      return { machineName: null, manufacturer: null, family: null, modelNumber: null, components: null };
    }
  }

  private derivePageTexts(parsed: any, fullText: string): string[] {
    const pagesFromFormFeed = String(fullText || '')
      .split('\f')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    // Some PDFs come back as one monolithic text block (no form-feed markers).
    // Only trust this path if we actually got multiple page buckets.
    if (pagesFromFormFeed.length > 1) {
      return pagesFromFormFeed;
    }
    const numPages = Number(parsed?.numpages ?? 1);
    if (!Number.isFinite(numPages) || numPages <= 1) {
      return [String(fullText || '')];
    }
    const text = String(fullText || '');
    const perPage = Math.max(1, Math.ceil(text.length / numPages));
    const chunks: string[] = [];
    for (let i = 0; i < numPages; i++) {
      chunks.push(text.slice(i * perPage, (i + 1) * perPage));
    }
    return chunks;
  }

  private scorePageQuality(pageText: string): {
    quality: 'good' | 'degraded' | 'poor' | 'unreadable';
    ocrConfidence: number;
    warnings: string[];
  } {
    const text = String(pageText || '').trim();
    const len = text.length;
    const warnings: string[] = [];
    let confidence = 0.9;

    if (len < 30) {
      return { quality: 'unreadable', ocrConfidence: 0.05, warnings: ['very_low_text_density'] };
    }
    if (len < 300) {
      warnings.push('low_text_density');
      confidence -= 0.45;
    } else if (len < 1200) {
      warnings.push('medium_text_density');
      confidence -= 0.2;
    }

    const symbolRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / Math.max(1, len);
    if (symbolRatio > 0.35) {
      warnings.push('high_symbol_noise');
      confidence -= 0.2;
    }

    const normalizedConfidence = Math.max(0, Math.min(1, confidence));
    if (normalizedConfidence < 0.2) {
      return { quality: 'poor', ocrConfidence: normalizedConfidence, warnings };
    }
    if (normalizedConfidence < 0.6) {
      return { quality: 'degraded', ocrConfidence: normalizedConfidence, warnings };
    }
    return { quality: 'good', ocrConfidence: normalizedConfidence, warnings };
  }

  /**
   * Detects PDF text that came from a custom font with no proper Unicode
   * mapping (e.g. LCD-segment display fonts). Such pages look "fine" to the
   * generic quality scorer but contain non-readable glyph clusters like
   * `,4#9':+$#':` mixed into otherwise normal sentences. We use it to force a
   * vision pass on those pages even when overall text length is healthy.
   */
  private detectGlyphCorruption(pageText: string): {
    corrupted: boolean;
    suspectTokenCount: number;
  } {
    const t = String(pageText || '').trim();
    if (!t) return { corrupted: false, suspectTokenCount: 0 };

    const tokens = t.split(/\s+/);
    let suspect = 0;
    for (const raw of tokens) {
      const tok = raw.trim();
      const displaySymbolCount = (tok.match(/[@#$%&*~^]/g) ?? []).length;
      const shortDisplayLike =
        tok.length >= 1 &&
        tok.length <= 4 &&
        displaySymbolCount === 1 &&
        /^[A-Za-z0-9'=@#$%&*~^]+$/.test(tok);
      if (shortDisplayLike) {
        suspect += 1;
        continue;
      }
      if (tok.length < 2 || tok.length > 32) continue;
      const specials = (tok.match(/[#$%&'+:;<>=*~^_|@!?"\\\/\.\-]/g) ?? []).length;
      const specialRatio = specials / Math.max(1, tok.length);
      if (specials < 2 || specialRatio < 0.25) continue;
      if (/[aeiouyàâéèêëîïôûùœAEIOUYÀÂÉÈÊËÎÏÔÛÙŒ]/.test(tok)) continue;
      if (/^https?:/i.test(tok)) continue;
      if (/^[\d.,:\-+]+$/.test(tok)) continue;
      suspect += 1;
    }
    return { corrupted: suspect >= 1, suspectTokenCount: suspect };
  }

  private isGlyphCorruptionVisionEnabled(): boolean {
    return String(process.env.ENABLE_GLYPH_CORRUPTION_VISION ?? 'true').toLowerCase() !== 'false';
  }

  private detectSectionType(pageText: string): string {
    const t = String(pageText || '').toLowerCase();
    if (/(fault table|troubleshooting|d[eé]pannage|panne|cause|corrective action|possible cause)/i.test(t)) {
      return 'fault_table';
    }
    if (/(alarm|alarme|a-\d+|alarm list|liste des alarmes)/i.test(t)) {
      return 'alarm_list';
    }
    if (/(wiring|schematic|diagram|circuit|mcc|single line|borne|terminal)/i.test(t)) {
      return 'wiring';
    }
    if (/(warning|danger|hazard|attention|sécurité|s[eé]curit[eé]|ppe|lockout|tagout)/i.test(t)) {
      return 'warning_notice';
    }
    if (/(step\s*\d+|procedure|proc[eé]dure|installation|setup|calibration|commissioning)/i.test(t)) {
      return 'procedure_steps';
    }
    if (/(specification|rating|voltage|current|dimension|torque|technical data|donn[eé]es techniques)/i.test(t)) {
      return 'specification';
    }
    return 'general';
  }

  private extractMachineNameHeuristic(text: string): string | null {
    const head = text.slice(0, 12000);
    const linePatterns = [
      /(?:^|\n)\s*(?:machine|equipment|device|model)\s*[:#]\s*([^\n]+)/i,
      /(?:^|\n)\s*model\s*(?:no\.?|number|#)?\s*[:#]?\s*([^\n]+)/i,
    ];
    for (const re of linePatterns) {
      const m = head.match(re);
      if (m?.[1]) {
        const name = m[1].replace(/\s+/g, ' ').trim();
        if (name.length >= 2 && name.length <= 500) return name;
      }
    }
    return null;
  }

  private async extractMachineNameWithLlm(excerpt: string): Promise<string | null> {
    const trimmed = excerpt.slice(0, 8000);
    if (!trimmed.trim()) return null;

    const messages = [
      {
        role: 'system' as const,
        content:
          'You read a technical manual excerpt. Return JSON only: {"machineName": string|null}. ' +
          'machineName is the primary equipment or machine model name as printed on the cover or title area (e.g. product line + model). ' +
          'Use null if you cannot identify it confidently.',
      },
      { role: 'user' as const, content: trimmed },
    ];

    try {
      const raw = await this.aiService.chatPdf(messages);
      const parsed = this.tryParseJson(raw);
      const n = parsed?.machineName;
      if (n == null) return null;
      const s = String(n).replace(/\s+/g, ' ').trim();
      if (s.length < 2 || s.length > 500) return null;
      return s;
    } catch {
      return null;
    }
  }

  private async extractMachineNameFromManual(fullText: string): Promise<string | null> {
    const llmFirst = await this.extractMachineNameWithLlm(fullText);
    if (llmFirst) return llmFirst;
    return this.extractMachineNameHeuristic(fullText);
  }

  private tryParseJson(raw: string): any | null {
    if (!raw) return null;
    const cleaned = raw
      .replace(/```json/gi, '```')
      .replace(/```/g, '')
      .trim();
    // Try direct JSON parse
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to locate first/last JSON braces
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const slice = cleaned.slice(start, end + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

