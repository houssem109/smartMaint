import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatus } from './entities/ticket.entity';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    create(createTicketDto: CreateTicketDto, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    findAll(req: any, status?: TicketStatus, category?: string, priority?: string, assignedToId?: string): Promise<import("./entities/ticket.entity").Ticket[]>;
    findOne(id: string, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    update(id: string, updateTicketDto: UpdateTicketDto, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    remove(id: string, req: any): Promise<void>;
    assignTicket(ticketId: string, technicianId: string, req: any): Promise<import("./entities/ticket.entity").Ticket>;
}
