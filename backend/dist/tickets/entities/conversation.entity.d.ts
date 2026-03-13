import { Ticket } from './ticket.entity';
export declare enum SenderType {
    USER = "user",
    AI = "ai",
    SYSTEM = "system"
}
export declare class Conversation {
    id: string;
    ticketId: string | null;
    ticket: Ticket;
    message: string;
    senderType: SenderType;
    senderId: string;
    timestamp: Date;
}
