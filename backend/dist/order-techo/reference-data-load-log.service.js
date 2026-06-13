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
exports.ReferenceDataLoadLogService = exports.REFERENCE_DATA_ENTITY_ID = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
exports.REFERENCE_DATA_ENTITY_ID = 'order-reference-data';
let ReferenceDataLoadLogService = class ReferenceDataLoadLogService {
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    async logSuccess(source, dataDir, counts, changedFiles) {
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: source === 'startup' ? audit_log_entity_1.ActionType.CREATE : audit_log_entity_1.ActionType.UPDATE,
            entityType: 'reference_data',
            entityId: exports.REFERENCE_DATA_ENTITY_ID,
            userId: null,
            changes: {
                event: source === 'startup' ? 'reference_data_loaded' : 'reference_data_reloaded',
                source,
                dataDir,
                data_plus: counts.dataPlus,
                order_lines: counts.orderLines,
                articles: counts.articles,
                magasins: counts.magasins,
                changedFiles: changedFiles?.length ? changedFiles : undefined,
            },
            reason: null,
        }));
    }
    async logFailure(source, dataDir, error) {
        await this.auditLogRepository.save(this.auditLogRepository.create({
            actionType: 'error',
            entityType: 'reference_data',
            entityId: exports.REFERENCE_DATA_ENTITY_ID,
            userId: null,
            changes: {
                event: 'reference_data_load_failed',
                source,
                dataDir,
                error,
            },
            reason: error,
        }));
    }
};
exports.ReferenceDataLoadLogService = ReferenceDataLoadLogService;
exports.ReferenceDataLoadLogService = ReferenceDataLoadLogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ReferenceDataLoadLogService);
//# sourceMappingURL=reference-data-load-log.service.js.map