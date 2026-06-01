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
exports.KnowledgeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const knowledge_service_1 = require("./knowledge.service");
const create_knowledge_entry_dto_1 = require("./dto/create-knowledge-entry.dto");
const update_knowledge_entry_dto_1 = require("./dto/update-knowledge-entry.dto");
const review_knowledge_entry_dto_1 = require("./dto/review-knowledge-entry.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const knowledge_photo_config_1 = require("./knowledge-photo.config");
let KnowledgeController = class KnowledgeController {
    constructor(knowledgeService) {
        this.knowledgeService = knowledgeService;
    }
    pendingReviewCount() {
        return this.knowledgeService.countPendingReview().then((count) => ({ count }));
    }
    listPendingReview() {
        return this.knowledgeService.listPendingReview();
    }
    async exportCsv(req, res) {
        const csv = await this.knowledgeService.exportCsvForUser(req.user.id, req.user.role);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="knowledge-entries.csv"');
        return res.send(csv);
    }
    async exportXlsx(req, res) {
        const buf = await this.knowledgeService.exportXlsxForUser(req.user.id, req.user.role);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="knowledge-entries.xlsx"');
        return res.send(buf);
    }
    create(dto, req) {
        return this.knowledgeService.create(dto, req.user.id, req.user.role);
    }
    findAll(req) {
        return this.knowledgeService.findAllForRole(req.user.id, req.user.role);
    }
    approve(id, req) {
        return this.knowledgeService.approveKnowledgeEntry(id, req.user.id);
    }
    reject(id, body, req) {
        return this.knowledgeService.rejectKnowledgeEntry(id, req.user.id, body.reason);
    }
    async uploadPhoto(id, file, req) {
        if (!file?.filename)
            throw new common_1.BadRequestException('file is required');
        const rel = (0, path_1.join)((0, knowledge_photo_config_1.getKnowledgePhotoUploadDir)(), file.filename).replace(/\\/g, '/');
        return this.knowledgeService.setPhotoPath(id, rel, req.user.id, req.user.role);
    }
    async photoFile(id, req, res) {
        const entry = await this.knowledgeService.findOneForUser(id, req.user.id, req.user.role);
        if (!entry.photoPath?.trim())
            throw new common_1.BadRequestException('No photo on this entry');
        const root = (0, path_1.resolve)((0, path_1.join)(process.cwd(), (0, knowledge_photo_config_1.getKnowledgePhotoUploadDir)()));
        const abs = (0, path_1.resolve)((0, path_1.join)(process.cwd(), entry.photoPath));
        if (!abs.startsWith(root)) {
            throw new common_1.ForbiddenException('Invalid photo path');
        }
        if (!(0, fs_1.existsSync)(abs))
            throw new common_1.BadRequestException('Photo file missing');
        return res.sendFile(abs);
    }
    findOne(id, req) {
        return this.knowledgeService.findOneForUser(id, req.user.id, req.user.role);
    }
    update(id, dto, req) {
        return this.knowledgeService.update(id, dto, req.user.id, req.user.role);
    }
    remove(id, req) {
        return this.knowledgeService.remove(id, req.user.id, req.user.role);
    }
};
exports.KnowledgeController = KnowledgeController;
__decorate([
    (0, common_1.Get)('pending-review/count'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Count knowledge entries awaiting admin approval' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "pendingReviewCount", null);
__decorate([
    (0, common_1.Get)('pending-review'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'List knowledge entries awaiting admin approval' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "listPendingReview", null);
__decorate([
    (0, common_1.Get)('export/csv'),
    (0, swagger_1.ApiOperation)({ summary: 'Export knowledge entries as CSV (technicians: own rows only)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Get)('export/xlsx'),
    (0, swagger_1.ApiOperation)({ summary: 'Export knowledge entries as Excel (technicians: own rows only)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "exportXlsx", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a knowledge entry (technicians submit for review)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_knowledge_entry_dto_1.CreateKnowledgeEntryDto, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List knowledge entries (technicians: own entries only)' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a pending technician knowledge entry and index to RAG' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a pending technician knowledge entry' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_knowledge_entry_dto_1.RejectKnowledgeEntryDto, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/photo'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Attach a field photo to a knowledge entry (JPEG/PNG/WebP)' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 8 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const ok = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
            cb(ok ? null : new common_1.BadRequestException('Only JPEG, PNG, or WebP images are allowed'), ok);
        },
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                cb(null, (0, knowledge_photo_config_1.ensureKnowledgePhotoUploadDir)());
            },
            filename: (_req, file, cb) => {
                cb(null, `${(0, uuid_1.v4)()}${(0, path_1.extname)(file.originalname).toLowerCase() || '.jpg'}`);
            },
        }),
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "uploadPhoto", null);
__decorate([
    (0, common_1.Get)(':id/photo-file'),
    (0, swagger_1.ApiOperation)({ summary: 'Download field photo for a knowledge entry' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "photoFile", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single knowledge entry' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a knowledge entry' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_knowledge_entry_dto_1.UpdateKnowledgeEntryDto, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a knowledge entry' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "remove", null);
exports.KnowledgeController = KnowledgeController = __decorate([
    (0, swagger_1.ApiTags)('Knowledge'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN, user_entity_1.UserRole.WORKER),
    (0, common_1.Controller)('knowledge'),
    __metadata("design:paramtypes", [knowledge_service_1.KnowledgeService])
], KnowledgeController);
//# sourceMappingURL=knowledge.controller.js.map