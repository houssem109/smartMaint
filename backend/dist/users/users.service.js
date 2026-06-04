"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
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
        try {
            await this.usersRepository.delete(id);
        }
        catch (err) {
            if (err instanceof typeorm_2.QueryFailedError && err.code === '23503') {
                throw new common_1.BadRequestException('Cannot delete this user because related records still reference them. Run database migrations and try again.');
            }
            throw err;
        }
        await this.logUserAction(id, audit_log_entity_1.ActionType.DELETE, null, {
            deletedSnapshot: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                factoryId: user.factoryId,
                isActive: user.isActive,
                passwordHash: user.password,
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
            return { user: existing, passwordWasRegenerated: false };
        }
        const log = await this.auditLogRepository.findOne({
            where: { entityId: id, entityType: 'user', actionType: audit_log_entity_1.ActionType.DELETE },
            order: { timestamp: 'DESC' },
        });
        const snapshot = log?.changes?.deletedSnapshot;
        if (!snapshot?.id || !snapshot.email || !snapshot.username) {
            throw new common_1.NotFoundException('No restore information found for this user');
        }
        const emailTaken = await this.usersRepository.findOne({ where: { email: snapshot.email } });
        if (emailTaken) {
            throw new common_1.ConflictException(`Cannot restore user: email "${snapshot.email}" is already used by another account`);
        }
        const usernameTaken = await this.usersRepository.findOne({ where: { username: snapshot.username } });
        if (usernameTaken) {
            throw new common_1.ConflictException(`Cannot restore user: username "${snapshot.username}" is already used by another account`);
        }
        const passwordHash = snapshot.passwordHash ?? (await bcrypt.hash((0, crypto_1.randomBytes)(32).toString('hex'), 10));
        const passwordWasRegenerated = !snapshot.passwordHash;
        const restored = this.usersRepository.create({
            id: snapshot.id,
            email: snapshot.email,
            username: snapshot.username,
            role: snapshot.role,
            fullName: snapshot.fullName ?? null,
            phoneNumber: snapshot.phoneNumber ?? null,
            factoryId: snapshot.factoryId ?? null,
            isActive: snapshot.isActive ?? true,
            password: passwordHash,
        });
        const saved = await this.usersRepository.save(restored);
        await this.logUserAction(id, audit_log_entity_1.ActionType.ROLLBACK, null, {
            restoredFromDelete: true,
            passwordWasRegenerated,
        });
        return { user: saved, passwordWasRegenerated };
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