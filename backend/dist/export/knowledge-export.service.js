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
exports.KnowledgeExportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const knowledge_entry_entity_1 = require("../knowledge/entities/knowledge-entry.entity");
const knowledge_document_entity_1 = require("../knowledge-documents/entities/knowledge-document.entity");
const machine_profile_entity_1 = require("../machine-profiles/entities/machine-profile.entity");
const exceljs_1 = __importDefault(require("exceljs"));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let KnowledgeExportService = class KnowledgeExportService {
    constructor(knowledgeEntryRepository, knowledgeDocumentRepository, machineProfileRepository) {
        this.knowledgeEntryRepository = knowledgeEntryRepository;
        this.knowledgeDocumentRepository = knowledgeDocumentRepository;
        this.machineProfileRepository = machineProfileRepository;
    }
    getProblemsSolutionsExportReference() {
        return {
            checkedAt: new Date().toISOString(),
            responsibility: 'KnowledgeExportService.exportProblemsSolutions — GET /export/problems-solutions',
            dataSource: 'knowledge_entries (approved or legacy null reviewStatus)',
            reviewFilter: "k.reviewStatus = 'approved' OR k.reviewStatus IS NULL",
            queryParams: [
                { name: 'format', type: 'xlsx | csv', notes: 'default xlsx' },
                { name: 'machine', type: 'string', notes: 'LIKE match on k.machineName (case-insensitive)' },
                { name: 'documentId', type: 'UUID', notes: 'Exact match on k.knowledgeDocumentId (PDF-backed rows after 23 migration)' },
                { name: 'severity', type: 'string', notes: 'Exact match on k.severity (case-insensitive)' },
                { name: 'from', type: 'ISO date', notes: 'With to: Between(createdAt); alone: createdAt >= from' },
                { name: 'to', type: 'ISO date', notes: 'With from: Between; alone: createdAt <= end of that calendar day (UTC)' },
            ],
            columns: [
                'Machine Name',
                'Manufacturer',
                'Error Code',
                'Problem',
                'Symptom',
                'Cause',
                'Solution',
                'Correction Steps',
                'Severity',
                'Source Document',
                'Page(s)',
                'Language',
                'Extracted Date',
            ],
            adminUi: '/dashboard/admin/problems-solutions-export',
            notes: [
                'Rows promoted before knowledgeDocumentId existed export with empty Source PDF unless source string was set manually.',
                'Manufacturer / PDF title filled when knowledgeDocumentId resolves to knowledge_documents (+ optional machine_profiles).',
                'Technicians use GET /knowledge/export/csv|xlsx for raw column dump of their rows (different shape).',
            ],
        };
    }
    dispositionFilename(base) {
        const safe = base.replace(/[^\w.\-]+/g, '_').slice(0, 120);
        return `attachment; filename="${safe}"`;
    }
    buildFilename(query, format) {
        const stamp = new Date().toISOString().slice(0, 10);
        const machinePart = query.machine?.trim()
            ? query.machine.trim().replace(/[^\w\-]+/g, '_').slice(0, 40)
            : 'all';
        const docPart = query.documentId?.trim() && UUID_RE.test(query.documentId.trim()) ? '_doc' : '';
        return `problems-solutions_${machinePart}${docPart}_${stamp}.${format}`;
    }
    async exportProblemsSolutions(query) {
        const format = query.format === 'csv' ? 'csv' : 'xlsx';
        const qb = this.knowledgeEntryRepository
            .createQueryBuilder('k')
            .leftJoinAndSelect('k.createdBy', 'createdBy')
            .where('(k.reviewStatus = :ap OR k.reviewStatus IS NULL)', { ap: 'approved' });
        if (query.machine?.trim()) {
            qb.andWhere('LOWER(k.machineName) LIKE LOWER(:m)', { m: `%${query.machine.trim()}%` });
        }
        if (query.severity?.trim()) {
            qb.andWhere('LOWER(k.severity) = LOWER(:s)', { s: query.severity.trim() });
        }
        if (query.documentId?.trim() && UUID_RE.test(query.documentId.trim())) {
            qb.andWhere('k.knowledgeDocumentId = :docId', { docId: query.documentId.trim() });
        }
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
                qb.andWhere('k.createdAt >= :from', { from });
            }
        }
        else if (toRaw) {
            const to = new Date(toRaw);
            if (!Number.isNaN(+to)) {
                const end = new Date(to);
                end.setUTCHours(23, 59, 59, 999);
                qb.andWhere('k.createdAt <= :toEnd', { toEnd: end });
            }
        }
        const rows = await qb.orderBy('k.createdAt', 'DESC').getMany();
        const docIds = [...new Set(rows.map((r) => r.knowledgeDocumentId).filter(Boolean))];
        const docMeta = new Map();
        const profileMeta = new Map();
        if (docIds.length > 0) {
            const docs = await this.knowledgeDocumentRepository.find({
                where: { id: (0, typeorm_2.In)(docIds) },
                select: ['id', 'originalName', 'machineProfileId'],
            });
            for (const d of docs) {
                docMeta.set(d.id, { originalName: d.originalName, machineProfileId: d.machineProfileId });
            }
            const profileIds = [...new Set(docs.map((d) => d.machineProfileId).filter(Boolean))];
            if (profileIds.length > 0) {
                const profiles = await this.machineProfileRepository.find({
                    where: { id: (0, typeorm_2.In)(profileIds) },
                    select: ['id', 'manufacturer'],
                });
                for (const p of profiles) {
                    profileMeta.set(p.id, { manufacturer: p.manufacturer ?? null });
                }
            }
        }
        const headers = [
            'Machine Name',
            'Manufacturer',
            'Error Code',
            'Problem',
            'Symptom',
            'Cause',
            'Solution',
            'Correction Steps',
            'Severity',
            'Source Document',
            'Page(s)',
            'Language',
            'Extracted Date',
        ];
        const sourceDocumentLabel = (k) => {
            const src = (k.source ?? '').toLowerCase();
            if (src === 'field_experience' || src === 'technician' || src === 'experience') {
                const name = k.createdBy?.fullName?.trim() ||
                    k.createdBy?.username?.trim() ||
                    k.createdBy?.email?.trim() ||
                    'Technician';
                return `Field experience — ${name}`;
            }
            const docId = k.knowledgeDocumentId;
            if (docId && docMeta.has(docId)) {
                return docMeta.get(docId).originalName;
            }
            return k.source ?? '';
        };
        const manufacturerFor = (k) => {
            const docId = k.knowledgeDocumentId;
            if (!docId || !docMeta.has(docId))
                return '';
            const mpId = docMeta.get(docId).machineProfileId;
            if (!mpId || !profileMeta.has(mpId))
                return '';
            return profileMeta.get(mpId).manufacturer ?? '';
        };
        const dataRows = rows.map((k) => [
            k.machineName ?? '',
            manufacturerFor(k),
            '',
            k.problemDescription,
            k.symptom ?? '',
            k.rootCause ?? '',
            k.solution,
            '',
            k.severity ?? '',
            sourceDocumentLabel(k),
            '',
            '',
            k.createdAt?.toISOString() ?? '',
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
        const sheet = workbook.addWorksheet('Problems & Solutions');
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF00B8D4' },
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
    async previewProblemsSolutions(query) {
        const parsed = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || ''), 10);
        const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(500, parsed)) : 150;
        const qb = this.knowledgeEntryRepository
            .createQueryBuilder('k')
            .leftJoinAndSelect('k.createdBy', 'createdBy')
            .where('(k.reviewStatus = :ap OR k.reviewStatus IS NULL)', { ap: 'approved' });
        if (query.machine?.trim()) {
            qb.andWhere('LOWER(k.machineName) LIKE LOWER(:m)', { m: `%${query.machine.trim()}%` });
        }
        if (query.severity?.trim()) {
            qb.andWhere('LOWER(k.severity) = LOWER(:s)', { s: query.severity.trim() });
        }
        if (query.documentId?.trim() && UUID_RE.test(query.documentId.trim())) {
            qb.andWhere('k.knowledgeDocumentId = :docId', { docId: query.documentId.trim() });
        }
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
                qb.andWhere('k.createdAt >= :from', { from });
            }
        }
        else if (toRaw) {
            const to = new Date(toRaw);
            if (!Number.isNaN(+to)) {
                const end = new Date(to);
                end.setUTCHours(23, 59, 59, 999);
                qb.andWhere('k.createdAt <= :toEnd', { toEnd: end });
            }
        }
        const rows = await qb.orderBy('k.createdAt', 'DESC').limit(limit).getMany();
        const docIds = [...new Set(rows.map((r) => r.knowledgeDocumentId).filter(Boolean))];
        const docMeta = new Map();
        const profileMeta = new Map();
        if (docIds.length > 0) {
            const docs = await this.knowledgeDocumentRepository.find({
                where: { id: (0, typeorm_2.In)(docIds) },
                select: ['id', 'originalName', 'machineProfileId'],
            });
            for (const d of docs) {
                docMeta.set(d.id, { originalName: d.originalName, machineProfileId: d.machineProfileId });
            }
            const profileIds = [...new Set(docs.map((d) => d.machineProfileId).filter(Boolean))];
            if (profileIds.length > 0) {
                const profiles = await this.machineProfileRepository.find({
                    where: { id: (0, typeorm_2.In)(profileIds) },
                    select: ['id', 'manufacturer'],
                });
                for (const p of profiles) {
                    profileMeta.set(p.id, { manufacturer: p.manufacturer ?? null });
                }
            }
        }
        const sourceDocumentLabel = (k) => {
            const src = (k.source ?? '').toLowerCase();
            if (src === 'field_experience' || src === 'technician' || src === 'experience') {
                const name = k.createdBy?.fullName?.trim() ||
                    k.createdBy?.username?.trim() ||
                    k.createdBy?.email?.trim() ||
                    'Technician';
                return `Field experience — ${name}`;
            }
            const docId = k.knowledgeDocumentId;
            if (docId && docMeta.has(docId)) {
                return docMeta.get(docId).originalName;
            }
            return k.source ?? '';
        };
        const manufacturerFor = (k) => {
            const docId = k.knowledgeDocumentId;
            if (!docId || !docMeta.has(docId))
                return '';
            const mpId = docMeta.get(docId).machineProfileId;
            if (!mpId || !profileMeta.has(mpId))
                return '';
            return profileMeta.get(mpId).manufacturer ?? '';
        };
        return {
            count: rows.length,
            rows: rows.map((k) => ({
                id: k.id,
                title: k.title ?? '',
                problemDescription: k.problemDescription ?? '',
                solution: k.solution ?? '',
                machineName: k.machineName ?? '',
                severity: k.severity ?? '',
                sourceDocument: sourceDocumentLabel(k),
                manufacturer: manufacturerFor(k),
                createdAt: k.createdAt?.toISOString() ?? '',
                knowledgeDocumentId: k.knowledgeDocumentId ?? null,
            })),
        };
    }
};
exports.KnowledgeExportService = KnowledgeExportService;
exports.KnowledgeExportService = KnowledgeExportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(knowledge_entry_entity_1.KnowledgeEntry)),
    __param(1, (0, typeorm_1.InjectRepository)(knowledge_document_entity_1.KnowledgeDocument)),
    __param(2, (0, typeorm_1.InjectRepository)(machine_profile_entity_1.MachineProfile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], KnowledgeExportService);
//# sourceMappingURL=knowledge-export.service.js.map