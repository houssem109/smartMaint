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
exports.KnowledgeExtractionCandidate = void 0;
const typeorm_1 = require("typeorm");
const knowledge_document_entity_1 = require("./knowledge-document.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const knowledge_extraction_tech_review_entity_1 = require("./knowledge-extraction-tech-review.entity");
let KnowledgeExtractionCandidate = class KnowledgeExtractionCandidate {
};
exports.KnowledgeExtractionCandidate = KnowledgeExtractionCandidate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => knowledge_document_entity_1.KnowledgeDocument),
    (0, typeorm_1.JoinColumn)({ name: 'documentId' }),
    __metadata("design:type", knowledge_document_entity_1.KnowledgeDocument)
], KnowledgeExtractionCandidate.prototype, "document", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "problemDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "solution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "entryType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "symptom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "rootCause", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "sourcePages", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], KnowledgeExtractionCandidate.prototype, "confidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "sectionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'candidate' }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "reviewedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'reviewedById' }),
    __metadata("design:type", user_entity_1.User)
], KnowledgeExtractionCandidate.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "techReviewStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "techReviewedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'techReviewedById' }),
    __metadata("design:type", user_entity_1.User)
], KnowledgeExtractionCandidate.prototype, "techReviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], KnowledgeExtractionCandidate.prototype, "techReviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "techEditedTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "techEditedProblemDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "techEditedSolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionCandidate.prototype, "techRejectReason", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => knowledge_extraction_tech_review_entity_1.KnowledgeExtractionTechReview, (r) => r.candidate),
    __metadata("design:type", Array)
], KnowledgeExtractionCandidate.prototype, "techReviews", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], KnowledgeExtractionCandidate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], KnowledgeExtractionCandidate.prototype, "updatedAt", void 0);
exports.KnowledgeExtractionCandidate = KnowledgeExtractionCandidate = __decorate([
    (0, typeorm_1.Entity)('knowledge_extraction_candidates')
], KnowledgeExtractionCandidate);
//# sourceMappingURL=knowledge-extraction-candidate.entity.js.map