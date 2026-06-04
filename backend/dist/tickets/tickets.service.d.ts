import { Repository } from 'typeorm';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { KnowledgeDocumentJob } from '../knowledge-documents/entities/knowledge-document-job.entity';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Attachment } from './entities/attachment.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { User, UserRole } from '../users/entities/user.entity';
export type ActivityLogDto = AuditLog & {
    performedBy?: {
        id: string;
        fullName: string | null;
        email: string;
    } | null;
};
export declare class TicketsService {
    private ticketsRepository;
    private attachmentsRepository;
    private auditLogRepository;
    private knowledgeDocumentRepository;
    private knowledgeDocumentJobRepository;
    private userRepository;
    constructor(ticketsRepository: Repository<Ticket>, attachmentsRepository: Repository<Attachment>, auditLogRepository: Repository<AuditLog>, knowledgeDocumentRepository: Repository<KnowledgeDocument>, knowledgeDocumentJobRepository: Repository<KnowledgeDocumentJob>, userRepository: Repository<User>);
    create(createTicketDto: CreateTicketDto, userId: string): Promise<Ticket>;
    findAll(userId: string, userRole: UserRole, filters?: {
        status?: TicketStatus;
        category?: string;
        priority?: string;
        assignedToId?: string;
        unassignedOnly?: boolean;
    }): Promise<Ticket[]>;
    findByTitleForRole(userId: string, userRole: UserRole, title: string, limit?: number): Promise<Ticket[]>;
    searchAccessibleTickets(userId: string, userRole: UserRole, query: string, limit?: number): Promise<Ticket[]>;
    findOne(id: string, userId: string, userRole: UserRole): Promise<Ticket>;
    update(id: string, updateTicketDto: UpdateTicketDto, userId: string, userRole: UserRole): Promise<Ticket>;
    remove(id: string, userId: string, userRole: UserRole): Promise<void>;
    assignTicket(ticketId: string, technicianId: string, userId: string, userRole: UserRole): Promise<Ticket>;
    requestSelfAssign(ticketId: string, userId: string, userRole: UserRole, note?: string): Promise<Ticket>;
    reviewSelfAssignRequest(ticketId: string, approve: boolean, userId: string, userRole: UserRole, reason?: string): Promise<Ticket>;
    addAttachments(ticketId: string, files: Express.Multer.File[], userId: string, userRole: UserRole): Promise<Attachment[]>;
    restore(id: string, userId: string, userRole: UserRole): Promise<Ticket>;
    getHistory(ticketId?: string, limit?: number, includeErrors?: boolean): Promise<ActivityLogDto[]>;
    private resolvePerformerId;
    private enrichActivityLogs;
    private buildPipelineErrorEntries;
    getNotificationsForUser(userId: string, userRole: UserRole, limit?: number): Promise<(AuditLog & {
        ticketTitle?: string;
    })[]>;
    private logTicketAction;
}
