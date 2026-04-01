import { ConfigService } from '@nestjs/config';
type SearchResult = {
    documentId: string;
    chunkIndex: number;
    text: string;
    score?: number;
};
export declare class RagService {
    private readonly configService;
    private readonly logger;
    private readonly qdrantUrl;
    private readonly collectionName;
    private readonly ollamaBaseUrl;
    private readonly embedModel;
    private readonly uuidNamespace;
    constructor(configService: ConfigService);
    private embed;
    private ensureCollection;
    indexDocumentChunks(documentId: string, chunks: string[]): Promise<void>;
    searchRelevantChunks(query: string, topK?: number): Promise<SearchResult[]>;
}
export {};
