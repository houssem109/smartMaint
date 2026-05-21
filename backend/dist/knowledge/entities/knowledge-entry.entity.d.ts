import { User } from '../../users/entities/user.entity';
import { KnowledgeDocument } from '../../knowledge-documents/entities/knowledge-document.entity';
export declare class KnowledgeEntry {
    id: string;
    title: string;
    problemDescription: string;
    solution: string;
    tags: string | null;
    entryType: string | null;
    reviewStatus: string;
    machineName: string | null;
    symptom: string | null;
    rootCause: string | null;
    severity: string | null;
    source: string | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    rejectReason: string | null;
    photoPath: string | null;
    knowledgeDocument?: KnowledgeDocument | null;
    knowledgeDocumentId: string | null;
    createdById: string;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}
