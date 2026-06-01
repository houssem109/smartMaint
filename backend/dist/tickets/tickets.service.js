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
const ticket_entity_1 = require("./entities/ticket.entity");
const attachment_entity_1 = require("./entities/attachment.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const user_entity_1 = require("../users/entities/user.entity");
let TicketsService = class TicketsService {
    constructor(ticketsRepository, attachmentsRepository, auditLogRepository) {
        this.ticketsRepository = ticketsRepository;
        this.attachmentsRepository = attachmentsRepository;
        this.auditLogRepository = auditLogRepository;
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
        if (userRole === user_entity_1.UserRole.WORKER) {
            queryBuilder.where('ticket.createdById = :userId', { userId }).andWhere('ticket.isDeleted = false');
        }
        else {
            queryBuilder.where('ticket.isDeleted = false');
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
        if (filters?.assignedToId) {
            queryBuilder.andWhere('ticket.assignedToId = :assignedToId', {
                assignedToId: filters.assignedToId,
            });
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
        likeQb
            .andWhere('LOWER(ticket.title) LIKE LOWER(:titleLike)', { titleLike: `%${q}%` })
            .orderBy('ticket.createdAt', 'DESC')
            .take(limit);
        return likeQb.getMany();
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
    async getHistory(ticketId, limit = 50) {
        const qb = this.auditLogRepository
            .createQueryBuilder('log')
            .orderBy('log.timestamp', 'DESC')
            .take(limit);
        if (ticketId) {
            qb.where('log.entityType = :type', { type: 'ticket' }).andWhere('log.entityId = :ticketId', { ticketId });
        }
        else {
            qb.where('log.entityType IN (:...types)', {
                types: ['ticket', 'user', 'knowledge_document', 'knowledge_entry'],
            });
        }
        return qb.getMany();
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map