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
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const knowledge_export_service_1 = require("./knowledge-export.service");
const ticket_export_service_1 = require("./ticket-export.service");
let ExportController = class ExportController {
    constructor(knowledgeExportService, ticketExportService) {
        this.knowledgeExportService = knowledgeExportService;
        this.ticketExportService = ticketExportService;
    }
    problemsSolutionsReference() {
        return this.knowledgeExportService.getProblemsSolutionsExportReference();
    }
    problemsSolutions(query) {
        return this.knowledgeExportService.exportProblemsSolutions(query);
    }
    problemsSolutionsPreview(query) {
        return this.knowledgeExportService.previewProblemsSolutions(query);
    }
    tickets(query) {
        return this.ticketExportService.exportTickets(query);
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.Get)('problems-solutions-reference'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Section 23 read-only: problems/solutions export filters, columns, notes' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ExportController.prototype, "problemsSolutionsReference", null);
__decorate([
    (0, common_1.Get)('problems-solutions'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'Export approved knowledge entries as CSV or Excel' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ExportController.prototype, "problemsSolutions", null);
__decorate([
    (0, common_1.Get)('problems-solutions-preview'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Preview exported problems/solutions rows in admin UI' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ExportController.prototype, "problemsSolutionsPreview", null);
__decorate([
    (0, common_1.Get)('tickets'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Export tickets as CSV or Excel (filter by creation period)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ExportController.prototype, "tickets", null);
exports.ExportController = ExportController = __decorate([
    (0, swagger_1.ApiTags)('Export'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('export'),
    __metadata("design:paramtypes", [knowledge_export_service_1.KnowledgeExportService,
        ticket_export_service_1.TicketExportService])
], ExportController);
//# sourceMappingURL=export.controller.js.map