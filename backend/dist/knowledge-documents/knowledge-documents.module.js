"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDocumentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const knowledge_document_entity_1 = require("./entities/knowledge-document.entity");
const knowledge_extraction_candidate_entity_1 = require("./entities/knowledge-extraction-candidate.entity");
const knowledge_documents_service_1 = require("./knowledge-documents.service");
const knowledge_documents_controller_1 = require("./knowledge-documents.controller");
const knowledge_module_1 = require("../knowledge/knowledge.module");
const ai_module_1 = require("../ai/ai.module");
let KnowledgeDocumentsModule = class KnowledgeDocumentsModule {
};
exports.KnowledgeDocumentsModule = KnowledgeDocumentsModule;
exports.KnowledgeDocumentsModule = KnowledgeDocumentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([knowledge_document_entity_1.KnowledgeDocument, knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate]),
            knowledge_module_1.KnowledgeModule,
            ai_module_1.AiModule,
        ],
        providers: [knowledge_documents_service_1.KnowledgeDocumentsService],
        controllers: [knowledge_documents_controller_1.KnowledgeDocumentsController],
        exports: [knowledge_documents_service_1.KnowledgeDocumentsService],
    })
], KnowledgeDocumentsModule);
//# sourceMappingURL=knowledge-documents.module.js.map