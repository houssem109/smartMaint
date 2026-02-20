import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';
export declare class Attachment {
    id: string;
    ticketId: string;
    ticket: Ticket;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedById: string;
    uploadedBy: User;
    uploadedAt: Date;
}
