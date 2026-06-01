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
const bull_1 = require("@nestjs/bull");
const knowledge_document_entity_1 = require("./entities/knowledge-document.entity");
const knowledge_extraction_candidate_entity_1 = require("./entities/knowledge-extraction-candidate.entity");
const machine_name_suggestion_entity_1 = require("./entities/machine-name-suggestion.entity");
const knowledge_document_page_analysis_entity_1 = require("./entities/knowledge-document-page-analysis.entity");
const knowledge_document_job_entity_1 = require("./entities/knowledge-document-job.entity");
const admin_page_fix_queue_entity_1 = require("./entities/admin-page-fix-queue.entity");
const extraction_feedback_event_entity_1 = require("./entities/extraction-feedback-event.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const pipeline_preferences_entity_1 = require("./entities/pipeline-preferences.entity");
const knowledge_entry_entity_1 = require("../knowledge/entities/knowledge-entry.entity");
const knowledge_documents_service_1 = require("./knowledge-documents.service");
const knowledge_documents_controller_1 = require("./knowledge-documents.controller");
const knowledge_module_1 = require("../knowledge/knowledge.module");
const ai_module_1 = require("../ai/ai.module");
const rag_module_1 = require("../ai/rag.module");
const machine_profiles_module_1 = require("../machine-profiles/machine-profiles.module");
const auth_module_1 = require("../auth/auth.module");
const database_schema_module_1 = require("../database/database-schema.module");
const document_progress_gateway_1 = require("./document-progress.gateway");
const knowledge_documents_queue_processor_1 = require("./knowledge-documents.queue.processor");
const queues_constants_1 = require("./queues.constants");
let KnowledgeDocumentsModule = class KnowledgeDocumentsModule {
};
exports.KnowledgeDocumentsModule = KnowledgeDocumentsModule;
exports.KnowledgeDocumentsModule = KnowledgeDocumentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                knowledge_document_entity_1.KnowledgeDocument,
                knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate,
                machine_name_suggestion_entity_1.MachineNameSuggestion,
                knowledge_document_page_analysis_entity_1.KnowledgeDocumentPageAnalysis,
                knowledge_document_job_entity_1.KnowledgeDocumentJob,
                admin_page_fix_queue_entity_1.AdminPageFixQueueItem,
                extraction_feedback_event_entity_1.ExtractionFeedbackEvent,
                audit_log_entity_1.AuditLog,
                knowledge_entry_entity_1.KnowledgeEntry,
                pipeline_preferences_entity_1.PipelinePreferences,
            ]),
            bull_1.BullModule.registerQueue({ name: queues_constants_1.GATE_QUEUE }, { name: queues_constants_1.EXTRACTION_QUEUE }, { name: queues_constants_1.OCR_QUEUE }, { name: queues_constants_1.VISION_QUEUE }, { name: queues_constants_1.INDEXING_QUEUE }),
            knowledge_module_1.KnowledgeModule,
            ai_module_1.AiModule,
            rag_module_1.RagModule,
            machine_profiles_module_1.MachineProfilesModule,
            auth_module_1.AuthModule,
            database_schema_module_1.DatabaseSchemaModule,
        ],
        providers: [
            document_progress_gateway_1.DocumentProgressGateway,
            knowledge_documents_service_1.KnowledgeDocumentsService,
            knowledge_documents_queue_processor_1.KnowledgeDocumentsQueueProcessor,
            knowledge_documents_queue_processor_1.KnowledgeDocumentsExtractionQueueProcessor,
            knowledge_documents_queue_processor_1.KnowledgeDocumentsOcrQueueProcessor,
            knowledge_documents_queue_processor_1.KnowledgeDocumentsVisionQueueProcessor,
            knowledge_documents_queue_processor_1.KnowledgeDocumentsIndexingQueueProcessor,
        ],
        controllers: [knowledge_documents_controller_1.KnowledgeDocumentsController],
        exports: [knowledge_documents_service_1.KnowledgeDocumentsService],
    })
], KnowledgeDocumentsModule);
//# sourceMappingURL=knowledge-documents.module.js.map