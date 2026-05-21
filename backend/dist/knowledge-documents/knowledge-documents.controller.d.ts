import { StreamableFile } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
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
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService);
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
    databaseInventory(): {
        checkedAt: string;
        tables: {
            table: string;
            entity: string;
            scope: "pdf" | "shared";
            purpose: string;
        }[];
    };
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
    }>;
    runVision(id: string, req: any): Promise<{
        ok: true;
        processedPages: number;
    }>;
    reindexManualChunks(id: string): Promise<{
        ok: true;
        chunksIndexed: number;
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
