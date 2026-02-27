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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("./entities/user.entity");
const create_user_dto_1 = require("./dto/create-user.dto");
const email_service_1 = require("../common/services/email.service");
const bcrypt = require("bcrypt");
let UsersController = class UsersController {
    constructor(usersService, emailService) {
        this.usersService = usersService;
        this.emailService = emailService;
    }
    async create(req, createUserDto) {
        if (createUserDto.role === user_entity_1.UserRole.SUPERADMIN) {
            throw new common_1.ForbiddenException('Creating superadmin users is not allowed');
        }
        if (req.user.role === user_entity_1.UserRole.ADMIN &&
            createUserDto.role === user_entity_1.UserRole.ADMIN) {
            throw new common_1.ForbiddenException('Only superadmin can create admin users');
        }
        const plainPassword = createUserDto.password;
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        const user = await this.usersService.create({
            ...createUserDto,
            password: hashedPassword,
            isActive: true,
        });
        this.emailService.sendWelcomeEmail(createUserDto.email, plainPassword, createUserDto.fullName, createUserDto.username).catch((error) => {
            console.error('Failed to send welcome email:', error);
        });
        return user;
    }
    findAll() {
        return this.usersService.findAll();
    }
    findTechnicians() {
        return this.usersService.findTechnicians();
    }
    getProfile(req) {
        return this.usersService.findOne(req.user.id);
    }
    async updateMe(req, body) {
        const updateData = {};
        if (body.fullName !== undefined)
            updateData.fullName = body.fullName;
        if (body.username !== undefined)
            updateData.username = body.username;
        if (body.phoneNumber !== undefined)
            updateData.phoneNumber = body.phoneNumber;
        if (body.password) {
            updateData.password = await bcrypt.hash(body.password, 10);
        }
        return this.usersService.update(req.user.id, updateData);
    }
    findOne(id) {
        return this.usersService.findOne(id);
    }
    async update(req, id, updateData) {
        const target = await this.usersService.findOne(id);
        if (updateData.role === user_entity_1.UserRole.SUPERADMIN && target.email !== 'superadmin@smartmaint.com') {
            throw new common_1.ForbiddenException('Promoting users to superadmin is not allowed');
        }
        if (req.user.role === user_entity_1.UserRole.ADMIN) {
            if (target.role === user_entity_1.UserRole.ADMIN || target.role === user_entity_1.UserRole.SUPERADMIN) {
                throw new common_1.ForbiddenException('Only superadmin can modify admin or superadmin users');
            }
        }
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }
        return this.usersService.update(id, updateData);
    }
    async remove(req, id) {
        if (req.user.role === user_entity_1.UserRole.ADMIN) {
            const target = await this.usersService.findOne(id);
            if (target.role === user_entity_1.UserRole.ADMIN || target.role === user_entity_1.UserRole.SUPERADMIN) {
                throw new common_1.ForbiddenException('Only superadmin can delete admin or superadmin users');
            }
        }
        return this.usersService.remove(id);
    }
    async restore(id, req) {
        return this.usersService.restore(id, req.user.role);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create new user (Admin/Superadmin only)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users (Admin/Superadmin only)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('technicians'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all technicians' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findTechnicians", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Update current user profile (email cannot be changed)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update user (Admin/Superadmin only; admin cannot edit other admins)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete user (Admin/Superadmin only; admin cannot delete other admins)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/restore'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPERADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Restore a previously deleted user (Superadmin only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "restore", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users'),
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        email_service_1.EmailService])
], UsersController);
//# sourceMappingURL=users.controller.js.map