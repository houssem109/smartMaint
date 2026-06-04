import { type TicketActionKind } from './ticket-action.util';
export type TechoTurnIntent = 'general_chat' | 'ticket_lookup' | 'ticket_action' | 'ticket_create' | 'wizard_continue' | 'action_confirm' | 'action_cancel' | 'clarify';
export type TechoTurnAction = 'delete' | 'close' | 'reopen' | 'update' | null;
export interface TechoTurnRoute {
    intent: TechoTurnIntent;
    action: TechoTurnAction;
    searchQuery: string | null;
    confidence: number;
    reason: string;
}
export interface TurnRouterContext {
    message: string;
    history?: {
        role: string;
        content: string;
    }[];
    lastTicket: {
        id: string;
        title: string;
    } | null;
    pendingActionKind: TicketActionKind | null;
    wizardStep: string | null;
    hasCachedTicket: boolean;
}
export declare function isTurnRouterEnabled(): boolean;
export declare function mapActionKindToTurnAction(kind: TicketActionKind | null): TechoTurnAction;
export declare function buildTurnRouterPrompt(ctx: TurnRouterContext): string;
export declare function parseTurnRouterJson(raw: string): TechoTurnRoute | null;
export declare function detectTurnRouteHeuristic(ctx: TurnRouterContext): TechoTurnRoute | null;
export declare function mergeTurnRoutes(llm: TechoTurnRoute | null, heuristic: TechoTurnRoute | null): TechoTurnRoute | null;
export declare function shouldClarifyInsteadOfLoop(route: TechoTurnRoute | null): boolean;
export declare function buildRouterClarifyReply(route: TechoTurnRoute | null, lang: 'en' | 'fr', lastTicket: {
    title: string;
} | null): string;
export declare function routeImpliesTicketAction(route: TechoTurnRoute | null): boolean;
export declare function routeImpliesTicketLookup(route: TechoTurnRoute | null): boolean;
export declare function routeImpliesTicketCreate(route: TechoTurnRoute | null): boolean;
export declare function routeImpliesWizardContinue(route: TechoTurnRoute | null): boolean;
