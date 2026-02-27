import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Attachment } from './entities/attachment.entity';
import { AuditLog, ActionType } from '../common/entities/audit-log.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
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
    },
  ): Promise<Ticket[]> {
    const queryBuilder = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .leftJoinAndSelect('ticket.attachments', 'attachments');

    // Role-based filtering + exclude soft-deleted tickets
    if (userRole === UserRole.WORKER) {
      queryBuilder.where('ticket.createdById = :userId', { userId }).andWhere('ticket.isDeleted = false');
    } else {
      // Technicians, admins, superadmins see all non-deleted tickets
      queryBuilder.where('ticket.isDeleted = false');
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
    if (filters?.assignedToId) {
      queryBuilder.andWhere('ticket.assignedToId = :assignedToId', {
        assignedToId: filters.assignedToId,
      });
    }

    queryBuilder.orderBy('ticket.createdAt', 'DESC');

    return queryBuilder.getMany();
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
      ticket.assignedToId !== userId
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
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN && userRole !== UserRole.TECHNICIAN) {
      throw new ForbiddenException('Only admins and technicians can assign tickets');
    }

    const ticket = await this.findOne(ticketId, userId, userRole);
    ticket.assignedToId = technicianId;
    ticket.status = TicketStatus.IN_PROGRESS;

    const saved = await this.ticketsRepository.save(ticket);

    await this.logTicketAction(ticketId, ActionType.UPDATE, userId, {
      assignedToId: { to: technicianId },
      status: { to: TicketStatus.IN_PROGRESS },
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

  async getHistory(ticketId?: string, limit = 50): Promise<AuditLog[]> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .take(limit);

    if (ticketId) {
      qb.where('log.entityType = :type', { type: 'ticket' }).andWhere(
        'log.entityId = :ticketId',
        { ticketId },
      );
    } else {
      // Global history: show both ticket and user logs
      qb.where('log.entityType IN (:...types)', { types: ['ticket', 'user'] });
    }

    return qb.getMany();
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
