import { User } from '../../users/entities/user.entity';
export type KnowledgeDocumentStatus = 'uploaded' | 'processing' | 'done' | 'failed';
export declare class KnowledgeDocument {
    id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    status: KnowledgeDocumentStatus;
    error: string | null;
    chunksIndexed: number;
    uploadedById: string;
    uploadedBy: User;
    createdAt: Date;
    updatedAt: Date;
}
