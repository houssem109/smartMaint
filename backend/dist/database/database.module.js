"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const user_entity_1 = require("../users/entities/user.entity");
const ticket_entity_1 = require("../tickets/entities/ticket.entity");
const conversation_entity_1 = require("../tickets/entities/conversation.entity");
const attachment_entity_1 = require("../tickets/entities/attachment.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const knowledge_entry_entity_1 = require("../knowledge/entities/knowledge-entry.entity");
const knowledge_document_entity_1 = require("../knowledge-documents/entities/knowledge-document.entity");
const knowledge_extraction_candidate_entity_1 = require("../knowledge-documents/entities/knowledge-extraction-candidate.entity");
const knowledge_extraction_tech_review_entity_1 = require("../knowledge-documents/entities/knowledge-extraction-tech-review.entity");
const machine_name_suggestion_entity_1 = require("../knowledge-documents/entities/machine-name-suggestion.entity");
const knowledge_document_page_analysis_entity_1 = require("../knowledge-documents/entities/knowledge-document-page-analysis.entity");
const knowledge_document_job_entity_1 = require("../knowledge-documents/entities/knowledge-document-job.entity");
const machine_profile_entity_1 = require("../machine-profiles/entities/machine-profile.entity");
const pipeline_preferences_entity_1 = require("../knowledge-documents/entities/pipeline-preferences.entity");
const extraction_feedback_event_entity_1 = require("../knowledge-documents/entities/extraction-feedback-event.entity");
const vector_chunk_hash_entity_1 = require("../ai/entities/vector-chunk-hash.entity");
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    type: 'postgres',
                    host: configService.get('DATABASE_HOST', 'localhost'),
                    port: configService.get('DATABASE_PORT', 5432),
                    username: configService.get('DATABASE_USER', 'smartmaint'),
                    password: configService.get('DATABASE_PASSWORD', 'smartmaint123'),
                    database: configService.get('DATABASE_NAME', 'smartmaint_db'),
                    entities: [
                        user_entity_1.User,
                        ticket_entity_1.Ticket,
                        conversation_entity_1.Conversation,
                        attachment_entity_1.Attachment,
                        audit_log_entity_1.AuditLog,
                        knowledge_entry_entity_1.KnowledgeEntry,
                        knowledge_document_entity_1.KnowledgeDocument,
                        knowledge_extraction_candidate_entity_1.KnowledgeExtractionCandidate,
                        knowledge_extraction_tech_review_entity_1.KnowledgeExtractionTechReview,
                        machine_name_suggestion_entity_1.MachineNameSuggestion,
                        knowledge_document_page_analysis_entity_1.KnowledgeDocumentPageAnalysis,
                        knowledge_document_job_entity_1.KnowledgeDocumentJob,
                        extraction_feedback_event_entity_1.ExtractionFeedbackEvent,
                        machine_profile_entity_1.MachineProfile,
                        pipeline_preferences_entity_1.PipelinePreferences,
                        vector_chunk_hash_entity_1.VectorChunkHash,
                    ],
                    synchronize: configService.get('DATABASE_SYNCHRONIZE', 'false') === 'true',
                    logging: configService.get('NODE_ENV') === 'development',
                    migrations: ['dist/database/migrations/*.js'],
                    migrationsRun: configService.get('DATABASE_RUN_MIGRATIONS', 'false') === 'true',
                }),
                inject: [config_1.ConfigService],
            }),
        ],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map