import { Job } from 'bull';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { RagService } from '../ai/rag.service';
export declare class KnowledgeDocumentsQueueProcessor {
    private readonly knowledgeDocumentsService;
    private readonly logger;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService);
    handleGate(job: Job<{
        documentId: string;
        trackingJobId?: string;
    }>): Promise<void>;
}
export declare class KnowledgeDocumentsExtractionQueueProcessor {
    private readonly knowledgeDocumentsService;
    private readonly logger;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService);
    handleExtraction(job: Job<{
        documentId: string;
        trackingJobId?: string;
        resume?: boolean;
    }>): Promise<void>;
}
export declare class KnowledgeDocumentsOcrQueueProcessor {
    private readonly knowledgeDocumentsService;
    private readonly logger;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService);
    handleOcr(job: Job<{
        documentId: string;
        trackingJobId?: string;
        pageNumbers: number[];
    }>): Promise<void>;
}
export declare class KnowledgeDocumentsVisionQueueProcessor {
    private readonly knowledgeDocumentsService;
    private readonly logger;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService);
    handleVision(job: Job<{
        documentId: string;
        trackingJobId?: string;
        pageNumbers: number[];
    }>): Promise<void>;
}
export declare class KnowledgeDocumentsIndexingQueueProcessor {
    private readonly knowledgeDocumentsService;
    private readonly knowledgeService;
    private readonly ragService;
    private readonly logger;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService, knowledgeService: KnowledgeService, ragService: RagService);
    handleIndexing(job: Job<{
        documentId: string;
        trackingJobId?: string;
        knowledgeEntryId: string;
        candidateId?: string;
    }>): Promise<void>;
}
