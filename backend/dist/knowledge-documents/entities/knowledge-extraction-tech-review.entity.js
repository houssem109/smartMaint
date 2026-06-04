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
exports.KnowledgeExtractionTechReview = void 0;
const typeorm_1 = require("typeorm");
const knowledge_extraction_candidate_entity_1 = require("./knowledge-extraction-candidate.entity");
const user_entity_1 = require("../../users/entities/user.entity");
let KnowledgeExtractionTechReview = class KnowledgeExtractionTechReview {
};
exports.KnowledgeExtractionTechReview = KnowledgeExtractionTechReview;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "candidateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate, (c) => c.techReviews, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'candidateId' }),
    __metadata("design:type", knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate)
], KnowledgeExtractionTechReview.prototype, "candidate", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "technicianId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'technicianId' }),
    __metadata("design:type", user_entity_1.User)
], KnowledgeExtractionTechReview.prototype, "technician", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "editedTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "editedProblemDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "editedSolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], KnowledgeExtractionTechReview.prototype, "rejectReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], KnowledgeExtractionTechReview.prototype, "createdAt", void 0);
exports.KnowledgeExtractionTechReview = KnowledgeExtractionTechReview = __decorate([
    (0, typeorm_1.Entity)('knowledge_extraction_tech_reviews'),
    (0, typeorm_1.Unique)('UQ_extraction_tech_review_candidate_technician', ['candidateId', 'technicianId'])
], KnowledgeExtractionTechReview);
//# sourceMappingURL=knowledge-extraction-tech-review.entity.js.map