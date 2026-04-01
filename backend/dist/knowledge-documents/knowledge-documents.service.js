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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDocumentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs_1 = require("fs");
const knowledge_document_entity_1 = require("./entities/knowledge-document.entity");
const knowledge_extraction_candidate_entity_1 = require("./entities/knowledge-extraction-candidate.entity");
const knowledge_service_1 = require("../knowledge/knowledge.service");
const ai_service_1 = require("../ai/ai.service");
const rag_service_1 = require("../ai/rag.service");
const path_1 = require("path");
const fs_2 = require("fs");
const pdfParse = require("pdf-parse");
let KnowledgeDocumentsService = class KnowledgeDocumentsService {
    constructor(knowledgeDocumentsRepository, extractionCandidatesRepository, knowledgeService, aiService, ragService) {
        this.knowledgeDocumentsRepository = knowledgeDocumentsRepository;
        this.extractionCandidatesRepository = extractionCandidatesRepository;
        this.knowledgeService = knowledgeService;
        this.aiService = aiService;
        this.ragService = ragService;
    }
    async createFromUpload(params) {
        const doc = this.knowledgeDocumentsRepository.create({
            ...params,
            status: 'uploaded',
            error: null,
        });
        return this.knowledgeDocumentsRepository.save(doc);
    }
    async findAll() {
        return this.knowledgeDocumentsRepository.find({
            order: { createdAt: 'DESC' },
            relations: ['uploadedBy'],
        });
    }
    async findOne(id) {
        const doc = await this.knowledgeDocumentsRepository.findOne({
            where: { id },
            relations: ['uploadedBy'],
        });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        return doc;
    }
    async getExtractionsForDocument(documentId) {
        await this.findOne(documentId);
        return this.extractionCandidatesRepository.find({
            where: { documentId },
            order: { createdAt: 'DESC' },
        });
    }
    async getExtractionStats(documentId) {
        await this.findOne(documentId);
        const extractedCandidates = await this.extractionCandidatesRepository.count({ where: { documentId } });
        const approvedCandidates = await this.extractionCandidatesRepository.count({
            where: { documentId, status: 'approved' },
        });
        const rejectedCandidates = await this.extractionCandidatesRepository.count({
            where: { documentId, status: 'rejected' },
        });
        return { extractedCandidates, approvedCandidates, rejectedCandidates };
    }
    async deleteDocument(documentId, adminId) {
        const doc = await this.findOne(documentId);
        await this.extractionCandidatesRepository.delete({ documentId: doc.id });
        await this.knowledgeDocumentsRepository.delete({ id: doc.id });
        try {
            if (doc.filePath && (0, fs_1.existsSync)(doc.filePath)) {
                (0, fs_1.unlinkSync)(doc.filePath);
            }
        }
        catch {
        }
    }
    async approveExtractionCandidate(candidateId, adminId, payload) {
        const candidate = await this.extractionCandidatesRepository.findOne({
            where: { id: candidateId },
        });
        if (!candidate)
            throw new common_1.NotFoundException('Extraction candidate not found');
        const normalizedTags = payload?.tags ??
            candidate.tags ??
            undefined;
        const tags = typeof normalizedTags === 'string' && normalizedTags.trim().length > 0 ? normalizedTags : undefined;
        const entry = await this.knowledgeService.create({
            title: payload?.title ?? candidate.title,
            problemDescription: payload?.problemDescription ?? candidate.problemDescription,
            solution: payload?.solution ?? candidate.solution,
            tags,
        }, adminId);
        candidate.status = 'approved';
        candidate.reviewedById = adminId;
        await this.extractionCandidatesRepository.save(candidate);
        return candidate;
    }
    async rejectExtractionCandidate(candidateId, adminId) {
        const candidate = await this.extractionCandidatesRepository.findOne({
            where: { id: candidateId },
        });
        if (!candidate)
            throw new common_1.NotFoundException('Extraction candidate not found');
        candidate.status = 'rejected';
        candidate.reviewedById = adminId;
        return this.extractionCandidatesRepository.save(candidate);
    }
    async processDocumentExtraction(documentId) {
        const doc = await this.findOne(documentId);
        doc.status = 'processing';
        doc.error = null;
        await this.knowledgeDocumentsRepository.save(doc);
        try {
            const promptPathCandidates = [
                (0, path_1.join)(process.cwd(), 'src', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
                (0, path_1.join)(__dirname, '..', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
                (0, path_1.join)(__dirname, 'prompts', 'techo-pdf-extractor-system.prompt.md'),
            ];
            const extractionPrompt = (() => {
                for (const p of promptPathCandidates) {
                    try {
                        return (0, fs_2.readFileSync)(p, 'utf8');
                    }
                    catch {
                    }
                }
                throw new Error('Could not load extractor prompt file');
            })();
            const fileBuffer = (0, fs_2.readFileSync)(doc.filePath);
            const parsed = await pdfParse(fileBuffer);
            const fullText = parsed?.text || '';
            const lower = fullText.toLowerCase();
            const idx = lower.indexOf('troubleshooting');
            const relevantText = idx >= 0 ? fullText.slice(idx) : fullText;
            const maxChunksToProcess = Number(process.env.DOC_EXTRACTION_MAX_CHUNKS ?? 20);
            const maxCandidatesTotal = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES ?? 200);
            const maxCandidatesPerChunk = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK ?? 10);
            const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
            const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);
            const chunks = [];
            for (let i = 0; i < relevantText.length; i += chunkSize - overlap) {
                const chunk = relevantText.slice(i, i + chunkSize);
                if (chunk.trim().length > 0)
                    chunks.push(chunk);
            }
            const candidatesToSave = [];
            const chunksToUse = chunks.slice(0, maxChunksToProcess);
            for (const [chunkIndex, chunk] of chunksToUse.entries()) {
                if (candidatesToSave.length >= maxCandidatesTotal)
                    break;
                const userContent = `Extract Problem→Solution candidates from this manual text.\n` +
                    `Return JSON ONLY with key "candidates".\n` +
                    `Chunk index: ${chunkIndex}\n\n` +
                    chunk;
                const messages = [
                    { role: 'system', content: extractionPrompt },
                    { role: 'user', content: userContent },
                ];
                const raw = await this.aiService.chat(messages);
                const parsedJson = this.tryParseJson(raw);
                const candidates = parsedJson?.candidates;
                if (!Array.isArray(candidates))
                    continue;
                const newCandidates = [];
                for (const c of candidates.slice(0, maxCandidatesPerChunk)) {
                    if (!c?.title || !c?.problemDescription || !c?.solution)
                        continue;
                    const candidate = this.extractionCandidatesRepository.create({
                        documentId: doc.id,
                        title: String(c.title),
                        problemDescription: String(c.problemDescription),
                        solution: String(c.solution),
                        tags: Array.isArray(c.tags) ? c.tags.join(',') : c.tags ? String(c.tags) : null,
                        status: 'candidate',
                        createdById: doc.uploadedById,
                        reviewedById: null,
                    });
                    candidatesToSave.push(candidate);
                    newCandidates.push(candidate);
                }
                if (newCandidates.length > 0) {
                    await this.extractionCandidatesRepository.save(newCandidates);
                }
            }
            if (candidatesToSave.length > 0) {
                await this.extractionCandidatesRepository.save(candidatesToSave);
            }
            doc.status = 'done';
            doc.error = null;
            doc.chunksIndexed = 0;
            await this.knowledgeDocumentsRepository.save(doc);
            try {
                await this.ragService.indexDocumentChunks(doc.id, chunksToUse);
                doc.chunksIndexed = chunksToUse.length;
                await this.knowledgeDocumentsRepository.save(doc);
            }
            catch (indexErr) {
                doc.error = `Indexing failed: ${indexErr?.message ? String(indexErr.message) : 'unknown error'}`;
                doc.chunksIndexed = 0;
                await this.knowledgeDocumentsRepository.save(doc);
            }
        }
        catch (e) {
            doc.status = 'failed';
            doc.error = e?.message ? String(e.message) : 'PDF extraction failed';
            await this.knowledgeDocumentsRepository.save(doc);
        }
    }
    tryParseJson(raw) {
        if (!raw)
            return null;
        const cleaned = raw
            .replace(/```json/gi, '```')
            .replace(/```/g, '')
            .trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                const slice = cleaned.slice(start, end + 1);
                try {
                    return JSON.parse(slice);
                }
                catch {
                    return null;
                }
            }
            return null;
        }
    }
};
exports.KnowledgeDocumentsService = KnowledgeDocumentsService;
exports.KnowledgeDocumentsService = KnowledgeDocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(knowledge_document_entity_1.KnowledgeDocument)),
    __param(1, (0, typeorm_1.InjectRepository)(knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        knowledge_service_1.KnowledgeService,
        ai_service_1.AiService,
        rag_service_1.RagService])
], KnowledgeDocumentsService);
//# sourceMappingURL=knowledge-documents.service.js.map