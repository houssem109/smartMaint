import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatus } from './entities/ticket.entity';
import { Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';
import { Response } from 'express';
export declare class TicketsController {
    private readonly ticketsService;
    private readonly attachmentsRepository;
    constructor(ticketsService: TicketsService, attachmentsRepository: Repository<Attachment>);
    create(createTicketDto: CreateTicketDto, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    uploadAttachments(ticketId: string, files: Express.Multer.File[], req: any): Promise<Attachment[]>;
    downloadAttachment(attachmentId: string, res: Response): Promise<void>;
    findAll(req: any, status?: TicketStatus, category?: string, priority?: string, assignedToId?: string): Promise<import("./entities/ticket.entity").Ticket[]>;
    history(ticketId?: string, limit?: string): Promise<import("../common/entities/audit-log.entity").AuditLog[]>;
    findOne(id: string, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    update(id: string, updateTicketDto: UpdateTicketDto, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    remove(id: string, req: any): Promise<void>;
    restore(id: string, req: any): Promise<import("./entities/ticket.entity").Ticket>;
    assignTicket(ticketId: string, technicianId: string, req: any): Promise<import("./entities/ticket.entity").Ticket>;
}
