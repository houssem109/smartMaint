import { CreateTicketDto } from './create-ticket.dto';
import { TicketStatus } from '../entities/ticket.entity';
declare const UpdateTicketDto_base: import("@nestjs/common").Type<Partial<CreateTicketDto>>;
export declare class UpdateTicketDto extends UpdateTicketDto_base {
    status?: TicketStatus;
    assignedToId?: string;
}
export {};
