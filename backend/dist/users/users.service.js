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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
let UsersService = class UsersService {
    constructor(usersRepository, auditLogRepository) {
        this.usersRepository = usersRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async create(createUserDto) {
        const existingUser = await this.usersRepository.findOne({
            where: [{ email: createUserDto.email }, { username: createUserDto.username }],
        });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email or username already exists');
        }
        const user = this.usersRepository.create(createUserDto);
        const saved = await this.usersRepository.save(user);
        await this.logUserAction(saved.id, audit_log_entity_1.ActionType.CREATE, null, {
            email: saved.email,
            role: saved.role,
            isActive: saved.isActive,
        });
        return saved;
    }
    async findAll() {
        return this.usersRepository.find({
            select: ['id', 'username', 'email', 'role', 'fullName', 'phoneNumber', 'isActive', 'createdAt'],
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const user = await this.usersRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async findByEmail(email) {
        return this.usersRepository.findOne({ where: { email } });
    }
    async findByUsername(username) {
        return this.usersRepository.findOne({ where: { username } });
    }
    async update(id, updateData) {
        const before = await this.findOne(id);
        await this.usersRepository.update(id, updateData);
        const updated = await this.findOne(id);
        const changes = {};
        if (updateData.fullName && updateData.fullName !== before.fullName) {
            changes.fullName = { from: before.fullName, to: updateData.fullName };
        }
        if (updateData.username && updateData.username !== before.username) {
            changes.username = { from: before.username, to: updateData.username };
        }
        if (typeof updateData.isActive !== 'undefined' && updateData.isActive !== before.isActive) {
            changes.isActive = { from: before.isActive, to: updateData.isActive };
        }
        if (updateData.role && updateData.role !== before.role) {
            changes.role = { from: before.role, to: updateData.role };
        }
        if (Object.keys(changes).length > 0) {
            await this.logUserAction(id, audit_log_entity_1.ActionType.UPDATE, null, changes);
        }
        return updated;
    }
    async remove(id) {
        const user = await this.findOne(id);
        await this.usersRepository.delete(id);
        await this.logUserAction(id, audit_log_entity_1.ActionType.DELETE, null, {
            deletedSnapshot: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                isActive: user.isActive,
            },
        });
    }
    async findTechnicians() {
        return this.usersRepository.find({
            where: { role: user_entity_1.UserRole.TECHNICIAN, isActive: true },
            select: ['id', 'username', 'email', 'fullName'],
        });
    }
    async restore(id, currentUserRole) {
        if (currentUserRole !== user_entity_1.UserRole.SUPERADMIN) {
            throw new common_1.ForbiddenException('Only superadmin can restore users');
        }
        const existing = await this.usersRepository.findOne({ where: { id } });
        if (existing) {
            return existing;
        }
        const log = await this.auditLogRepository.findOne({
            where: { entityId: id, entityType: 'user', actionType: audit_log_entity_1.ActionType.DELETE },
            order: { timestamp: 'DESC' },
        });
        const snapshot = log?.changes?.deletedSnapshot;
        if (!snapshot) {
            throw new common_1.NotFoundException('No restore information found for this user');
        }
        const restored = this.usersRepository.create(snapshot);
        const saved = await this.usersRepository.save(restored);
        await this.logUserAction(id, audit_log_entity_1.ActionType.ROLLBACK, null, {
            restoredFromDelete: true,
        });
        return saved;
    }
    async logUserAction(userId, actionType, actorUserId, changes) {
        const log = this.auditLogRepository.create({
            actionType,
            entityId: userId,
            entityType: 'user',
            userId: actorUserId,
            changes: changes ?? null,
            reason: null,
        });
        await this.auditLogRepository.save(log);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map