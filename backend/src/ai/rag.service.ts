import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { v5 as uuidv5 } from 'uuid';
import { VectorChunkHash } from './entities/vector-chunk-hash.entity';

export type DocumentChunkIndexMeta = {
  machineProfileId?: string | null;
  machineName?: string | null;
  manufacturer?: string | null;
  docType?: string | null;
  language?: string | null;
};

/** Per manual-chunk row stored on the Qdrant payload (12). */
export type DocumentChunkRowMeta = {
  sectionType?: string | null;
  sourcePages?: string | null;
  title?: string | null;
  confidence?: number | null;
  entryType?: string | null;
};

type QdrantPayload = {
  documentId: string;
  chunkIndex: number;
  text: string;
  source: string;
  chunkHash?: string;
  machineProfileId?: string | null;
  machineName?: string | null;
  manufacturer?: string | null;
  docType?: string | null;
  language?: string | null;
  entryType?: string | null;
  title?: string | null;
  sectionType?: string | null;
  sourcePages?: string | null;
  confidence?: number | null;
};

type KnowledgePayload = {
  kind: 'knowledge_entry';
  knowledgeEntryId: string;
  text: string;
  source: string;
  chunkHash?: string;
  machineName?: string | null;
  entryType?: string | null;
  title?: string | null;
  photoPath?: string | null;
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
  /** Human-readable provenance for prompts and UI */
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

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  private readonly qdrantUrl: string;
  private readonly collectionName: string;
  private readonly ollamaBaseUrl: string;
  private readonly embedModel: string;
  private readonly uuidNamespace: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(VectorChunkHash)
    private readonly vectorChunkHashRepository: Repository<VectorChunkHash>,
  ) {
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    this.collectionName = this.configService.get<string>('QDRANT_COLLECTION') || 'manual_chunks';
    this.ollamaBaseUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    this.embedModel = this.configService.get<string>('OLLAMA_EMBED_MODEL') || 'nomic-embed-text';
    this.uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  }

  async embedText(text: string): Promise<number[]> {
    return this.embed(text);
  }

  private async embed(text: string): Promise<number[]> {
    const configuredMax = Number(process.env.OLLAMA_EMBED_MAX_CHARS ?? 6000);
    const attempts = [configuredMax, 3000, 2000, 1200]
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.floor(n));
    let lastError = 'unknown error';

    for (const maxChars of [...new Set(attempts)]) {
      const input = String(text || '').slice(0, maxChars);
      const res = await fetch(`${this.ollamaBaseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embedModel, input, truncate: true }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const vec = data?.embeddings?.[0];
        if (!Array.isArray(vec)) throw new Error('Unexpected embeddings response from Ollama');
        return vec as number[];
      }

      const body = await res.text().catch(() => '');
      lastError = `Ollama embed failed (${res.status}): ${body}`;
      const contextTooLong = /exceeds the context length/i.test(body);
      if (!(res.status === 400 && contextTooLong)) {
        throw new Error(lastError);
      }
    }

    throw new Error(lastError);
  }

  private normalizeChunkForHash(text: string): string {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private sha256Hex(prefix: string, normalizedBody: string): string {
    return createHash('sha256').update(`${prefix}:${normalizedBody}`, 'utf8').digest('hex');
  }

  /**
   * Cross-document dedup: skip if another document already embedded this normalized text.
   * Same document may embed the same text twice (different chunk indices); same-doc always allowed.
   */
  private async shouldEmbedDocumentChunk(hash: string, documentId: string): Promise<boolean> {
    let row = await this.vectorChunkHashRepository.findOne({ where: { hash } });
    if (!row) {
      try {
        await this.vectorChunkHashRepository.save(this.vectorChunkHashRepository.create({ hash, documentId }));
      } catch {
        // concurrent insert from another worker
      }
      row = await this.vectorChunkHashRepository.findOne({ where: { hash } });
    }
    return row?.documentId === documentId;
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

  async indexDocumentChunks(
    documentId: string,
    chunks: string[],
    meta?: DocumentChunkIndexMeta,
    perChunkMeta?: (DocumentChunkRowMeta | undefined)[],
  ): Promise<void> {
    if (!chunks.length) return;

    const points: Array<{ id: string; vector: number[]; payload: QdrantPayload }> = [];
    let firstEmbedding: number[] | null = null;
    let skipped = 0;

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i]?.trim();
      if (!text) continue;

      const norm = this.normalizeChunkForHash(text);
      const hash = this.sha256Hex('docchunk', norm);
      const embedOk = await this.shouldEmbedDocumentChunk(hash, documentId);
      if (!embedOk) {
        skipped += 1;
        continue;
      }

      const vector = await this.embed(text);
      if (!firstEmbedding) firstEmbedding = vector;
      const row = perChunkMeta?.[i];
      const basePayload: QdrantPayload = {
        documentId,
        chunkIndex: i,
        text,
        source: 'pdf_extraction',
        chunkHash: hash,
        machineProfileId: meta?.machineProfileId ?? null,
        machineName: meta?.machineName ?? null,
        manufacturer: meta?.manufacturer ?? null,
        docType: meta?.docType ?? null,
        language: meta?.language ?? null,
        entryType: row?.entryType ?? null,
        title: row?.title ?? null,
        sectionType: row?.sectionType ?? null,
        sourcePages: row?.sourcePages ?? null,
        confidence:
          row?.confidence != null && Number.isFinite(Number(row.confidence))
            ? Math.max(0, Math.min(1, Number(row.confidence)))
            : null,
      };
      points.push({
        id: uuidv5(`${documentId}:${i}`, this.uuidNamespace),
        vector,
        payload: basePayload,
      });
    }

    if (skipped > 0) {
      this.logger.log(`Skipped ${skipped} duplicate manual chunk(s) for document ${documentId} (vector_chunk_hashes)`);
    }

    if (!points.length) {
      this.logger.warn(`No manual chunks upserted for document ${documentId} (all duplicates or empty)`);
      return;
    }

    if (!firstEmbedding) return;
    await this.ensureCollection(firstEmbedding.length);

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

  /**
   * Removes all Qdrant manual-chunk points for a PDF and releases vector_chunk_hashes rows
   * owned by that document so a successor revision can re-embed the same text (11).
   */
  async purgeManualIndexForDocument(documentId: string): Promise<void> {
    const id = documentId?.trim();
    if (!id) return;

    try {
      const res = await fetch(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/delete?wait=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filter: {
              must: [{ key: 'documentId', match: { value: id } }],
            },
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Qdrant purge failed for document ${id} (${res.status}): ${body}`);
      }
    } catch (e) {
      this.logger.warn(`Qdrant purge error for document ${id}: ${(e as Error).message}`);
    }

    try {
      const r = await this.vectorChunkHashRepository.delete({ documentId: id });
      const n = r.affected ?? 0;
      if (n > 0) {
        this.logger.log(`Removed ${n} vector_chunk_hash row(s) for document ${id}`);
      }
    } catch (e) {
      this.logger.warn(`vector_chunk_hashes delete failed for ${id}: ${(e as Error).message}`);
    }
  }

  async indexKnowledgeEntry(
    knowledgeEntryId: string,
    text: string,
    opts?: KnowledgeIndexMeta,
  ): Promise<void> {
    const clean = (text ?? '').trim();
    if (!clean) return;

    const vector = await this.embed(clean);
    await this.ensureCollection(vector.length);

    const pointId = uuidv5(`knowledge:${knowledgeEntryId}`, this.uuidNamespace);
    const norm = this.normalizeChunkForHash(clean);
    const chunkHash = this.sha256Hex('knowledge', norm);
    const src = opts?.source?.trim() || 'knowledge_entry';
    const payload: KnowledgePayload = {
      kind: 'knowledge_entry',
      knowledgeEntryId,
      text: clean,
      source: src,
      chunkHash,
      machineName: opts?.machineName ?? null,
      entryType: opts?.entryType ?? null,
      title: opts?.title ?? null,
      photoPath: opts?.photoPath?.trim() ? opts.photoPath : null,
    };

    const upsertRes = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points?wait=true`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [{ id: pointId, vector, payload }] }),
    });

    if (!upsertRes.ok) {
      const body = await upsertRes.text().catch(() => '');
      throw new Error(`Qdrant upsert failed (${upsertRes.status}): ${body}`);
    }
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
      const body = await res.text().catch(() => '');
      this.logger.warn(`Qdrant search failed (${res.status}): ${body}`);
      return [];
    }

    const data: any = await res.json();
    const scored = Array.isArray(data?.result) ? data.result : [];

    return scored
      .map((r: any) => {
        const payload = r?.payload as Partial<QdrantPayload> & Partial<KnowledgePayload> | undefined;
        if (!payload?.text) return null;
        const score = typeof r?.score === 'number' ? r.score : undefined;
        if (payload.kind === 'knowledge_entry' && payload.knowledgeEntryId) {
          const source = String(payload.source || 'knowledge_entry');
          const title = payload.title != null ? String(payload.title) : null;
          const machineName = payload.machineName != null ? String(payload.machineName) : null;
          const entryType = payload.entryType != null ? String(payload.entryType) : null;
          const chunkHash = payload.chunkHash != null ? String(payload.chunkHash) : null;
          const photoPath = payload.photoPath != null ? String(payload.photoPath) : null;
          const srcLabel =
            source === 'field_experience' || source === 'field_photo'
              ? 'Field experience'
              : source === 'pdf_extraction'
                ? 'Curated from PDF'
                : 'Knowledge entry';
          const photoNote = photoPath ? ' (has field photo)' : '';
          const sourceCaption = `${srcLabel}${machineName ? ` — ${machineName}` : ''}${title ? ` — ${title}` : ''}${entryType ? ` [${entryType}]` : ''}${photoNote}`;
          return {
            knowledgeEntryId: String(payload.knowledgeEntryId),
            text: String(payload.text),
            score,
            source,
            title,
            machineName,
            entryType,
            chunkHash,
            sourceCaption,
          } as SearchResult;
        }
        if (typeof payload.chunkIndex === 'number' && payload.documentId) {
          const machineName = payload.machineName != null ? String(payload.machineName) : null;
          const manufacturer = payload.manufacturer != null ? String(payload.manufacturer) : null;
          const docType = payload.docType != null ? String(payload.docType) : null;
          const chunkHash = payload.chunkHash != null ? String(payload.chunkHash) : null;
          const sectionType = payload.sectionType != null ? String(payload.sectionType) : null;
          const sourcePages = payload.sourcePages != null ? String(payload.sourcePages) : null;
          const title = payload.title != null ? String(payload.title) : null;
          const entryType = payload.entryType != null ? String(payload.entryType) : null;
          const confRaw = payload.confidence;
          const confidence =
            typeof confRaw === 'number' && Number.isFinite(confRaw)
              ? confRaw
              : confRaw != null && Number.isFinite(Number(confRaw))
                ? Math.max(0, Math.min(1, Number(confRaw)))
                : null;
          const docLabel = machineName || 'Manual';
          const typeSuffix = docType ? ` (${docType})` : '';
          const sec = sectionType ? ` — ${sectionType}` : '';
          const pages = sourcePages ? ` — pages ${sourcePages}` : '';
          const tit = title ? ` — “${title.slice(0, 80)}${title.length > 80 ? '…' : ''}”` : '';
          const sourceCaption = `PDF manual — ${docLabel}${typeSuffix}${sec}${pages}${tit} — excerpt #${payload.chunkIndex + 1}`;
          return {
            documentId: String(payload.documentId),
            chunkIndex: payload.chunkIndex,
            text: String(payload.text),
            score,
            source: String(payload.source || 'pdf_extraction'),
            machineName,
            manufacturer,
            docType,
            chunkHash,
            sectionType,
            sourcePages,
            title,
            entryType,
            confidence,
            sourceCaption,
          } as SearchResult;
        }
        return null;
      })
      .filter(Boolean) as SearchResult[];
  }

  async listDocumentChunks(documentId: string, limit = 120): Promise<StoredDocumentChunk[]> {
    const docId = String(documentId || '').trim();
    if (!docId) return [];
    const cap = Math.max(1, Math.min(500, Math.floor(limit || 120)));
    const out: StoredDocumentChunk[] = [];
    let offset: unknown = undefined;

    while (out.length < cap) {
      const pageSize = Math.min(100, cap - out.length);
      const body: Record<string, unknown> = {
        limit: pageSize,
        with_payload: true,
        with_vector: false,
        filter: { must: [{ key: 'documentId', match: { value: docId } }] },
      };
      if (offset != null) body.offset = offset;

      const res = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        this.logger.warn(`Qdrant scroll failed for doc ${docId} (${res.status}): ${msg}`);
        break;
      }
      const data: any = await res.json();
      const points = Array.isArray(data?.result?.points) ? data.result.points : [];
      for (const p of points) {
        const payload = (p?.payload || {}) as Partial<QdrantPayload>;
        if (payload.documentId !== docId || typeof payload.chunkIndex !== 'number' || !payload.text) continue;
        const confRaw = payload.confidence;
        const confidence =
          typeof confRaw === 'number' && Number.isFinite(confRaw)
            ? confRaw
            : confRaw != null && Number.isFinite(Number(confRaw))
              ? Math.max(0, Math.min(1, Number(confRaw)))
              : null;
        out.push({
          documentId: String(payload.documentId),
          chunkIndex: payload.chunkIndex,
          text: String(payload.text),
          source: String(payload.source || 'pdf_extraction'),
          machineName: payload.machineName != null ? String(payload.machineName) : null,
          manufacturer: payload.manufacturer != null ? String(payload.manufacturer) : null,
          docType: payload.docType != null ? String(payload.docType) : null,
          title: payload.title != null ? String(payload.title) : null,
          entryType: payload.entryType != null ? String(payload.entryType) : null,
          sectionType: payload.sectionType != null ? String(payload.sectionType) : null,
          sourcePages: payload.sourcePages != null ? String(payload.sourcePages) : null,
          confidence,
        });
        if (out.length >= cap) break;
      }
      offset = data?.result?.next_page_offset;
      if (offset == null || points.length === 0) break;
    }

    return out.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async listAllDocumentChunks(limit = 400, documentId?: string): Promise<StoredDocumentChunk[]> {
    const cap = Math.max(1, Math.min(2000, Math.floor(limit || 400)));
    const scopedDocId = String(documentId || '').trim();
    const out: StoredDocumentChunk[] = [];
    let offset: unknown = undefined;

    while (out.length < cap) {
      const pageSize = Math.min(100, cap - out.length);
      const body: Record<string, unknown> = {
        limit: pageSize,
        with_payload: true,
        with_vector: false,
      };
      if (scopedDocId) {
        body.filter = { must: [{ key: 'documentId', match: { value: scopedDocId } }] };
      }
      if (offset != null) body.offset = offset;

      const res = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        this.logger.warn(`Qdrant global scroll failed (${res.status}): ${msg}`);
        break;
      }
      const data: any = await res.json();
      const points = Array.isArray(data?.result?.points) ? data.result.points : [];
      for (const p of points) {
        const payload = (p?.payload || {}) as Partial<QdrantPayload>;
        if (!payload.documentId || typeof payload.chunkIndex !== 'number' || !payload.text) continue;
        const confRaw = payload.confidence;
        const confidence =
          typeof confRaw === 'number' && Number.isFinite(confRaw)
            ? confRaw
            : confRaw != null && Number.isFinite(Number(confRaw))
              ? Math.max(0, Math.min(1, Number(confRaw)))
              : null;
        out.push({
          documentId: String(payload.documentId),
          chunkIndex: payload.chunkIndex,
          text: String(payload.text),
          source: String(payload.source || 'pdf_extraction'),
          machineName: payload.machineName != null ? String(payload.machineName) : null,
          manufacturer: payload.manufacturer != null ? String(payload.manufacturer) : null,
          docType: payload.docType != null ? String(payload.docType) : null,
          title: payload.title != null ? String(payload.title) : null,
          entryType: payload.entryType != null ? String(payload.entryType) : null,
          sectionType: payload.sectionType != null ? String(payload.sectionType) : null,
          sourcePages: payload.sourcePages != null ? String(payload.sourcePages) : null,
          confidence,
        });
        if (out.length >= cap) break;
      }
      offset = data?.result?.next_page_offset;
      if (offset == null || points.length === 0) break;
    }

    return out.sort((a, b) => {
      if (a.documentId === b.documentId) return a.chunkIndex - b.chunkIndex;
      return a.documentId.localeCompare(b.documentId);
    });
  }
}
