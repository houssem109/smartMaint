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
var KnowledgeDocumentsQueueProcessor_1, KnowledgeDocumentsExtractionQueueProcessor_1, KnowledgeDocumentsOcrQueueProcessor_1, KnowledgeDocumentsVisionQueueProcessor_1, KnowledgeDocumentsIndexingQueueProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDocumentsIndexingQueueProcessor = exports.KnowledgeDocumentsVisionQueueProcessor = exports.KnowledgeDocumentsOcrQueueProcessor = exports.KnowledgeDocumentsExtractionQueueProcessor = exports.KnowledgeDocumentsQueueProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const knowledge_documents_service_1 = require("./knowledge-documents.service");
const knowledge_service_1 = require("../knowledge/knowledge.service");
const rag_service_1 = require("../ai/rag.service");
const queues_constants_1 = require("./queues.constants");
let KnowledgeDocumentsQueueProcessor = KnowledgeDocumentsQueueProcessor_1 = class KnowledgeDocumentsQueueProcessor {
    constructor(knowledgeDocumentsService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
        this.logger = new common_1.Logger(KnowledgeDocumentsQueueProcessor_1.name);
    }
    async handleGate(job) {
        const { documentId, trackingJobId } = job.data;
        await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
        try {
            const decision = await this.knowledgeDocumentsService.runGateStage(documentId);
            if (decision === 'accepted') {
                await this.knowledgeDocumentsService.enqueueExtractionJob(documentId);
            }
            await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
        }
        catch (e) {
            const msg = e?.message ? String(e.message) : String(e);
            this.logger.error(`Gate job failed for ${documentId}: ${msg}`);
            await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
            throw e;
        }
    }
};
exports.KnowledgeDocumentsQueueProcessor = KnowledgeDocumentsQueueProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.GATE_JOB),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsQueueProcessor.prototype, "handleGate", null);
exports.KnowledgeDocumentsQueueProcessor = KnowledgeDocumentsQueueProcessor = KnowledgeDocumentsQueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.GATE_QUEUE),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService])
], KnowledgeDocumentsQueueProcessor);
let KnowledgeDocumentsExtractionQueueProcessor = KnowledgeDocumentsExtractionQueueProcessor_1 = class KnowledgeDocumentsExtractionQueueProcessor {
    constructor(knowledgeDocumentsService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
        this.logger = new common_1.Logger(KnowledgeDocumentsExtractionQueueProcessor_1.name);
    }
    async handleExtraction(job) {
        const { documentId, trackingJobId } = job.data;
        await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
        try {
            await this.knowledgeDocumentsService.processDocumentExtraction(documentId);
            await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
        }
        catch (e) {
            const msg = e?.message ? String(e.message) : String(e);
            this.logger.error(`Extraction job failed for ${documentId}: ${msg}`);
            await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
            throw e;
        }
    }
};
exports.KnowledgeDocumentsExtractionQueueProcessor = KnowledgeDocumentsExtractionQueueProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.EXTRACTION_JOB),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsExtractionQueueProcessor.prototype, "handleExtraction", null);
exports.KnowledgeDocumentsExtractionQueueProcessor = KnowledgeDocumentsExtractionQueueProcessor = KnowledgeDocumentsExtractionQueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.EXTRACTION_QUEUE),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService])
], KnowledgeDocumentsExtractionQueueProcessor);
let KnowledgeDocumentsOcrQueueProcessor = KnowledgeDocumentsOcrQueueProcessor_1 = class KnowledgeDocumentsOcrQueueProcessor {
    constructor(knowledgeDocumentsService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
        this.logger = new common_1.Logger(KnowledgeDocumentsOcrQueueProcessor_1.name);
    }
    async handleOcr(job) {
        const { documentId, trackingJobId, pageNumbers } = job.data;
        await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
        try {
            await this.knowledgeDocumentsService.runOcrForDocumentPages(documentId, pageNumbers ?? []);
            await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
        }
        catch (e) {
            const msg = e?.message ? String(e.message) : String(e);
            this.logger.error(`OCR job failed for ${documentId}: ${msg}`);
            await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
            throw e;
        }
    }
};
exports.KnowledgeDocumentsOcrQueueProcessor = KnowledgeDocumentsOcrQueueProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.OCR_JOB),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsOcrQueueProcessor.prototype, "handleOcr", null);
exports.KnowledgeDocumentsOcrQueueProcessor = KnowledgeDocumentsOcrQueueProcessor = KnowledgeDocumentsOcrQueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.OCR_QUEUE),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService])
], KnowledgeDocumentsOcrQueueProcessor);
let KnowledgeDocumentsVisionQueueProcessor = KnowledgeDocumentsVisionQueueProcessor_1 = class KnowledgeDocumentsVisionQueueProcessor {
    constructor(knowledgeDocumentsService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
        this.logger = new common_1.Logger(KnowledgeDocumentsVisionQueueProcessor_1.name);
    }
    async handleVision(job) {
        const { documentId, trackingJobId, pageNumbers } = job.data;
        await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
        try {
            await this.knowledgeDocumentsService.runVisionForDocumentPages(documentId, pageNumbers ?? []);
            await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
        }
        catch (e) {
            const msg = e?.message ? String(e.message) : String(e);
            this.logger.error(`Vision job failed for ${documentId}: ${msg}`);
            await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
            throw e;
        }
    }
};
exports.KnowledgeDocumentsVisionQueueProcessor = KnowledgeDocumentsVisionQueueProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.VISION_JOB),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsVisionQueueProcessor.prototype, "handleVision", null);
exports.KnowledgeDocumentsVisionQueueProcessor = KnowledgeDocumentsVisionQueueProcessor = KnowledgeDocumentsVisionQueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.VISION_QUEUE),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService])
], KnowledgeDocumentsVisionQueueProcessor);
let KnowledgeDocumentsIndexingQueueProcessor = KnowledgeDocumentsIndexingQueueProcessor_1 = class KnowledgeDocumentsIndexingQueueProcessor {
    constructor(knowledgeDocumentsService, knowledgeService, ragService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
        this.knowledgeService = knowledgeService;
        this.ragService = ragService;
        this.logger = new common_1.Logger(KnowledgeDocumentsIndexingQueueProcessor_1.name);
    }
    async handleIndexing(job) {
        const { documentId, trackingJobId, knowledgeEntryId } = job.data;
        await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
        try {
            const entry = await this.knowledgeService.findOne(knowledgeEntryId);
            const text = this.knowledgeService.buildIndexText(entry);
            await this.ragService.indexKnowledgeEntry(entry.id, text, {
                source: entry.source ?? 'pdf_extraction',
                title: entry.title,
                machineName: entry.machineName,
                entryType: entry.entryType,
                photoPath: entry.photoPath,
            });
            await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
        }
        catch (e) {
            const msg = e?.message ? String(e.message) : String(e);
            this.logger.error(`Indexing job failed for document ${documentId} entry ${job.data.knowledgeEntryId}: ${msg}`);
            await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
            throw e;
        }
    }
};
exports.KnowledgeDocumentsIndexingQueueProcessor = KnowledgeDocumentsIndexingQueueProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.INDEXING_JOB),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsIndexingQueueProcessor.prototype, "handleIndexing", null);
exports.KnowledgeDocumentsIndexingQueueProcessor = KnowledgeDocumentsIndexingQueueProcessor = KnowledgeDocumentsIndexingQueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.INDEXING_QUEUE),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService,
        knowledge_service_1.KnowledgeService,
        rag_service_1.RagService])
], KnowledgeDocumentsIndexingQueueProcessor);
//# sourceMappingURL=knowledge-documents.queue.processor.js.map