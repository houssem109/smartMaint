export type ExtractionFeedbackSignal = 'approve' | 'approve_edit' | 'reject';
export declare class ExtractionFeedbackEvent {
    id: string;
    documentId: string;
    candidateId: string;
    signal: ExtractionFeedbackSignal;
    docType: string | null;
    sectionType: string | null;
    entryType: string | null;
    confidence: number | null;
    adminId: string | null;
    reason: string | null;
    editDelta: Record<string, unknown> | null;
    createdAt: Date;
}
