import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { VectorChunkHash } from './entities/vector-chunk-hash.entity';
export type DocumentChunkIndexMeta = {
    machineProfileId?: string | null;
    machineName?: string | null;
    manufacturer?: string | null;
    docType?: string | null;
    language?: string | null;
};
export type DocumentChunkRowMeta = {
    sectionType?: string | null;
    sourcePages?: string | null;
    title?: string | null;
    confidence?: number | null;
    entryType?: string | null;
};
export type KnowledgeIndexMeta = {
    source?: string;
    title?: string | null;
    machineName?: string | null;
    entryType?: string | null;
    photoPath?: string | null;
};
export type SearchResult = {
    documentId?: string;
    chunkIndex?: number;
    text: string;
    score?: number;
    knowledgeEntryId?: string;
    source?: string;
    machineName?: string | null;
    manufacturer?: string | null;
    docType?: string | null;
    entryType?: string | null;
    title?: string | null;
    chunkHash?: string | null;
    sectionType?: string | null;
    sourcePages?: string | null;
    confidence?: number | null;
    sourceCaption?: string;
};
export type StoredDocumentChunk = {
    documentId: string;
    chunkIndex: number;
    text: string;
    source: string;
    machineName?: string | null;
    manufacturer?: string | null;
    docType?: string | null;
    title?: string | null;
    entryType?: string | null;
    sectionType?: string | null;
    sourcePages?: string | null;
    confidence?: number | null;
};
export declare class RagService {
    private readonly configService;
    private readonly vectorChunkHashRepository;
    private readonly logger;
    private readonly qdrantUrl;
    private readonly collectionName;
    private readonly ollamaBaseUrl;
    private readonly embedModel;
    private readonly uuidNamespace;
    constructor(configService: ConfigService, vectorChunkHashRepository: Repository<VectorChunkHash>);
    embedText(text: string): Promise<number[]>;
    private embed;
    private normalizeChunkForHash;
    private sha256Hex;
    private shouldEmbedDocumentChunk;
    private ensureCollection;
    indexDocumentChunks(documentId: string, chunks: string[], meta?: DocumentChunkIndexMeta, perChunkMeta?: (DocumentChunkRowMeta | undefined)[]): Promise<void>;
    purgeManualIndexForDocument(documentId: string): Promise<void>;
    indexKnowledgeEntry(knowledgeEntryId: string, text: string, opts?: KnowledgeIndexMeta): Promise<void>;
    searchRelevantChunks(query: string, topK?: number): Promise<SearchResult[]>;
    listDocumentChunks(documentId: string, limit?: number): Promise<StoredDocumentChunk[]>;
    listAllDocumentChunks(limit?: number, documentId?: string): Promise<StoredDocumentChunk[]>;
}
