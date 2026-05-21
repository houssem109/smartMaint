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
exports.MachineProfilesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const machine_profile_entity_1 = require("./entities/machine-profile.entity");
const knowledge_document_entity_1 = require("../knowledge-documents/entities/knowledge-document.entity");
const knowledge_entry_entity_1 = require("../knowledge/entities/knowledge-entry.entity");
let MachineProfilesService = class MachineProfilesService {
    constructor(machineProfilesRepository, knowledgeDocumentsRepository, knowledgeEntriesRepository) {
        this.machineProfilesRepository = machineProfilesRepository;
        this.knowledgeDocumentsRepository = knowledgeDocumentsRepository;
        this.knowledgeEntriesRepository = knowledgeEntriesRepository;
    }
    async findAll() {
        return this.machineProfilesRepository.find({ order: { updatedAt: 'DESC' } });
    }
    async findOne(id) {
        const row = await this.machineProfilesRepository.findOne({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException('Machine profile not found');
        return row;
    }
    async getAdminProfileSummary(id) {
        const profile = await this.findOne(id);
        const pdfDocumentCount = await this.knowledgeDocumentsRepository.count({
            where: { machineProfileId: id, status: (0, typeorm_2.Not)('superseded') },
        });
        const nameNorm = profile.machineName?.trim().toLowerCase() || '';
        let knowledgeEntriesApproxCount = 0;
        let knowledgeEntriesWithPhotoApproxCount = 0;
        if (nameNorm) {
            knowledgeEntriesApproxCount = await this.knowledgeEntriesRepository
                .createQueryBuilder('k')
                .where('LOWER(TRIM(COALESCE(k.machineName, :empty))) = :name', {
                name: nameNorm,
                empty: '',
            })
                .getCount();
            knowledgeEntriesWithPhotoApproxCount = await this.knowledgeEntriesRepository
                .createQueryBuilder('k')
                .where('LOWER(TRIM(COALESCE(k.machineName, :empty))) = :name', {
                name: nameNorm,
                empty: '',
            })
                .andWhere('k.photoPath IS NOT NULL')
                .andWhere("TRIM(k.photoPath) <> ''")
                .getCount();
        }
        return {
            profile,
            pdfDocumentCount,
            knowledgeEntriesApproxCount,
            knowledgeEntriesWithPhotoApproxCount,
        };
    }
    async findOrCreate(input) {
        const name = String(input.machineName ?? '').trim();
        if (!name) {
            throw new common_1.NotFoundException('Machine name is required');
        }
        const manufacturer = input.manufacturer?.trim() || null;
        const qb = this.machineProfilesRepository
            .createQueryBuilder('m')
            .where('LOWER(TRIM(m.machineName)) = LOWER(TRIM(:name))', { name });
        if (manufacturer) {
            qb.andWhere('LOWER(TRIM(COALESCE(m.manufacturer, :empty))) = LOWER(TRIM(:mf))', {
                mf: manufacturer,
                empty: '',
            });
        }
        else {
            qb.andWhere('m.manufacturer IS NULL');
        }
        const existing = await qb.getOne();
        if (existing) {
            let dirty = false;
            if (input.family != null && input.family !== existing.family) {
                existing.family = input.family;
                dirty = true;
            }
            if (input.modelNumber != null && input.modelNumber !== existing.modelNumber) {
                existing.modelNumber = input.modelNumber;
                dirty = true;
            }
            if (input.components != null) {
                const next = Array.isArray(input.components)
                    ? input.components.map((c) => String(c).trim()).filter(Boolean).join(', ')
                    : String(input.components).trim() || null;
                if (next !== existing.components) {
                    existing.components = next;
                    dirty = true;
                }
            }
            if (dirty)
                return this.machineProfilesRepository.save(existing);
            return existing;
        }
        const componentsStr = input.components == null
            ? null
            : Array.isArray(input.components)
                ? input.components.map((c) => String(c).trim()).filter(Boolean).join(', ')
                : String(input.components).trim() || null;
        const created = this.machineProfilesRepository.create({
            machineName: name,
            manufacturer,
            family: input.family?.trim() || null,
            modelNumber: input.modelNumber?.trim() || null,
            components: componentsStr,
        });
        return this.machineProfilesRepository.save(created);
    }
    async createManual(input) {
        const name = String(input.machineName ?? '').trim();
        if (!name)
            throw new common_1.BadRequestException('Machine name is required');
        const manufacturer = input.manufacturer?.trim() || null;
        const dup = await this.machineProfilesRepository
            .createQueryBuilder('m')
            .where('LOWER(TRIM(m.machineName)) = LOWER(TRIM(:name))', { name })
            .andWhere(manufacturer
            ? 'LOWER(TRIM(COALESCE(m.manufacturer, :empty))) = LOWER(TRIM(:mf))'
            : 'm.manufacturer IS NULL', manufacturer ? { mf: manufacturer, empty: '' } : {})
            .getOne();
        if (dup) {
            throw new common_1.ConflictException('A profile with this machine name and manufacturer already exists');
        }
        const row = this.machineProfilesRepository.create({
            machineName: name,
            manufacturer,
            family: input.family?.trim() || null,
            modelNumber: input.modelNumber?.trim() || null,
            components: input.components?.trim() || null,
        });
        return this.machineProfilesRepository.save(row);
    }
    async updateManual(id, patch) {
        const row = await this.findOne(id);
        if (patch.machineName != null) {
            const t = String(patch.machineName).trim();
            if (!t)
                throw new common_1.ConflictException('machineName cannot be empty');
            row.machineName = t;
        }
        if (patch.manufacturer !== undefined) {
            row.manufacturer = patch.manufacturer?.trim() || null;
        }
        if (patch.family !== undefined)
            row.family = patch.family?.trim() || null;
        if (patch.modelNumber !== undefined)
            row.modelNumber = patch.modelNumber?.trim() || null;
        if (patch.components !== undefined)
            row.components = patch.components?.trim() || null;
        return this.machineProfilesRepository.save(row);
    }
};
exports.MachineProfilesService = MachineProfilesService;
exports.MachineProfilesService = MachineProfilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(machine_profile_entity_1.MachineProfile)),
    __param(1, (0, typeorm_1.InjectRepository)(knowledge_document_entity_1.KnowledgeDocument)),
    __param(2, (0, typeorm_1.InjectRepository)(knowledge_entry_entity_1.KnowledgeEntry)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], MachineProfilesService);
//# sourceMappingURL=machine-profiles.service.js.map