import { Ticket } from '../tickets/entities/ticket.entity';
export declare const TICKET_INQUIRY_MARKER_RE: RegExp;
export type TicketInquiryAspect = 'overview' | 'description' | 'status' | 'assignment' | 'priority' | 'location';
export declare function tagInquiryReply(kind: 'await_query' | 'found', text: string): string;
export declare function stripInquiryMarker(text: string): string;
export declare function getLastAssistantText(history?: {
    role: string;
    content: string;
}[]): string | null;
export declare function isAwaitingTicketLookupQuery(history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function hasRecentTicketInquiryContext(history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function isTicketInquiryFollowUp(message: string): boolean;
export declare function findRecentTicketSearchTermFromHistory(history?: {
    role: string;
    content: string;
}[]): string | null;
export declare function extractBareSearchQuery(message: string): string | null;
export declare function shouldProcessTicketInquiry(message: string, history?: {
    role: string;
    content: string;
}[], hasCachedTicket?: boolean): boolean;
export declare function isTicketInquiryIntent(message: string): boolean;
export declare function extractTicketIdFromText(message: string): string | undefined;
export declare function extractTicketSearchQuery(message: string, history?: {
    role: string;
    content: string;
}[]): string | null;
export declare function extractTicketInquiryAspect(message: string): TicketInquiryAspect;
export declare function formatTicketInquiryReply(ticket: Ticket, aspect: TicketInquiryAspect, lang: 'en' | 'fr'): string;
export declare function formatMultipleTicketsReply(tickets: Ticket[], lang: 'en' | 'fr'): string;
export declare function formatNoTicketReply(query: string, lang: 'en' | 'fr'): string;
export declare function formatNeedQueryReply(lang: 'en' | 'fr'): string;
