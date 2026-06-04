import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { KnowledgeDocumentJob } from '../knowledge-documents/entities/knowledge-document-job.entity';
import { AssignmentRequestStatus, Ticket, TicketStatus } from './entities/ticket.entity';
import { Attachment } from './entities/attachment.entity';
import { AuditLog, ActionType } from '../common/entities/audit-log.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { User, UserRole } from '../users/entities/user.entity';

export type ActivityLogDto = AuditLog & {
  performedBy?: { id: string; fullName: string | null; email: string } | null;
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(KnowledgeDocument)
    private knowledgeDocumentRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeDocumentJob)
    private knowledgeDocumentJobRepository: Repository<KnowledgeDocumentJob>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createTicketDto: CreateTicketDto, userId: string): Promise<Ticket> {
    const ticket = this.ticketsRepository.create({
      ...createTicketDto,
      createdById: userId,
    });
    const saved = await this.ticketsRepository.save(ticket);

    await this.logTicketAction(saved.id, ActionType.CREATE, userId, {
      title: saved.title,
      status: saved.status,
      priority: saved.priority,
    });

    return saved;
  }

  async findAll(
    userId: string,
    userRole: UserRole,
    filters?: {
      status?: TicketStatus;
      category?: string;
      priority?: string;
      assignedToId?: string;
      unassignedOnly?: boolean;
    },
  ): Promise<Ticket[]> {
    const queryBuilder = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .leftJoinAndSelect('ticket.attachments', 'attachments');

    queryBuilder.where('ticket.isDeleted = false');

    if (userRole === UserRole.WORKER) {
      queryBuilder.andWhere('ticket.createdById = :userId', { userId });
    } else if (userRole === UserRole.TECHNICIAN) {
      if (filters?.unassignedOnly) {
        queryBuilder.andWhere('ticket.assignedToId IS NULL');
      } else {
        queryBuilder.andWhere('ticket.assignedToId = :userId', { userId });
      }
    } else if (filters?.assignedToId) {
      queryBuilder.andWhere('ticket.assignedToId = :assignedToId', {
        assignedToId: filters.assignedToId,
      });
    }

    // Apply filters
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

  async findByTitleForRole(
    userId: string,
    userRole: UserRole,
    title: string,
    limit = 5,
  ): Promise<Ticket[]> {
    const q = (title ?? '').trim();
    if (!q) return [];

    const exactQb = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.isDeleted = false');

    if (userRole === UserRole.WORKER) {
      exactQb.andWhere('ticket.createdById = :userId', { userId });
    } else if (userRole === UserRole.TECHNICIAN) {
      exactQb.andWhere('ticket.assignedToId = :userId', { userId });
    }

    exactQb
      .andWhere('LOWER(ticket.title) = LOWER(:title)', { title: q })
      .orderBy('ticket.createdAt', 'DESC')
      .take(limit);

    const exact = await exactQb.getMany();
    if (exact.length > 0) return exact;

    const likeQb = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.isDeleted = false');

    if (userRole === UserRole.WORKER) {
      likeQb.andWhere('ticket.createdById = :userId', { userId });
    } else if (userRole === UserRole.TECHNICIAN) {
      likeQb.andWhere('ticket.assignedToId = :userId', { userId });
    }

    likeQb
      .andWhere('LOWER(ticket.title) LIKE LOWER(:titleLike)', { titleLike: `%${q}%` })
      .orderBy('ticket.createdAt', 'DESC')
      .take(limit);

    return likeQb.getMany();
  }

  /** Search by title, description, or partial ID (role-scoped). */
  async searchAccessibleTickets(
    userId: string,
    userRole: UserRole,
    query: string,
    limit = 5,
  ): Promise<Ticket[]> {
    const q = (query ?? '').trim();
    if (!q) return [];

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(q)) {
      try {
        const one = await this.findOne(q, userId, userRole);
        return one ? [one] : [];
      } catch {
        return [];
      }
    }

    const safeQ = q.replace(/[%_]/g, ' ').trim();
    if (!safeQ) return [];
    const like = `%${safeQ}%`;

    const qb = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .where('ticket.isDeleted = false');

    if (userRole === UserRole.WORKER) {
      qb.andWhere('ticket.createdById = :userId', { userId });
    } else if (userRole === UserRole.TECHNICIAN) {
      qb.andWhere('ticket.assignedToId = :userId', { userId });
    }

    qb.andWhere(
      '(LOWER(ticket.title) LIKE LOWER(:like) OR LOWER(ticket.description) LIKE LOWER(:like) OR CAST(ticket.id AS text) LIKE :like)',
      { like },
    )
      .orderBy('ticket.createdAt', 'DESC')
      .take(Math.min(10, limit));

    return qb.getMany();
  }

  async findOne(id: string, userId: string, userRole: UserRole): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['createdBy', 'assignedTo', 'conversations', 'attachments'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check permissions
    if (
      userRole === UserRole.WORKER &&
      ticket.createdById !== userId
    ) {
      throw new ForbiddenException('You can only view your own tickets');
    }

    if (
      userRole === UserRole.TECHNICIAN &&
      ticket.createdById !== userId &&
      ticket.assignedToId !== userId &&
      !!ticket.assignedToId
    ) {
      throw new ForbiddenException('You can only view assigned tickets');
    }

    return ticket;
  }

  async update(
    id: string,
    updateTicketDto: UpdateTicketDto,
    userId: string,
    userRole: UserRole,
  ): Promise<Ticket> {
    const ticket = await this.findOne(id, userId, userRole);

    // Workers can only update their own tickets if status is OPEN
    if (userRole === UserRole.WORKER) {
      if (ticket.createdById !== userId) {
        throw new ForbiddenException('You can only update your own tickets');
      }
      if (ticket.status !== TicketStatus.OPEN && updateTicketDto.status) {
        throw new ForbiddenException('You can only update open tickets');
      }
    }

    // Technicians can update assigned tickets
    if (userRole === UserRole.TECHNICIAN) {
      if (
        ticket.assignedToId !== userId &&
        ticket.createdById !== userId &&
        updateTicketDto.status
      ) {
        throw new ForbiddenException('You can only update assigned tickets');
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

    const changes: Record<string, any> = {};
    if (updateTicketDto.status && updateTicketDto.status !== before.status) {
      changes.status = { from: before.status, to: updateTicketDto.status };
    }
    if (updateTicketDto.priority && updateTicketDto.priority !== before.priority) {
      changes.priority = { from: before.priority, to: updateTicketDto.priority };
    }
    if (
      typeof updateTicketDto['assignedToId'] !== 'undefined' &&
      updateTicketDto['assignedToId'] !== before.assignedToId
    ) {
      changes.assignedToId = { from: before.assignedToId, to: updateTicketDto['assignedToId'] };
    }

    if (Object.keys(changes).length > 0) {
      await this.logTicketAction(id, ActionType.UPDATE, userId, changes);
    }

    return saved;
  }

  async remove(id: string, userId: string, userRole: UserRole): Promise<void> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id },
      relations: ['attachments'],
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Admins and superadmins can delete any ticket
    // Workers can only delete their own tickets
    const canDeleteAsAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;
    const canDeleteAsWorker = userRole === UserRole.WORKER && ticket.createdById === userId;

    if (!canDeleteAsAdmin && !canDeleteAsWorker) {
      throw new ForbiddenException('You do not have permission to delete this ticket');
    }

    // Snapshot attachments for potential future hard-delete/restore
    const attachments = await this.attachmentsRepository.find({ where: { ticketId: id } });

    // Soft delete: move to "corbeille" instead of removing from DB
    ticket.isDeleted = true;
    ticket.deletedAt = new Date();
    await this.ticketsRepository.save(ticket);

    await this.logTicketAction(id, ActionType.DELETE, userId, {
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

  async assignTicket(
    ticketId: string,
    technicianId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Ticket> {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Only admins can assign tickets');
    }

    const ticket = await this.findOne(ticketId, userId, userRole);
    ticket.assignedToId = technicianId;
    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.assignmentRequestStatus = AssignmentRequestStatus.NONE;
    ticket.assignmentRequestedById = null as any;
    ticket.assignmentRequestNote = null as any;
    ticket.assignmentRequestedAt = null;
    ticket.assignmentReviewedById = userId;
    ticket.assignmentReviewedAt = new Date();

    const saved = await this.ticketsRepository.save(ticket);

    await this.logTicketAction(ticketId, ActionType.UPDATE, userId, {
      assignedToId: { to: technicianId },
      status: { to: TicketStatus.IN_PROGRESS },
    });

    return saved;
  }

  async requestSelfAssign(
    ticketId: string,
    userId: string,
    userRole: UserRole,
    note?: string,
  ): Promise<Ticket> {
    if (userRole !== UserRole.TECHNICIAN) {
      throw new ForbiddenException('Only technicians can request self-assignment');
    }
    const ticket = await this.findOne(ticketId, userId, userRole);

    if (ticket.assignedToId === userId) {
      return ticket;
    }
    if (ticket.assignedToId && ticket.assignedToId !== userId) {
      throw new ForbiddenException('This ticket is already assigned to another technician');
    }
    if (ticket.assignmentRequestStatus === AssignmentRequestStatus.PENDING) {
      throw new ForbiddenException('A request is already pending for this ticket');
    }

    ticket.assignmentRequestedById = userId;
    ticket.assignmentRequestStatus = AssignmentRequestStatus.PENDING;
    ticket.assignmentRequestNote = note?.trim() || null;
    ticket.assignmentRequestedAt = new Date();
    ticket.assignmentReviewedById = null as any;
    ticket.assignmentReviewedAt = null;

    const saved = await this.ticketsRepository.save(ticket);
    await this.logTicketAction(ticketId, ActionType.UPDATE, userId, {
      assignmentRequest: {
        event: 'self_assign_requested',
        requestedById: userId,
        note: ticket.assignmentRequestNote,
      },
    });
    return saved;
  }

  async reviewSelfAssignRequest(
    ticketId: string,
    approve: boolean,
    userId: string,
    userRole: UserRole,
    reason?: string,
  ): Promise<Ticket> {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Only admin or superadmin can review assignment requests');
    }
    const ticket = await this.findOne(ticketId, userId, userRole);
    if (ticket.assignmentRequestStatus !== AssignmentRequestStatus.PENDING || !ticket.assignmentRequestedById) {
      throw new ForbiddenException('No pending assignment request for this ticket');
    }

    const requestedById = ticket.assignmentRequestedById;
    ticket.assignmentReviewedById = userId;
    ticket.assignmentReviewedAt = new Date();

    if (approve) {
      ticket.assignedToId = requestedById;
      ticket.status = TicketStatus.IN_PROGRESS;
      ticket.assignmentRequestStatus = AssignmentRequestStatus.APPROVED;
      ticket.assignmentRequestNote = null as any;
      ticket.assignmentRequestedById = null as any;
      ticket.assignmentRequestedAt = null;
    } else {
      ticket.assignmentRequestStatus = AssignmentRequestStatus.REJECTED;
      ticket.assignmentRequestNote = reason?.trim() || null;
      ticket.assignmentRequestedById = null as any;
      ticket.assignmentRequestedAt = null;
    }

    const saved = await this.ticketsRepository.save(ticket);
    await this.logTicketAction(ticketId, ActionType.UPDATE, userId, {
      assignmentRequest: {
        event: approve ? 'self_assign_approved' : 'self_assign_rejected',
        requestedById,
        reason: reason?.trim() || null,
      },
      ...(approve
        ? {
            assignedToId: { to: requestedById },
            status: { to: TicketStatus.IN_PROGRESS },
          }
        : {}),
    });
    return saved;
  }

  async addAttachments(
    ticketId: string,
    files: Express.Multer.File[],
    userId: string,
    userRole: UserRole,
  ): Promise<Attachment[]> {
    // Reuse permission checks from findOne
    const ticket = await this.findOne(ticketId, userId, userRole);

    if (!files || files.length === 0) {
      return [];
    }

    const attachments = files.map((file) =>
      this.attachmentsRepository.create({
        ticketId: ticket.id,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      }),
    );

    const saved = await this.attachmentsRepository.save(attachments);

    await this.logTicketAction(ticket.id, ActionType.UPDATE, userId, {
      attachmentsAdded: saved.map((a) => a.fileName),
    });

    return saved;
  }

  async restore(id: string, userId: string, userRole: UserRole): Promise<Ticket> {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Only admin or superadmin can restore tickets');
    }

    // If ticket already exists, just undelete it
    const existing = await this.ticketsRepository.findOne({
      where: { id },
      relations: ['attachments'],
    });
    if (existing) {
      if (existing.isDeleted) {
        existing.isDeleted = false;
        existing.deletedAt = null;
        const saved = await this.ticketsRepository.save(existing);
        await this.logTicketAction(id, ActionType.ROLLBACK, userId, {
          restoredFromDelete: true,
        });
        return saved;
      }
      return existing;
    }

    const log = await this.auditLogRepository.findOne({
      where: { entityId: id, entityType: 'ticket', actionType: ActionType.DELETE },
      order: { timestamp: 'DESC' },
    });

    const snapshot = log?.changes?.deletedSnapshot;
    if (!snapshot?.ticket) {
      throw new NotFoundException('No restore information found for this ticket');
    }

    const ticketSnapshot = snapshot.ticket as Partial<Ticket>;
    const attachmentSnapshots = (snapshot.attachments as any[]) || [];

    const restoredTicket = this.ticketsRepository.create(ticketSnapshot);
    const savedTicket = await this.ticketsRepository.save(restoredTicket);

    if (attachmentSnapshots.length > 0) {
      const restoredAttachments = attachmentSnapshots.map((a) =>
        this.attachmentsRepository.create({
          ticketId: savedTicket.id,
          fileName: a.fileName,
          filePath: a.filePath,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          uploadedById: a.uploadedById,
          uploadedAt: a.uploadedAt,
        }),
      );
      await this.attachmentsRepository.save(restoredAttachments);
    }

    await this.logTicketAction(id, ActionType.ROLLBACK, userId, {
      restoredFromDelete: true,
    });

    return savedTicket;
  }

  async getHistory(
    ticketId?: string,
    limit = 50,
    includeErrors = true,
  ): Promise<ActivityLogDto[]> {
    const effectiveLimit = Math.min(Math.max(limit, 1), 500);
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .take(Math.min(effectiveLimit * 2, 400));

    if (ticketId) {
      qb.where('log.entityType = :type', { type: 'ticket' }).andWhere(
        'log.entityId = :ticketId',
        { ticketId },
      );
      const rows = await qb.take(effectiveLimit).getMany();
      return this.enrichActivityLogs(rows);
    }

    const mainTypes = [
      'ticket',
      'user',
      'knowledge_document',
      'knowledge_entry',
    ];
    const reviewTypes = ['knowledge_extraction_candidate', 'machine_name_suggestion'];
    const fetchPool = Math.min(effectiveLimit * 4, 2000);

    qb.where('log.entityType IN (:...types)', { types: mainTypes }).take(fetchPool);

    const [mainLogs, reviewLogs] = await Promise.all([
      qb.getMany(),
      this.auditLogRepository.find({
        where: { entityType: In(reviewTypes) },
        order: { timestamp: 'DESC' },
        take: Math.min(250, fetchPool),
      }),
    ]);

    const byId = new Map<string, AuditLog>();
    for (const row of [...mainLogs, ...reviewLogs]) {
      byId.set(row.id, row);
    }
    const logs = [...byId.values()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    let merged: AuditLog[] = logs;
    if (includeErrors) {
      const pipelineErrors = await this.buildPipelineErrorEntries(logs, 40);
      merged = [...logs, ...pipelineErrors].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    }
    return this.enrichActivityLogs(merged.slice(0, effectiveLimit));
  }

  private resolvePerformerId(log: AuditLog): string | null {
    const ch = log.changes as Record<string, unknown> | null;
    if (ch && typeof ch.reviewedById === 'string') return ch.reviewedById;
    return log.userId ?? null;
  }

  private async enrichActivityLogs(logs: AuditLog[]): Promise<ActivityLogDto[]> {
    const performerIds = [
      ...new Set(logs.map((l) => this.resolvePerformerId(l)).filter((id): id is string => !!id)),
    ];
    const users =
      performerIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(performerIds) },
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

  private async buildPipelineErrorEntries(
    existingLogs: AuditLog[],
    take: number,
  ): Promise<AuditLog[]> {
    const entries: AuditLog[] = [];
    const rejectDocIds = new Set(
      existingLogs
        .filter(
          (l) =>
            l.entityType === 'knowledge_document' && l.actionType === ActionType.REJECT,
        )
        .map((l) => l.entityId),
    );

    const failedDocs = await this.knowledgeDocumentRepository.find({
      where: { status: In(['failed']) },
      order: { updatedAt: 'DESC' },
      take,
    });

    for (const doc of failedDocs) {
      if (!doc.error?.trim()) continue;
      entries.push({
        id: `pipeline-doc-${doc.id}`,
        actionType: 'error' as ActionType,
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
      } as AuditLog);
    }

    const partialDocs = await this.knowledgeDocumentRepository.find({
      where: { status: 'partially_indexed' },
      order: { updatedAt: 'DESC' },
      take: Math.max(10, Math.floor(take / 2)),
    });
    for (const doc of partialDocs) {
      if (!doc.error?.trim() || rejectDocIds.has(doc.id)) continue;
      entries.push({
        id: `pipeline-partial-${doc.id}`,
        actionType: 'error' as ActionType,
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
      } as AuditLog);
    }

    const failedJobs = await this.knowledgeDocumentJobRepository.find({
      where: { status: 'failed' },
      order: { updatedAt: 'DESC' },
      take: Math.max(15, Math.floor(take / 2)),
    });

    for (const job of failedJobs) {
      if (!job.error?.trim()) continue;
      const doc = await this.knowledgeDocumentRepository.findOne({
        where: { id: job.documentId },
        select: ['id', 'originalName'],
      });
      entries.push({
        id: `pipeline-job-${job.id}`,
        actionType: 'error' as ActionType,
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
      } as AuditLog);
    }

    return entries;
  }

  async getNotificationsForUser(
    userId: string,
    userRole: UserRole,
    limit = 50,
  ): Promise<(AuditLog & { ticketTitle?: string })[]> {
    // Determine relevant tickets for this user
    let tickets: Ticket[] = [];

    if (userRole === UserRole.WORKER) {
      tickets = await this.ticketsRepository.find({
        where: { createdById: userId, isDeleted: false },
        select: ['id', 'title'],
      });
    } else if (userRole === UserRole.TECHNICIAN) {
      tickets = await this.ticketsRepository.find({
        where: { assignedToId: userId, isDeleted: false },
        select: ['id', 'title'],
      });
    } else {
      // Admins/superadmins get global notifications via history page instead
      return [];
    }

    const idToTitle = new Map<string, string>();
    const ticketIds = tickets.map((t) => {
      idToTitle.set(t.id, t.title);
      return t.id;
    });

    let ticketMapped: (AuditLog & { ticketTitle?: string })[] = [];
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

    let withMachineTitles: (AuditLog & { ticketTitle?: string })[] = [];
    if (userRole === UserRole.TECHNICIAN) {
      const machineNameLogs = await this.auditLogRepository
        .createQueryBuilder('log')
        .where('log.entityType = :t', { t: 'machine_name_suggestion' })
        .andWhere("log.changes->>'forUserId' = :userId", { userId })
        .orderBy('log.timestamp', 'DESC')
        .take(limit)
        .getMany();

      withMachineTitles = machineNameLogs.map((log) => {
        const ch = log.changes as Record<string, unknown> | null;
        const docName =
          ch && typeof ch.documentOriginalName === 'string'
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
      const ch = log.changes as Record<string, unknown> | null;
      const title = ch && typeof ch.title === 'string' ? ch.title : undefined;
      return {
        ...log,
        ticketTitle: title,
      };
    });

    const merged = [...ticketMapped, ...withMachineTitles, ...withKnowledgeTitles].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return merged.slice(0, limit);
  }

  private async logTicketAction(
    ticketId: string,
    actionType: ActionType,
    userId: string | null,
    changes?: Record<string, any>,
  ): Promise<void> {
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
}
