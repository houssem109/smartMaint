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
exports.KnowledgeDocumentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const knowledge_documents_service_1 = require("./knowledge-documents.service");
const database_schema_service_1 = require("../database/database-schema.service");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const pdf_ingestion_config_1 = require("./pdf-ingestion.config");
const class_validator_1 = require("class-validator");
const machine_name_dto_1 = require("./dto/machine-name.dto");
const set_pdf_vision_preference_dto_1 = require("./dto/set-pdf-vision-preference.dto");
class ApproveExtractionDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveExtractionDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveExtractionDto.prototype, "problemDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveExtractionDto.prototype, "solution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveExtractionDto.prototype, "tags", void 0);
class RejectExtractionDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectExtractionDto.prototype, "reason", void 0);
class GateDecisionDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GateDecisionDto.prototype, "reason", void 0);
let KnowledgeDocumentsController = class KnowledgeDocumentsController {
    constructor(knowledgeDocumentsService, databaseSchemaService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
        this.databaseSchemaService = databaseSchemaService;
    }
    async acceptPdfUpload(file, req, supersedesDocumentId) {
        if (!file) {
            throw new common_1.HttpException('No file uploaded', common_1.HttpStatus.BAD_REQUEST);
        }
        const mt = (file.mimetype || '').toLowerCase();
        if (!mt.includes('pdf') && mt !== 'application/octet-stream') {
            try {
                if (file.path && (0, fs_1.existsSync)(file.path))
                    (0, fs_1.unlinkSync)(file.path);
            }
            catch {
            }
            throw new common_1.HttpException('Only PDF files are allowed', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            const { document, jobId } = await this.knowledgeDocumentsService.ingestAndQueue({
                fileName: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size,
                filePath: file.path,
                uploadedById: req.user.id,
                supersedesDocumentId: supersedesDocumentId?.trim() || undefined,
            });
            return {
                documentId: document.id,
                jobId,
                document,
                resume: {
                    extractedCandidates: 0,
                    approvedCandidates: 0,
                    rejectedCandidates: 0,
                    chunksIndexed: 0,
                    message: 'Upload accepted and queued for background processing.',
                },
            };
        }
        catch (err) {
            try {
                if (file?.path && (0, fs_1.existsSync)(file.path))
                    (0, fs_1.unlinkSync)(file.path);
            }
            catch {
            }
            throw err;
        }
    }
    async upload(file, req, supersedesDocumentId) {
        return this.acceptPdfUpload(file, req, supersedesDocumentId);
    }
    async uploadAlias(file, req, supersedesDocumentId) {
        return this.acceptPdfUpload(file, req, supersedesDocumentId);
    }
    async approveMachineNameSuggestion(suggestionId, body, req) {
        return this.knowledgeDocumentsService.approveMachineNameSuggestion(suggestionId, req.user.id, body.rejectOthersReason);
    }
    async approveGate(id, req) {
        return this.knowledgeDocumentsService.approveGateAndContinue(id, req.user.id);
    }
    async rejectGate(id, body, req) {
        return this.knowledgeDocumentsService.rejectGate(id, req.user.id, body.reason);
    }
    async rejectMachineNameSuggestion(suggestionId, body, req) {
        return this.knowledgeDocumentsService.rejectMachineNameSuggestion(suggestionId, req.user.id, body.reason);
    }
    async approveExtraction(candidateId, body, req) {
        return this.knowledgeDocumentsService.approveExtractionCandidate(candidateId, req.user.id, req.user.role, body);
    }
    async rejectExtraction(candidateId, body, req) {
        return this.knowledgeDocumentsService.rejectExtractionCandidate(candidateId, req.user.id, body.reason);
    }
    async list(req, includeSuperseded) {
        const wants = includeSuperseded === 'true' || includeSuperseded === '1' || includeSuperseded === 'yes';
        const isAdmin = req.user.role === user_entity_1.UserRole.ADMIN || req.user.role === user_entity_1.UserRole.SUPERADMIN;
        return this.knowledgeDocumentsService.findAll({ includeSuperseded: wants && isAdmin });
    }
    async machineNameSuggestions(id) {
        return this.knowledgeDocumentsService.listMachineNameSuggestions(id);
    }
    async patchMachineName(id, body, req) {
        return this.knowledgeDocumentsService.updateMachineName(id, body.machineName, req.user.id);
    }
    async suggestMachineName(id, body, req) {
        return this.knowledgeDocumentsService.suggestMachineName(id, body.proposedName, req.user.id);
    }
    async extractions(id) {
        return this.knowledgeDocumentsService.getExtractionsForDocument(id);
    }
    async pageAnalysis(id) {
        return this.knowledgeDocumentsService.getPageAnalysis(id);
    }
    async ragStoredData(id, limitRaw) {
        const parsed = limitRaw != null ? parseInt(limitRaw, 10) : 120;
        const limit = Number.isFinite(parsed) ? parsed : 120;
        return this.knowledgeDocumentsService.getRagStoredData(id, limit);
    }
    async pipelineAuditExportXlsx(id, ragLimitRaw) {
        const parsed = ragLimitRaw != null ? parseInt(ragLimitRaw, 10) : 2000;
        const ragLimit = Number.isFinite(parsed) ? parsed : 2000;
        const { buffer, filename } = await this.knowledgeDocumentsService.exportPipelineAuditExcel(id, ragLimit);
        return new common_1.StreamableFile(buffer, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            disposition: `attachment; filename="${filename}"`,
        });
    }
    async pipelineAuditReport(id, ragLimitRaw) {
        const parsed = ragLimitRaw != null ? parseInt(ragLimitRaw, 10) : 2000;
        const ragLimit = Number.isFinite(parsed) ? parsed : 2000;
        return this.knowledgeDocumentsService.getPipelineAuditReport(id, ragLimit);
    }
    async ragStoredDataGlobal(limitRaw, documentId) {
        const parsed = limitRaw != null ? parseInt(limitRaw, 10) : 400;
        const limit = Number.isFinite(parsed) ? parsed : 400;
        return this.knowledgeDocumentsService.getRagStoredDataGlobal(limit, documentId);
    }
    async status(id) {
        return this.knowledgeDocumentsService.getDocumentStatus(id);
    }
    adminPipelineCounts() {
        return this.knowledgeDocumentsService.getAdminPipelineSummary();
    }
    queuesHealth() {
        return this.knowledgeDocumentsService.getBullQueuesHealth();
    }
    pipelineConfig() {
        return this.knowledgeDocumentsService.getPipelineConfigSnapshot();
    }
    databaseInventory() {
        return this.knowledgeDocumentsService.getDatabaseInventory();
    }
    databaseSchema() {
        return this.databaseSchemaService.getPublicSchema();
    }
    qaSuccessCriteria() {
        return this.knowledgeDocumentsService.getQaSuccessCriteria();
    }
    troubleshootingExtractionReference() {
        return this.knowledgeDocumentsService.getTroubleshootingExtractionReference();
    }
    getPdfVisionPreference() {
        return this.knowledgeDocumentsService.getPdfVisionPreferenceReadModel();
    }
    patchPdfVisionPreference(body, req) {
        return this.knowledgeDocumentsService.setPdfVisionAdminEnabled(body.enabled, req.user.id);
    }
    async extractionFeedbackRecent(limitRaw) {
        const parsed = limitRaw != null ? parseInt(limitRaw, 10) : 200;
        const limit = Number.isFinite(parsed) ? parsed : 200;
        return this.knowledgeDocumentsService.listRecentExtractionFeedback(limit);
    }
    async runOcr(id, req) {
        return this.knowledgeDocumentsService.runOcrForDocument(id, req.user.id);
    }
    async runVision(id, req) {
        return this.knowledgeDocumentsService.runVisionForDocument(id, req.user.id);
    }
    async reindexManualChunks(id) {
        return this.knowledgeDocumentsService.reindexManualChunksForDocument(id);
    }
    async continueExtraction(id, req) {
        return this.knowledgeDocumentsService.continueDocumentExtraction(id, req.user.id);
    }
    async download(id, res) {
        const doc = await this.knowledgeDocumentsService.findOne(id);
        if (!doc.filePath) {
            throw new common_1.HttpException('File path missing', common_1.HttpStatus.NOT_FOUND);
        }
        return res.download(doc.filePath, doc.originalName || doc.fileName, (err) => {
            if (err) {
                throw new common_1.HttpException('Failed to download file', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
        });
    }
    async details(id) {
        const doc = await this.knowledgeDocumentsService.findOne(id);
        const stats = await this.knowledgeDocumentsService.getExtractionStats(id);
        const message = doc.status === 'failed'
            ? `Extraction failed${doc.error ? `: ${doc.error}` : ''}`
            : doc.status === 'rejected'
                ? `Upload rejected${doc.error ? `: ${doc.error}` : ''}`
                : doc.status === 'needs_review'
                    ? 'Document needs admin review before trusting extracted results.'
                    : doc.status === 'gated'
                        ? 'Document passed relevance gate.'
                        : doc.status === 'partially_indexed'
                            ? `Extraction done, but indexing had issues${doc.error ? `: ${doc.error}` : ''}`
                            : doc.status === 'processing'
                                ? 'Extraction is running...'
                                : doc.status === 'done'
                                    ? doc.error
                                        ? `Extraction done, but indexing had issues: ${doc.error}`
                                        : 'Extraction done.'
                                    : 'Extraction started.';
        return {
            document: doc,
            resume: {
                extractedCandidates: stats.extractedCandidates,
                approvedCandidates: stats.approvedCandidates,
                rejectedCandidates: stats.rejectedCandidates,
                chunksIndexed: doc.chunksIndexed ?? 0,
                docType: doc.docType ?? null,
                isWorkRelated: doc.isWorkRelated,
                gateConfidence: doc.gateConfidence ?? null,
                needsReview: doc.needsReview ?? false,
                message,
            },
        };
    }
    async remove(id, req) {
        await this.knowledgeDocumentsService.deleteDocument(id, req.user.id);
        return { ok: true };
    }
};
exports.KnowledgeDocumentsController = KnowledgeDocumentsController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a PDF to the knowledge documents library' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const baseDir = (0, pdf_ingestion_config_1.getKnowledgePdfUploadDir)();
                if (!(0, fs_1.existsSync)(baseDir)) {
                    (0, fs_1.mkdirSync)(baseDir, { recursive: true });
                }
                cb(null, baseDir);
            },
            filename: (_req, file, cb) => {
                const unique = (0, uuid_1.v4)();
                const extension = (0, path_1.extname)(file.originalname || '') || '.pdf';
                cb(null, `${unique}${extension}`);
            },
        }),
        limits: { fileSize: (0, pdf_ingestion_config_1.getKnowledgePdfMaxBytes)() },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Query)('supersedesDocumentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload alias (same behavior as /upload)' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const baseDir = (0, pdf_ingestion_config_1.getKnowledgePdfUploadDir)();
                if (!(0, fs_1.existsSync)(baseDir)) {
                    (0, fs_1.mkdirSync)(baseDir, { recursive: true });
                }
                cb(null, baseDir);
            },
            filename: (_req, file, cb) => {
                const unique = (0, uuid_1.v4)();
                const extension = (0, path_1.extname)(file.originalname || '') || '.pdf';
                cb(null, `${unique}${extension}`);
            },
        }),
        limits: { fileSize: (0, pdf_ingestion_config_1.getKnowledgePdfMaxBytes)() },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Query)('supersedesDocumentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "uploadAlias", null);
__decorate([
    (0, common_1.Post)('machine-name-suggestions/:suggestionId/approve'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a machine name suggestion (rejects other pending for same PDF)' }),
    __param(0, (0, common_1.Param)('suggestionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, machine_name_dto_1.ApproveMachineNameSuggestionDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "approveMachineNameSuggestion", null);
__decorate([
    (0, common_1.Post)(':id/gate/approve'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve gate-review document and continue pipeline' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "approveGate", null);
__decorate([
    (0, common_1.Post)(':id/gate/reject'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Reject document at gate-review stage' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, GateDecisionDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "rejectGate", null);
__decorate([
    (0, common_1.Post)('machine-name-suggestions/:suggestionId/reject'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a single pending machine name suggestion' }),
    __param(0, (0, common_1.Param)('suggestionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, machine_name_dto_1.RejectMachineNameSuggestionDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "rejectMachineNameSuggestion", null);
__decorate([
    (0, common_1.Post)('extractions/:candidateId/approve'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve an extracted candidate and create a KnowledgeEntry' }),
    __param(0, (0, common_1.Param)('candidateId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ApproveExtractionDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "approveExtraction", null);
__decorate([
    (0, common_1.Post)('extractions/:candidateId/reject'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Reject an extracted candidate' }),
    __param(0, (0, common_1.Param)('candidateId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RejectExtractionDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "rejectExtraction", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({
        summary: 'List uploaded knowledge documents',
        description: 'Query includeSuperseded=true (admin/superadmin only) to list superseded revisions for 11 history.',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('includeSuperseded')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/machine-name/suggestions'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'List machine name suggestions for a document' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "machineNameSuggestions", null);
__decorate([
    (0, common_1.Patch)(':id/machine-name'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Set official machine name (admin)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, machine_name_dto_1.UpdateMachineNameDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "patchMachineName", null);
__decorate([
    (0, common_1.Post)(':id/machine-name/suggest'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'Suggest a machine name for a PDF (pending admin review)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, machine_name_dto_1.SuggestMachineNameDto, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "suggestMachineName", null);
__decorate([
    (0, common_1.Get)(':id/extractions'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get extracted Problem→Solution candidates for a document' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "extractions", null);
__decorate([
    (0, common_1.Get)(':id/page-analysis'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get OCR/quality page analysis for a document' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "pageAnalysis", null);
__decorate([
    (0, common_1.Get)(':id/rag-stored-data'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get RAG chunks currently stored for this PDF in vector DB' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "ragStoredData", null);
__decorate([
    (0, common_1.Get)(':id/pipeline-audit-export/xlsx'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Excel report: summary, pages OCR, RAG chunks, LLM extraction (readable for jury / thesis)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('ragLimit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "pipelineAuditExportXlsx", null);
__decorate([
    (0, common_1.Get)(':id/pipeline-audit-report'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Full pipeline audit for jury/report: page OCR+vision text, Qdrant chunks, KPIs, chunk before/after filter',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('ragLimit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "pipelineAuditReport", null);
__decorate([
    (0, common_1.Get)('rag-stored-data-global'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get RAG chunks across all PDFs for admin inspection' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "ragStoredDataGlobal", null);
__decorate([
    (0, common_1.Get)(':id/status'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'Get document processing status/progress' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('admin-pipeline-counts'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Counts for admin nav: pending PDF extraction candidates',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "adminPipelineCounts", null);
__decorate([
    (0, common_1.Get)('queues/health'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Bull/Redis health: PING + job counts per knowledge-documents queue',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "queuesHealth", null);
__decorate([
    (0, common_1.Get)('pipeline-config'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Read-only effective PDF pipeline env (16): gate, OCR, vision, extraction caps, Ollama/Qdrant URLs',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "pipelineConfig", null);
__decorate([
    (0, common_1.Get)('database-inventory'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'PostgreSQL tables touched by the PDF knowledge pipeline (19); curated list aligned with architecture doc',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "databaseInventory", null);
__decorate([
    (0, common_1.Get)('database-schema'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Live PostgreSQL public schema: all tables, columns, and foreign keys (from information_schema)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "databaseSchema", null);
__decorate([
    (0, common_1.Get)('qa-success-criteria'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Section 20 QA matrix: original success criteria vs shipped/partial/gap (curated; read-only)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "qaSuccessCriteria", null);
__decorate([
    (0, common_1.Get)('troubleshooting-extraction-reference'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Section 22 read-only: troubleshooting extraction (service, queue, schema, endpoints)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "troubleshootingExtractionReference", null);
__decorate([
    (0, common_1.Get)('pipeline-preferences/pdf-vision'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'PDF vision admin toggle vs env (ENABLE_PDF_VISION); effective = both true',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "getPdfVisionPreference", null);
__decorate([
    (0, common_1.Patch)('pipeline-preferences/pdf-vision'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Turn PDF pipeline vision on/off without restarting the API. Enabling still requires ENABLE_PDF_VISION=true in environment.',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [set_pdf_vision_preference_dto_1.SetPdfVisionPreferenceDto, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeDocumentsController.prototype, "patchPdfVisionPreference", null);
__decorate([
    (0, common_1.Get)('extraction-feedback/recent'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Recent extraction approve/reject feedback events (analytics)' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "extractionFeedbackRecent", null);
__decorate([
    (0, common_1.Post)(':id/run-ocr'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Run OCR on low-quality pages (best-effort)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "runOcr", null);
__decorate([
    (0, common_1.Post)(':id/run-vision'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Run vision LLM on low-quality / low-confidence pages (requires ENABLE_PDF_VISION)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "runVision", null);
__decorate([
    (0, common_1.Post)(':id/reindex-manual-chunks'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Rebuild Qdrant manual chunks from current page_analysis (ocrText) — use after fixes or if vectors drifted',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "reindexManualChunks", null);
__decorate([
    (0, common_1.Post)(':id/continue-extraction'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Resume failed/partial extraction without re-upload — keeps OCR/vision page work, re-runs LLM + Qdrant',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "continueExtraction", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'Download uploaded PDF' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "download", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'Get document details + resume' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "details", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a PDF document' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "remove", null);
exports.KnowledgeDocumentsController = KnowledgeDocumentsController = __decorate([
    (0, swagger_1.ApiTags)('Knowledge Documents'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('knowledge-documents'),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService,
        database_schema_service_1.DatabaseSchemaService])
], KnowledgeDocumentsController);
//# sourceMappingURL=knowledge-documents.controller.js.map