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
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const knowledge_document_entity_1 = require("../knowledge-documents/entities/knowledge-document.entity");
const knowledge_document_job_entity_1 = require("../knowledge-documents/entities/knowledge-document-job.entity");
const ticket_entity_1 = require("./entities/ticket.entity");
const attachment_entity_1 = require("./entities/attachment.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const user_entity_1 = require("../users/entities/user.entity");
let TicketsService = class TicketsService {
    constructor(ticketsRepository, attachmentsRepository, auditLogRepository, knowledgeDocumentRepository, knowledgeDocumentJobRepository, userRepository) {
        this.ticketsRepository = ticketsRepository;
        this.attachmentsRepository = attachmentsRepository;
        this.auditLogRepository = auditLogRepository;
        this.knowledgeDocumentRepository = knowledgeDocumentRepository;
        this.knowledgeDocumentJobRepository = knowledgeDocumentJobRepository;
        this.userRepository = userRepository;
    }
    async create(createTicketDto, userId) {
        const ticket = this.ticketsRepository.create({
            ...createTicketDto,
            createdById: userId,
        });
        const saved = await this.ticketsRepository.save(ticket);
        await this.logTicketAction(saved.id, audit_log_entity_1.ActionType.CREATE, userId, {
            title: saved.title,
            status: saved.status,
            priority: saved.priority,
        });
        return saved;
    }
    async findAll(userId, userRole, filters) {
        const queryBuilder = this.ticketsRepository
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.createdBy', 'createdBy')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.attachments', 'attachments');
        queryBuilder.where('ticket.isDeleted = false');
        if (userRole === user_entity_1.UserRole.WORKER) {
            queryBuilder.andWhere('ticket.createdById = :userId', { userId });
        }
        else if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            if (filters?.unassignedOnly) {
                queryBuilder.andWhere('ticket.assignedToId IS NULL');
            }
            else {
                queryBuilder.andWhere('ticket.assignedToId = :userId', { userId });
            }
        }
        else if (filters?.assignedToId) {
            queryBuilder.andWhere('ticket.assignedToId = :assignedToId', {
                assignedToId: filters.assignedToId,
            });
        }
        if (filters?.status) {
            queryBuilder.andWhere('ticket.status = :status', { status: filters.status });
        }
        if (filters?.category) {
            queryBuilder.andWhere('ticket.category = :category', { category: filters.category });
        }
        if (filters?.priority) {
            queryBuilder.andWhere('ticket.priority = :priority', { priority: filters.priority });
        }
        queryBuilder.orderBy('ticket.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findByTitleForRole(userId, userRole, title, limit = 5) {
        const q = (title ?? '').trim();
        if (!q)
            return [];
        const exactQb = this.ticketsRepository
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket.isDeleted = false');
        if (userRole === user_entity_1.UserRole.WORKER) {
            exactQb.andWhere('ticket.createdById = :userId', { userId });
        }
        else if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            exactQb.andWhere('ticket.assignedToId = :userId', { userId });
        }
        exactQb
            .andWhere('LOWER(ticket.title) = LOWER(:title)', { title: q })
            .orderBy('ticket.createdAt', 'DESC')
            .take(limit);
        const exact = await exactQb.getMany();
        if (exact.length > 0)
            return exact;
        const likeQb = this.ticketsRepository
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket.isDeleted = false');
        if (userRole === user_entity_1.UserRole.WORKER) {
            likeQb.andWhere('ticket.createdById = :userId', { userId });
        }
        else if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            likeQb.andWhere('ticket.assignedToId = :userId', { userId });
        }
        likeQb
            .andWhere('LOWER(ticket.title) LIKE LOWER(:titleLike)', { titleLike: `%${q}%` })
            .orderBy('ticket.createdAt', 'DESC')
            .take(limit);
        return likeQb.getMany();
    }
    async searchAccessibleTickets(userId, userRole, query, limit = 5) {
        const q = (query ?? '').trim();
        if (!q)
            return [];
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRe.test(q)) {
            try {
                const one = await this.findOne(q, userId, userRole);
                return one ? [one] : [];
            }
            catch {
                return [];
            }
        }
        const safeQ = q.replace(/[%_]/g, ' ').trim();
        if (!safeQ)
            return [];
        const like = `%${safeQ}%`;
        const qb = this.ticketsRepository
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.createdBy', 'createdBy')
            .where('ticket.isDeleted = false');
        if (userRole === user_entity_1.UserRole.WORKER) {
            qb.andWhere('ticket.createdById = :userId', { userId });
        }
        else if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            qb.andWhere('ticket.assignedToId = :userId', { userId });
        }
        qb.andWhere('(LOWER(ticket.title) LIKE LOWER(:like) OR LOWER(ticket.description) LIKE LOWER(:like) OR CAST(ticket.id AS text) LIKE :like)', { like })
            .orderBy('ticket.createdAt', 'DESC')
            .take(Math.min(10, limit));
        return qb.getMany();
    }
    async findOne(id, userId, userRole) {
        const ticket = await this.ticketsRepository.findOne({
            where: { id, isDeleted: false },
            relations: ['createdBy', 'assignedTo', 'conversations', 'attachments'],
        });
        if (!ticket) {
            throw new common_1.NotFoundException('Ticket not found');
        }
        if (userRole === user_entity_1.UserRole.WORKER &&
            ticket.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only view your own tickets');
        }
        if (userRole === user_entity_1.UserRole.TECHNICIAN &&
            ticket.createdById !== userId &&
            ticket.assignedToId !== userId &&
            !!ticket.assignedToId) {
            throw new common_1.ForbiddenException('You can only view assigned tickets');
        }
        return ticket;
    }
    async update(id, updateTicketDto, userId, userRole) {
        const ticket = await this.findOne(id, userId, userRole);
        if (userRole === user_entity_1.UserRole.WORKER) {
            if (ticket.createdById !== userId) {
                throw new common_1.ForbiddenException('You can only update your own tickets');
            }
            if (ticket.status !== ticket_entity_1.TicketStatus.OPEN && updateTicketDto.status) {
                throw new common_1.ForbiddenException('You can only update open tickets');
            }
        }
        if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            if (ticket.assignedToId !== userId &&
                ticket.createdById !== userId &&
                updateTicketDto.status) {
                throw new common_1.ForbiddenException('You can only update assigned tickets');
            }
        }
        Object.assign(ticket, updateTicketDto);
        const before = {
            status: ticket.status,
            priority: ticket.priority,
            assignedToId: ticket.assignedToId,
        };
        Object.assign(ticket, updateTicketDto);
        const saved = await this.ticketsRepository.save(ticket);
        const changes = {};
        if (updateTicketDto.status && updateTicketDto.status !== before.status) {
            changes.status = { from: before.status, to: updateTicketDto.status };
        }
        if (updateTicketDto.priority && updateTicketDto.priority !== before.priority) {
            changes.priority = { from: before.priority, to: updateTicketDto.priority };
        }
        if (typeof updateTicketDto['assignedToId'] !== 'undefined' &&
            updateTicketDto['assignedToId'] !== before.assignedToId) {
            changes.assignedToId = { from: before.assignedToId, to: updateTicketDto['assignedToId'] };
        }
        if (Object.keys(changes).length > 0) {
            await this.logTicketAction(id, audit_log_entity_1.ActionType.UPDATE, userId, changes);
        }
        return saved;
    }
    async remove(id, userId, userRole) {
        const ticket = await this.ticketsRepository.findOne({
            where: { id },
            relations: ['attachments'],
        });
        if (!ticket) {
            throw new common_1.NotFoundException('Ticket not found');
        }
        const canDeleteAsAdmin = userRole === user_entity_1.UserRole.ADMIN || userRole === user_entity_1.UserRole.SUPERADMIN;
        const canDeleteAsWorker = userRole === user_entity_1.UserRole.WORKER && ticket.createdById === userId;
        if (!canDeleteAsAdmin && !canDeleteAsWorker) {
            throw new common_1.ForbiddenException('You do not have permission to delete this ticket');
        }
        const attachments = await this.attachmentsRepository.find({ where: { ticketId: id } });
        ticket.isDeleted = true;
        ticket.deletedAt = new Date();
        await this.ticketsRepository.save(ticket);
        await this.logTicketAction(id, audit_log_entity_1.ActionType.DELETE, userId, {
            deletedSnapshot: {
                ticket: {
                    id: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    category: ticket.category,
                    priority: ticket.priority,
                    status: ticket.status,
                    subcategory: ticket.subcategory,
                    machine: ticket.machine,
                    area: ticket.area,
                    source: ticket.source,
                    createdById: ticket.createdById,
                    assignedToId: ticket.assignedToId,
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                },
                attachments: attachments.map((a) => ({
                    fileName: a.fileName,
                    filePath: a.filePath,
                    fileSize: a.fileSize,
                    mimeType: a.mimeType,
                    uploadedById: a.uploadedById,
                    uploadedAt: a.uploadedAt,
                })),
            },
        });
    }
    async assignTicket(ticketId, technicianId, userId, userRole) {
        if (userRole !== user_entity_1.UserRole.ADMIN && userRole !== user_entity_1.UserRole.SUPERADMIN) {
            throw new common_1.ForbiddenException('Only admins can assign tickets');
        }
        const ticket = await this.findOne(ticketId, userId, userRole);
        ticket.assignedToId = technicianId;
        ticket.status = ticket_entity_1.TicketStatus.IN_PROGRESS;
        ticket.assignmentRequestStatus = ticket_entity_1.AssignmentRequestStatus.NONE;
        ticket.assignmentRequestedById = null;
        ticket.assignmentRequestNote = null;
        ticket.assignmentRequestedAt = null;
        ticket.assignmentReviewedById = userId;
        ticket.assignmentReviewedAt = new Date();
        const saved = await this.ticketsRepository.save(ticket);
        await this.logTicketAction(ticketId, audit_log_entity_1.ActionType.UPDATE, userId, {
            assignedToId: { to: technicianId },
            status: { to: ticket_entity_1.TicketStatus.IN_PROGRESS },
        });
        return saved;
    }
    async requestSelfAssign(ticketId, userId, userRole, note) {
        if (userRole !== user_entity_1.UserRole.TECHNICIAN) {
            throw new common_1.ForbiddenException('Only technicians can request self-assignment');
        }
        const ticket = await this.findOne(ticketId, userId, userRole);
        if (ticket.assignedToId === userId) {
            return ticket;
        }
        if (ticket.assignedToId && ticket.assignedToId !== userId) {
            throw new common_1.ForbiddenException('This ticket is already assigned to another technician');
        }
        if (ticket.assignmentRequestStatus === ticket_entity_1.AssignmentRequestStatus.PENDING) {
            throw new common_1.ForbiddenException('A request is already pending for this ticket');
        }
        ticket.assignmentRequestedById = userId;
        ticket.assignmentRequestStatus = ticket_entity_1.AssignmentRequestStatus.PENDING;
        ticket.assignmentRequestNote = note?.trim() || null;
        ticket.assignmentRequestedAt = new Date();
        ticket.assignmentReviewedById = null;
        ticket.assignmentReviewedAt = null;
        const saved = await this.ticketsRepository.save(ticket);
        await this.logTicketAction(ticketId, audit_log_entity_1.ActionType.UPDATE, userId, {
            assignmentRequest: {
                event: 'self_assign_requested',
                requestedById: userId,
                note: ticket.assignmentRequestNote,
            },
        });
        return saved;
    }
    async reviewSelfAssignRequest(ticketId, approve, userId, userRole, reason) {
        if (userRole !== user_entity_1.UserRole.ADMIN && userRole !== user_entity_1.UserRole.SUPERADMIN) {
            throw new common_1.ForbiddenException('Only admin or superadmin can review assignment requests');
        }
        const ticket = await this.findOne(ticketId, userId, userRole);
        if (ticket.assignmentRequestStatus !== ticket_entity_1.AssignmentRequestStatus.PENDING || !ticket.assignmentRequestedById) {
            throw new common_1.ForbiddenException('No pending assignment request for this ticket');
        }
        const requestedById = ticket.assignmentRequestedById;
        ticket.assignmentReviewedById = userId;
        ticket.assignmentReviewedAt = new Date();
        if (approve) {
            ticket.assignedToId = requestedById;
            ticket.status = ticket_entity_1.TicketStatus.IN_PROGRESS;
            ticket.assignmentRequestStatus = ticket_entity_1.AssignmentRequestStatus.APPROVED;
            ticket.assignmentRequestNote = null;
            ticket.assignmentRequestedById = null;
            ticket.assignmentRequestedAt = null;
        }
        else {
            ticket.assignmentRequestStatus = ticket_entity_1.AssignmentRequestStatus.REJECTED;
            ticket.assignmentRequestNote = reason?.trim() || null;
            ticket.assignmentRequestedById = null;
            ticket.assignmentRequestedAt = null;
        }
        const saved = await this.ticketsRepository.save(ticket);
        await this.logTicketAction(ticketId, audit_log_entity_1.ActionType.UPDATE, userId, {
            assignmentRequest: {
                event: approve ? 'self_assign_approved' : 'self_assign_rejected',
                requestedById,
                reason: reason?.trim() || null,
            },
            ...(approve
                ? {
                    assignedToId: { to: requestedById },
                    status: { to: ticket_entity_1.TicketStatus.IN_PROGRESS },
                }
                : {}),
        });
        return saved;
    }
    async addAttachments(ticketId, files, userId, userRole) {
        const ticket = await this.findOne(ticketId, userId, userRole);
        if (!files || files.length === 0) {
            return [];
        }
        const attachments = files.map((file) => this.attachmentsRepository.create({
            ticketId: ticket.id,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: userId,
        }));
        const saved = await this.attachmentsRepository.save(attachments);
        await this.logTicketAction(ticket.id, audit_log_entity_1.ActionType.UPDATE, userId, {
            attachmentsAdded: saved.map((a) => a.fileName),
        });
        return saved;
    }
    async restore(id, userId, userRole) {
        if (userRole !== user_entity_1.UserRole.ADMIN && userRole !== user_entity_1.UserRole.SUPERADMIN) {
            throw new common_1.ForbiddenException('Only admin or superadmin can restore tickets');
        }
        const existing = await this.ticketsRepository.findOne({
            where: { id },
            relations: ['attachments'],
        });
        if (existing) {
            if (existing.isDeleted) {
                existing.isDeleted = false;
                existing.deletedAt = null;
                const saved = await this.ticketsRepository.save(existing);
                await this.logTicketAction(id, audit_log_entity_1.ActionType.ROLLBACK, userId, {
                    restoredFromDelete: true,
                });
                return saved;
            }
            return existing;
        }
        const log = await this.auditLogRepository.findOne({
            where: { entityId: id, entityType: 'ticket', actionType: audit_log_entity_1.ActionType.DELETE },
            order: { timestamp: 'DESC' },
        });
        const snapshot = log?.changes?.deletedSnapshot;
        if (!snapshot?.ticket) {
            throw new common_1.NotFoundException('No restore information found for this ticket');
        }
        const ticketSnapshot = snapshot.ticket;
        const attachmentSnapshots = snapshot.attachments || [];
        const restoredTicket = this.ticketsRepository.create(ticketSnapshot);
        const savedTicket = await this.ticketsRepository.save(restoredTicket);
        if (attachmentSnapshots.length > 0) {
            const restoredAttachments = attachmentSnapshots.map((a) => this.attachmentsRepository.create({
                ticketId: savedTicket.id,
                fileName: a.fileName,
                filePath: a.filePath,
                fileSize: a.fileSize,
                mimeType: a.mimeType,
                uploadedById: a.uploadedById,
                uploadedAt: a.uploadedAt,
            }));
            await this.attachmentsRepository.save(restoredAttachments);
        }
        await this.logTicketAction(id, audit_log_entity_1.ActionType.ROLLBACK, userId, {
            restoredFromDelete: true,
        });
        return savedTicket;
    }
    async getHistory(ticketId, limit = 50, includeErrors = true) {
        const effectiveLimit = Math.min(Math.max(limit, 1), 500);
        const qb = this.auditLogRepository
            .createQueryBuilder('log')
            .orderBy('log.timestamp', 'DESC')
            .take(Math.min(effectiveLimit * 2, 400));
        if (ticketId) {
            qb.where('log.entityType = :type', { type: 'ticket' }).andWhere('log.entityId = :ticketId', { ticketId });
            const rows = await qb.take(effectiveLimit).getMany();
            return this.enrichActivityLogs(rows);
        }
        const mainTypes = [
            'ticket',
            'user',
            'knowledge_document',
            'knowledge_entry',
            'reference_data',
        ];
        const reviewTypes = ['knowledge_extraction_candidate', 'machine_name_suggestion'];
        const fetchPool = Math.min(effectiveLimit * 4, 2000);
        qb.where('log.entityType IN (:...types)', { types: mainTypes }).take(fetchPool);
        const [mainLogs, reviewLogs] = await Promise.all([
            qb.getMany(),
            this.auditLogRepository.find({
                where: { entityType: (0, typeorm_2.In)(reviewTypes) },
                order: { timestamp: 'DESC' },
                take: Math.min(250, fetchPool),
            }),
        ]);
        const byId = new Map();
        for (const row of [...mainLogs, ...reviewLogs]) {
            byId.set(row.id, row);
        }
        const logs = [...byId.values()].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        let merged = logs;
        if (includeErrors) {
            const pipelineErrors = await this.buildPipelineErrorEntries(logs, 40);
            merged = [...logs, ...pipelineErrors].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return this.enrichActivityLogs(merged.slice(0, effectiveLimit));
    }
    resolvePerformerId(log) {
        const ch = log.changes;
        if (ch && typeof ch.reviewedById === 'string')
            return ch.reviewedById;
        return log.userId ?? null;
    }
    async enrichActivityLogs(logs) {
        const performerIds = [
            ...new Set(logs.map((l) => this.resolvePerformerId(l)).filter((id) => !!id)),
        ];
        const users = performerIds.length > 0
            ? await this.userRepository.find({
                where: { id: (0, typeorm_2.In)(performerIds) },
                select: ['id', 'fullName', 'email'],
            })
            : [];
        const byId = new Map(users.map((u) => [u.id, u]));
        return logs.map((log) => {
            const pid = this.resolvePerformerId(log);
            const user = pid ? byId.get(pid) : undefined;
            return {
                ...log,
                performedBy: user
                    ? { id: user.id, fullName: user.fullName ?? null, email: user.email }
                    : null,
            };
        });
    }
    async buildPipelineErrorEntries(existingLogs, take) {
        const entries = [];
        const rejectDocIds = new Set(existingLogs
            .filter((l) => l.entityType === 'knowledge_document' && l.actionType === audit_log_entity_1.ActionType.REJECT)
            .map((l) => l.entityId));
        const failedDocs = await this.knowledgeDocumentRepository.find({
            where: { status: (0, typeorm_2.In)(['failed']) },
            order: { updatedAt: 'DESC' },
            take,
        });
        for (const doc of failedDocs) {
            if (!doc.error?.trim())
                continue;
            entries.push({
                id: `pipeline-doc-${doc.id}`,
                actionType: 'error',
                entityType: 'pipeline_error',
                entityId: doc.id,
                userId: null,
                changes: {
                    documentOriginalName: doc.originalName,
                    status: doc.status,
                    error: doc.error,
                    source: 'knowledge_document',
                },
                reason: doc.error,
                timestamp: doc.updatedAt,
            });
        }
        const partialDocs = await this.knowledgeDocumentRepository.find({
            where: { status: 'partially_indexed' },
            order: { updatedAt: 'DESC' },
            take: Math.max(10, Math.floor(take / 2)),
        });
        for (const doc of partialDocs) {
            if (!doc.error?.trim() || rejectDocIds.has(doc.id))
                continue;
            entries.push({
                id: `pipeline-partial-${doc.id}`,
                actionType: 'error',
                entityType: 'pipeline_error',
                entityId: doc.id,
                userId: null,
                changes: {
                    documentOriginalName: doc.originalName,
                    status: doc.status,
                    error: doc.error,
                    source: 'knowledge_document',
                },
                reason: doc.error,
                timestamp: doc.updatedAt,
            });
        }
        const failedJobs = await this.knowledgeDocumentJobRepository.find({
            where: { status: 'failed' },
            order: { updatedAt: 'DESC' },
            take: Math.max(15, Math.floor(take / 2)),
        });
        for (const job of failedJobs) {
            if (!job.error?.trim())
                continue;
            const doc = await this.knowledgeDocumentRepository.findOne({
                where: { id: job.documentId },
                select: ['id', 'originalName'],
            });
            entries.push({
                id: `pipeline-job-${job.id}`,
                actionType: 'error',
                entityType: 'pipeline_error',
                entityId: job.documentId,
                userId: null,
                changes: {
                    documentOriginalName: doc?.originalName ?? 'PDF document',
                    jobType: job.jobType,
                    queueName: job.queueName,
                    error: job.error,
                    source: 'knowledge_document_job',
                },
                reason: job.error,
                timestamp: job.updatedAt,
            });
        }
        return entries;
    }
    async getNotificationsForUser(userId, userRole, limit = 50) {
        let tickets = [];
        if (userRole === user_entity_1.UserRole.WORKER) {
            tickets = await this.ticketsRepository.find({
                where: { createdById: userId, isDeleted: false },
                select: ['id', 'title'],
            });
        }
        else if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            tickets = await this.ticketsRepository.find({
                where: { assignedToId: userId, isDeleted: false },
                select: ['id', 'title'],
            });
        }
        else {
            return [];
        }
        const idToTitle = new Map();
        const ticketIds = tickets.map((t) => {
            idToTitle.set(t.id, t.title);
            return t.id;
        });
        let ticketMapped = [];
        if (ticketIds.length > 0) {
            const ticketLogs = await this.auditLogRepository
                .createQueryBuilder('log')
                .where('log.entityType = :type', { type: 'ticket' })
                .andWhere('log.entityId IN (:...ids)', { ids: ticketIds })
                .orderBy('log.timestamp', 'DESC')
                .take(limit)
                .getMany();
            ticketMapped = ticketLogs.map((log) => ({
                ...log,
                ticketTitle: idToTitle.get(log.entityId),
            }));
        }
        let withMachineTitles = [];
        if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            const machineNameLogs = await this.auditLogRepository
                .createQueryBuilder('log')
                .where('log.entityType = :t', { t: 'machine_name_suggestion' })
                .andWhere("log.changes->>'forUserId' = :userId", { userId })
                .orderBy('log.timestamp', 'DESC')
                .take(limit)
                .getMany();
            withMachineTitles = machineNameLogs.map((log) => {
                const ch = log.changes;
                const docName = ch && typeof ch.documentOriginalName === 'string'
                    ? ch.documentOriginalName
                    : undefined;
                return {
                    ...log,
                    ticketTitle: docName,
                };
            });
        }
        const knowledgeReviewLogs = await this.auditLogRepository
            .createQueryBuilder('log')
            .where('log.entityType = :t', { t: 'knowledge_entry' })
            .andWhere("log.changes->>'forUserId' = :userId", { userId })
            .orderBy('log.timestamp', 'DESC')
            .take(limit)
            .getMany();
        const withKnowledgeTitles = knowledgeReviewLogs.map((log) => {
            const ch = log.changes;
            const title = ch && typeof ch.title === 'string' ? ch.title : undefined;
            return {
                ...log,
                ticketTitle: title,
            };
        });
        const merged = [...ticketMapped, ...withMachineTitles, ...withKnowledgeTitles].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return merged.slice(0, limit);
    }
    async logTicketAction(ticketId, actionType, userId, changes) {
        const log = this.auditLogRepository.create({
            actionType,
            entityId: ticketId,
            entityType: 'ticket',
            userId: userId ?? null,
            changes: changes ?? null,
            reason: null,
        });
        await this.auditLogRepository.save(log);
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ticket_entity_1.Ticket)),
    __param(1, (0, typeorm_1.InjectRepository)(attachment_entity_1.Attachment)),
    __param(2, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __param(3, (0, typeorm_1.InjectRepository)(knowledge_document_entity_1.KnowledgeDocument)),
    __param(4, (0, typeorm_1.InjectRepository)(knowledge_document_job_entity_1.KnowledgeDocumentJob)),
    __param(5, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map