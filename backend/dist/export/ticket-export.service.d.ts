import { StreamableFile } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
export type TicketsExportQuery = {
    format?: 'xlsx' | 'csv';
    from?: string;
    to?: string;
    status?: TicketStatus;
    category?: string;
};
export declare class TicketExportService {
    private readonly ticketRepository;
    private readonly userRepository;
    private readonly auditLogRepository;
    constructor(ticketRepository: Repository<Ticket>, userRepository: Repository<User>, auditLogRepository: Repository<AuditLog>);
    private dispositionFilename;
    private buildFilename;
    private userLabel;
    private isResolved;
    private applyDateFilters;
    private resolveResolverLabels;
    exportTickets(query: TicketsExportQuery): Promise<StreamableFile>;
}
