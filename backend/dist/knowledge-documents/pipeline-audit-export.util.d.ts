import type { KnowledgeDocument } from './entities/knowledge-document.entity';
import type { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
export type PipelineAuditExcelInput = {
    generatedAt: string;
    document: KnowledgeDocument;
    status: {
        progressPercent: number;
        currentStage: string | null;
        chunksIndexed: number;
    };
    metrics: {
        totalPages: number;
        pagesWithOcrText: number;
        pagesVisionUsed: number;
        ragChunkCount: number;
        ragMostlyDotsChunks: number;
        candidateTotal: number;
        candidateApproved: number;
        approvalRatePercent: number | null;
    };
    visionPreference: {
        enabledEffective: boolean;
    };
    chunkAudit: {
        builtCount: number;
        afterNearDuplicateCount: number;
        afterLowValueFilterCount: number;
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
        popplerTextPreview: string;
        ocrText: string | null;
    }>;
    ragChunks: Array<{
        chunkIndex: number;
        sectionType: string | null;
        title: string | null;
        confidence: number | null;
        textPreview: string;
        text: string;
        quality: {
            mostlyDots: boolean;
            embedWorthy: boolean;
            alnumRatio: number;
        };
    }>;
};
export declare function buildPipelineAuditExcelBuffer(report: PipelineAuditExcelInput, candidates: KnowledgeExtractionCandidate[]): Promise<Buffer>;
export declare function pipelineAuditExcelFilename(doc: KnowledgeDocument): string;
