import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UserRole } from '../users/entities/user.entity';
export declare class TicketsService {
    private ticketsRepository;
    constructor(ticketsRepository: Repository<Ticket>);
    create(createTicketDto: CreateTicketDto, userId: string): Promise<Ticket>;
    findAll(userId: string, userRole: UserRole, filters?: {
        status?: TicketStatus;
        category?: string;
        priority?: string;
        assignedToId?: string;
    }): Promise<Ticket[]>;
    findOne(id: string, userId: string, userRole: UserRole): Promise<Ticket>;
    update(id: string, updateTicketDto: UpdateTicketDto, userId: string, userRole: UserRole): Promise<Ticket>;
    remove(id: string, userId: string, userRole: UserRole): Promise<void>;
    assignTicket(ticketId: string, technicianId: string, userId: string, userRole: UserRole): Promise<Ticket>;
}
