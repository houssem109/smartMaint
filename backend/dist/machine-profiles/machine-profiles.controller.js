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
exports.MachineProfilesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const machine_profiles_service_1 = require("./machine-profiles.service");
const machine_profile_mutations_dto_1 = require("./dto/machine-profile-mutations.dto");
let MachineProfilesController = class MachineProfilesController {
    constructor(machineProfilesService) {
        this.machineProfilesService = machineProfilesService;
    }
    findAll() {
        return this.machineProfilesService.findAll();
    }
    create(body) {
        return this.machineProfilesService.createManual(body);
    }
    adminSummary(id) {
        return this.machineProfilesService.getAdminProfileSummary(id);
    }
    update(id, body) {
        return this.machineProfilesService.updateManual(id, body);
    }
    findOne(id) {
        return this.machineProfilesService.findOne(id);
    }
};
exports.MachineProfilesController = MachineProfilesController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'List machine profiles' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MachineProfilesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create machine profile manually (admin)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [machine_profile_mutations_dto_1.CreateMachineProfileDto]),
    __metadata("design:returntype", void 0)
], MachineProfilesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/summary'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Profile + linked PDF count and approximate knowledge/photo counts (admin)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MachineProfilesController.prototype, "adminSummary", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update machine profile (admin)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, machine_profile_mutations_dto_1.UpdateMachineProfileDto]),
    __metadata("design:returntype", void 0)
], MachineProfilesController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN, user_entity_1.UserRole.TECHNICIAN),
    (0, swagger_1.ApiOperation)({ summary: 'Get machine profile by id' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MachineProfilesController.prototype, "findOne", null);
exports.MachineProfilesController = MachineProfilesController = __decorate([
    (0, swagger_1.ApiTags)('Machine profiles'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('machine-profiles'),
    __metadata("design:paramtypes", [machine_profiles_service_1.MachineProfilesService])
], MachineProfilesController);
//# sourceMappingURL=machine-profiles.controller.js.map