import { Repository } from 'typeorm';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { MachineNameSuggestion } from './entities/machine-name-suggestion.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { RagService } from '../ai/rag.service';
import { AuditLog } from '../common/entities/audit-log.entity';
export declare class KnowledgeDocumentsService {
    private readonly knowledgeDocumentsRepository;
    private readonly extractionCandidatesRepository;
    private readonly machineNameSuggestionsRepository;
    private readonly auditLogRepository;
    private readonly knowledgeService;
    private readonly aiService;
    private readonly ragService;
    constructor(knowledgeDocumentsRepository: Repository<KnowledgeDocument>, extractionCandidatesRepository: Repository<KnowledgeExtractionCandidate>, machineNameSuggestionsRepository: Repository<MachineNameSuggestion>, auditLogRepository: Repository<AuditLog>, knowledgeService: KnowledgeService, aiService: AiService, ragService: RagService);
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
    updateMachineName(documentId: string, machineName: string, _adminId: string): Promise<KnowledgeDocument>;
    listMachineNameSuggestions(documentId: string): Promise<MachineNameSuggestion[]>;
    suggestMachineName(documentId: string, proposedName: string, technicianId: string): Promise<MachineNameSuggestion>;
    approveMachineNameSuggestion(suggestionId: string, adminId: string, rejectOthersReason?: string): Promise<{
        document: KnowledgeDocument;
        approved: MachineNameSuggestion;
    }>;
    rejectMachineNameSuggestion(suggestionId: string, adminId: string, reason?: string): Promise<MachineNameSuggestion>;
    processDocumentExtraction(documentId: string): Promise<void>;
    private extractMachineNameHeuristic;
    private extractMachineNameWithLlm;
    private extractMachineNameFromManual;
    private tryParseJson;
}
