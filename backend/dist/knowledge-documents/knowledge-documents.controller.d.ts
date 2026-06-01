import { StreamableFile } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { DatabaseSchemaService } from '../database/database-schema.service';
import { ApproveMachineNameSuggestionDto, RejectMachineNameSuggestionDto, SuggestMachineNameDto, UpdateMachineNameDto } from './dto/machine-name.dto';
import { SetPdfVisionPreferenceDto } from './dto/set-pdf-vision-preference.dto';
declare class ApproveExtractionDto {
    title?: string;
    problemDescription?: string;
    solution?: string;
    tags?: string;
}
declare class RejectExtractionDto {
    reason?: string;
}
declare class GateDecisionDto {
    reason?: string;
}
declare class AdminFixTextDto {
    text: string;
}
export declare class KnowledgeDocumentsController {
    private readonly knowledgeDocumentsService;
    private readonly databaseSchemaService;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService, databaseSchemaService: DatabaseSchemaService);
    private acceptPdfUpload;
    upload(file: Express.Multer.File, req: any, supersedesDocumentId?: string): Promise<{
        documentId: string;
        jobId: string;
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        resume: {
            extractedCandidates: number;
            approvedCandidates: number;
            rejectedCandidates: number;
            chunksIndexed: number;
            message: string;
        };
    }>;
    uploadAlias(file: Express.Multer.File, req: any, supersedesDocumentId?: string): Promise<{
        documentId: string;
        jobId: string;
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        resume: {
            extractedCandidates: number;
            approvedCandidates: number;
            rejectedCandidates: number;
            chunksIndexed: number;
            message: string;
        };
    }>;
    approveMachineNameSuggestion(suggestionId: string, body: ApproveMachineNameSuggestionDto, req: any): Promise<{
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        approved: import("./entities/machine-name-suggestion.entity").MachineNameSuggestion;
    }>;
    approveGate(id: string, req: any): Promise<{
        ok: true;
        extractionJobId: string;
    }>;
    rejectGate(id: string, body: GateDecisionDto, req: any): Promise<{
        ok: true;
    }>;
    rejectMachineNameSuggestion(suggestionId: string, body: RejectMachineNameSuggestionDto, req: any): Promise<import("./entities/machine-name-suggestion.entity").MachineNameSuggestion>;
    approveExtraction(candidateId: string, body: ApproveExtractionDto, req: any): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate>;
    rejectExtraction(candidateId: string, body: RejectExtractionDto, req: any): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate>;
    list(req: {
        user: {
            role: UserRole;
        };
    }, includeSuperseded?: string): Promise<import("./entities/knowledge-document.entity").KnowledgeDocument[]>;
    machineNameSuggestions(id: string): Promise<import("./entities/machine-name-suggestion.entity").MachineNameSuggestion[]>;
    patchMachineName(id: string, body: UpdateMachineNameDto, req: any): Promise<import("./entities/knowledge-document.entity").KnowledgeDocument>;
    suggestMachineName(id: string, body: SuggestMachineNameDto, req: any): Promise<import("./entities/machine-name-suggestion.entity").MachineNameSuggestion>;
    extractions(id: string): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate[]>;
    pageAnalysis(id: string): Promise<import("./entities/knowledge-document-page-analysis.entity").KnowledgeDocumentPageAnalysis[]>;
    ragStoredData(id: string, limitRaw?: string): Promise<{
        documentId: string;
        chunkCount: number;
        chunks: Awaited<ReturnType<import("../ai/rag.service").RagService["listDocumentChunks"]>>;
    }>;
    pipelineAuditExportXlsx(id: string, ragLimitRaw?: string): Promise<StreamableFile>;
    pipelineAuditReport(id: string, ragLimitRaw?: string): Promise<{
        generatedAt: string;
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        status: Awaited<ReturnType<KnowledgeDocumentsService["getDocumentStatus"]>>;
        extractionStats: Awaited<ReturnType<KnowledgeDocumentsService["getExtractionStats"]>>;
        visionPreference: ReturnType<KnowledgeDocumentsService["getPdfVisionPreferenceReadModel"]>;
        pipelineConfig: ReturnType<KnowledgeDocumentsService["getPipelineConfigSnapshot"]>;
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
            quality: ReturnType<typeof import("./pdf-chunk-quality.util").chunkQualityFlags>;
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
    ragStoredDataGlobal(limitRaw?: string, documentId?: string): Promise<{
        count: number;
        rows: Array<Awaited<ReturnType<import("../ai/rag.service").RagService["listAllDocumentChunks"]>>[number] & {
            originalName: string | null;
        }>;
    }>;
    status(id: string): Promise<{
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
    pageFixQueue(): Promise<import("./entities/admin-page-fix-queue.entity").AdminPageFixQueueItem[]>;
    pageFixReplacementImage(itemId: string): Promise<StreamableFile>;
    adminPipelineCounts(): Promise<{
        pageFixOpen: number;
        extractionCandidatesPending: number;
    }>;
    queuesHealth(): Promise<{
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
    pipelineConfig(): {
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
    databaseInventory(): {
        checkedAt: string;
        tables: {
            table: string;
            entity: string;
            scope: "pdf" | "shared";
            purpose: string;
        }[];
    };
    databaseSchema(): Promise<import("../database/database-schema.service").DatabaseSchemaSnapshot>;
    qaSuccessCriteria(): {
        checkedAt: string;
        rows: {
            id: string;
            goal: string;
            status: "shipped" | "partial" | "gap" | "aspirational";
            notes: string;
        }[];
    };
    troubleshootingExtractionReference(): {
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
    getPdfVisionPreference(): {
        pdfVisionAdminEnabled: boolean;
        enabledFromEnv: boolean;
        enabledEffective: boolean;
    };
    patchPdfVisionPreference(body: SetPdfVisionPreferenceDto, req: any): Promise<{
        pdfVisionAdminEnabled: boolean;
        enabledFromEnv: boolean;
        enabledEffective: boolean;
    }>;
    extractionFeedbackRecent(limitRaw?: string): Promise<import("./entities/extraction-feedback-event.entity").ExtractionFeedbackEvent[]>;
    fixUnreadableText(itemId: string, body: AdminFixTextDto, req: any): Promise<{
        ok: true;
    }>;
    fixUnreadableImage(itemId: string, file: Express.Multer.File | undefined, req: any): Promise<{
        ok: true;
        visionPages: number;
    }>;
    dismissFixQueueItem(itemId: string, req: any): Promise<{
        ok: true;
    }>;
    runOcr(id: string, req: any): Promise<{
        ok: true;
        processedPages: number;
        pagesSelected: number;
        chunksIndexed?: number;
    }>;
    runVision(id: string, req: any): Promise<{
        ok: true;
        processedPages: number;
    }>;
    reindexManualChunks(id: string): Promise<{
        ok: true;
        chunksIndexed: number;
    }>;
    continueExtraction(id: string, req: any): Promise<{
        ok: true;
        jobId: string;
    }>;
    download(id: string, res: any): Promise<any>;
    details(id: string): Promise<{
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        resume: {
            extractedCandidates: number;
            approvedCandidates: number;
            rejectedCandidates: number;
            chunksIndexed: number;
            docType: string;
            isWorkRelated: boolean;
            gateConfidence: number;
            needsReview: boolean;
            message: string;
        };
    }>;
    remove(id: string, req: any): Promise<{
        ok: boolean;
    }>;
}
export {};
