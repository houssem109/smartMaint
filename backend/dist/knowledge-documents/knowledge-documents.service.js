"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var KnowledgeDocumentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDocumentsService = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs_1 = require("fs");
const knowledge_document_entity_1 = require("./entities/knowledge-document.entity");
const knowledge_extraction_candidate_entity_1 = require("./entities/knowledge-extraction-candidate.entity");
const machine_name_suggestion_entity_1 = require("./entities/machine-name-suggestion.entity");
const knowledge_document_page_analysis_entity_1 = require("./entities/knowledge-document-page-analysis.entity");
const knowledge_document_job_entity_1 = require("./entities/knowledge-document-job.entity");
const pipeline_preferences_entity_1 = require("./entities/pipeline-preferences.entity");
const admin_page_fix_queue_entity_1 = require("./entities/admin-page-fix-queue.entity");
const extraction_feedback_event_entity_1 = require("./entities/extraction-feedback-event.entity");
const knowledge_service_1 = require("../knowledge/knowledge.service");
const ai_service_1 = require("../ai/ai.service");
const ollama_vision_util_1 = require("../ai/ollama-vision.util");
const rag_service_1 = require("../ai/rag.service");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const path_1 = require("path");
const fs_2 = require("fs");
const os_1 = require("os");
const fs_3 = require("fs");
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto_1 = require("crypto");
const sharp_1 = __importDefault(require("sharp"));
const queues_constants_1 = require("./queues.constants");
const machine_profiles_service_1 = require("../machine-profiles/machine-profiles.service");
const document_progress_gateway_1 = require("./document-progress.gateway");
const pdf_ingestion_config_1 = require("./pdf-ingestion.config");
const pdf_ingestion_util_1 = require("./pdf-ingestion.util");
const gate_config_1 = require("./gate.config");
const pdf_vision_config_1 = require("./pdf-vision.config");
const pdf_text_util_1 = require("./pdf-text.util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function safeUnlinkUpload(path) {
    if (!path)
        return;
    try {
        if ((0, fs_1.existsSync)(path))
            (0, fs_1.unlinkSync)(path);
    }
    catch {
    }
}
let KnowledgeDocumentsService = KnowledgeDocumentsService_1 = class KnowledgeDocumentsService {
    constructor(knowledgeDocumentsRepository, extractionCandidatesRepository, machineNameSuggestionsRepository, pageAnalysisRepository, knowledgeDocumentJobRepository, adminPageFixQueueRepository, extractionFeedbackRepository, auditLogRepository, pipelinePreferencesRepository, gateQueue, extractionQueue, indexingQueue, ocrQueue, visionQueue, knowledgeService, aiService, ragService, machineProfilesService, documentProgressGateway) {
        this.knowledgeDocumentsRepository = knowledgeDocumentsRepository;
        this.extractionCandidatesRepository = extractionCandidatesRepository;
        this.machineNameSuggestionsRepository = machineNameSuggestionsRepository;
        this.pageAnalysisRepository = pageAnalysisRepository;
        this.knowledgeDocumentJobRepository = knowledgeDocumentJobRepository;
        this.adminPageFixQueueRepository = adminPageFixQueueRepository;
        this.extractionFeedbackRepository = extractionFeedbackRepository;
        this.auditLogRepository = auditLogRepository;
        this.pipelinePreferencesRepository = pipelinePreferencesRepository;
        this.gateQueue = gateQueue;
        this.extractionQueue = extractionQueue;
        this.indexingQueue = indexingQueue;
        this.ocrQueue = ocrQueue;
        this.visionQueue = visionQueue;
        this.knowledgeService = knowledgeService;
        this.aiService = aiService;
        this.ragService = ragService;
        this.machineProfilesService = machineProfilesService;
        this.documentProgressGateway = documentProgressGateway;
        this.logger = new common_1.Logger(KnowledgeDocumentsService_1.name);
        this.workProfileEmbedding = null;
        this.nonWorkProfileEmbedding = null;
        this.pdfVisionAdminEnabled = true;
    }
    async onModuleInit() {
        await this.loadPdfVisionAdminPreference();
    }
    async loadPdfVisionAdminPreference() {
        try {
            let row = await this.pipelinePreferencesRepository.findOne({
                where: { id: pipeline_preferences_entity_1.PipelinePreferences.SINGLETON_ID },
            });
            if (!row) {
                row = this.pipelinePreferencesRepository.create({
                    id: pipeline_preferences_entity_1.PipelinePreferences.SINGLETON_ID,
                    pdfVisionEnabled: true,
                });
                await this.pipelinePreferencesRepository.save(row);
            }
            this.pdfVisionAdminEnabled = row.pdfVisionEnabled;
        }
        catch (e) {
            this.logger.warn(`Could not load pipeline_preferences (vision toggle); defaulting admin vision ON: ${e?.message ?? e}`);
            this.pdfVisionAdminEnabled = true;
        }
    }
    isEffectivePdfVision() {
        return (0, pdf_vision_config_1.isPdfVisionEnabled)() && this.pdfVisionAdminEnabled;
    }
    getPdfVisionPreferenceReadModel() {
        return {
            pdfVisionAdminEnabled: this.pdfVisionAdminEnabled,
            enabledFromEnv: (0, pdf_vision_config_1.isPdfVisionEnabled)(),
            enabledEffective: this.isEffectivePdfVision(),
        };
    }
    async setPdfVisionAdminEnabled(enabled, userId) {
        if (enabled && !(0, pdf_vision_config_1.isPdfVisionEnabled)()) {
            throw new common_1.BadRequestException('Cannot turn PDF vision on: set ENABLE_PDF_VISION=true in server environment and restart the API.');
        }
        let row = await this.pipelinePreferencesRepository.findOne({
            where: { id: pipeline_preferences_entity_1.PipelinePreferences.SINGLETON_ID },
        });
        if (!row) {
            row = this.pipelinePreferencesRepository.create({
                id: pipeline_preferences_entity_1.PipelinePreferences.SINGLETON_ID,
                pdfVisionEnabled: true,
            });
        }
        row.pdfVisionEnabled = enabled;
        row.updatedById = userId;
        await this.pipelinePreferencesRepository.save(row);
        this.pdfVisionAdminEnabled = enabled;
        return this.getPdfVisionPreferenceReadModel();
    }
    async createFromUpload(params) {
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
    async ingestAndQueue(params) {
        const maxBytes = (0, pdf_ingestion_config_1.getKnowledgePdfMaxBytes)();
        let fileBuffer;
        try {
            fileBuffer = (0, fs_2.readFileSync)(params.filePath);
        }
        catch {
            throw new common_1.BadRequestException('Uploaded file could not be read');
        }
        try {
            (0, pdf_ingestion_util_1.assertValidPdfForIngestion)(fileBuffer, maxBytes);
        }
        catch (e) {
            safeUnlinkUpload(params.filePath);
            throw e;
        }
        let parsed;
        try {
            parsed = await (0, pdf_text_util_1.parsePdfWithPoppler)(fileBuffer);
        }
        catch {
            safeUnlinkUpload(params.filePath);
            throw new common_1.BadRequestException('Invalid or corrupted PDF (parse failed)');
        }
        const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
        const totalPages = Number(parsed?.numpages ?? 0) || 0;
        const pages = this.derivePageTexts(parsed, fullText);
        const firstFive = pages.slice(0, 5).join('\n\f\n');
        const fingerprint = (0, crypto_1.createHash)('sha256').update(firstFive || fullText.slice(0, 10000)).digest('hex');
        const supersedeId = params.supersedesDocumentId?.trim() || null;
        if (supersedeId) {
            const predecessor = await this.knowledgeDocumentsRepository.findOne({ where: { id: supersedeId } });
            if (!predecessor) {
                safeUnlinkUpload(params.filePath);
                throw new common_1.BadRequestException('supersedesDocumentId does not reference an existing document');
            }
            if (predecessor.supersededByDocumentId) {
                safeUnlinkUpload(params.filePath);
                throw new common_1.BadRequestException('That document is already superseded; point supersedesDocumentId at the latest active revision.');
            }
        }
        const duplicate = await this.knowledgeDocumentsRepository.findOne({
            where: { fingerprint },
            order: { createdAt: 'DESC' },
        });
        if (duplicate) {
            if (!supersedeId || duplicate.id !== supersedeId) {
                safeUnlinkUpload(params.filePath);
                throw new common_1.BadRequestException(`Duplicate document detected (existing id: ${duplicate.id})`);
            }
            await this.knowledgeDocumentsRepository.update({ id: supersedeId }, { fingerprint: null });
        }
        const dupAfterClear = await this.knowledgeDocumentsRepository.findOne({
            where: { fingerprint },
            order: { createdAt: 'DESC' },
        });
        if (dupAfterClear && (!supersedeId || dupAfterClear.id !== supersedeId)) {
            safeUnlinkUpload(params.filePath);
            throw new common_1.BadRequestException('Fingerprint conflict with another document. Use supersedesDocumentId only for the exact duplicate row.');
        }
        const doc = await this.knowledgeDocumentsRepository.save(this.knowledgeDocumentsRepository.create({
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
        }));
        if (supersedeId) {
            await this.knowledgeDocumentsRepository.update({ id: supersedeId }, { supersededByDocumentId: doc.id, status: 'superseded' });
            try {
                await this.ragService.purgeManualIndexForDocument(supersedeId);
            }
            catch (e) {
                this.logger.warn(`RAG purge after supersede failed for ${supersedeId}: ${e.message}`);
            }
        }
        const tracking = await this.knowledgeDocumentJobRepository.save(this.knowledgeDocumentJobRepository.create({
            documentId: doc.id,
            queueName: queues_constants_1.GATE_QUEUE,
            jobType: queues_constants_1.GATE_JOB,
            status: 'queued',
            progressPercent: 0,
            error: null,
            bullJobId: null,
        }));
        const bullJob = await this.gateQueue.add(queues_constants_1.GATE_JOB, { documentId: doc.id, trackingJobId: tracking.id }, { removeOnComplete: 100, removeOnFail: 100 });
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
    async findAll(opts) {
        return this.knowledgeDocumentsRepository.find({
            ...(opts?.includeSuperseded ? {} : { where: { status: (0, typeorm_2.Not)('superseded') } }),
            order: { createdAt: 'DESC' },
            relations: ['uploadedBy'],
        });
    }
    async findOne(id) {
        const doc = await this.knowledgeDocumentsRepository.findOne({
            where: { id },
            relations: ['uploadedBy'],
        });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        return doc;
    }
    async getExtractionsForDocument(documentId) {
        await this.findOne(documentId);
        return this.extractionCandidatesRepository.find({
            where: { documentId },
            order: { createdAt: 'DESC' },
        });
    }
    async getExtractionStats(documentId) {
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
    async getPageAnalysis(documentId) {
        await this.findOne(documentId);
        return this.pageAnalysisRepository.find({
            where: { documentId },
            order: { pageNumber: 'ASC' },
        });
    }
    async getRagStoredData(documentId, limit = 120) {
        await this.findOne(documentId);
        const chunks = await this.ragService.listDocumentChunks(documentId, limit);
        return { documentId, chunkCount: chunks.length, chunks };
    }
    async getRagStoredDataGlobal(limit = 400, documentId) {
        const chunks = await this.ragService.listAllDocumentChunks(limit, documentId);
        const docIds = [...new Set(chunks.map((c) => c.documentId).filter(Boolean))];
        const docs = docIds.length
            ? await this.knowledgeDocumentsRepository.find({
                where: { id: (0, typeorm_2.In)(docIds) },
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
    async getDocumentStatus(documentId) {
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
    async qualitySnapshotForDocument(documentId) {
        const rows = await this.pageAnalysisRepository
            .createQueryBuilder('p')
            .select('p.quality', 'quality')
            .addSelect('COUNT(*)', 'cnt')
            .where('p.documentId = :id', { id: documentId })
            .groupBy('p.quality')
            .getRawMany();
        const base = { good: 0, degraded: 0, poor: 0, unreadable: 0 };
        for (const r of rows) {
            const q = String(r.quality || 'unknown');
            const n = parseInt(String(r.cnt), 10) || 0;
            if (q in base)
                base[q] = n;
            else
                base[q] = n;
        }
        return base;
    }
    async updateProgress(documentId, patch) {
        await this.knowledgeDocumentsRepository.update({ id: documentId }, patch);
        try {
            this.documentProgressGateway.emitDocumentProgress(documentId, patch);
        }
        catch {
        }
    }
    async markTrackingJobActive(trackingJobId, bullJobId) {
        if (!trackingJobId)
            return;
        await this.knowledgeDocumentJobRepository.update({ id: trackingJobId }, { status: 'active', bullJobId: bullJobId ?? null });
    }
    async markTrackingJobCompleted(trackingJobId) {
        if (!trackingJobId)
            return;
        await this.knowledgeDocumentJobRepository.update({ id: trackingJobId }, { status: 'completed', progressPercent: 100, error: null });
    }
    async markTrackingJobFailed(trackingJobId, error) {
        if (!trackingJobId)
            return;
        await this.knowledgeDocumentJobRepository.update({ id: trackingJobId }, { status: 'failed', error: error.slice(0, 1000) });
    }
    async getBullQueuesHealth() {
        const pairs = [
            [queues_constants_1.GATE_QUEUE, this.gateQueue],
            [queues_constants_1.EXTRACTION_QUEUE, this.extractionQueue],
            [queues_constants_1.OCR_QUEUE, this.ocrQueue],
            [queues_constants_1.VISION_QUEUE, this.visionQueue],
            [queues_constants_1.INDEXING_QUEUE, this.indexingQueue],
        ];
        let redisOk = false;
        let redisError;
        try {
            const pong = await this.gateQueue.client.ping();
            redisOk = pong === 'PONG';
            if (!redisOk)
                redisError = `Unexpected PING reply: ${String(pong)}`;
        }
        catch (e) {
            redisError = e?.message ? String(e.message) : String(e);
        }
        const queues = {};
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
            }
            catch (e) {
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
    getPipelineConfigSnapshot() {
        const num = (key, fallback) => {
            const n = Number(process.env[key]);
            return Number.isFinite(n) ? n : fallback;
        };
        return {
            checkedAt: new Date().toISOString(),
            pdfUpload: {
                maxBytes: (0, pdf_ingestion_config_1.getKnowledgePdfMaxBytes)(),
                uploadDir: (0, pdf_ingestion_config_1.getKnowledgePdfUploadDir)(),
                pageFixImageMaxBytes: (0, pdf_ingestion_config_1.getPageFixImageMaxBytes)(),
                pageFixImageUploadDir: (0, pdf_ingestion_config_1.getPageFixImageUploadDir)(),
            },
            gate: {
                tier1AcceptAbove: (0, gate_config_1.getGateTier1AcceptAbove)(),
                tier1RejectBelow: (0, gate_config_1.getGateTier1RejectBelow)(),
                tier2WorkSimMin: (0, gate_config_1.getGateTier2WorkSimMin)(),
                tier2NonWorkSimMin: (0, gate_config_1.getGateTier2NonWorkSimMin)(),
                tier2PageCount: (0, gate_config_1.getGateTier2PageCount)(),
                heuristicPageCount: (0, gate_config_1.getGateHeuristicPageCount)(),
                llmCharLimit: (0, gate_config_1.getGateLlmCharLimit)(),
                gateModel: (0, gate_config_1.getOllamaGateModel)() ?? null,
            },
            ocr: {
                enabled: String(process.env.ENABLE_PDF_OCR ?? 'false').toLowerCase() === 'true',
                maxPagesPerDocument: num('PDF_OCR_MAX_PAGES', 10),
                tessLang: process.env.TESSERACT_LANG?.trim() || 'eng+fra',
                tessPath: process.env.TESSERACT_PATH?.trim() || 'tesseract',
                pdftoppmPath: process.env.PDFTOPPM_PATH?.trim() || 'pdftoppm',
            },
            vision: {
                enabled: this.isEffectivePdfVision(),
                enabledFromEnv: (0, pdf_vision_config_1.isPdfVisionEnabled)(),
                adminToggleOn: this.pdfVisionAdminEnabled,
                maxPages: (0, pdf_vision_config_1.getPdfVisionMaxPages)(),
                maxPagesPerBatch: this.getVisionMaxPagesPerBatch(),
                docBatchPages: this.getDocBatchPages(),
                figureVisionEnabled: this.isFigureVisionEnabled(),
                triggerOcrConfidenceBelow: (0, pdf_vision_config_1.getVisionTriggerOcrConfidenceBelow)(),
                minOcrTextChars: (0, pdf_vision_config_1.getVisionMinOcrTextChars)(),
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
                visionModel: (0, ollama_vision_util_1.getOllamaVisionModel)(),
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
    getDatabaseInventory() {
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
                    table: 'admin_page_fix_queue',
                    entity: 'AdminPageFixQueueItem',
                    scope: 'pdf',
                    purpose: 'Unreadable pages + admin fix-text / replacementImagePath / dismiss',
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
                    purpose: 'Technician + approved curated rows; photoPath; optional FK knowledgeDocumentId → PDF for 23 export filter & source column',
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
    getQaSuccessCriteria() {
        return {
            checkedAt: new Date().toISOString(),
            rows: [
                {
                    id: 'gate-irrelevant',
                    goal: 'Irrelevant PDFs blocked at the gate without calling the LLM in obvious cases',
                    status: 'partial',
                    notes: 'Tier 1/2 heuristics + embedding similarity often decide without LLM; Tier 3 LLM still runs when confidence is borderline.',
                },
                {
                    id: 'machine-cover',
                    goal: 'Machine name and manufacturer auto-detected from PDF cover / early pages',
                    status: 'partial',
                    notes: 'Machine name from gate/extraction + suggestions flow; manufacturer on `machine_profiles` is often manual or inferred — not a guaranteed auto-fill for every PDF.',
                },
                {
                    id: 'pages-covered',
                    goal: 'All pages covered by text extraction, OCR, or vision',
                    status: 'partial',
                    notes: 'Poppler text + OCR queues + bounded vision pass; caps (`PDF_OCR_MAX_PAGES`, `PDF_VISION_MAX_PAGES`) mean very large manuals may not run OCR/vision on every page.',
                },
                {
                    id: 'upload-latency',
                    goal: 'Very large PDFs do not block the backend — upload returns in under ~1 second',
                    status: 'aspirational',
                    notes: 'Handler returns 202 after accepting the file, but disk write + validation still scale with bytes — treat as ops benchmark, not a guaranteed SLA.',
                },
                {
                    id: 'concurrent-uploads',
                    goal: 'Multiple PDFs can upload and process concurrently without crashes',
                    status: 'partial',
                    notes: 'Bull queues isolate work; no formal load test or back-pressure policy is checked in CI.',
                },
                {
                    id: 'progress-realtime',
                    goal: 'Progress visible from 0% to 100% in near real time',
                    status: 'partial',
                    notes: 'Postgres progress fields + `document:progress` WebSocket; some stages are coarse and polling via `GET …/status` is still used for some clients.',
                },
                {
                    id: 'chat-latency',
                    goal: 'Chatbot has access to fault tables within ~2 minutes of upload',
                    status: 'gap',
                    notes: 'No automated SLA; depends on queue depth, extraction chunk limits, and model speed.',
                },
                {
                    id: 'unreadable-nonblocking',
                    goal: 'Unreadable pages never block the pipeline — they go to admin queue',
                    status: 'shipped',
                    notes: '`admin_page_fix_queue` + pipeline continues; admin can dismiss or fix.',
                },
                {
                    id: 'admin-fix-index',
                    goal: 'Admin manual fix is reflected in RAG quickly (re-index path)',
                    status: 'partial',
                    notes: '`reindex-manual-chunks` and best-effort re-embed after page fix; Qdrant write failures are log-only today (Postgres still source of truth).',
                },
                {
                    id: 'tech-in-chat',
                    goal: 'Technician experience entries appear in chatbot answers alongside PDF knowledge',
                    status: 'shipped',
                    notes: 'Approved `knowledge_entries` are embedded and merged into RAG retrieval for Techo.',
                },
                {
                    id: 'attribution',
                    goal: 'Chatbot shows source attribution (page, document, technician where applicable)',
                    status: 'partial',
                    notes: '`POST /chat/message` returns `sources` and the widget can show them; persisting sources on stored conversation rows for audit replay is still pending.',
                },
                {
                    id: 'cross-dedup',
                    goal: 'Cross-document dedup reduces duplicate answers (fingerprint + chunk hashes + supersede)',
                    status: 'partial',
                    notes: 'Fingerprint gate + `vector_chunk_hashes` + superseded manual vector purge; not a semantic duplicate detector for all phrasings.',
                },
                {
                    id: 'crash-resume',
                    goal: 'System recovers from worker crashes without reprocessing from page 1',
                    status: 'gap',
                    notes: 'Bull retries and re-queued jobs help, but there is no fully documented durable “checkpoint resume” story per page across arbitrary failure modes.',
                },
                {
                    id: 'tri-lang-ocr',
                    goal: 'French, English, and Arabic PDFs extract correctly via OCR stack',
                    status: 'partial',
                    notes: 'Dockerfile includes Arabic tess data and `.env.example` suggests `eng+fra+ara`; scan quality and mixed-language layouts still vary.',
                },
            ],
        };
    }
    getTroubleshootingExtractionReference() {
        return {
            checkedAt: new Date().toISOString(),
            responsibility: 'Problem/solution-style rows are produced by the same PDF extraction pass as other structured knowledge — implemented in KnowledgeDocumentsService (no separate PdfTroubleshootingExtractorService).',
            implementation: {
                service: 'KnowledgeDocumentsService',
                method: 'processDocumentExtraction(documentId)',
                bullQueue: queues_constants_1.EXTRACTION_QUEUE,
                bullJobType: queues_constants_1.EXTRACTION_JOB,
            },
            systemPromptRelativePaths: [
                'backend/src/ai/prompts/techo-pdf-extractor-system.prompt.md',
                '(runtime fallbacks: dist-relative paths in processDocumentExtraction)',
            ],
            envKeys: [
                'DOC_EXTRACTION_MAX_CHUNKS',
                'DOC_EXTRACTION_MAX_CANDIDATES',
                'DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK',
                'DOC_EXTRACTION_CHUNK_SIZE',
                'DOC_EXTRACTION_CHUNK_OVERLAP',
            ],
            textWindowNote: 'If the lowercased full-PDF text contains the substring "troubleshooting", extraction and manual re-index use text from that offset onward; otherwise the entire extracted string is used. Manuals that only use headings like "Dépannage" without the English word keep the full text.',
            persistence: {
                table: 'knowledge_extraction_candidates',
                entity: 'KnowledgeExtractionCandidate',
                statusValues: ['candidate', 'approved', 'rejected'],
                requiredCandidateFields: ['title', 'problemDescription', 'solution'],
                optionalCandidateFields: [
                    'tags',
                    'entryType',
                    'symptom',
                    'rootCause',
                    'sourcePages',
                    'confidence',
                    'sectionType',
                ],
            },
            pageSectionLabels: [
                'fault_table',
                'alarm_list',
                'wiring',
                'warning_notice',
                'procedure_steps',
                'specification',
                'general',
            ],
            chunkSectionLabels: [
                'fault_table',
                'alarm_list',
                'wiring',
                'warning_notice',
                'procedure_steps',
                'specification',
                'general_text',
            ],
            extractionUserMessageSchema: 'Per chunk: JSON with top-level key "candidates" (array). Each item: entryType, title, problemDescription, solution, symptom, rootCause, tags, sourcePages, confidence — see inline string in processDocumentExtraction.',
            entryTypesFromLlm: ['fault', 'procedure', 'safety', 'wiring', 'spec'],
            relatedEndpoints: [
                { method: 'GET', path: '/knowledge-documents/:id/extractions', note: 'List candidates for one PDF' },
                {
                    method: 'POST',
                    path: '/knowledge-documents/extractions/:candidateId/approve',
                    note: 'Promote candidate into knowledge_entries (optional body edits)',
                },
                {
                    method: 'POST',
                    path: '/knowledge-documents/extractions/:candidateId/reject',
                    note: 'Reject candidate; logs extraction_feedback_events (14) best-effort',
                },
                {
                    method: 'GET',
                    path: '/export/problems-solutions',
                    note: 'Curated columns export; filters machine, documentId (UUID, knowledge_documents FK on entry), severity, from/to, format — see 23',
                },
            ],
            notes: [
                'Per-page sectionType uses detectSectionType (regex on page text); chunk hints use classifyChunkSection (chunk + docType).',
                'buildRoutedChunks + prioritizeChunksForExtraction order chunks before the LLM pass.',
                'RAG manual re-index (reindexManualChunksForDocument) reuses the same troubleshooting slice + routing.',
            ],
        };
    }
    async enqueueExtractionJob(documentId) {
        const tracking = await this.knowledgeDocumentJobRepository.save(this.knowledgeDocumentJobRepository.create({
            documentId,
            queueName: queues_constants_1.EXTRACTION_QUEUE,
            jobType: queues_constants_1.EXTRACTION_JOB,
            status: 'queued',
            progressPercent: 0,
            error: null,
            bullJobId: null,
        }));
        const bullJob = await this.extractionQueue.add(queues_constants_1.EXTRACTION_JOB, { documentId, trackingJobId: tracking.id }, { removeOnComplete: 100, removeOnFail: 100 });
        tracking.bullJobId = String(bullJob.id);
        await this.knowledgeDocumentJobRepository.save(tracking);
        return tracking.id;
    }
    async enqueueOcrJob(documentId, pageNumbers) {
        const tracking = await this.knowledgeDocumentJobRepository.save(this.knowledgeDocumentJobRepository.create({
            documentId,
            queueName: queues_constants_1.OCR_QUEUE,
            jobType: queues_constants_1.OCR_JOB,
            status: 'queued',
            progressPercent: 0,
            error: null,
            bullJobId: null,
        }));
        const bullJob = await this.ocrQueue.add(queues_constants_1.OCR_JOB, { documentId, trackingJobId: tracking.id, pageNumbers }, { removeOnComplete: 100, removeOnFail: 100 });
        tracking.bullJobId = String(bullJob.id);
        await this.knowledgeDocumentJobRepository.save(tracking);
        return tracking.id;
    }
    async enqueueVisionJob(documentId, pageNumbers) {
        const tracking = await this.knowledgeDocumentJobRepository.save(this.knowledgeDocumentJobRepository.create({
            documentId,
            queueName: queues_constants_1.VISION_QUEUE,
            jobType: queues_constants_1.VISION_JOB,
            status: 'queued',
            progressPercent: 0,
            error: null,
            bullJobId: null,
        }));
        const bullJob = await this.visionQueue.add(queues_constants_1.VISION_JOB, { documentId, trackingJobId: tracking.id, pageNumbers }, { removeOnComplete: 100, removeOnFail: 100 });
        tracking.bullJobId = String(bullJob.id);
        await this.knowledgeDocumentJobRepository.save(tracking);
        return tracking.id;
    }
    async enqueueIndexingJob(documentId, payload) {
        const tracking = await this.knowledgeDocumentJobRepository.save(this.knowledgeDocumentJobRepository.create({
            documentId,
            queueName: queues_constants_1.INDEXING_QUEUE,
            jobType: queues_constants_1.INDEXING_JOB,
            status: 'queued',
            progressPercent: 0,
            error: null,
            bullJobId: null,
        }));
        const bullJob = await this.indexingQueue.add(queues_constants_1.INDEXING_JOB, { documentId, trackingJobId: tracking.id, ...payload }, { removeOnComplete: 100, removeOnFail: 100 });
        tracking.bullJobId = String(bullJob.id);
        await this.knowledgeDocumentJobRepository.save(tracking);
        return tracking.id;
    }
    async runOcrForDocumentPages(documentId, pageNumbers) {
        if (!pageNumbers.length)
            return;
        const doc = await this.findOne(documentId);
        await this.ocrPagesFromPdf(doc.filePath, doc.id, pageNumbers);
    }
    async runVisionForDocumentPages(documentId, pageNumbers) {
        if (!this.isEffectivePdfVision() || !pageNumbers.length)
            return 0;
        const maxPages = this.getVisionMaxPagesPerBatch();
        if (maxPages <= 0)
            return 0;
        const doc = await this.findOne(documentId);
        const pages = [...new Set(pageNumbers)].sort((a, b) => a - b).slice(0, maxPages);
        if (!pages.length)
            return 0;
        const workDir = (0, path_1.join)((0, os_1.tmpdir)(), `smartmaint-vision-${documentId}-${Date.now()}`);
        (0, fs_3.mkdirSync)(workDir, { recursive: true });
        const concurrency = this.getVisionConcurrency();
        let done = 0;
        const docLanguage = await this.detectDocumentPrimaryLanguage(doc.filePath);
        const langLabel = this.languageLabel(docLanguage);
        const allowedScripts = this.allowedScriptsFor(docLanguage);
        const baseVisionPrompt = 'You are reading a page from an industrial maintenance or electrical manual.\n' +
            `The document language is ${langLabel}. Transcribe ONLY in ${langLabel} (and standard ASCII numerals/symbols).\n` +
            `Do NOT insert any characters from other scripts (no Arabic, Hebrew, Chinese, Japanese, Korean, Cyrillic, etc.) unless they are clearly visible on the page in that script.\n` +
            'When you see leader dots ("....") connecting a heading to a page number, render them as a single ellipsis "..." — never as letters from another alphabet.\n' +
            '1) Transcribe all readable text (headings, table cells, labels, fault or alarm codes).\n' +
            '2) For diagrams or schematics, briefly describe components, connections, and identifiers.\n' +
            '3) Output plain text only (no markdown code fences).';
        const displayFontPages = await this.detectDisplayFontPagesParallel(doc.filePath, pages);
        const processOne = async (pageNumber) => {
            const usesDisplayFont = displayFontPages.has(pageNumber);
            const visionPrompt = baseVisionPrompt +
                (usesDisplayFont
                    ? '\nThis page uses seven-segment/LCD readouts. Transcribe display digits and short codes EXACTLY (examples: 0, 10, 20, ULoc, C). ' +
                        'When symbols represent keys/buttons, use canonical labels: UP_ARROW, DOWN_ARROW, ON_OFF_BUTTON.'
                    : '\nIf the page shows seven-segment or LCD-style digital readouts, transcribe those digits and short codes EXACTLY as displayed (e.g. 0, 10, 20, ULoc, C).');
            await this.pageAnalysisRepository.update({ documentId, pageNumber }, { extractionMode: 'vision', visionUsed: false });
            let b64;
            try {
                const replacementAbs = await this.resolveReplacementPageImageAbs(documentId, pageNumber);
                if (replacementAbs) {
                    const pngBuf = await (0, sharp_1.default)(replacementAbs).png().toBuffer();
                    b64 = pngBuf.toString('base64');
                }
                else {
                    const dpi = usesDisplayFont ? 380 : 200;
                    const pngPath = await this.renderPdfPageToPng(doc.filePath, pageNumber, workDir, dpi);
                    b64 = (0, fs_2.readFileSync)(pngPath).toString('base64');
                }
            }
            catch (e) {
                this.logger.warn(`Vision render failed page ${pageNumber}: ${e?.message ?? e}`);
                await this.appendPageQualityWarning(documentId, pageNumber, 'vision_render_failed');
                return false;
            }
            let description;
            try {
                description = await this.aiService.describeImageBase64ForPdf(b64, visionPrompt);
                if (usesDisplayFont) {
                    description = this.normalizeDisplayVisionText(description);
                }
                description = this.stripDisallowedScripts(description, allowedScripts);
            }
            catch (e) {
                this.logger.warn(`Vision model failed page ${pageNumber}: ${e?.message ?? e}`);
                await this.appendPageQualityWarning(documentId, pageNumber, 'vision_model_failed');
                await this.pageAnalysisRepository.update({ documentId, pageNumber }, { extractionMode: 'vision', visionUsed: false });
                return false;
            }
            const row = await this.pageAnalysisRepository.findOne({ where: { documentId, pageNumber } });
            const previous = (row?.ocrText ?? '').trim();
            const warnings = Array.isArray(row?.qualityWarnings) ? [...row.qualityWarnings] : [];
            const warnedGlyph = warnings.some((w) => String(w).startsWith('glyph_corruption_likely'));
            const previousGlyphCorrupted = this.detectGlyphCorruption(previous).corrupted;
            const shouldReplaceRawWithVision = usesDisplayFont || warnedGlyph || previousGlyphCorrupted;
            const merged = shouldReplaceRawWithVision
                ? description
                : previous.length > 0
                    ? `${previous}\n\n--- Vision description ---\n${description}`
                    : description;
            if (shouldReplaceRawWithVision) {
                if (!warnings.includes('vision_replaced_raw_text'))
                    warnings.push('vision_replaced_raw_text');
            }
            else {
                if (!warnings.includes('vision_layer'))
                    warnings.push('vision_layer');
            }
            await this.pageAnalysisRepository.update({ documentId, pageNumber }, {
                ocrText: merged.slice(0, 500000),
                visionUsed: true,
                extractionMode: 'vision',
                processingMode: 'region',
                qualityWarnings: warnings,
            });
            return true;
        };
        try {
            for (let i = 0; i < pages.length; i += concurrency) {
                const slice = pages.slice(i, i + concurrency);
                const results = await Promise.allSettled(slice.map((p) => processOne(p)));
                for (const r of results) {
                    if (r.status === 'fulfilled' && r.value === true)
                        done += 1;
                }
            }
        }
        finally {
            try {
                (0, fs_3.rmSync)(workDir, { recursive: true, force: true });
            }
            catch {
            }
        }
        return done;
    }
    getVisionConcurrency() {
        const n = Number(process.env.PDF_VISION_CONCURRENCY ?? 4);
        if (!Number.isFinite(n))
            return 4;
        return Math.max(1, Math.min(16, Math.floor(n)));
    }
    async appendPageQualityWarning(documentId, pageNumber, code) {
        const row = await this.pageAnalysisRepository.findOne({ where: { documentId, pageNumber } });
        if (!row)
            return;
        const w = Array.isArray(row.qualityWarnings) ? [...row.qualityWarnings] : [];
        if (!w.includes(code))
            w.push(code);
        await this.pageAnalysisRepository.update({ documentId, pageNumber }, { qualityWarnings: w });
    }
    async renderPdfPageToPng(pdfPath, pageNumber, workDir, dpi = 200) {
        const pdftoppm = process.env.PDFTOPPM_PATH?.trim() || 'pdftoppm';
        const prefix = (0, path_1.join)(workDir, `page-${pageNumber}`);
        await execFileAsync(pdftoppm, ['-f', String(pageNumber), '-l', String(pageNumber), '-png', '-r', String(dpi), pdfPath, prefix], { windowsHide: true });
        const baseName = `page-${pageNumber}`;
        const candidates = new Set([
            `${prefix}-${pageNumber}.png`,
            `${prefix}-${String(pageNumber).padStart(2, '0')}.png`,
            `${prefix}-${String(pageNumber).padStart(3, '0')}.png`,
            `${prefix}-${String(pageNumber).padStart(4, '0')}.png`,
            `${prefix}-${String(pageNumber).padStart(5, '0')}.png`,
            `${prefix}-1.png`,
            `${prefix}.png`,
        ]);
        for (const candidate of candidates) {
            if ((0, fs_1.existsSync)(candidate))
                return candidate;
        }
        try {
            const files = (0, fs_3.readdirSync)(workDir);
            const match = files.find((f) => f.startsWith(`${baseName}-`) && f.endsWith('.png'));
            if (match)
                return (0, path_1.join)(workDir, match);
        }
        catch {
        }
        throw new Error(`pdftoppm did not produce a PNG for page ${pageNumber} (looked under prefix ${prefix})`);
    }
    async maybeEnqueueVisionPagesAfterOcr(documentId, ocrPageNumbers) {
        if (!this.isEffectivePdfVision() || !ocrPageNumbers.length)
            return;
        const maxV = this.getVisionMaxPagesPerBatch();
        if (maxV <= 0)
            return;
        const rows = await this.pageAnalysisRepository.find({
            where: { documentId, pageNumber: (0, typeorm_2.In)(ocrPageNumbers) },
        });
        const confBelow = (0, pdf_vision_config_1.getVisionTriggerOcrConfidenceBelow)();
        const minChars = (0, pdf_vision_config_1.getVisionMinOcrTextChars)();
        const candidates = [];
        for (const r of rows) {
            const text = (r.ocrText ?? '').trim();
            const conf = r.ocrConfidence;
            const shortText = text.length < minChars;
            const lowConf = conf == null || conf < confBelow;
            const wiringSparse = r.sectionType === 'wiring' && text.length < Math.max(minChars, 120);
            const glyphCorrupted = (r.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely')) ||
                this.detectGlyphCorruption(text).corrupted;
            if (lowConf || shortText || wiringSparse || glyphCorrupted) {
                candidates.push(r.pageNumber);
            }
        }
        const uniq = [...new Set(candidates)].sort((a, b) => a - b).slice(0, maxV);
        if (!uniq.length)
            return;
        try {
            await this.enqueueVisionJob(documentId, uniq);
        }
        catch (e) {
            this.logger.warn(`Vision enqueue after OCR failed: ${e?.message ?? e}`);
        }
    }
    async runGateStage(documentId) {
        const doc = await this.findOne(documentId);
        await this.updateProgress(doc.id, { currentStage: 'gate_processing', progressPercent: 10 });
        const fileBuffer = (0, fs_2.readFileSync)(doc.filePath);
        let parsed;
        try {
            parsed = await (0, pdf_text_util_1.parsePdfWithPoppler)(fileBuffer);
        }
        catch {
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
        const mpSample = pageTexts
            .slice(0, (0, gate_config_1.getGateHeuristicPageCount)())
            .join('\n\n')
            .slice(0, 12000);
        const mpDetection = await this.detectMachineProfile(mpSample, doc.originalName);
        const profileMachineName = (mpDetection.machineName && mpDetection.machineName.trim()) ||
            (gate.detectedMachineName && gate.detectedMachineName.trim()) ||
            null;
        const profileManufacturer = (mpDetection.manufacturer && mpDetection.manufacturer.trim()) ||
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
        }
        else {
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
    async approveGateAndContinue(documentId, adminId) {
        const doc = await this.findOne(documentId);
        if (doc.status !== 'needs_review') {
            throw new common_1.BadRequestException('Document is not in needs_review state');
        }
        doc.status = 'gated';
        doc.needsReview = false;
        doc.error = null;
        await this.knowledgeDocumentsRepository.save(doc);
        const extractionJobId = await this.enqueueExtractionJob(documentId);
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.APPROVE,
            entityType: 'knowledge_document',
            entityId: documentId,
            userId: adminId,
            changes: { event: 'gate_approved', extractionJobId },
            reason: null,
        }));
        return { ok: true, extractionJobId };
    }
    async rejectGate(documentId, adminId, reason) {
        const doc = await this.findOne(documentId);
        doc.status = 'rejected';
        doc.error = reason?.trim() || 'Rejected by admin at gate review';
        doc.needsReview = false;
        await this.knowledgeDocumentsRepository.save(doc);
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.REJECT,
            entityType: 'knowledge_document',
            entityId: documentId,
            userId: adminId,
            changes: { event: 'gate_rejected' },
            reason: doc.error,
        }));
        return { ok: true };
    }
    async runOcrForDocument(documentId, adminId) {
        const doc = await this.findOne(documentId);
        if (!doc.deepMode) {
            throw new common_1.BadRequestException('OCR runs only in deep mode');
        }
        const enabled = String(process.env.ENABLE_PDF_OCR ?? 'false').toLowerCase() === 'true';
        if (!enabled) {
            throw new common_1.BadRequestException('OCR is disabled (set ENABLE_PDF_OCR=true)');
        }
        const pageRows = await this.getPageAnalysis(documentId);
        const glyphCorruptedPages = await this.detectGlyphCorruptedPagesForDocument(doc, pageRows);
        const targets = pageRows
            .filter((p) => p.quality !== 'good' || glyphCorruptedPages.has(p.pageNumber))
            .slice(0, Number(process.env.PDF_OCR_MAX_PAGES ?? 10));
        if (targets.length === 0)
            return { ok: true, processedPages: 0 };
        const processed = await this.ocrPagesFromPdf(doc.filePath, documentId, targets.map((t) => t.pageNumber));
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.UPDATE,
            entityType: 'knowledge_document',
            entityId: doc.id,
            userId: adminId,
            changes: { event: 'ocr_run', processedPages: processed },
            reason: null,
        }));
        return { ok: true, processedPages: processed };
    }
    async runVisionForDocument(documentId, adminId) {
        const doc = await this.findOne(documentId);
        if (!doc.deepMode) {
            throw new common_1.BadRequestException('Vision runs only in deep mode');
        }
        if (!this.isEffectivePdfVision()) {
            throw new common_1.BadRequestException('PDF vision is off: enable ENABLE_PDF_VISION in server env and turn the admin “PDF vision” toggle on (Pipeline env / PDF Library).');
        }
        const pageRows = await this.getPageAnalysis(documentId);
        const batchSize = this.getDocBatchPages();
        const maxPerBatch = this.getVisionMaxPagesPerBatch();
        if (maxPerBatch <= 0)
            return { ok: true, processedPages: 0 };
        const glyphCorruptedPages = this.isGlyphCorruptionVisionEnabled()
            ? await this.detectGlyphCorruptedPagesForDocument(doc, pageRows)
            : new Set();
        const displayFontPages = new Set();
        for (const row of pageRows) {
            if (await this.pageUsesDisplayFont(doc.filePath, row.pageNumber)) {
                displayFontPages.add(row.pageNumber);
            }
        }
        let processed = 0;
        const batches = this.splitRowsIntoBatches(pageRows, batchSize);
        for (const batchRows of batches) {
            const targets = batchRows
                .filter((p) => displayFontPages.has(p.pageNumber) ||
                p.quality !== 'good' ||
                (p.ocrConfidence != null && p.ocrConfidence < (0, pdf_vision_config_1.getVisionTriggerOcrConfidenceBelow)()) ||
                glyphCorruptedPages.has(p.pageNumber))
                .sort((a, b) => Number(displayFontPages.has(b.pageNumber)) - Number(displayFontPages.has(a.pageNumber)))
                .slice(0, maxPerBatch);
            if (!targets.length)
                continue;
            processed += await this.runVisionForDocumentPages(documentId, targets.map((t) => t.pageNumber));
        }
        if (processed === 0)
            return { ok: true, processedPages: 0 };
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.UPDATE,
            entityType: 'knowledge_document',
            entityId: doc.id,
            userId: adminId,
            changes: { event: 'vision_run', processedPages: processed },
            reason: null,
        }));
        return { ok: true, processedPages: processed };
    }
    pageLikelyHasDiagram(pageText) {
        const t = String(pageText || '');
        return (/\bfig(?:ure|\.)\s*\d+/i.test(t) ||
            /(sch[ée]ma|schematic|diagram|wiring|raccordement|c[âa]blage|dimensions)/i.test(t));
    }
    isFigureVisionEnabled() {
        return String(process.env.ENABLE_FIGURE_VISION ?? 'true').toLowerCase() !== 'false';
    }
    getDocBatchPages() {
        const n = Number(process.env.DOC_BATCH_PAGES ?? 20);
        if (!Number.isFinite(n))
            return 20;
        return Math.max(1, Math.min(500, Math.floor(n)));
    }
    getVisionMaxPagesPerBatch() {
        const n = Number(process.env.PDF_VISION_MAX_PAGES_PER_BATCH ?? (0, pdf_vision_config_1.getPdfVisionMaxPages)());
        if (!Number.isFinite(n))
            return (0, pdf_vision_config_1.getPdfVisionMaxPages)();
        return Math.max(1, Math.min(500, Math.floor(n)));
    }
    splitRowsIntoBatches(rows, batchSize) {
        const sorted = [...rows].sort((a, b) => a.pageNumber - b.pageNumber);
        const batches = [];
        for (let i = 0; i < sorted.length; i += batchSize) {
            batches.push(sorted.slice(i, i + batchSize));
        }
        return batches;
    }
    async pageUsesDisplayFont(pdfPath, pageNumber) {
        try {
            const bin = process.env.PDFFONTS_PATH?.trim() || 'pdffonts';
            const { stdout } = await execFileAsync(bin, ['-f', String(pageNumber), '-l', String(pageNumber), pdfPath], { windowsHide: true });
            return /(7segment|seven.?segment|segment|lcd|dseg|digital|display)/i.test(String(stdout ?? ''));
        }
        catch {
            return false;
        }
    }
    async detectDisplayFontPagesParallel(pdfPath, pageNumbers) {
        const set = new Set();
        const concurrency = Math.max(2, Math.min(16, this.getVisionConcurrency() * 2));
        for (let i = 0; i < pageNumbers.length; i += concurrency) {
            const slice = pageNumbers.slice(i, i + concurrency);
            const results = await Promise.allSettled(slice.map(async (p) => ({ p, hit: await this.pageUsesDisplayFont(pdfPath, p) })));
            for (const r of results) {
                if (r.status === 'fulfilled' && r.value.hit)
                    set.add(r.value.p);
            }
        }
        return set;
    }
    normalizeDisplayVisionText(text) {
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
    async detectDocumentPrimaryLanguage(pdfPath) {
        try {
            const buf = (0, fs_2.readFileSync)(pdfPath);
            const parsed = await (0, pdf_text_util_1.parsePdfWithPoppler)(buf);
            const sample = String(parsed?.text ?? '').slice(0, 8000).toLowerCase();
            if (!sample.trim())
                return 'unknown';
            const score = (words) => words.reduce((acc, w) => acc + (sample.includes(` ${w} `) ? 1 : 0), 0);
            const frScore = score([
                'le', 'la', 'les', 'des', 'pour', 'avec', 'configuration', 'paramètres', 'paramètre',
                'réglage', 'sortie', 'entrée', 'tableau', 'mode', 'écran', 'généraux', 'définition',
                'définitions', 'contrôleur', 'contrôleurs', 'fonction', 'fonctionnement',
            ]) + (sample.match(/[éèêàâîôûç]/g)?.length ?? 0) / 50;
            const enScore = score([
                'the', 'and', 'with', 'configuration', 'parameters', 'setting', 'output', 'input',
                'table', 'mode', 'screen', 'general', 'definition', 'controller', 'function', 'operation',
            ]);
            const ranking = [
                [frScore, 'fr'],
                [enScore, 'en'],
            ];
            ranking.sort((a, b) => b[0] - a[0]);
            const [top] = ranking;
            if (top[0] >= 3)
                return top[1];
            return 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    languageLabel(code) {
        switch (code) {
            case 'fr':
                return 'French';
            case 'en':
                return 'English';
            default:
                return 'French or English (same as the page)';
        }
    }
    allowedScriptsFor(_code) {
        return new Set(['latin']);
    }
    stripDisallowedScripts(text, allowed) {
        if (!text)
            return text;
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
    async deleteDocument(documentId, adminId) {
        const doc = await this.findOne(documentId);
        try {
            await this.ragService.purgeManualIndexForDocument(doc.id);
        }
        catch {
        }
        await this.extractionCandidatesRepository.delete({ documentId: doc.id });
        await this.machineNameSuggestionsRepository.delete({ documentId: doc.id });
        await this.knowledgeDocumentsRepository.delete({ id: doc.id });
        try {
            if (doc.filePath && (0, fs_1.existsSync)(doc.filePath)) {
                (0, fs_1.unlinkSync)(doc.filePath);
            }
        }
        catch {
        }
    }
    async approveExtractionCandidate(candidateId, adminId, approverRole, payload) {
        const candidate = await this.extractionCandidatesRepository.findOne({
            where: { id: candidateId },
        });
        if (!candidate)
            throw new common_1.NotFoundException('Extraction candidate not found');
        const normalizedTags = payload?.tags ??
            candidate.tags ??
            undefined;
        const tags = typeof normalizedTags === 'string' && normalizedTags.trim().length > 0 ? normalizedTags : undefined;
        const title = payload?.title ?? candidate.title;
        const problemDescription = payload?.problemDescription ?? candidate.problemDescription;
        const solution = payload?.solution ?? candidate.solution;
        const entry = await this.knowledgeService.create({
            title,
            problemDescription,
            solution,
            tags,
            entryType: candidate.entryType ?? undefined,
            source: 'pdf_extraction',
            knowledgeDocumentId: candidate.documentId,
        }, adminId, approverRole, { skipAutoIndex: true });
        candidate.status = 'approved';
        candidate.reviewedById = adminId;
        await this.extractionCandidatesRepository.save(candidate);
        try {
            await this.enqueueIndexingJob(candidate.documentId, { knowledgeEntryId: entry.id, candidateId: candidate.id });
        }
        catch {
        }
        const doc = await this.knowledgeDocumentsRepository.findOne({ where: { id: candidate.documentId } });
        const edited = (payload?.title != null && payload.title !== candidate.title) ||
            (payload?.problemDescription != null && payload.problemDescription !== candidate.problemDescription) ||
            (payload?.solution != null && payload.solution !== candidate.solution);
        try {
            await this.extractionFeedbackRepository.save(this.extractionFeedbackRepository.create({
                documentId: candidate.documentId,
                candidateId: candidate.id,
                signal: edited ? 'approve_edit' : 'approve',
                docType: doc?.docType ?? null,
                sectionType: candidate.sectionType ?? null,
                entryType: candidate.entryType ?? null,
                confidence: candidate.confidence,
                adminId,
                reason: null,
                editDelta: edited
                    ? {
                        title: payload?.title ?? null,
                        problemDescription: payload?.problemDescription ?? null,
                        solution: payload?.solution ?? null,
                    }
                    : null,
            }));
        }
        catch {
        }
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.APPROVE,
            entityType: 'knowledge_extraction_candidate',
            entityId: candidate.id,
            userId: adminId,
            changes: { event: 'extraction_candidate_approved', knowledgeEntryId: entry.id },
            reason: null,
        }));
        return candidate;
    }
    async rejectExtractionCandidate(candidateId, adminId, reason) {
        const candidate = await this.extractionCandidatesRepository.findOne({
            where: { id: candidateId },
        });
        if (!candidate)
            throw new common_1.NotFoundException('Extraction candidate not found');
        candidate.status = 'rejected';
        candidate.reviewedById = adminId;
        const saved = await this.extractionCandidatesRepository.save(candidate);
        const doc = await this.knowledgeDocumentsRepository.findOne({ where: { id: candidate.documentId } });
        try {
            await this.extractionFeedbackRepository.save(this.extractionFeedbackRepository.create({
                documentId: candidate.documentId,
                candidateId: candidate.id,
                signal: 'reject',
                docType: doc?.docType ?? null,
                sectionType: candidate.sectionType ?? null,
                entryType: candidate.entryType ?? null,
                confidence: candidate.confidence,
                adminId,
                reason: reason?.trim() || null,
                editDelta: null,
            }));
        }
        catch {
        }
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.REJECT,
            entityType: 'knowledge_extraction_candidate',
            entityId: candidate.id,
            userId: adminId,
            changes: { event: 'extraction_candidate_rejected' },
            reason: reason?.trim() || null,
        }));
        return saved;
    }
    async listPageFixQueue() {
        return this.adminPageFixQueueRepository.find({
            where: { status: 'open' },
            order: { createdAt: 'DESC' },
            take: 200,
        });
    }
    async getPageFixReplacementImage(itemId) {
        const item = await this.adminPageFixQueueRepository.findOne({ where: { id: itemId } });
        if (!item)
            throw new common_1.NotFoundException('Fix queue item not found');
        const rel = item.replacementImagePath?.trim();
        if (!rel)
            throw new common_1.NotFoundException('No replacement image for this item');
        const cwd = process.cwd();
        const abs = (0, path_1.resolve)(cwd, rel);
        const baseDir = (0, path_1.resolve)(cwd, (0, pdf_ingestion_config_1.getPageFixImageUploadDir)());
        const relToBase = (0, path_1.relative)(baseDir, abs);
        if (!relToBase || relToBase.split(path_1.sep).includes('..')) {
            throw new common_1.ForbiddenException('Invalid image path');
        }
        if (!(0, fs_1.existsSync)(abs))
            throw new common_1.NotFoundException('Image file not found');
        const ext = (0, path_1.extname)(abs).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return { data: (0, fs_2.readFileSync)(abs), contentType };
    }
    async listRecentExtractionFeedback(limit = 200) {
        const take = Math.min(Math.max(1, limit), 500);
        return this.extractionFeedbackRepository.find({
            order: { createdAt: 'DESC' },
            take,
        });
    }
    async fixPageWithText(itemId, text, adminId) {
        const item = await this.adminPageFixQueueRepository.findOne({ where: { id: itemId } });
        if (!item)
            throw new common_1.NotFoundException('Fix queue item not found');
        if (item.status !== 'open')
            throw new common_1.BadRequestException('Item is not open');
        const trimmed = (text || '').trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Text cannot be empty');
        await this.pageAnalysisRepository.update({ documentId: item.documentId, pageNumber: item.pageNumber }, {
            ocrText: trimmed,
            ocrConfidence: 1,
            processingMode: 'region',
            extractionMode: 'ocr',
            quality: 'degraded',
            qualityWarnings: ['admin_fixed_text'],
        });
        item.status = 'fixed';
        item.adminFixedText = trimmed;
        item.fixedByAdminId = adminId;
        item.fixedAt = new Date();
        await this.adminPageFixQueueRepository.save(item);
        await this.reindexManualChunksAfterPageFixBestEffort(item.documentId);
        return { ok: true };
    }
    async dismissFixQueueItem(itemId, adminId) {
        const item = await this.adminPageFixQueueRepository.findOne({ where: { id: itemId } });
        if (!item)
            throw new common_1.NotFoundException('Fix queue item not found');
        item.status = 'dismissed';
        item.fixedByAdminId = adminId;
        item.fixedAt = new Date();
        await this.adminPageFixQueueRepository.save(item);
        return { ok: true };
    }
    async reindexManualChunksForDocument(documentId) {
        const doc = await this.findOne(documentId);
        if (!doc.filePath || !(0, fs_1.existsSync)(doc.filePath)) {
            throw new common_1.BadRequestException('PDF file missing for re-index');
        }
        const fileBuffer = (0, fs_2.readFileSync)(doc.filePath);
        const parsed = await (0, pdf_text_util_1.parsePdfWithPoppler)(fileBuffer);
        const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
        const relevantText = fullText;
        const maxChunksToProcess = Number(process.env.DOC_EXTRACTION_MAX_CHUNKS ?? 50);
        const indexMax = Number(process.env.DOC_INDEX_MAX_CHUNKS ?? 2000);
        const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
        const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);
        const chunks = await this.buildRoutedChunks(doc.id, relevantText, chunkSize, overlap);
        const prioritizedChunks = this.prioritizeChunksForExtraction(chunks, doc.docType ?? 'general_reference');
        const dedupedChunks = this.filterNearDuplicateChunks(prioritizedChunks);
        const chunksToUse = dedupedChunks.slice(0, maxChunksToProcess);
        const chunksToIndex = dedupedChunks.slice(0, indexMax);
        let manufacturer = null;
        if (doc.machineProfileId) {
            try {
                const mp = await this.machineProfilesService.findOne(doc.machineProfileId);
                manufacturer = mp.manufacturer ?? null;
            }
            catch {
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
    async reindexManualChunksAfterPageFixBestEffort(documentId) {
        try {
            await this.reindexManualChunksForDocument(documentId);
        }
        catch (e) {
            this.logger.warn(`Manual RAG re-index after page fix failed for ${documentId}: ${e?.message ?? e}`);
        }
    }
    async getAdminPipelineSummary() {
        const pageFixOpen = await this.adminPageFixQueueRepository.count({
            where: { status: 'open' },
        });
        const extractionCandidatesPending = await this.extractionCandidatesRepository.count({
            where: { status: 'candidate' },
        });
        return { pageFixOpen, extractionCandidatesPending };
    }
    assertReplacementImageMagicBytes(absPath) {
        const raw = (0, fs_2.readFileSync)(absPath);
        const sig = raw.subarray(0, Math.min(12, raw.length));
        const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
        const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
        const isWebp = sig[0] === 0x52 &&
            sig[1] === 0x49 &&
            sig[2] === 0x46 &&
            sig[8] === 0x57 &&
            sig[9] === 0x45 &&
            sig[10] === 0x42 &&
            sig[11] === 0x50;
        if (!isPng && !isJpeg && !isWebp) {
            throw new common_1.BadRequestException('Only JPEG, PNG, or WebP images are allowed');
        }
    }
    async resolveReplacementPageImageAbs(documentId, pageNumber) {
        const rows = await this.adminPageFixQueueRepository.find({
            where: { documentId, pageNumber, status: (0, typeorm_2.In)(['open', 'fixed']) },
            order: { updatedAt: 'DESC' },
            take: 10,
        });
        const row = rows.find((r) => r.replacementImagePath != null && String(r.replacementImagePath).trim() !== '');
        if (!row?.replacementImagePath)
            return null;
        const root = (0, path_1.resolve)((0, path_1.join)(process.cwd(), (0, pdf_ingestion_config_1.getPageFixImageUploadDir)()));
        const abs = (0, path_1.resolve)((0, path_1.join)(process.cwd(), row.replacementImagePath.trim()));
        if (!abs.startsWith(root))
            return null;
        if (!(0, fs_1.existsSync)(abs))
            return null;
        return abs;
    }
    async fixPageWithReplacementImage(itemId, absoluteUploadedPath, relativePathForDb, adminId) {
        if (!this.isEffectivePdfVision()) {
            try {
                if (absoluteUploadedPath && (0, fs_1.existsSync)(absoluteUploadedPath))
                    (0, fs_1.unlinkSync)(absoluteUploadedPath);
            }
            catch {
            }
            throw new common_1.BadRequestException('PDF vision is off: enable ENABLE_PDF_VISION in server env and turn the admin “PDF vision” toggle on (Pipeline env / PDF Library).');
        }
        const uploadRoot = (0, path_1.resolve)((0, path_1.join)(process.cwd(), (0, pdf_ingestion_config_1.getPageFixImageUploadDir)()));
        const resolvedUpload = (0, path_1.resolve)(absoluteUploadedPath);
        if (!resolvedUpload.startsWith(uploadRoot)) {
            throw new common_1.BadRequestException('Invalid upload path');
        }
        this.assertReplacementImageMagicBytes(resolvedUpload);
        const item = await this.adminPageFixQueueRepository.findOne({ where: { id: itemId } });
        if (!item)
            throw new common_1.NotFoundException('Fix queue item not found');
        if (item.status !== 'open')
            throw new common_1.BadRequestException('Item is not open');
        if (item.replacementImagePath?.trim()) {
            const oldAbs = (0, path_1.resolve)((0, path_1.join)(process.cwd(), item.replacementImagePath.trim()));
            if (oldAbs.startsWith(uploadRoot) && (0, fs_1.existsSync)(oldAbs) && oldAbs !== resolvedUpload) {
                try {
                    (0, fs_1.unlinkSync)(oldAbs);
                }
                catch {
                }
            }
        }
        item.replacementImagePath = relativePathForDb.replace(/\\/g, '/');
        await this.adminPageFixQueueRepository.save(item);
        const n = await this.runVisionForDocumentPages(item.documentId, [item.pageNumber]);
        if (n > 0) {
            item.status = 'fixed';
            item.fixedByAdminId = adminId;
            item.fixedAt = new Date();
            await this.adminPageFixQueueRepository.save(item);
            const w = await this.pageAnalysisRepository.findOne({
                where: { documentId: item.documentId, pageNumber: item.pageNumber },
            });
            const qw = Array.isArray(w?.qualityWarnings) ? [...w.qualityWarnings] : [];
            if (!qw.includes('admin_replacement_image'))
                qw.push('admin_replacement_image');
            await this.pageAnalysisRepository.update({ documentId: item.documentId, pageNumber: item.pageNumber }, { qualityWarnings: qw });
            await this.reindexManualChunksAfterPageFixBestEffort(item.documentId);
        }
        return { ok: true, visionPages: n };
    }
    async updateMachineName(documentId, machineName, _adminId) {
        const doc = await this.findOne(documentId);
        const trimmed = machineName.trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Machine name cannot be empty');
        doc.machineName = trimmed;
        return this.knowledgeDocumentsRepository.save(doc);
    }
    async listMachineNameSuggestions(documentId) {
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
    async suggestMachineName(documentId, proposedName, technicianId) {
        const doc = await this.findOne(documentId);
        if (doc.machineName != null && String(doc.machineName).trim() !== '') {
            throw new common_1.BadRequestException('Machine name is already set; suggestions are not needed');
        }
        const trimmed = proposedName.trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Proposed name cannot be empty');
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
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.CREATE,
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
        }));
        return saved;
    }
    async approveMachineNameSuggestion(suggestionId, adminId, rejectOthersReason) {
        const suggestion = await this.machineNameSuggestionsRepository.findOne({
            where: { id: suggestionId },
        });
        if (!suggestion)
            throw new common_1.NotFoundException('Suggestion not found');
        if (suggestion.status !== 'pending') {
            throw new common_1.BadRequestException('Only pending suggestions can be approved');
        }
        const doc = await this.findOne(suggestion.documentId);
        const sharedReason = rejectOthersReason?.trim() || 'Another suggestion was approved for this document.';
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
            if (o.id === suggestion.id)
                continue;
            o.status = 'rejected';
            o.rejectReason = sharedReason;
            o.reviewedById = adminId;
            o.reviewedAt = now;
            await this.machineNameSuggestionsRepository.save(o);
            await this.auditLogRepository.save(this.auditLogRepository.create({
                actionType: audit_log_entity_1.ActionType.REJECT,
                entityType: 'machine_name_suggestion',
                entityId: o.id,
                userId: o.suggestedById,
                changes: {
                    forUserId: o.suggestedById,
                    documentId: doc.id,
                    documentOriginalName: doc.originalName,
                    proposedName: o.proposedName,
                    rejectReason: sharedReason,
                    event: 'machine_name_suggestion_superseded',
                },
                reason: sharedReason,
            }));
        }
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.APPROVE,
            entityType: 'machine_name_suggestion',
            entityId: suggestion.id,
            userId: suggestion.suggestedById,
            changes: {
                forUserId: suggestion.suggestedById,
                documentId: doc.id,
                documentOriginalName: doc.originalName,
                proposedName: suggestion.proposedName,
                adoptedName: suggestion.proposedName,
                event: 'machine_name_suggestion_approved',
            },
            reason: null,
        }));
        return { document: doc, approved: suggestion };
    }
    async rejectMachineNameSuggestion(suggestionId, adminId, reason) {
        const suggestion = await this.machineNameSuggestionsRepository.findOne({
            where: { id: suggestionId },
        });
        if (!suggestion)
            throw new common_1.NotFoundException('Suggestion not found');
        if (suggestion.status !== 'pending') {
            throw new common_1.BadRequestException('Only pending suggestions can be rejected');
        }
        const doc = await this.findOne(suggestion.documentId);
        const now = new Date();
        const r = reason?.trim() || null;
        suggestion.status = 'rejected';
        suggestion.rejectReason = r;
        suggestion.reviewedById = adminId;
        suggestion.reviewedAt = now;
        await this.machineNameSuggestionsRepository.save(suggestion);
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: audit_log_entity_1.ActionType.REJECT,
            entityType: 'machine_name_suggestion',
            entityId: suggestion.id,
            userId: suggestion.suggestedById,
            changes: {
                forUserId: suggestion.suggestedById,
                documentId: doc.id,
                documentOriginalName: doc.originalName,
                proposedName: suggestion.proposedName,
                rejectReason: r,
                event: 'machine_name_suggestion_rejected',
            },
            reason: r,
        }));
        return suggestion;
    }
    async processDocumentExtraction(documentId) {
        const doc = await this.findOne(documentId);
        try {
            await this.updateProgress(doc.id, { currentStage: 'extraction_start', progressPercent: 5 });
            const promptPathCandidates = [
                (0, path_1.join)(process.cwd(), 'src', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
                (0, path_1.join)(__dirname, '..', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
                (0, path_1.join)(__dirname, 'prompts', 'techo-pdf-extractor-system.prompt.md'),
            ];
            const extractionPrompt = (() => {
                for (const p of promptPathCandidates) {
                    try {
                        return (0, fs_2.readFileSync)(p, 'utf8');
                    }
                    catch {
                    }
                }
                throw new Error('Could not load extractor prompt file');
            })();
            const fileBuffer = (0, fs_2.readFileSync)(doc.filePath);
            const parsed = await (0, pdf_text_util_1.parsePdfWithPoppler)(fileBuffer);
            const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
            const totalPages = Number(parsed?.numpages ?? doc.totalPages ?? 0) || 0;
            await this.updateProgress(doc.id, {
                currentStage: 'page_quality_scoring',
                progressPercent: 12,
                totalPages,
                pagesProcessed: 0,
            });
            await this.pageAnalysisRepository.delete({ documentId: doc.id });
            await this.savePageAnalysis(doc.id, parsed, fullText);
            try {
                const ocrEnabled = String(process.env.ENABLE_PDF_OCR ?? 'false').toLowerCase() === 'true';
                if (doc.deepMode) {
                    const rows = await this.getPageAnalysis(doc.id);
                    const batches = this.splitRowsIntoBatches(rows, this.getDocBatchPages());
                    const ocrMax = Number(process.env.PDF_OCR_MAX_PAGES ?? 10);
                    if (ocrEnabled) {
                        const toOcr = batches.flatMap((batchRows) => batchRows
                            .filter((r) => r.quality === 'poor' || r.quality === 'unreadable' || r.quality === 'degraded')
                            .slice(0, ocrMax)
                            .map((r) => r.pageNumber));
                        if (toOcr.length > 0) {
                            await this.enqueueOcrJob(doc.id, [...new Set(toOcr)].sort((a, b) => a - b));
                        }
                    }
                    else if (this.isEffectivePdfVision()) {
                        const toVision = batches.flatMap((batchRows) => batchRows
                            .filter((r) => r.quality === 'poor' || r.quality === 'unreadable' || r.quality === 'degraded')
                            .slice(0, this.getVisionMaxPagesPerBatch())
                            .map((r) => r.pageNumber));
                        if (toVision.length > 0) {
                            await this.enqueueVisionJob(doc.id, [...new Set(toVision)].sort((a, b) => a - b));
                        }
                    }
                    if (this.isEffectivePdfVision()) {
                        const maxVisionPagesPerBatch = this.getVisionMaxPagesPerBatch();
                        const pageTextsForFigures = this.derivePageTexts(parsed, fullText);
                        const inlineVisionPages = new Set();
                        const extractionCriticalSections = new Set([
                            'fault_table',
                            'alarm_list',
                            'procedure_steps',
                            'warning_notice',
                            'specification',
                        ]);
                        const displayFontPages = await this.detectDisplayFontPagesParallel(doc.filePath, rows.map((r) => r.pageNumber));
                        if (this.isGlyphCorruptionVisionEnabled()) {
                            for (const batchRows of batches) {
                                let perBatch = 0;
                                for (const r of batchRows) {
                                    if ((r.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely'))) {
                                        inlineVisionPages.add(r.pageNumber);
                                        perBatch += 1;
                                        if (perBatch >= maxVisionPagesPerBatch)
                                            break;
                                    }
                                }
                            }
                        }
                        for (const batchRows of batches) {
                            let perBatch = [...inlineVisionPages].filter((p) => batchRows.some((r) => r.pageNumber === p)).length;
                            if (perBatch >= maxVisionPagesPerBatch)
                                continue;
                            for (const r of batchRows) {
                                if (inlineVisionPages.has(r.pageNumber))
                                    continue;
                                if (!displayFontPages.has(r.pageNumber))
                                    continue;
                                if (!extractionCriticalSections.has(String(r.sectionType ?? '')))
                                    continue;
                                inlineVisionPages.add(r.pageNumber);
                                perBatch += 1;
                                if (perBatch >= maxVisionPagesPerBatch)
                                    break;
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
                            }
                            catch (e) {
                                this.logger.warn(`Inline vision for critical pages failed: ${e?.message ?? e}`);
                            }
                        }
                        const asyncDisplayPages = new Set([...displayFontPages].filter((p) => !inlineVisionPages.has(p)));
                        for (const batchRows of batches) {
                            const enriched = new Set();
                            for (const r of batchRows) {
                                if (asyncDisplayPages.has(r.pageNumber)) {
                                    enriched.add(r.pageNumber);
                                    if (enriched.size >= maxVisionPagesPerBatch)
                                        break;
                                }
                            }
                            const pages = [...enriched].sort((a, b) => a - b);
                            if (pages.length > 0) {
                                await this.enqueueVisionJob(doc.id, pages);
                            }
                        }
                        if (this.isFigureVisionEnabled()) {
                            for (const batchRows of batches) {
                                const figurePages = new Set();
                                for (const r of batchRows) {
                                    if (inlineVisionPages.has(r.pageNumber))
                                        continue;
                                    if (asyncDisplayPages.has(r.pageNumber))
                                        continue;
                                    if (r.sectionType === 'wiring' ||
                                        this.pageLikelyHasDiagram(pageTextsForFigures[r.pageNumber - 1] ?? '')) {
                                        figurePages.add(r.pageNumber);
                                        if (figurePages.size >= maxVisionPagesPerBatch)
                                            break;
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
            }
            catch {
            }
            doc.deepMode = true;
            doc.status = 'processing';
            await this.knowledgeDocumentsRepository.save(doc);
            if (doc.machineName == null || String(doc.machineName).trim() === '') {
                let extractedName = null;
                try {
                    extractedName = await this.extractMachineNameFromManual(fullText);
                }
                catch {
                    extractedName = null;
                }
                if (extractedName) {
                    doc.machineName = extractedName;
                    await this.knowledgeDocumentsRepository.save(doc);
                }
            }
            const relevantText = fullText;
            const maxChunksToProcess = Number(process.env.DOC_EXTRACTION_MAX_CHUNKS ?? 50);
            const indexMax = Number(process.env.DOC_INDEX_MAX_CHUNKS ?? 2000);
            const maxCandidatesTotal = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES ?? 200);
            const maxCandidatesPerChunk = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK ?? 10);
            const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
            const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);
            const chunks = await this.buildRoutedChunks(doc.id, relevantText, chunkSize, overlap);
            const prioritizedChunks = this.prioritizeChunksForExtraction(chunks, doc.docType ?? 'general_reference');
            const dedupedChunks = this.filterNearDuplicateChunks(prioritizedChunks);
            const ocrScaffold = this.getOcrScaffoldMetadata(fullText);
            if (ocrScaffold.quality === 'poor') {
                doc.error = 'Scan quality looks poor; OCR/vision fallback recommended in next phase.';
                await this.knowledgeDocumentsRepository.save(doc);
            }
            const candidatesToSave = [];
            const chunksToUse = dedupedChunks.slice(0, maxChunksToProcess);
            const chunksToIndex = dedupedChunks.slice(0, indexMax);
            const chunkRagMeta = new Array(chunksToUse.length);
            await this.updateProgress(doc.id, { currentStage: 'structured_extraction', progressPercent: 25 });
            const dedupe = new Set();
            for (const [chunkIndex, chunk] of chunksToUse.entries()) {
                if (candidatesToSave.length >= maxCandidatesTotal)
                    break;
                const sectionType = this.classifyChunkSection(chunk, doc.docType ?? 'general_reference');
                const userContent = `Extract structured maintenance knowledge candidates from this text.\n` +
                    `Return JSON ONLY with key "candidates".\n` +
                    `Each candidate must use keys: entryType, title, problemDescription, solution, symptom, rootCause, tags, sourcePages, confidence.\n` +
                    `Preserve the original language(s) of the source text exactly; do not translate.\n` +
                    `entryType must be one of: fault, procedure, safety, wiring, spec.\n` +
                    `Section type hint: ${sectionType}\n` +
                    `Chunk index: ${chunkIndex}\n\n` +
                    chunk;
                const messages = [
                    { role: 'system', content: extractionPrompt },
                    { role: 'user', content: userContent },
                ];
                const raw = await this.aiService.chatPdf(messages);
                const parsedJson = this.tryParseJson(raw);
                const candidates = parsedJson?.candidates;
                if (!Array.isArray(candidates))
                    continue;
                const newCandidates = [];
                for (const c of candidates.slice(0, maxCandidatesPerChunk)) {
                    if (!c?.title || !c?.problemDescription || !c?.solution)
                        continue;
                    const fp = `${String(c.title).trim().toLowerCase()}|${String(c.problemDescription)
                        .trim()
                        .toLowerCase()}|${String(c.solution).trim().toLowerCase()}`;
                    if (dedupe.has(fp))
                        continue;
                    dedupe.add(fp);
                    const parsedConfidence = Number(c.confidence);
                    const confidence = Number.isFinite(parsedConfidence)
                        ? Math.max(0, Math.min(1, parsedConfidence))
                        : null;
                    const sourcePagesRaw = Array.isArray(c.sourcePages) ? c.sourcePages.join(',') : c.sourcePages ? String(c.sourcePages) : null;
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
                if (newCandidates.length > 0) {
                    await this.extractionCandidatesRepository.save(newCandidates);
                }
                if (newCandidates.length > 0) {
                    const best = newCandidates.reduce((a, b) => (Number(b.confidence) || 0) > (Number(a.confidence) || 0) ? b : a);
                    chunkRagMeta[chunkIndex] = {
                        sectionType,
                        title: best.title ? String(best.title).slice(0, 400) : null,
                        sourcePages: best.sourcePages ?? null,
                        confidence: best.confidence ?? null,
                        entryType: best.entryType ?? null,
                    };
                }
                else {
                    chunkRagMeta[chunkIndex] = { sectionType };
                }
                const pct = Math.min(78, 25 + Math.round(((chunkIndex + 1) / Math.max(1, chunksToUse.length)) * 53));
                await this.updateProgress(doc.id, {
                    progressPercent: pct,
                    pagesProcessed: Math.min(totalPages || chunksToUse.length, chunkIndex + 1),
                    lastProcessedPage: chunkIndex + 1,
                });
            }
            if (candidatesToSave.length > 0) {
                await this.extractionCandidatesRepository.save(candidatesToSave);
            }
            doc.status = 'done';
            doc.error = null;
            doc.chunksIndexed = 0;
            await this.knowledgeDocumentsRepository.save(doc);
            await this.updateProgress(doc.id, { currentStage: 'indexing', progressPercent: 85 });
            try {
                let manufacturer = null;
                if (doc.machineProfileId) {
                    try {
                        const mp = await this.machineProfilesService.findOne(doc.machineProfileId);
                        manufacturer = mp.manufacturer ?? null;
                    }
                    catch {
                        manufacturer = null;
                    }
                }
                await this.ragService.indexDocumentChunks(doc.id, chunksToIndex, {
                    machineProfileId: doc.machineProfileId,
                    machineName: doc.machineName,
                    manufacturer,
                    docType: doc.docType,
                    language: null,
                }, chunkRagMeta);
                doc.chunksIndexed = chunksToIndex.length;
                doc.status = 'done';
                await this.knowledgeDocumentsRepository.save(doc);
                await this.updateProgress(doc.id, {
                    currentStage: 'done',
                    progressPercent: 100,
                    pagesProcessed: totalPages || chunksToIndex.length,
                    lastProcessedPage: totalPages || chunksToIndex.length,
                });
            }
            catch (indexErr) {
                doc.error = `Indexing failed: ${indexErr?.message ? String(indexErr.message) : 'unknown error'}`;
                doc.chunksIndexed = 0;
                doc.status = 'partially_indexed';
                await this.knowledgeDocumentsRepository.save(doc);
                await this.updateProgress(doc.id, { currentStage: 'partially_indexed', progressPercent: 92 });
            }
        }
        catch (e) {
            doc.status = 'failed';
            doc.error = e?.message ? String(e.message) : 'PDF extraction failed';
            await this.knowledgeDocumentsRepository.save(doc);
            await this.updateProgress(doc.id, { currentStage: 'failed', progressPercent: 100 });
        }
    }
    heuristicDocType(text, originalName) {
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
    quickRelevanceHeuristic(text, originalName) {
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
        for (const t of positive)
            if (corpus.includes(t))
                score += 0.08;
        for (const t of negative)
            if (corpus.includes(t))
                score -= 0.18;
        const normalized = Math.max(0, Math.min(1, 0.5 + score));
        const reason = normalized >= 0.8
            ? 'Strong industrial/maintenance signal'
            : normalized < 0.55
                ? 'Low work-related signal'
                : 'Mixed signal';
        return { score: normalized, reason };
    }
    async classifyUploadGateThreeTier(pageTexts, originalName) {
        const joinFirstPages = (count) => pageTexts.slice(0, Math.min(count, pageTexts.length)).join('\n\n');
        const tier1Pages = (0, gate_config_1.getGateHeuristicPageCount)();
        const tier2Pages = (0, gate_config_1.getGateTier2PageCount)();
        const heuristicBody = joinFirstPages(tier1Pages).slice(0, 12000);
        const tier2EmbedBody = joinFirstPages(tier2Pages).slice(0, 5000);
        const llmBody = joinFirstPages(tier1Pages).slice(0, (0, gate_config_1.getGateLlmCharLimit)());
        const heur = this.quickRelevanceHeuristic(heuristicBody, originalName);
        const heuristicType = this.heuristicDocType(heuristicBody, originalName);
        const acceptAbove = (0, gate_config_1.getGateTier1AcceptAbove)();
        const rejectBelow = (0, gate_config_1.getGateTier1RejectBelow)();
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
        try {
            const [sampleVec, workVec, nonWorkVec] = await Promise.all([
                this.ragService.embedText(tier2EmbedBody),
                this.getWorkProfileEmbedding(),
                this.getNonWorkProfileEmbedding(),
            ]);
            const workSim = this.cosineSimilarity(sampleVec, workVec);
            const nonWorkSim = this.cosineSimilarity(sampleVec, nonWorkVec);
            const workMin = (0, gate_config_1.getGateTier2WorkSimMin)();
            const nonWorkMin = (0, gate_config_1.getGateTier2NonWorkSimMin)();
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
        }
        catch {
        }
        const messages = [
            {
                role: 'system',
                content: 'Classify if a PDF is related to industrial maintenance work. Return JSON only with keys: ' +
                    '{"isWorkRelated": boolean, "docType": string, "confidence": number, "reason": string, ' +
                    '"language": string|null, "detectedMachineName": string|null, "detectedManufacturer": string|null}. ' +
                    'language should be an ISO 639-1 code when possible (e.g. "fr", "en", "ar"). ' +
                    'docType must be one of: machine_manual, electrical_circuit_guide, hmi_software_guide, safety_document, operations_procedure, general_reference, irrelevant.',
            },
            {
                role: 'user',
                content: `Filename: ${originalName}\n` +
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
            const detectedMachineName = typeof parsed.detectedMachineName === 'string' && parsed.detectedMachineName.trim()
                ? parsed.detectedMachineName.trim()
                : null;
            const detectedManufacturer = typeof parsed.detectedManufacturer === 'string' && parsed.detectedManufacturer.trim()
                ? parsed.detectedManufacturer.trim()
                : null;
            const language = typeof parsed.language === 'string' && parsed.language.trim() ? parsed.language.trim().slice(0, 12) : null;
            const hasValidAi = Number.isFinite(aiConfidence) && aiConfidence >= 0 && aiConfidence <= 1;
            if (hasValidAi) {
                const blended = Math.max(0, Math.min(1, aiConfidence * 0.75 + heur.score * 0.25));
                const decision = blended >= 0.8
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
        }
        catch {
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
    async getWorkProfileEmbedding() {
        if (this.workProfileEmbedding)
            return this.workProfileEmbedding;
        const profileText = [
            'industrial machine maintenance manual fault troubleshooting alarm wiring plc inverter motor sensor actuator',
            'safety procedure lockout tagout machine operation corrective action preventive maintenance',
            'electrical circuit schematic relay mcc panel voltage current terminal diagram',
        ].join('\n');
        this.workProfileEmbedding = await this.ragService.embedText(profileText);
        return this.workProfileEmbedding;
    }
    async getNonWorkProfileEmbedding() {
        if (this.nonWorkProfileEmbedding)
            return this.nonWorkProfileEmbedding;
        const profileText = [
            'recipe cooking kitchen food ingredients meal restaurant',
            'gaming game walkthrough sport football movie entertainment travel',
            'personal blog lifestyle social media',
        ].join('\n');
        this.nonWorkProfileEmbedding = await this.ragService.embedText(profileText);
        return this.nonWorkProfileEmbedding;
    }
    cosineSimilarity(a, b) {
        const n = Math.min(a.length, b.length);
        if (n === 0)
            return 0;
        let dot = 0;
        let na = 0;
        let nb = 0;
        for (let i = 0; i < n; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        if (!denom)
            return 0;
        return dot / denom;
    }
    classifyChunkSection(chunk, docType) {
        const text = `${docType} ${chunk}`.toLowerCase();
        if (/(fault|alarm|error|troubleshoot|failure|cause)/i.test(text))
            return 'fault_table';
        if (/(alarm|alarme|a-\d+|alarm list)/i.test(text))
            return 'alarm_list';
        if (/(wiring|schematic|circuit|terminal|connector|mcc|single line)/i.test(text))
            return 'wiring';
        if (/(warning|danger|hazard|sécurité|ppe|lockout|tagout)/i.test(text))
            return 'warning_notice';
        if (/(step|procedure|setup|calibration|commissioning|install)/i.test(text))
            return 'procedure_steps';
        if (/(specification|rating|voltage|current|dimension|torque)/i.test(text))
            return 'specification';
        return 'general_text';
    }
    defaultEntryTypeFromSection(sectionType) {
        if (sectionType === 'fault_table')
            return 'fault';
        if (sectionType === 'alarm_list')
            return 'fault';
        if (sectionType === 'wiring')
            return 'wiring';
        if (sectionType === 'warning_notice')
            return 'safety';
        if (sectionType === 'procedure_steps')
            return 'procedure';
        if (sectionType === 'specification')
            return 'spec';
        return 'procedure';
    }
    splitTextIntoPageBuckets(text, expectedPages) {
        const byFormFeed = String(text || '')
            .split('\f')
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        if (byFormFeed.length >= Math.max(1, expectedPages)) {
            return byFormFeed;
        }
        if (expectedPages <= 1)
            return [String(text || '')];
        const src = String(text || '');
        const perPage = Math.max(1, Math.ceil(src.length / expectedPages));
        const buckets = [];
        for (let i = 0; i < expectedPages; i++) {
            buckets.push(src.slice(i * perPage, (i + 1) * perPage));
        }
        return buckets;
    }
    async buildRoutedChunks(documentId, text, chunkSize, overlap) {
        const pageRows = await this.pageAnalysisRepository.find({
            where: { documentId },
            order: { pageNumber: 'ASC' },
        });
        if (!pageRows || pageRows.length === 0) {
            const chunks = [];
            for (let i = 0; i < text.length; i += chunkSize - overlap) {
                const chunk = text.slice(i, i + chunkSize);
                if (chunk.trim().length > 0)
                    chunks.push(chunk);
            }
            return chunks;
        }
        const pages = this.splitTextIntoPageBuckets(text, pageRows.length);
        const chunks = [];
        for (let i = 0; i < pageRows.length; i++) {
            const row = pageRows[i];
            const rawPageText = (pages[i] ?? '').trim();
            let pageText = (row?.ocrText && row.ocrText.trim().length > 0 ? row.ocrText : rawPageText).trim();
            if (pageText.includes('--- Vision description ---')) {
                const [rawPart, ...visionParts] = pageText.split('--- Vision description ---');
                const visionOnly = visionParts.join('--- Vision description ---').trim();
                const rawLikelyCorrupted = this.detectGlyphCorruption(String(rawPart || '')).corrupted ||
                    (row?.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely'));
                if (visionOnly && rawLikelyCorrupted) {
                    pageText = visionOnly;
                }
            }
            if (!pageText)
                continue;
            const st = row?.sectionType ?? this.detectSectionType(pageText);
            if (st === 'fault_table' || st === 'alarm_list') {
                for (const line of pageText.split(/\r?\n/)) {
                    const l = line.trim();
                    if (!l)
                        continue;
                    if (l.length < 20)
                        continue;
                    if (/(E-\d+|A-\d+|\|)/i.test(l)) {
                        chunks.push(l);
                    }
                }
                continue;
            }
            if (st === 'warning_notice') {
                chunks.push(pageText.slice(0, 6000));
                continue;
            }
            if (st === 'procedure_steps') {
                chunks.push(pageText.slice(0, 9000));
                continue;
            }
            if (st === 'wiring' || st === 'specification') {
                chunks.push(pageText.slice(0, 9000));
                continue;
            }
            for (let off = 0; off < pageText.length; off += chunkSize - overlap) {
                const ch = pageText.slice(off, off + chunkSize);
                if (ch.trim())
                    chunks.push(ch);
            }
        }
        return chunks;
    }
    prioritizeChunksForExtraction(chunks, docType) {
        const scored = chunks.map((chunk) => {
            const sectionType = this.classifyChunkSection(chunk, docType);
            const text = chunk.toLowerCase();
            const looksLikeToc = /(table of contents|contents|sommaire|index)/i.test(text) ||
                (text.includes('.....') && /\b\d{1,4}\b/.test(text));
            const score = (() => {
                if (looksLikeToc)
                    return 100;
                if (sectionType === 'fault_table')
                    return 90;
                if (sectionType === 'alarm_list')
                    return 85;
                if (sectionType === 'procedure_steps')
                    return 80;
                if (sectionType === 'warning_notice')
                    return 75;
                if (sectionType === 'specification')
                    return 60;
                if (sectionType === 'wiring')
                    return 55;
                return 10;
            })();
            return { chunk, score };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s) => s.chunk);
    }
    getNearDuplicateJaccardThreshold() {
        const raw = Number(process.env.DOC_CHUNK_NEAR_DUPLICATE_JACCARD ?? 0.97);
        if (!Number.isFinite(raw))
            return 0.97;
        return Math.max(0.75, Math.min(0.995, raw));
    }
    normalizeChunkForSimilarity(text) {
        return String(text || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[^a-z0-9\u00c0-\u017f]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    jaccardSetSimilarity(a, b) {
        if (a.size === 0 || b.size === 0)
            return 0;
        let intersection = 0;
        const small = a.size <= b.size ? a : b;
        const big = a.size <= b.size ? b : a;
        for (const x of small) {
            if (big.has(x))
                intersection += 1;
        }
        const union = a.size + b.size - intersection;
        return union > 0 ? intersection / union : 0;
    }
    filterNearDuplicateChunks(chunks) {
        const threshold = this.getNearDuplicateJaccardThreshold();
        const kept = [];
        const tokenSets = [];
        for (const chunk of chunks) {
            const norm = this.normalizeChunkForSimilarity(chunk);
            const tokens = norm.split(' ').filter((t) => t.length >= 3);
            const tokenSet = new Set(tokens);
            if (tokenSet.size === 0) {
                kept.push(chunk);
                tokenSets.push(tokenSet);
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
    normalizeExtractedText(text) {
        return String(text || '')
            .replace(/\u0000/g, '')
            .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
            .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
            .normalize('NFC');
    }
    async detectGlyphCorruptedPagesForDocument(doc, pageRows) {
        const flagged = new Set();
        for (const row of pageRows) {
            const warned = (row.qualityWarnings ?? []).some((w) => String(w).startsWith('glyph_corruption_likely'));
            if (warned || this.detectGlyphCorruption(row.ocrText ?? '').corrupted) {
                flagged.add(row.pageNumber);
            }
        }
        if (!doc.filePath || !(0, fs_1.existsSync)(doc.filePath))
            return flagged;
        try {
            const fileBuffer = (0, fs_2.readFileSync)(doc.filePath);
            const parsed = await (0, pdf_text_util_1.parsePdfWithPoppler)(fileBuffer);
            const fullText = this.normalizeExtractedText(String(parsed?.text || ''));
            const pageTexts = this.derivePageTexts(parsed, fullText);
            for (const row of pageRows) {
                const raw = pageTexts[row.pageNumber - 1] ?? '';
                if (this.detectGlyphCorruption(raw).corrupted) {
                    flagged.add(row.pageNumber);
                }
            }
        }
        catch {
        }
        return flagged;
    }
    getOcrScaffoldMetadata(fullText) {
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
    async savePageAnalysis(documentId, parsed, fullText) {
        const pageTexts = this.derivePageTexts(parsed, fullText);
        const rows = [];
        for (const [idx, pageText] of pageTexts.entries()) {
            const qualityEval = this.scorePageQuality(pageText);
            const sectionType = this.detectSectionType(pageText);
            const glyph = this.detectGlyphCorruption(pageText);
            let quality = qualityEval.quality;
            const warnings = [...qualityEval.warnings];
            if (glyph.corrupted) {
                warnings.push(`glyph_corruption_likely(${glyph.suspectTokenCount})`);
                if (quality === 'good')
                    quality = 'degraded';
            }
            rows.push(this.pageAnalysisRepository.create({
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
            }));
        }
        if (rows.length > 0) {
            await this.pageAnalysisRepository.save(rows);
        }
        const unreadable = rows.filter((r) => r.quality === 'unreadable');
        if (unreadable.length > 0) {
            for (const u of unreadable) {
                const exists = await this.adminPageFixQueueRepository.findOne({
                    where: { documentId, pageNumber: u.pageNumber, status: 'open' },
                });
                if (exists)
                    continue;
                await this.adminPageFixQueueRepository.save(this.adminPageFixQueueRepository.create({
                    documentId,
                    pageNumber: u.pageNumber,
                    status: 'open',
                    reason: (u.qualityWarnings || []).join(',') || 'unreadable_page',
                    adminFixedText: null,
                    fixedByAdminId: null,
                    fixedAt: null,
                }));
            }
        }
    }
    async ocrPagesFromPdf(pdfPath, documentId, pageNumbers) {
        const tesseract = process.env.TESSERACT_PATH?.trim() || 'tesseract';
        const lang = process.env.TESSERACT_LANG?.trim() || 'eng+fra';
        const workDir = (0, path_1.join)((0, os_1.tmpdir)(), `smartmaint-ocr-${documentId}-${Date.now()}`);
        (0, fs_3.mkdirSync)(workDir, { recursive: true });
        let processed = 0;
        try {
            for (const page of pageNumbers) {
                const pngPath = await this.renderPdfPageToPng(pdfPath, page, workDir);
                const first = await this.runTesseract(pngPath, tesseract, lang);
                let bestText = first.text;
                let bestConf = first.confidence;
                let bestMode = 'raw';
                const preprocessedPath = (0, path_1.join)(workDir, `page-${page}-pre.png`);
                await (0, sharp_1.default)(pngPath)
                    .grayscale()
                    .normalize()
                    .median(1)
                    .sharpen()
                    .threshold(180)
                    .png()
                    .toFile(preprocessedPath);
                const second = await this.runTesseract(preprocessedPath, tesseract, lang);
                if ((second.confidence ?? 0) > (bestConf ?? 0)) {
                    bestText = second.text;
                    bestConf = second.confidence;
                    bestMode = 'preprocessed';
                }
                await this.pageAnalysisRepository.update({ documentId, pageNumber: page }, {
                    ocrText: bestText || null,
                    ocrConfidence: bestConf,
                    processingMode: bestMode,
                    extractionMode: 'ocr',
                });
                processed += 1;
            }
            await this.maybeEnqueueVisionPagesAfterOcr(documentId, pageNumbers);
        }
        finally {
            try {
                (0, fs_3.rmSync)(workDir, { recursive: true, force: true });
            }
            catch {
            }
        }
        return processed;
    }
    async runTesseract(pngPath, tesseractBin, lang) {
        const textRes = await execFileAsync(tesseractBin, [pngPath, 'stdout', '-l', lang], {
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
        });
        const text = this.normalizeExtractedText((textRes.stdout ?? '').toString().trim());
        const tsvRes = await execFileAsync(tesseractBin, [pngPath, 'stdout', '-l', lang, 'tsv'], {
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
        });
        const tsv = (tsvRes.stdout ?? '').toString();
        const confidence = this.meanTesseractConfidence(tsv);
        return { text, confidence };
    }
    meanTesseractConfidence(tsv) {
        const lines = String(tsv || '').split(/\r?\n/);
        if (lines.length <= 1)
            return null;
        let sum = 0;
        let count = 0;
        for (const line of lines.slice(1)) {
            if (!line.trim())
                continue;
            const parts = line.split('\t');
            const confStr = parts[10];
            const text = parts[11];
            if (!text || !text.trim())
                continue;
            const conf = Number(confStr);
            if (!Number.isFinite(conf) || conf < 0)
                continue;
            sum += conf;
            count += 1;
        }
        if (count === 0)
            return null;
        return Math.max(0, Math.min(1, (sum / count) / 100));
    }
    async detectMachineProfile(textSample, originalName) {
        const messages = [
            {
                role: 'system',
                content: 'Extract machine profile details from an industrial PDF cover/intro text. Return JSON only with keys: ' +
                    '{"machineName": string|null, "manufacturer": string|null, "family": string|null, "modelNumber": string|null, "components": string[]|null}. ' +
                    'If unsure, use null. Components should be short phrases (e.g. "PLC Siemens S7-300").',
            },
            {
                role: 'user',
                content: `Filename: ${originalName}\n\nText sample:\n${textSample.slice(0, (0, gate_config_1.getGateLlmCharLimit)())}`,
            },
        ];
        try {
            const raw = await this.aiService.chatPdf(messages);
            const parsed = this.tryParseJson(raw) ?? {};
            const machineName = typeof parsed.machineName === 'string' && parsed.machineName.trim() ? parsed.machineName.trim() : null;
            const manufacturer = typeof parsed.manufacturer === 'string' && parsed.manufacturer.trim() ? parsed.manufacturer.trim() : null;
            const family = typeof parsed.family === 'string' && parsed.family.trim() ? parsed.family.trim() : null;
            const modelNumber = typeof parsed.modelNumber === 'string' && parsed.modelNumber.trim() ? parsed.modelNumber.trim() : null;
            const components = Array.isArray(parsed.components) ? parsed.components.map((c) => String(c)).filter(Boolean) : null;
            return { machineName, manufacturer, family, modelNumber, components };
        }
        catch {
            return { machineName: null, manufacturer: null, family: null, modelNumber: null, components: null };
        }
    }
    derivePageTexts(parsed, fullText) {
        const pagesFromFormFeed = String(fullText || '')
            .split('\f')
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        if (pagesFromFormFeed.length > 1) {
            return pagesFromFormFeed;
        }
        const numPages = Number(parsed?.numpages ?? 1);
        if (!Number.isFinite(numPages) || numPages <= 1) {
            return [String(fullText || '')];
        }
        const text = String(fullText || '');
        const perPage = Math.max(1, Math.ceil(text.length / numPages));
        const chunks = [];
        for (let i = 0; i < numPages; i++) {
            chunks.push(text.slice(i * perPage, (i + 1) * perPage));
        }
        return chunks;
    }
    scorePageQuality(pageText) {
        const text = String(pageText || '').trim();
        const len = text.length;
        const warnings = [];
        let confidence = 0.9;
        if (len < 30) {
            return { quality: 'unreadable', ocrConfidence: 0.05, warnings: ['very_low_text_density'] };
        }
        if (len < 300) {
            warnings.push('low_text_density');
            confidence -= 0.45;
        }
        else if (len < 1200) {
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
    detectGlyphCorruption(pageText) {
        const t = String(pageText || '').trim();
        if (!t)
            return { corrupted: false, suspectTokenCount: 0 };
        const tokens = t.split(/\s+/);
        let suspect = 0;
        for (const raw of tokens) {
            const tok = raw.trim();
            const displaySymbolCount = (tok.match(/[@#$%&*~^]/g) ?? []).length;
            const shortDisplayLike = tok.length >= 1 &&
                tok.length <= 4 &&
                displaySymbolCount === 1 &&
                /^[A-Za-z0-9'=@#$%&*~^]+$/.test(tok);
            if (shortDisplayLike) {
                suspect += 1;
                continue;
            }
            if (tok.length < 2 || tok.length > 32)
                continue;
            const specials = (tok.match(/[#$%&'+:;<>=*~^_|@!?"\\\/\.\-]/g) ?? []).length;
            const specialRatio = specials / Math.max(1, tok.length);
            if (specials < 2 || specialRatio < 0.25)
                continue;
            if (/[aeiouyàâéèêëîïôûùœAEIOUYÀÂÉÈÊËÎÏÔÛÙŒ]/.test(tok))
                continue;
            if (/^https?:/i.test(tok))
                continue;
            if (/^[\d.,:\-+]+$/.test(tok))
                continue;
            suspect += 1;
        }
        return { corrupted: suspect >= 1, suspectTokenCount: suspect };
    }
    isGlyphCorruptionVisionEnabled() {
        return String(process.env.ENABLE_GLYPH_CORRUPTION_VISION ?? 'true').toLowerCase() !== 'false';
    }
    detectSectionType(pageText) {
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
    extractMachineNameHeuristic(text) {
        const head = text.slice(0, 12000);
        const linePatterns = [
            /(?:^|\n)\s*(?:machine|equipment|device|model)\s*[:#]\s*([^\n]+)/i,
            /(?:^|\n)\s*model\s*(?:no\.?|number|#)?\s*[:#]?\s*([^\n]+)/i,
        ];
        for (const re of linePatterns) {
            const m = head.match(re);
            if (m?.[1]) {
                const name = m[1].replace(/\s+/g, ' ').trim();
                if (name.length >= 2 && name.length <= 500)
                    return name;
            }
        }
        return null;
    }
    async extractMachineNameWithLlm(excerpt) {
        const trimmed = excerpt.slice(0, 8000);
        if (!trimmed.trim())
            return null;
        const messages = [
            {
                role: 'system',
                content: 'You read a technical manual excerpt. Return JSON only: {"machineName": string|null}. ' +
                    'machineName is the primary equipment or machine model name as printed on the cover or title area (e.g. product line + model). ' +
                    'Use null if you cannot identify it confidently.',
            },
            { role: 'user', content: trimmed },
        ];
        try {
            const raw = await this.aiService.chatPdf(messages);
            const parsed = this.tryParseJson(raw);
            const n = parsed?.machineName;
            if (n == null)
                return null;
            const s = String(n).replace(/\s+/g, ' ').trim();
            if (s.length < 2 || s.length > 500)
                return null;
            return s;
        }
        catch {
            return null;
        }
    }
    async extractMachineNameFromManual(fullText) {
        const llmFirst = await this.extractMachineNameWithLlm(fullText);
        if (llmFirst)
            return llmFirst;
        return this.extractMachineNameHeuristic(fullText);
    }
    tryParseJson(raw) {
        if (!raw)
            return null;
        const cleaned = raw
            .replace(/```json/gi, '```')
            .replace(/```/g, '')
            .trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                const slice = cleaned.slice(start, end + 1);
                try {
                    return JSON.parse(slice);
                }
                catch {
                    return null;
                }
            }
            return null;
        }
    }
};
exports.KnowledgeDocumentsService = KnowledgeDocumentsService;
exports.KnowledgeDocumentsService = KnowledgeDocumentsService = KnowledgeDocumentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(knowledge_document_entity_1.KnowledgeDocument)),
    __param(1, (0, typeorm_1.InjectRepository)(knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate)),
    __param(2, (0, typeorm_1.InjectRepository)(machine_name_suggestion_entity_1.MachineNameSuggestion)),
    __param(3, (0, typeorm_1.InjectRepository)(knowledge_document_page_analysis_entity_1.KnowledgeDocumentPageAnalysis)),
    __param(4, (0, typeorm_1.InjectRepository)(knowledge_document_job_entity_1.KnowledgeDocumentJob)),
    __param(5, (0, typeorm_1.InjectRepository)(admin_page_fix_queue_entity_1.AdminPageFixQueueItem)),
    __param(6, (0, typeorm_1.InjectRepository)(extraction_feedback_event_entity_1.ExtractionFeedbackEvent)),
    __param(7, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __param(8, (0, typeorm_1.InjectRepository)(pipeline_preferences_entity_1.PipelinePreferences)),
    __param(9, (0, bull_1.InjectQueue)(queues_constants_1.GATE_QUEUE)),
    __param(10, (0, bull_1.InjectQueue)(queues_constants_1.EXTRACTION_QUEUE)),
    __param(11, (0, bull_1.InjectQueue)(queues_constants_1.INDEXING_QUEUE)),
    __param(12, (0, bull_1.InjectQueue)(queues_constants_1.OCR_QUEUE)),
    __param(13, (0, bull_1.InjectQueue)(queues_constants_1.VISION_QUEUE)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository, Object, Object, Object, Object, Object, knowledge_service_1.KnowledgeService,
        ai_service_1.AiService,
        rag_service_1.RagService,
        machine_profiles_service_1.MachineProfilesService,
        document_progress_gateway_1.DocumentProgressGateway])
], KnowledgeDocumentsService);
//# sourceMappingURL=knowledge-documents.service.js.map