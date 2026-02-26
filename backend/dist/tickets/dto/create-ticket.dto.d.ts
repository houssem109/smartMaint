import { TicketCategory, TicketPriority, TicketSource } from '../entities/ticket.entity';
export declare class CreateTicketDto {
    title: string;
    description: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    subcategory?: string;
    machine?: string;
    area?: string;
    source?: TicketSource;
    assignedToId?: string;
}
