import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';
import { Attachment } from './attachment.entity';
export declare enum TicketStatus {
    OPEN = "open",
    IN_REVIEW = "in_review",
    IN_PROGRESS = "in_progress",
    SOLVED = "solved",
    CLOSED = "closed"
}
export declare enum TicketPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum TicketCategory {
    SOFTWARE = "software",
    HARDWARE = "hardware",
    ELECTRICAL = "electrical",
    MECHANICAL = "mechanical",
    IT = "it",
    PLUMBING = "plumbing",
    TASK = "task",
    OTHER = "other"
}
export declare enum TicketSource {
    WEB = "web",
    WHATSAPP = "whatsapp",
    EMAIL = "email"
}
export declare enum AssignmentRequestStatus {
    NONE = "none",
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare class Ticket {
    id: string;
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    subcategory: string;
    machine: string;
    area: string;
    source: TicketSource;
    createdById: string;
    createdBy: User;
    assignedToId: string;
    assignedTo: User;
    assignmentRequestedById: string;
    assignmentRequestStatus: AssignmentRequestStatus;
    assignmentRequestNote: string;
    assignmentRequestedAt: Date | null;
    assignmentReviewedById: string;
    assignmentReviewedAt: Date | null;
    conversations: Conversation[];
    attachments: Attachment[];
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
