import { AiService } from './ai.service';
import { TicketsService } from '../tickets/tickets.service';
import { RagService } from './rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { Repository } from 'typeorm';
import { Conversation } from '../tickets/entities/conversation.entity';
declare class ChatHistoryItemDto {
    role: 'user' | 'assistant';
    content: string;
}
declare class ChatMessageDto {
    message: string;
    ticketId?: string;
    imageBase64?: string;
    history?: ChatHistoryItemDto[];
    allowTicketCreation?: boolean;
}
export declare class ChatController {
    private readonly aiService;
    private readonly ticketsService;
    private readonly ragService;
    private readonly knowledgeService;
    private readonly conversationRepository;
    constructor(aiService: AiService, ticketsService: TicketsService, ragService: RagService, knowledgeService: KnowledgeService, conversationRepository: Repository<Conversation>);
    sendMessage(body: ChatMessageDto, req: any): Promise<{
        reply: string;
        ticketId: string;
        sources: ({
            kind: "pdf_chunk";
            caption: string;
            score: number;
            documentId: string;
            chunkIndex: number;
        } | {
            kind: "knowledge_entry";
            caption: string;
            knowledgeEntryId: string;
        })[];
    }>;
    history(ticketId: string, req: any): Promise<Conversation[]>;
    private normalizeChatImageBase64;
    private persistConversation;
    private extractTicketIdFromMessage;
    private buildTicketContext;
    private maybeHandleTicketCreationFlow;
    private maybeHandleTicketStatusQuestion;
    private maybeHandleTicketListQuestion;
    private extractTicketStatusFromMessage;
    private extractTicketPriorityFromMessage;
    private isTicketStatusQuestion;
    private extractTicketTitleCandidate;
    private renderTicketStatusReply;
    private safeParseJson;
    private normalizeTicketCategory;
    private normalizeTicketPriority;
    private getFriendlyUserName;
    myHistory(req: any): Promise<Conversation[]>;
}
export {};
