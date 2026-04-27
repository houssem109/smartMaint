import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { ApproveMachineNameSuggestionDto, RejectMachineNameSuggestionDto, SuggestMachineNameDto, UpdateMachineNameDto } from './dto/machine-name.dto';
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
    approveMachineNameSuggestion(suggestionId: string, body: ApproveMachineNameSuggestionDto, req: any): Promise<{
        document: import("./entities/knowledge-document.entity").KnowledgeDocument;
        approved: import("./entities/machine-name-suggestion.entity").MachineNameSuggestion;
    }>;
    rejectMachineNameSuggestion(suggestionId: string, body: RejectMachineNameSuggestionDto, req: any): Promise<import("./entities/machine-name-suggestion.entity").MachineNameSuggestion>;
    approveExtraction(candidateId: string, body: ApproveExtractionDto, req: any): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate>;
    rejectExtraction(candidateId: string, req: any): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate>;
    list(): Promise<import("./entities/knowledge-document.entity").KnowledgeDocument[]>;
    machineNameSuggestions(id: string): Promise<import("./entities/machine-name-suggestion.entity").MachineNameSuggestion[]>;
    patchMachineName(id: string, body: UpdateMachineNameDto, req: any): Promise<import("./entities/knowledge-document.entity").KnowledgeDocument>;
    suggestMachineName(id: string, body: SuggestMachineNameDto, req: any): Promise<import("./entities/machine-name-suggestion.entity").MachineNameSuggestion>;
    extractions(id: string): Promise<import("./entities/knowledge-extraction-candidate.entity").KnowledgeExtractionCandidate[]>;
    download(id: string, res: any): Promise<any>;
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
}
export {};
