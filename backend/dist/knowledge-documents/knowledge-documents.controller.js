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
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const class_validator_1 = require("class-validator");
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
let KnowledgeDocumentsController = class KnowledgeDocumentsController {
    constructor(knowledgeDocumentsService) {
        this.knowledgeDocumentsService = knowledgeDocumentsService;
    }
    async upload(file, req) {
        if (!file) {
            throw new common_1.HttpException('No file uploaded', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!file.mimetype.includes('pdf')) {
            throw new common_1.HttpException('Only PDF files are allowed', common_1.HttpStatus.BAD_REQUEST);
        }
        const doc = await this.knowledgeDocumentsService.createFromUpload({
            fileName: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
            uploadedById: req.user.id,
        });
        void this.knowledgeDocumentsService
            .processDocumentExtraction(doc.id)
            .catch(() => {
        });
        return {
            document: doc,
            resume: {
                extractedCandidates: 0,
                approvedCandidates: 0,
                rejectedCandidates: 0,
                chunksIndexed: 0,
                message: 'Extraction started. Please refresh the document details to see extracted candidates.',
            },
        };
    }
    async list() {
        return this.knowledgeDocumentsService.findAll();
    }
    async details(id) {
        const doc = await this.knowledgeDocumentsService.findOne(id);
        const stats = await this.knowledgeDocumentsService.getExtractionStats(id);
        const message = doc.status === 'failed'
            ? `Extraction failed${doc.error ? `: ${doc.error}` : ''}`
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
                message,
            },
        };
    }
    async remove(id, req) {
        await this.knowledgeDocumentsService.deleteDocument(id, req.user.id);
        return { ok: true };
    }
    async extractions(id) {
        return this.knowledgeDocumentsService.getExtractionsForDocument(id);
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
    async approveExtraction(candidateId, body, req) {
        return this.knowledgeDocumentsService.approveExtractionCandidate(candidateId, req.user.id, body);
    }
    async rejectExtraction(candidateId, req) {
        return this.knowledgeDocumentsService.rejectExtractionCandidate(candidateId, req.user.id);
    }
};
exports.KnowledgeDocumentsController = KnowledgeDocumentsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a PDF to the knowledge documents library' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const baseDir = 'uploads/knowledge-documents';
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
        limits: { fileSize: 30 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all uploaded knowledge documents (admin)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get document details + resume (admin)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "details", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a PDF document (admin only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/extractions'),
    (0, swagger_1.ApiOperation)({ summary: 'Get extracted Problem→Solution candidates for a document' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "extractions", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, swagger_1.ApiOperation)({ summary: 'Download uploaded PDF (admin/superadmin)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "download", null);
__decorate([
    (0, common_1.Post)('extractions/:candidateId/approve'),
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
    (0, swagger_1.ApiOperation)({ summary: 'Reject an extracted candidate' }),
    __param(0, (0, common_1.Param)('candidateId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeDocumentsController.prototype, "rejectExtraction", null);
exports.KnowledgeDocumentsController = KnowledgeDocumentsController = __decorate([
    (0, swagger_1.ApiTags)('Knowledge Documents'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, common_1.Controller)('knowledge-documents'),
    __metadata("design:paramtypes", [knowledge_documents_service_1.KnowledgeDocumentsService])
], KnowledgeDocumentsController);
//# sourceMappingURL=knowledge-documents.controller.js.map