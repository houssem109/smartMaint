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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketExportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ticket_entity_1 = require("../tickets/entities/ticket.entity");
const user_entity_1 = require("../users/entities/user.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const exceljs_1 = __importDefault(require("exceljs"));
const RESOLVED_STATUSES = [ticket_entity_1.TicketStatus.SOLVED, ticket_entity_1.TicketStatus.CLOSED];
let TicketExportService = class TicketExportService {
    constructor(ticketRepository, userRepository, auditLogRepository) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
    }
    dispositionFilename(base) {
        const safe = base.replace(/[^\w.\-]+/g, '_').slice(0, 120);
        return `attachment; filename="${safe}"`;
    }
    buildFilename(query, format) {
        const stamp = new Date().toISOString().slice(0, 10);
        const fromPart = query.from?.trim() ? query.from.trim().slice(0, 10) : 'all';
        const toPart = query.to?.trim() ? query.to.trim().slice(0, 10) : 'all';
        return `tickets_${fromPart}_${toPart}_${stamp}.${format}`;
    }
    userLabel(u) {
        if (!u)
            return '';
        return u.fullName?.trim() || u.username?.trim() || u.email?.trim() || '';
    }
    isResolved(status) {
        return RESOLVED_STATUSES.includes(status);
    }
    applyDateFilters(qb, query) {
        const fromRaw = query.from?.trim();
        const toRaw = query.to?.trim();
        if (fromRaw && toRaw) {
            const from = new Date(fromRaw);
            const to = new Date(toRaw);
            if (!Number.isNaN(+from) && !Number.isNaN(+to)) {
                qb.andWhere({ createdAt: (0, typeorm_2.Between)(from, to) });
            }
        }
        else if (fromRaw) {
            const from = new Date(fromRaw);
            if (!Number.isNaN(+from)) {
                qb.andWhere('ticket.createdAt >= :from', { from });
            }
        }
        else if (toRaw) {
            const to = new Date(toRaw);
            if (!Number.isNaN(+to)) {
                const end = new Date(to);
                end.setUTCHours(23, 59, 59, 999);
                qb.andWhere('ticket.createdAt <= :toEnd', { toEnd: end });
            }
        }
    }
    async resolveResolverLabels(tickets) {
        const result = new Map();
        const resolvedIds = tickets
            .filter((t) => this.isResolved(t.status))
            .map((t) => t.id);
        if (resolvedIds.length === 0)
            return result;
        const logs = await this.auditLogRepository
            .createQueryBuilder('log')
            .where('log.entityType = :type', { type: 'ticket' })
            .andWhere('log.entityId IN (:...ids)', { ids: resolvedIds })
            .andWhere("log.changes->'status'->>'to' IN (:...statuses)", {
            statuses: RESOLVED_STATUSES,
        })
            .orderBy('log.timestamp', 'DESC')
            .getMany();
        const resolverUserIdByTicket = new Map();
        for (const log of logs) {
            if (!resolverUserIdByTicket.has(log.entityId) && log.userId) {
                resolverUserIdByTicket.set(log.entityId, log.userId);
            }
        }
        const userIds = [...new Set(resolverUserIdByTicket.values())];
        const users = userIds.length > 0
            ? await this.userRepository.find({ where: { id: (0, typeorm_2.In)(userIds) } })
            : [];
        const userById = new Map(users.map((u) => [u.id, u]));
        for (const ticket of tickets) {
            if (!this.isResolved(ticket.status))
                continue;
            const resolverId = resolverUserIdByTicket.get(ticket.id);
            if (resolverId && userById.has(resolverId)) {
                result.set(ticket.id, this.userLabel(userById.get(resolverId)));
                continue;
            }
            if (ticket.assignedTo) {
                result.set(ticket.id, this.userLabel(ticket.assignedTo));
            }
        }
        return result;
    }
    async exportTickets(query) {
        const format = query.format === 'csv' ? 'csv' : 'xlsx';
        const qb = this.ticketRepository
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.createdBy', 'createdBy')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket.isDeleted = false');
        this.applyDateFilters(qb, query);
        if (query.status) {
            qb.andWhere('ticket.status = :status', { status: query.status });
        }
        if (query.category?.trim()) {
            qb.andWhere('LOWER(ticket.category) = LOWER(:category)', {
                category: query.category.trim(),
            });
        }
        const rows = await qb.orderBy('ticket.createdAt', 'DESC').getMany();
        const resolverByTicket = await this.resolveResolverLabels(rows);
        const headers = [
            'Title',
            'Description',
            'Type (Category)',
            'Priority',
            'Status',
            'Resolved',
            'Created By',
            'Assigned To',
            'Resolved By',
            'Created At',
            'Updated At',
            'Machine',
            'Area',
            'Source',
        ];
        const dataRows = rows.map((t) => [
            t.title,
            t.description ?? '',
            t.category,
            t.priority,
            t.status,
            this.isResolved(t.status) ? 'Yes' : 'No',
            this.userLabel(t.createdBy),
            this.userLabel(t.assignedTo),
            resolverByTicket.get(t.id) ?? '',
            t.createdAt?.toISOString() ?? '',
            t.updatedAt?.toISOString() ?? '',
            t.machine ?? '',
            t.area ?? '',
            t.source ?? '',
        ]);
        const filename = this.buildFilename(query, format);
        if (format === 'csv') {
            const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
            const lines = [headers.map(esc).join(',')];
            for (const r of dataRows) {
                lines.push(r.map((c) => esc(String(c))).join(','));
            }
            const buf = Buffer.from(lines.join('\n'), 'utf8');
            return new common_1.StreamableFile(buf, {
                type: 'text/csv; charset=utf-8',
                disposition: this.dispositionFilename(filename),
            });
        }
        const workbook = new exceljs_1.default.Workbook();
        const sheet = workbook.addWorksheet('Tickets');
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2563EB' },
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        for (const r of dataRows) {
            sheet.addRow(r);
        }
        const colCount = headers.length;
        for (let c = 1; c <= colCount; c++) {
            let max = 12;
            for (let r = 1; r <= sheet.rowCount; r++) {
                const v = sheet.getRow(r).getCell(c).value;
                const len = v != null ? String(v).length : 0;
                if (len > max)
                    max = Math.min(len, 55);
            }
            sheet.getColumn(c).width = max + 2;
        }
        const buf = Buffer.from(await workbook.xlsx.writeBuffer());
        return new common_1.StreamableFile(buf, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            disposition: this.dispositionFilename(filename),
        });
    }
};
exports.TicketExportService = TicketExportService;
exports.TicketExportService = TicketExportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ticket_entity_1.Ticket)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TicketExportService);
//# sourceMappingURL=ticket-export.service.js.map