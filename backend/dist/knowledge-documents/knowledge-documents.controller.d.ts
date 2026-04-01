import { KnowledgeDocumentsService } from './knowledge-documents.service';
declare class ApproveExtractionDto {
    title?: string;
    problemDescription?: string;
    solution?: string;
    tags?: string;
}
export declare class KnowledgeDocumentsController {
    private readonly knowledgeDocumentsService;
    constructor(knowledgeDocumentsService: KnowledgeDocumentsService);
    upload(file: Express.Multer.File, req: any): Promise<{
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        resume: {
            extractedCandidates: number;
            approvedCandidates: number;
            rejectedCandidates: number;
            chunksIndexed: number;
            message: string;
        };
    }>;
    list(): Promise<import("./entities/knowledge-document.entity").KnowledgeDocument[]>;
    details(id: string): Promise<{
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        resume: {
            extractedCandidates: number;
            approvedCandidates: number;
            rejectedCandidates: number;
            chunksIndexed: number;
            message: string;
        };
    }>;
    remove(id: string, req: any): Promise<{
        ok: boolean;
    }>;
    extractions(id: string): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate[]>;
    download(id: string, res: any): Promise<any>;
    approveExtraction(candidateId: string, body: ApproveExtractionDto, req: any): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate>;
    rejectExtraction(candidateId: string, req: any): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate>;
}
export {};
