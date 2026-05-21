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
var KnowledgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ExcelJS = __importStar(require("exceljs"));
const knowledge_entry_entity_1 = require("./entities/knowledge-entry.entity");
const user_entity_1 = require("../users/entities/user.entity");
const rag_service_1 = require("../ai/rag.service");
let KnowledgeService = KnowledgeService_1 = class KnowledgeService {
    constructor(knowledgeRepository, ragService) {
        this.knowledgeRepository = knowledgeRepository;
        this.ragService = ragService;
        this.logger = new common_1.Logger(KnowledgeService_1.name);
    }
    buildIndexText(entry) {
        const parts = [
            entry.machineName ? `Machine: ${entry.machineName}` : null,
            `Title: ${entry.title}`,
            `Problem: ${entry.problemDescription}`,
            entry.symptom ? `Symptom: ${entry.symptom}` : null,
            entry.rootCause ? `Cause: ${entry.rootCause}` : null,
            `Solution: ${entry.solution}`,
            entry.tags ? `Tags: ${entry.tags}` : null,
            entry.photoPath ? `Field photo on file: ${entry.photoPath}` : null,
        ].filter(Boolean);
        return parts.join('\n');
    }
    async indexEntryIfApproved(entry) {
        if (entry.reviewStatus !== 'approved')
            return;
        try {
            await this.ragService.indexKnowledgeEntry(entry.id, this.buildIndexText(entry), {
                source: entry.source ?? 'knowledge_entry',
                title: entry.title,
                machineName: entry.machineName,
                entryType: entry.entryType,
                photoPath: entry.photoPath,
            });
        }
        catch (e) {
            this.logger.warn(`RAG index failed for knowledge entry ${entry.id}: ${e?.message ?? e}`);
        }
    }
    async create(dto, userId, role, options) {
        const isTech = role === user_entity_1.UserRole.TECHNICIAN;
        const reviewStatus = isTech ? 'pending_review' : 'approved';
        const { knowledgeDocumentId, ...rest } = dto;
        const entry = this.knowledgeRepository.create({
            ...rest,
            knowledgeDocument: !isTech && knowledgeDocumentId ? { id: knowledgeDocumentId } : null,
            createdById: userId,
            reviewStatus,
            entryType: dto.entryType?.trim() || (isTech ? 'experience' : null),
            source: dto.source?.trim() || (isTech ? 'field_experience' : null),
            machineName: dto.machineName?.trim() || null,
            symptom: dto.symptom?.trim() || null,
            rootCause: dto.rootCause?.trim() || null,
            severity: dto.severity?.trim() || null,
        });
        const saved = await this.knowledgeRepository.save(entry);
        if (reviewStatus === 'approved' && !options?.skipAutoIndex) {
            await this.indexEntryIfApproved(saved);
        }
        return saved;
    }
    async findAllForRole(userId, role) {
        const qb = this.knowledgeRepository.createQueryBuilder('k').leftJoinAndSelect('k.createdBy', 'createdBy');
        if (role === user_entity_1.UserRole.TECHNICIAN) {
            qb.where('k.createdById = :userId', { userId });
        }
        qb.orderBy('k.createdAt', 'DESC');
        return qb.getMany();
    }
    async findAll() {
        return this.knowledgeRepository.find({
            order: { createdAt: 'DESC' },
            relations: ['createdBy'],
        });
    }
    async listPendingReview() {
        return this.knowledgeRepository.find({
            where: { reviewStatus: 'pending_review' },
            order: { createdAt: 'ASC' },
            relations: ['createdBy'],
        });
    }
    async countPendingReview() {
        return this.knowledgeRepository.count({ where: { reviewStatus: 'pending_review' } });
    }
    async searchRelevantEntries(query, limit = 3) {
        const q = (query ?? '').trim().toLowerCase();
        if (!q)
            return [];
        const safe = q.slice(0, 200);
        return this.knowledgeRepository
            .createQueryBuilder('k')
            .leftJoinAndSelect('k.createdBy', 'createdBy')
            .where('k.reviewStatus = :rs', { rs: 'approved' })
            .andWhere('LOWER(k.title) LIKE :q OR LOWER(k.problemDescription) LIKE :q OR LOWER(k.solution) LIKE :q OR LOWER(COALESCE(k.tags, :empty)) LIKE :q', { q: `%${safe}%`, empty: '' })
            .orderBy('k.createdAt', 'DESC')
            .take(limit)
            .getMany();
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
    async findOneForUser(id, userId, role) {
        const entry = await this.findOne(id);
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only view your own knowledge entries');
        }
        return entry;
    }
    async update(id, dto, userId, role) {
        const entry = await this.findOne(id);
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only update your own knowledge entries');
        }
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.reviewStatus === 'approved') {
            throw new common_1.BadRequestException('Approved entries cannot be edited by technicians');
        }
        Object.assign(entry, dto);
        if (role === user_entity_1.UserRole.TECHNICIAN) {
            entry.reviewStatus = 'pending_review';
            entry.reviewedById = null;
            entry.reviewedAt = null;
            entry.rejectReason = null;
        }
        const saved = await this.knowledgeRepository.save(entry);
        if (saved.reviewStatus === 'approved') {
            await this.indexEntryIfApproved(saved);
        }
        return saved;
    }
    async remove(id, userId, role) {
        const entry = await this.findOne(id);
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only delete your own knowledge entries');
        }
        await this.knowledgeRepository.delete(id);
    }
    async approveKnowledgeEntry(id, adminId) {
        const entry = await this.findOne(id);
        if (entry.reviewStatus !== 'pending_review') {
            throw new common_1.BadRequestException('Entry is not pending review');
        }
        entry.reviewStatus = 'approved';
        entry.reviewedById = adminId;
        entry.reviewedAt = new Date();
        entry.rejectReason = null;
        const saved = await this.knowledgeRepository.save(entry);
        await this.indexEntryIfApproved(saved);
        return saved;
    }
    async rejectKnowledgeEntry(id, adminId, reason) {
        const entry = await this.findOne(id);
        if (entry.reviewStatus !== 'pending_review') {
            throw new common_1.BadRequestException('Entry is not pending review');
        }
        entry.reviewStatus = 'rejected';
        entry.reviewedById = adminId;
        entry.reviewedAt = new Date();
        entry.rejectReason = reason?.trim() || null;
        return this.knowledgeRepository.save(entry);
    }
    async setPhotoPath(entryId, relativePath, userId, role) {
        const entry = await this.findOne(entryId);
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only attach photos to your own entries');
        }
        if (role === user_entity_1.UserRole.TECHNICIAN && entry.reviewStatus === 'approved') {
            throw new common_1.BadRequestException('Cannot change photo on approved entries');
        }
        entry.photoPath = relativePath;
        if (role === user_entity_1.UserRole.TECHNICIAN) {
            entry.reviewStatus = 'pending_review';
            entry.reviewedById = null;
            entry.reviewedAt = null;
        }
        return this.knowledgeRepository.save(entry);
    }
    async exportCsvForUser(userId, role) {
        const rows = role === user_entity_1.UserRole.TECHNICIAN
            ? await this.knowledgeRepository.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } })
            : await this.knowledgeRepository.find({ order: { createdAt: 'DESC' } });
        const header = [
            'id',
            'title',
            'problemDescription',
            'solution',
            'tags',
            'machineName',
            'symptom',
            'rootCause',
            'severity',
            'entryType',
            'source',
            'reviewStatus',
            'photoPath',
            'createdById',
            'createdAt',
        ].join(',');
        const esc = (v) => {
            const s = (v ?? '').replace(/"/g, '""');
            return `"${s}"`;
        };
        const lines = rows.map((r) => [
            r.id,
            esc(r.title),
            esc(r.problemDescription),
            esc(r.solution),
            esc(r.tags),
            esc(r.machineName),
            esc(r.symptom),
            esc(r.rootCause),
            esc(r.severity),
            esc(r.entryType),
            esc(r.source),
            esc(r.reviewStatus),
            esc(r.photoPath),
            r.createdById,
            r.createdAt?.toISOString() ?? '',
        ].join(','));
        return [header, ...lines].join('\n');
    }
    async exportXlsxForUser(userId, role) {
        const rows = role === user_entity_1.UserRole.TECHNICIAN
            ? await this.knowledgeRepository.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } })
            : await this.knowledgeRepository.find({ order: { createdAt: 'DESC' } });
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Knowledge entries');
        ws.columns = [
            { header: 'id', key: 'id', width: 38 },
            { header: 'title', key: 'title', width: 28 },
            { header: 'problemDescription', key: 'problemDescription', width: 40 },
            { header: 'solution', key: 'solution', width: 40 },
            { header: 'tags', key: 'tags', width: 20 },
            { header: 'machineName', key: 'machineName', width: 22 },
            { header: 'symptom', key: 'symptom', width: 24 },
            { header: 'rootCause', key: 'rootCause', width: 24 },
            { header: 'severity', key: 'severity', width: 12 },
            { header: 'entryType', key: 'entryType', width: 14 },
            { header: 'source', key: 'source', width: 18 },
            { header: 'reviewStatus', key: 'reviewStatus', width: 16 },
            { header: 'photoPath', key: 'photoPath', width: 36 },
            { header: 'createdById', key: 'createdById', width: 38 },
            { header: 'createdAt', key: 'createdAt', width: 22 },
        ];
        for (const r of rows) {
            ws.addRow({
                id: r.id,
                title: r.title,
                problemDescription: r.problemDescription,
                solution: r.solution,
                tags: r.tags,
                machineName: r.machineName,
                symptom: r.symptom,
                rootCause: r.rootCause,
                severity: r.severity,
                entryType: r.entryType,
                source: r.source,
                reviewStatus: r.reviewStatus,
                photoPath: r.photoPath,
                createdById: r.createdById,
                createdAt: r.createdAt?.toISOString() ?? '',
            });
        }
        const buf = await wb.xlsx.writeBuffer();
        return Buffer.from(buf);
    }
};
exports.KnowledgeService = KnowledgeService;
exports.KnowledgeService = KnowledgeService = KnowledgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(knowledge_entry_entity_1.KnowledgeEntry)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        rag_service_1.RagService])
], KnowledgeService);
//# sourceMappingURL=knowledge.service.js.map