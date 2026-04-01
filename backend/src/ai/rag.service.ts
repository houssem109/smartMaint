import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v5 as uuidv5 } from 'uuid';

type QdrantPayload = {
  documentId: string;
  chunkIndex: number;
  text: string;
};

type SearchResult = {
  documentId: string;
  chunkIndex: number;
  text: string;
  score?: number;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  private readonly qdrantUrl: string;
  private readonly collectionName: string;
  private readonly ollamaBaseUrl: string;
  private readonly embedModel: string;
  private readonly uuidNamespace: string;

  constructor(private readonly configService: ConfigService) {
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    this.collectionName = this.configService.get<string>('QDRANT_COLLECTION') || 'manual_chunks';
    this.ollamaBaseUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    this.embedModel = this.configService.get<string>('OLLAMA_EMBED_MODEL') || 'nomic-embed-text';
    // Stable namespace for deterministic UUID generation for chunk point IDs.
    // Any valid UUID is fine as long as it stays constant.
    this.uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  }

  private async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.ollamaBaseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embedModel, input: text, truncate: true }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama embed failed (${res.status}): ${body}`);
    }

    const data: any = await res.json();
    const vec = data?.embeddings?.[0];
    if (!Array.isArray(vec)) throw new Error('Unexpected embeddings response from Ollama');
    return vec as number[];
  }

  private async ensureCollection(vectorSize: number): Promise<void> {
    const url = `${this.qdrantUrl}/collections/${this.collectionName}`;
    const check = await fetch(url);
    if (check.ok) return;

    const createBody = {
      vectors: { size: vectorSize, distance: 'Cosine' },
    };

    const createRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '');
      throw new Error(`Failed to create Qdrant collection (${createRes.status}): ${body}`);
    }
  }

  async indexDocumentChunks(documentId: string, chunks: string[]): Promise<void> {
    if (!chunks.length) return;

    // Create collection lazily using the first chunk.
    const firstEmbedding = await this.embed(chunks[0]);
    await this.ensureCollection(firstEmbedding.length);

    const points: Array<{ id: string; vector: number[]; payload: QdrantPayload }> = [];
    for (let i = 0; i < chunks.length; i++) {
      // Keep each point payload small enough for Qdrant requests.
      const text = chunks[i]?.trim();
      if (!text) continue;

      const vector = i === 0 ? firstEmbedding : await this.embed(text);
      // Qdrant point id must be either an unsigned integer or a UUID.
      // We generate a deterministic UUID so multiple re-index runs don’t create duplicates.
      const pointId = uuidv5(`${documentId}:${i}`, this.uuidNamespace);
      points.push({
        id: pointId,
        vector,
        payload: { documentId, chunkIndex: i, text },
      });
    }

    const upsertRes = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points?wait=true`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    });

    if (!upsertRes.ok) {
      const body = await upsertRes.text().catch(() => '');
      throw new Error(`Qdrant upsert failed (${upsertRes.status}): ${body}`);
    }

    this.logger.log(`Indexed ${points.length} manual chunks for document ${documentId}`);
  }

  async searchRelevantChunks(query: string, topK = 6): Promise<SearchResult[]> {
    const vector = await this.embed(query);

    const res = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector,
        limit: topK,
        with_payload: true,
      }),
    });

    if (!res.ok) {
      // If the collection doesn't exist yet, just return nothing.
      const body = await res.text().catch(() => '');
      this.logger.warn(`Qdrant search failed (${res.status}): ${body}`);
      return [];
    }

    const data: any = await res.json();
    const scored = Array.isArray(data?.result) ? data.result : [];

    return scored
      .map((r: any) => {
        const payload = r?.payload as Partial<QdrantPayload> | undefined;
        if (!payload?.text || typeof payload?.chunkIndex !== 'number') return null;
        return {
          documentId: String(payload.documentId ?? ''),
          chunkIndex: payload.chunkIndex,
          text: String(payload.text),
          score: typeof r?.score === 'number' ? r.score : undefined,
        } as SearchResult;
      })
      .filter(Boolean) as SearchResult[];
  }
}

