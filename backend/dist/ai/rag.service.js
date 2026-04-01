"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RagService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const uuid_1 = require("uuid");
let RagService = RagService_1 = class RagService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RagService_1.name);
        this.qdrantUrl = this.configService.get('QDRANT_URL') || 'http://localhost:6333';
        this.collectionName = this.configService.get('QDRANT_COLLECTION') || 'manual_chunks';
        this.ollamaBaseUrl = this.configService.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
        this.embedModel = this.configService.get('OLLAMA_EMBED_MODEL') || 'nomic-embed-text';
        this.uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    }
    async embed(text) {
        const res = await fetch(`${this.ollamaBaseUrl}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.embedModel, input: text, truncate: true }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Ollama embed failed (${res.status}): ${body}`);
        }
        const data = await res.json();
        const vec = data?.embeddings?.[0];
        if (!Array.isArray(vec))
            throw new Error('Unexpected embeddings response from Ollama');
        return vec;
    }
    async ensureCollection(vectorSize) {
        const url = `${this.qdrantUrl}/collections/${this.collectionName}`;
        const check = await fetch(url);
        if (check.ok)
            return;
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
    async indexDocumentChunks(documentId, chunks) {
        if (!chunks.length)
            return;
        const firstEmbedding = await this.embed(chunks[0]);
        await this.ensureCollection(firstEmbedding.length);
        const points = [];
        for (let i = 0; i < chunks.length; i++) {
            const text = chunks[i]?.trim();
            if (!text)
                continue;
            const vector = i === 0 ? firstEmbedding : await this.embed(text);
            const pointId = (0, uuid_1.v5)(`${documentId}:${i}`, this.uuidNamespace);
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
    async searchRelevantChunks(query, topK = 6) {
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
        const data = await res.json();
        const scored = Array.isArray(data?.result) ? data.result : [];
        return scored
            .map((r) => {
            const payload = r?.payload;
            if (!payload?.text || typeof payload?.chunkIndex !== 'number')
                return null;
            return {
                documentId: String(payload.documentId ?? ''),
                chunkIndex: payload.chunkIndex,
                text: String(payload.text),
                score: typeof r?.score === 'number' ? r.score : undefined,
            };
        })
            .filter(Boolean);
    }
};
exports.RagService = RagService;
exports.RagService = RagService = RagService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RagService);
//# sourceMappingURL=rag.service.js.map