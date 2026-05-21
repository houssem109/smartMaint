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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDocumentPageAnalysis = void 0;
const typeorm_1 = require("typeorm");
const knowledge_document_entity_1 = require("./knowledge-document.entity");
let KnowledgeDocumentPageAnalysis = class KnowledgeDocumentPageAnalysis {
};
exports.KnowledgeDocumentPageAnalysis = KnowledgeDocumentPageAnalysis;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => knowledge_document_entity_1.KnowledgeDocument, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'documentId' }),
    __metadata("design:type", knowledge_document_entity_1.KnowledgeDocument)
], KnowledgeDocumentPageAnalysis.prototype, "document", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], KnowledgeDocumentPageAnalysis.prototype, "pageNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24 }),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "quality", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], KnowledgeDocumentPageAnalysis.prototype, "ocrConfidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "ocrText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], KnowledgeDocumentPageAnalysis.prototype, "visionUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'raw' }),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "processingMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], KnowledgeDocumentPageAnalysis.prototype, "qualityWarnings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "sectionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'text' }),
    __metadata("design:type", String)
], KnowledgeDocumentPageAnalysis.prototype, "extractionMode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], KnowledgeDocumentPageAnalysis.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], KnowledgeDocumentPageAnalysis.prototype, "updatedAt", void 0);
exports.KnowledgeDocumentPageAnalysis = KnowledgeDocumentPageAnalysis = __decorate([
    (0, typeorm_1.Entity)('knowledge_document_page_analysis')
], KnowledgeDocumentPageAnalysis);
//# sourceMappingURL=knowledge-document-page-analysis.entity.js.map