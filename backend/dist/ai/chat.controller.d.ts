import { AiService } from './ai.service';
import { OrderTechoService } from '../order-techo/order-techo.service';
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
    threadId?: string;
    ticketId?: string;
    imageBase64?: string;
    history?: ChatHistoryItemDto[];
    allowTicketCreation?: boolean;
}
export declare class ChatController {
    private readonly aiService;
    private readonly orderTechoService;
    private readonly ticketsService;
    private readonly ragService;
    private readonly knowledgeService;
    private readonly conversationRepository;
    private readonly ticketWizardByKey;
    private readonly ticketInquiryContextByKey;
    private readonly ticketActionByKey;
    constructor(aiService: AiService, orderTechoService: OrderTechoService, ticketsService: TicketsService, ragService: RagService, knowledgeService: KnowledgeService, conversationRepository: Repository<Conversation>);
    sendMessage(body: ChatMessageDto, req: any): Promise<{
        reply: string;
        ticketId: string;
        sources: any[];
        archiveThread: boolean;
        ticketUpdated?: undefined;
        ticketCreated?: undefined;
        ticketWizard?: undefined;
        orderMode?: undefined;
        orderNumber?: undefined;
        detectedError?: undefined;
    } | {
        reply: string;
        ticketId: string;
        sources: any[];
        ticketUpdated: boolean;
        archiveThread: boolean;
        ticketCreated?: undefined;
        ticketWizard?: undefined;
        orderMode?: undefined;
        orderNumber?: undefined;
        detectedError?: undefined;
    } | {
        reply: string;
        ticketId: string;
        sources: any[];
        ticketCreated: boolean;
        ticketWizard: boolean;
        archiveThread?: undefined;
        ticketUpdated?: undefined;
        orderMode?: undefined;
        orderNumber?: undefined;
        detectedError?: undefined;
    } | {
        reply: string;
        ticketId: string;
        sources: any[];
        ticketWizard: boolean;
        archiveThread?: undefined;
        ticketUpdated?: undefined;
        ticketCreated?: undefined;
        orderMode?: undefined;
        orderNumber?: undefined;
        detectedError?: undefined;
    } | {
        reply: string;
        ticketId: string;
        sources: any[];
        orderMode: "order_data" | "order_wizard" | "order_wizard_complete" | "order_facts";
        orderNumber: string;
        detectedError: import("../order-techo/order-errors").OrderErrorCode;
        archiveThread?: undefined;
        ticketUpdated?: undefined;
        ticketCreated?: undefined;
        ticketWizard?: undefined;
    } | {
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
        archiveThread?: undefined;
        ticketUpdated?: undefined;
        ticketCreated?: undefined;
        ticketWizard?: undefined;
        orderMode?: undefined;
        orderNumber?: undefined;
        detectedError?: undefined;
    }>;
    history(ticketId: string, req: any): Promise<Conversation[]>;
    private normalizeChatImageBase64;
    private persistConversation;
    private loadThreadHistory;
    threadHistory(threadId: string, req: any): Promise<{
        threadId: string;
        turns: {
            role: "user" | "assistant";
            content: string;
        }[];
    }>;
    private extractTicketIdFromMessage;
    private buildTicketContext;
    private ticketDraftKey;
    private wizardReply;
    private isTicketCreationConfirmation;
    private userAskedForTicketInHistory;
    private isTicketDraftInProgress;
    private shouldEnterTicketCreationFlow;
    private shouldUseLlmTicketIntent;
    private detectTicketIntentWithLlm;
    private resolveTicketCreationIntent;
    private beginWizardFromIntent;
    private mergeTicketDraft;
    private extractTicketFieldsHeuristic;
    private extractConversationalTicketFields;
    private createTicketFromDraft;
    private enrichWizardDraft;
    private suggestTicketEnhancement;
    private recoverWizardSessionFromHistory;
    private finalizeWizardTicket;
    private maybeHandleTicketCreationFlow;
    private maybeHandleConversationWrap;
    private attachMissionDoneIfTaskComplete;
    private ticketInquiryKey;
    private resolveTicketForAction;
    private maybeHandleTicketAction;
    private maybeHandleTicketInquiry;
    private maybeHandleTicketListQuestion;
    private extractTicketStatusFromMessage;
    private extractTicketPriorityFromMessage;
    private safeParseJson;
    private normalizeTicketCategory;
    private normalizeTicketPriority;
    private getFriendlyUserName;
    myHistory(req: any): Promise<Conversation[]>;
}
export {};
