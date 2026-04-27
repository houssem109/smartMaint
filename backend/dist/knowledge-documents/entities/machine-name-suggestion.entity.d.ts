import { User } from '../../users/entities/user.entity';
import { KnowledgeDocument } from './knowledge-document.entity';
export type MachineNameSuggestionStatus = 'pending' | 'approved' | 'rejected';
export declare class MachineNameSuggestion {
    id: string;
    documentId: string;
    document: KnowledgeDocument;
    suggestedById: string;
    suggestedBy: User;
    proposedName: string;
    status: MachineNameSuggestionStatus;
    rejectReason: string | null;
    reviewedById: string | null;
    reviewedBy: User | null;
    reviewedAt: Date | null;
    createdAt: Date;
}
