import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
  ) {}

  async create(createTicketDto: CreateTicketDto, userId: string): Promise<Ticket> {
    const ticket = this.ticketsRepository.create({
      ...createTicketDto,
      createdById: userId,
    });
    return this.ticketsRepository.save(ticket);
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

    // Role-based filtering
    if (userRole === UserRole.WORKER) {
      queryBuilder.where('ticket.createdById = :userId', { userId });
    } else if (userRole === UserRole.TECHNICIAN) {
      // Technicians see all tickets (they can be assigned to any)
      // No filter needed - they see all tickets
    }
    // Admin sees all tickets (no filter)

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
      where: { id },
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
    return this.ticketsRepository.save(ticket);
  }

  async remove(id: string, userId: string, userRole: UserRole): Promise<void> {
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Admins and superadmins can delete any ticket
    // Workers can only delete their own tickets
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) {
      await this.ticketsRepository.remove(ticket);
      return;
    }

    if (userRole === UserRole.WORKER && ticket.createdById === userId) {
      await this.ticketsRepository.remove(ticket);
      return;
    }

    throw new ForbiddenException('You do not have permission to delete this ticket');
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

    return this.ticketsRepository.save(ticket);
  }
}
