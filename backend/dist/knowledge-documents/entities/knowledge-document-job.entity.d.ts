export declare class KnowledgeDocumentJob {
    id: string;
    documentId: string;
    queueName: string;
    jobType: string;
    status: 'queued' | 'active' | 'completed' | 'failed';
    progressPercent: number;
    error: string | null;
    bullJobId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
