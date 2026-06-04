import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
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
import { RagService } from '../ai/rag.service';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Queue } from 'bull';
import { MachineProfilesService } from '../machine-profiles/machine-profiles.service';
import { DocumentProgressGateway } from './document-progress.gateway';
import { UserRole } from '../users/entities/user.entity';
import { chunkQualityFlags } from './pdf-chunk-quality.util';
export declare class KnowledgeDocumentsService implements OnModuleInit {
    private readonly knowledgeDocumentsRepository;
    private readonly extractionCandidatesRepository;
    private readonly extractionTechReviewsRepository;
    private readonly machineNameSuggestionsRepository;
    private readonly pageAnalysisRepository;
    private readonly knowledgeDocumentJobRepository;
    private readonly extractionFeedbackRepository;
    private readonly auditLogRepository;
    private readonly knowledgeEntryRepository;
    private readonly pipelinePreferencesRepository;
    private readonly gateQueue;
    private readonly extractionQueue;
    private readonly indexingQueue;
    private readonly ocrQueue;
    private readonly visionQueue;
    private readonly knowledgeService;
    private readonly aiService;
    private readonly ragService;
    private readonly machineProfilesService;
    private readonly documentProgressGateway;
    private readonly logger;
    private workProfileEmbedding;
    private nonWorkProfileEmbedding;
    private pdfVisionAdminEnabled;
    constructor(knowledgeDocumentsRepository: Repository<KnowledgeDocument>, extractionCandidatesRepository: Repository<KnowledgeExtractionCandidate>, extractionTechReviewsRepository: Repository<KnowledgeExtractionTechReview>, machineNameSuggestionsRepository: Repository<MachineNameSuggestion>, pageAnalysisRepository: Repository<KnowledgeDocumentPageAnalysis>, knowledgeDocumentJobRepository: Repository<KnowledgeDocumentJob>, extractionFeedbackRepository: Repository<ExtractionFeedbackEvent>, auditLogRepository: Repository<AuditLog>, knowledgeEntryRepository: Repository<KnowledgeEntry>, pipelinePreferencesRepository: Repository<PipelinePreferences>, gateQueue: Queue, extractionQueue: Queue, indexingQueue: Queue, ocrQueue: Queue, visionQueue: Queue, knowledgeService: KnowledgeService, aiService: AiService, ragService: RagService, machineProfilesService: MachineProfilesService, documentProgressGateway: DocumentProgressGateway);
    onModuleInit(): Promise<void>;
    private loadPdfVisionAdminPreference;
    private isEffectivePdfVision;
    getPdfVisionPreferenceReadModel(): {
        pdfVisionAdminEnabled: boolean;
        enabledFromEnv: boolean;
        enabledEffective: boolean;
    };
    setPdfVisionAdminEnabled(enabled: boolean, userId: string): Promise<{
        pdfVisionAdminEnabled: boolean;
        enabledFromEnv: boolean;
        enabledEffective: boolean;
    }>;
    createFromUpload(params: {
        fileName: string;
        originalName: string;
        mimeType: string;
        fileSize: number;
        filePath: string;
        uploadedById: string;
    }): Promise<KnowledgeDocument>;
    ingestAndQueue(params: {
        fileName: string;
        originalName: string;
        mimeType: string;
        fileSize: number;
        filePath: string;
        uploadedById: string;
        supersedesDocumentId?: string | null;
    }): Promise<{
        document: KnowledgeDocument;
        jobId: string;
    }>;
    findAll(opts?: {
        includeSuperseded?: boolean;
        uploadedById?: string;
    }): Promise<KnowledgeDocument[]>;
    findOne(id: string): Promise<KnowledgeDocument>;
    getExtractionsForDocument(documentId: string): Promise<KnowledgeExtractionCandidate[]>;
    submitTechExtractionReview(candidateId: string, technicianId: string, payload: {
        action: 'approve' | 'approve_edit' | 'reject';
        title?: string;
        problemDescription?: string;
        solution?: string;
        reason?: string;
    }): Promise<KnowledgeExtractionTechReview>;
    getExtractionStats(documentId: string): Promise<{
        extractedCandidates: number;
        approvedCandidates: number;
        rejectedCandidates: number;
    }>;
    getPageAnalysis(documentId: string): Promise<KnowledgeDocumentPageAnalysis[]>;
    getRagStoredData(documentId: string, limit?: number): Promise<{
        documentId: string;
        chunkCount: number;
        chunks: Awaited<ReturnType<RagService['listDocumentChunks']>>;
    }>;
    getRagStoredDataGlobal(limit?: number, documentId?: string): Promise<{
        count: number;
        rows: Array<Awaited<ReturnType<RagService['listAllDocumentChunks']>>[number] & {
            originalName: string | null;
        }>;
    }>;
    getPipelineAuditReport(documentId: string, ragLimit?: number): Promise<{
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
            droppedLowValueSamples: Array<{
                index: number;
                preview: string;
                reason: string;
            }>;
            note: string;
        };
    }>;
    exportPipelineAuditExcel(documentId: string, ragLimit?: number): Promise<{
        buffer: Buffer;
        filename: string;
    }>;
    getDocumentStatus(documentId: string): Promise<{
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
    }>;
    private qualitySnapshotForDocument;
    updateProgress(documentId: string, patch: Partial<Pick<KnowledgeDocument, 'currentStage' | 'progressPercent' | 'pagesProcessed' | 'lastProcessedPage' | 'totalPages'>>): Promise<void>;
    markTrackingJobActive(trackingJobId?: string, bullJobId?: string): Promise<void>;
    markTrackingJobCompleted(trackingJobId?: string): Promise<void>;
    markTrackingJobFailed(trackingJobId: string | undefined, error: string): Promise<void>;
    getBullQueuesHealth(): Promise<{
        ok: boolean;
        redis: {
            ok: boolean;
            error?: string;
        };
        queues: Record<string, {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        } | {
            error: string;
        }>;
        checkedAt: string;
    }>;
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
        fieldPhotos: {
            visionEnabled: boolean;
        };
        extraction: {
            maxChunks: number;
            maxCandidatesTotal: number;
            maxCandidatesPerChunk: number;
            chunkSize: number;
            overlap: number;
        };
        ollama: {
            baseUrl: string;
            chatModel: string;
            embedModel: string;
            visionModel: string;
        };
        qdrant: {
            url: string;
            collection: string;
        };
        chatWidget: {
            enableImageVision: boolean;
        };
        bullJobs: {
            removeOnComplete: number;
            removeOnFail: number;
        };
    };
    getDatabaseInventory(): {
        checkedAt: string;
        tables: {
            table: string;
            entity: string;
            scope: 'pdf' | 'shared';
            purpose: string;
        }[];
    };
    enqueueExtractionJob(documentId: string, opts?: {
        resume?: boolean;
    }): Promise<string>;
    enqueueOcrJob(documentId: string, pageNumbers: number[]): Promise<string>;
    enqueueVisionJob(documentId: string, pageNumbers: number[]): Promise<string>;
    enqueueIndexingJob(documentId: string, payload: {
        knowledgeEntryId: string;
        candidateId?: string;
    }): Promise<string>;
    runOcrForDocumentPages(documentId: string, pageNumbers: number[]): Promise<number>;
    maybeAutoReindexAfterEnrichment(documentId: string, reason: string): Promise<void>;
    runVisionForDocumentPages(documentId: string, pageNumbers: number[], opts?: {
        maxPages?: number;
        promptMode?: 'default' | 'page_explanation';
        skipCompleted?: boolean;
    }): Promise<number>;
    private getVisionConcurrency;
    private appendPageQualityWarning;
    private renderPdfPageToPng;
    private maybeEnqueueVisionPagesAfterOcr;
    runGateStage(documentId: string): Promise<'accepted' | 'needs_review' | 'rejected'>;
    approveGateAndContinue(documentId: string, adminId: string): Promise<{
        ok: true;
        extractionJobId: string;
    }>;
    rejectGate(documentId: string, adminId: string, reason?: string): Promise<{
        ok: true;
    }>;
    runOcrForDocument(documentId: string, adminId: string): Promise<{
        ok: true;
        processedPages: number;
        pagesSelected: number;
        chunksIndexed?: number;
    }>;
    runVisionForDocument(documentId: string, adminId: string): Promise<{
        ok: true;
        processedPages: number;
    }>;
    private pageLikelyHasDiagram;
    private isFigureVisionEnabled;
    private getDocBatchPages;
    private getVisionMaxPagesPerBatch;
    private splitRowsIntoBatches;
    private pageUsesDisplayFont;
    private detectDisplayFontPagesParallel;
    private normalizeDisplayVisionText;
    private detectDocumentPrimaryLanguage;
    private languageLabel;
    private allowedScriptsFor;
    private stripDisallowedScripts;
    deleteDocument(documentId: string, userId: string, role: UserRole): Promise<void>;
    approveExtractionCandidate(candidateId: string, adminId: string, approverRole: UserRole, payload?: {
        title?: string;
        problemDescription?: string;
        solution?: string;
        tags?: string;
    }): Promise<KnowledgeExtractionCandidate>;
    rejectExtractionCandidate(candidateId: string, adminId: string, reason?: string): Promise<KnowledgeExtractionCandidate>;
    private pickNonEmptyString;
    private resolveFeedbackTextSnapshot;
    private findKnowledgeEntryForFeedbackEvent;
    private enrichExtractionFeedbackEvents;
    getExtractionFeedbackDetail(eventId: string): Promise<ExtractionFeedbackEvent & {
        candidateTitle: string | null;
        candidateProblem: string | null;
        candidateSolution: string | null;
        documentOriginalName: string | null;
    }>;
    listRecentExtractionFeedback(options?: {
        page?: number;
        pageSize?: number;
        signal?: 'approve' | 'approve_edit' | 'reject';
    }): Promise<{
        items: Array<ExtractionFeedbackEvent & {
            candidateTitle: string | null;
            candidateProblem: string | null;
            candidateSolution: string | null;
            documentOriginalName: string | null;
        }>;
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        counts: {
            approve: number;
            approve_edit: number;
            reject: number;
        };
    }>;
    reindexManualChunksForDocument(documentId: string): Promise<{
        ok: true;
        chunksIndexed: number;
    }>;
    getAdminPipelineSummary(): Promise<{
        extractionCandidatesPending: number;
    }>;
    updateMachineName(documentId: string, machineName: string, _adminId: string): Promise<KnowledgeDocument>;
    listMachineNameSuggestions(documentId: string): Promise<MachineNameSuggestion[]>;
    suggestMachineName(documentId: string, proposedName: string, technicianId: string): Promise<MachineNameSuggestion>;
    approveMachineNameSuggestion(suggestionId: string, adminId: string, rejectOthersReason?: string): Promise<{
        document: KnowledgeDocument;
        approved: MachineNameSuggestion;
    }>;
    rejectMachineNameSuggestion(suggestionId: string, adminId: string, reason?: string): Promise<MachineNameSuggestion>;
    continueDocumentExtraction(documentId: string, adminId: string): Promise<{
        ok: true;
        jobId: string;
    }>;
    processDocumentExtraction(documentId: string, opts?: {
        resume?: boolean;
    }): Promise<void>;
    private heuristicDocType;
    private quickRelevanceHeuristic;
    private classifyUploadGateThreeTier;
    private getWorkProfileEmbedding;
    private getNonWorkProfileEmbedding;
    private cosineSimilarity;
    private classifyChunkSection;
    private defaultEntryTypeFromSection;
    private splitTextIntoPageBuckets;
    private buildRoutedChunks;
    private prioritizeChunksForExtraction;
    private getNearDuplicateJaccardThreshold;
    private normalizeChunkForSimilarity;
    private jaccardSetSimilarity;
    private filterEmbedWorthyChunks;
    private pageLikelyNeedsUiVision;
    private filterNearDuplicateChunks;
    private normalizeExtractedText;
    private detectGlyphCorruptedPagesForDocument;
    private getOcrScaffoldMetadata;
    private savePageAnalysis;
    private loadPopplerPageTextsForDocument;
    private getMinGoodOcrCharsForVisionSkip;
    private filterPageNumbersNeedingOcr;
    private filterPageNumbersNeedingVision;
    private selectPageNumbersForPageExplanation;
    private runPageExplanationPassBeforeIndex;
    private selectPageNumbersForOcr;
    private progressInBand;
    private ocrPagesFromPdf;
    private detectMachineProfile;
    private derivePageTexts;
    private scorePageQuality;
    private detectGlyphCorruption;
    private isGlyphCorruptionVisionEnabled;
    private detectSectionType;
    private extractMachineNameHeuristic;
    private extractMachineNameWithLlm;
    private extractMachineNameFromManual;
    private tryParseJson;
}
