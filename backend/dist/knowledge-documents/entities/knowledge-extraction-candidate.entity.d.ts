import { KnowledgeDocument } from './knowledge-document.entity';
export type KnowledgeExtractionStatus = 'candidate' | 'approved' | 'rejected';
export declare class KnowledgeExtractionCandidate {
    id: string;
    documentId: string;
    document: KnowledgeDocument;
    title: string;
    problemDescription: string;
    solution: string;
    tags: string | null;
    entryType: string | null;
    symptom: string | null;
    rootCause: string | null;
    sourcePages: string | null;
    confidence: number | null;
    sectionType: string | null;
    status: KnowledgeExtractionStatus;
    createdById: string;
    reviewedById: string | null;
    createdAt: Date;
    updatedAt: Date;
}
