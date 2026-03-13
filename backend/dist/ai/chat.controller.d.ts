import { AiService } from './ai.service';
import { TicketsService } from '../tickets/tickets.service';
import { Repository } from 'typeorm';
import { Conversation } from '../tickets/entities/conversation.entity';
declare class ChatHistoryItemDto {
    role: 'user' | 'assistant';
    content: string;
}
declare class ChatMessageDto {
    message: string;
    ticketId?: string;
    history?: ChatHistoryItemDto[];
}
export declare class ChatController {
    private readonly aiService;
    private readonly ticketsService;
    private readonly conversationRepository;
    constructor(aiService: AiService, ticketsService: TicketsService, conversationRepository: Repository<Conversation>);
    sendMessage(body: ChatMessageDto, req: any): Promise<{
        reply: string;
        ticketId: string;
    }>;
    history(ticketId: string, req: any): Promise<Conversation[]>;
    myHistory(req: any): Promise<Conversation[]>;
}
export {};
