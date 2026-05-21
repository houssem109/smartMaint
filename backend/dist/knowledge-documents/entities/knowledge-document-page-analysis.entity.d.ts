import { KnowledgeDocument } from './knowledge-document.entity';
export declare class KnowledgeDocumentPageAnalysis {
    id: string;
    documentId: string;
    document: KnowledgeDocument;
    pageNumber: number;
    quality: 'good' | 'degraded' | 'poor' | 'unreadable';
    ocrConfidence: number | null;
    ocrText: string | null;
    visionUsed: boolean;
    processingMode: 'raw' | 'preprocessed' | 'region';
    qualityWarnings: string[] | null;
    sectionType: string | null;
    extractionMode: 'text' | 'ocr' | 'vision';
    createdAt: Date;
    updatedAt: Date;
}
