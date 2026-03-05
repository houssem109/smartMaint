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
exports.KnowledgeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const knowledge_entry_entity_1 = require("./entities/knowledge-entry.entity");
const user_entity_1 = require("../users/entities/user.entity");
let KnowledgeService = class KnowledgeService {
    constructor(knowledgeRepository) {
        this.knowledgeRepository = knowledgeRepository;
    }
    async create(dto, userId) {
        const entry = this.knowledgeRepository.create({
            ...dto,
            createdById: userId,
        });
        return this.knowledgeRepository.save(entry);
    }
    async findAll() {
        return this.knowledgeRepository.find({
            order: { createdAt: 'DESC' },
            relations: ['createdBy'],
        });
    }
    async findOne(id) {
        const entry = await this.knowledgeRepository.findOne({
            where: { id },
            relations: ['createdBy'],
        });
        if (!entry) {
            throw new common_1.NotFoundException('Knowledge entry not found');
        }
        return entry;
    }
    async update(id, dto, userId, role) {
        const entry = await this.findOne(id);
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only update your own knowledge entries');
        }
        Object.assign(entry, dto);
        return this.knowledgeRepository.save(entry);
    }
    async remove(id, userId, role) {
        const entry = await this.findOne(id);
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only delete your own knowledge entries');
        }
        await this.knowledgeRepository.delete(id);
    }
};
exports.KnowledgeService = KnowledgeService;
exports.KnowledgeService = KnowledgeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(knowledge_entry_entity_1.KnowledgeEntry)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], KnowledgeService);
//# sourceMappingURL=knowledge.service.js.map