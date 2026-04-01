import { Repository } from 'typeorm';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { RagService } from '../ai/rag.service';
export declare class KnowledgeDocumentsService {
    private readonly knowledgeDocumentsRepository;
    private readonly extractionCandidatesRepository;
    private readonly knowledgeService;
    private readonly aiService;
    private readonly ragService;
    constructor(knowledgeDocumentsRepository: Repository<KnowledgeDocument>, extractionCandidatesRepository: Repository<KnowledgeExtractionCandidate>, knowledgeService: KnowledgeService, aiService: AiService, ragService: RagService);
    createFromUpload(params: {
        fileName: string;
        originalName: string;
        mimeType: string;
        fileSize: number;
        filePath: string;
        uploadedById: string;
    }): Promise<KnowledgeDocument>;
    findAll(): Promise<KnowledgeDocument[]>;
    findOne(id: string): Promise<KnowledgeDocument>;
    getExtractionsForDocument(documentId: string): Promise<KnowledgeExtractionCandidate[]>;
    getExtractionStats(documentId: string): Promise<{
        extractedCandidates: number;
        approvedCandidates: number;
        rejectedCandidates: number;
    }>;
    deleteDocument(documentId: string, adminId: string): Promise<void>;
    approveExtractionCandidate(candidateId: string, adminId: string, payload?: {
        title?: string;
        problemDescription?: string;
        solution?: string;
        tags?: string;
    }): Promise<KnowledgeExtractionCandidate>;
    rejectExtractionCandidate(candidateId: string, adminId: string): Promise<KnowledgeExtractionCandidate>;
    processDocumentExtraction(documentId: string): Promise<void>;
    private tryParseJson;
}
