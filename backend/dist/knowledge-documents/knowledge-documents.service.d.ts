import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { MachineNameSuggestion } from './entities/machine-name-suggestion.entity';
import { KnowledgeDocumentPageAnalysis } from './entities/knowledge-document-page-analysis.entity';
import { KnowledgeDocumentJob } from './entities/knowledge-document-job.entity';
import { PipelinePreferences } from './entities/pipeline-preferences.entity';
import { AdminPageFixQueueItem } from './entities/admin-page-fix-queue.entity';
import { ExtractionFeedbackEvent } from './entities/extraction-feedback-event.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { RagService } from '../ai/rag.service';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Queue } from 'bull';
import { MachineProfilesService } from '../machine-profiles/machine-profiles.service';
import { DocumentProgressGateway } from './document-progress.gateway';
import { UserRole } from '../users/entities/user.entity';
export declare class KnowledgeDocumentsService implements OnModuleInit {
    private readonly knowledgeDocumentsRepository;
    private readonly extractionCandidatesRepository;
    private readonly machineNameSuggestionsRepository;
    private readonly pageAnalysisRepository;
    private readonly knowledgeDocumentJobRepository;
    private readonly adminPageFixQueueRepository;
    private readonly extractionFeedbackRepository;
    private readonly auditLogRepository;
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
    constructor(knowledgeDocumentsRepository: Repository<KnowledgeDocument>, extractionCandidatesRepository: Repository<KnowledgeExtractionCandidate>, machineNameSuggestionsRepository: Repository<MachineNameSuggestion>, pageAnalysisRepository: Repository<KnowledgeDocumentPageAnalysis>, knowledgeDocumentJobRepository: Repository<KnowledgeDocumentJob>, adminPageFixQueueRepository: Repository<AdminPageFixQueueItem>, extractionFeedbackRepository: Repository<ExtractionFeedbackEvent>, auditLogRepository: Repository<AuditLog>, pipelinePreferencesRepository: Repository<PipelinePreferences>, gateQueue: Queue, extractionQueue: Queue, indexingQueue: Queue, ocrQueue: Queue, visionQueue: Queue, knowledgeService: KnowledgeService, aiService: AiService, ragService: RagService, machineProfilesService: MachineProfilesService, documentProgressGateway: DocumentProgressGateway);
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
    }): Promise<KnowledgeDocument[]>;
    findOne(id: string): Promise<KnowledgeDocument>;
    getExtractionsForDocument(documentId: string): Promise<KnowledgeExtractionCandidate[]>;
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
            pageFixImageMaxBytes: number;
            pageFixImageUploadDir: string;
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
            tessLang: string;
            tessPath: string;
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
    getQaSuccessCriteria(): {
        checkedAt: string;
        rows: {
            id: string;
            goal: string;
            status: 'shipped' | 'partial' | 'gap' | 'aspirational';
            notes: string;
        }[];
    };
    getTroubleshootingExtractionReference(): {
        checkedAt: string;
        responsibility: string;
        implementation: {
            service: string;
            method: string;
            bullQueue: string;
            bullJobType: string;
        };
        systemPromptRelativePaths: string[];
        envKeys: string[];
        textWindowNote: string;
        persistence: {
            table: string;
            entity: string;
            statusValues: string[];
            requiredCandidateFields: string[];
            optionalCandidateFields: string[];
        };
        pageSectionLabels: string[];
        chunkSectionLabels: string[];
        extractionUserMessageSchema: string;
        entryTypesFromLlm: string[];
        relatedEndpoints: {
            method: string;
            path: string;
            note: string;
        }[];
        notes: string[];
    };
    enqueueExtractionJob(documentId: string): Promise<string>;
    enqueueOcrJob(documentId: string, pageNumbers: number[]): Promise<string>;
    enqueueVisionJob(documentId: string, pageNumbers: number[]): Promise<string>;
    enqueueIndexingJob(documentId: string, payload: {
        knowledgeEntryId: string;
        candidateId?: string;
    }): Promise<string>;
    runOcrForDocumentPages(documentId: string, pageNumbers: number[]): Promise<void>;
    runVisionForDocumentPages(documentId: string, pageNumbers: number[]): Promise<number>;
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
    deleteDocument(documentId: string, adminId: string): Promise<void>;
    approveExtractionCandidate(candidateId: string, adminId: string, approverRole: UserRole, payload?: {
        title?: string;
        problemDescription?: string;
        solution?: string;
        tags?: string;
    }): Promise<KnowledgeExtractionCandidate>;
    rejectExtractionCandidate(candidateId: string, adminId: string, reason?: string): Promise<KnowledgeExtractionCandidate>;
    listPageFixQueue(): Promise<AdminPageFixQueueItem[]>;
    getPageFixReplacementImage(itemId: string): Promise<{
        data: Buffer;
        contentType: string;
    }>;
    listRecentExtractionFeedback(limit?: number): Promise<ExtractionFeedbackEvent[]>;
    fixPageWithText(itemId: string, text: string, adminId: string): Promise<{
        ok: true;
    }>;
    dismissFixQueueItem(itemId: string, adminId: string): Promise<{
        ok: true;
    }>;
    reindexManualChunksForDocument(documentId: string): Promise<{
        ok: true;
        chunksIndexed: number;
    }>;
    private reindexManualChunksAfterPageFixBestEffort;
    getAdminPipelineSummary(): Promise<{
        pageFixOpen: number;
        extractionCandidatesPending: number;
    }>;
    private assertReplacementImageMagicBytes;
    private resolveReplacementPageImageAbs;
    fixPageWithReplacementImage(itemId: string, absoluteUploadedPath: string, relativePathForDb: string, adminId: string): Promise<{
        ok: true;
        visionPages: number;
    }>;
    updateMachineName(documentId: string, machineName: string, _adminId: string): Promise<KnowledgeDocument>;
    listMachineNameSuggestions(documentId: string): Promise<MachineNameSuggestion[]>;
    suggestMachineName(documentId: string, proposedName: string, technicianId: string): Promise<MachineNameSuggestion>;
    approveMachineNameSuggestion(suggestionId: string, adminId: string, rejectOthersReason?: string): Promise<{
        document: KnowledgeDocument;
        approved: MachineNameSuggestion;
    }>;
    rejectMachineNameSuggestion(suggestionId: string, adminId: string, reason?: string): Promise<MachineNameSuggestion>;
    processDocumentExtraction(documentId: string): Promise<void>;
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
    private filterNearDuplicateChunks;
    private normalizeExtractedText;
    private detectGlyphCorruptedPagesForDocument;
    private getOcrScaffoldMetadata;
    private savePageAnalysis;
    private ocrPagesFromPdf;
    private runTesseract;
    private meanTesseractConfidence;
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
