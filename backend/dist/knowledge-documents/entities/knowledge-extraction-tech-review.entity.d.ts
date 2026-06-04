import { KnowledgeExtractionCandidate } from './knowledge-extraction-candidate.entity';
import { User } from '../../users/entities/user.entity';
export type TechExtractionReviewAction = 'approve' | 'approve_edit' | 'reject';
export declare class KnowledgeExtractionTechReview {
    id: string;
    candidateId: string;
    candidate: KnowledgeExtractionCandidate;
    technicianId: string;
    technician: User;
    action: TechExtractionReviewAction;
    editedTitle: string | null;
    editedProblemDescription: string | null;
    editedSolution: string | null;
    rejectReason: string | null;
    createdAt: Date;
}
