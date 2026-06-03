import { UpdateTicketDto } from '../tickets/dto/update-ticket.dto';
export type TicketActionKind = 'close' | 'delete' | 'reopen' | 'update';
export interface PendingTicketAction {
    kind: TicketActionKind;
    ticketId: string;
    ticketTitle: string;
    updates: Partial<UpdateTicketDto>;
    lang: 'en' | 'fr';
    summary: string;
}
export declare const TICKET_ACTION_MARKER_RE: RegExp;
export declare function tagActionConfirmReply(actionKey: string, text: string): string;
export declare function stripActionMarker(text: string): string;
export declare function isAwaitingTicketActionConfirm(history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function parseActionKeyFromHistory(history?: {
    role: string;
    content: string;
}[]): string | null;
export declare function isActionConfirmation(message: string): boolean;
export declare function isActionCancellation(message: string): boolean;
export declare function isTicketActionIntent(message: string): boolean;
export declare function parseTicketActionIntent(message: string): {
    kind: TicketActionKind | null;
    updates: Partial<UpdateTicketDto>;
    summaryEn: string;
    summaryFr: string;
};
export declare function buildActionConfirmPrompt(action: PendingTicketAction, lang: 'en' | 'fr'): string;
export declare function buildActionSuccessReply(action: PendingTicketAction, lang: 'en' | 'fr'): string;
export declare function buildActionCancelledReply(lang: 'en' | 'fr'): string;
export declare function buildActionErrorReply(error: string, lang: 'en' | 'fr'): string;
export declare function buildNoTicketForActionReply(lang: 'en' | 'fr'): string;
export declare function shouldProcessTicketAction(message: string, history?: {
    role: string;
    content: string;
}[], hasPendingAction?: boolean, hasTicketContext?: boolean): boolean;
