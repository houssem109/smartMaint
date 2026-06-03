import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import { TicketCategory, TicketPriority } from '../tickets/entities/ticket.entity';
export type TicketWizardStep = 'await_title' | 'await_description' | 'await_location' | 'await_confirm' | 'await_suggestion_accept';
export type TicketIntentKind = 'none' | 'explicit_ticket' | 'problem_report' | 'wizard_continue';
export interface TicketIntentResult {
    kind: TicketIntentKind;
    suggestedTitle?: string;
    confidence: 'high' | 'medium';
}
export interface TicketWizardSession {
    step: TicketWizardStep;
    draft: Partial<CreateTicketDto>;
    pendingEnhancement?: string;
    lang: 'en' | 'fr';
    entryKind?: 'explicit_ticket' | 'problem_report';
}
export declare const TICKET_WIZARD_MARKER_RE: RegExp;
export declare function isTicketWizardTrigger(message: string): boolean;
export declare function isContextualTicketRequest(message: string, history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function isProblemReportPhrase(text: string): boolean;
export declare function isGeneralHowToOnly(message: string): boolean;
export declare function extractTitleFromProblemReport(message: string): string | undefined;
export declare function analyzeTicketCreationIntent(message: string, history?: {
    role: string;
    content: string;
}[]): TicketIntentResult;
export declare function shouldStartTicketWizard(message: string, history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function isBareTicketTrigger(message: string): boolean;
export declare function isTriggerOnlyPhrase(message: string): boolean;
export declare function tagWizardReply(step: TicketWizardStep, text: string): string;
export declare function stripWizardMarker(text: string): string;
export declare function getWizardStepFromHistory(history?: {
    role: string;
    content: string;
}[]): TicketWizardStep | null;
export declare function parseDraftFromSummaryHistory(history?: {
    role: string;
    content: string;
}[]): Partial<CreateTicketDto>;
export declare function detectWizardLang(message: string, userHistoryText?: string): 'en' | 'fr';
export declare function isWizardCancel(message: string): boolean;
export declare function isConfirmCreate(message: string): boolean;
export declare function wantsTicketImprovement(message: string): boolean;
export declare function acceptsEnhancement(message: string): boolean;
export declare function parseStructuredTicketInput(text: string): Partial<CreateTicketDto>;
export declare function sanitizeTicketTitle(raw: string): string;
export declare function parseMachineAndArea(text: string): {
    machine?: string;
    area?: string;
};
export declare function inferCategoryFromText(title: string, description: string): TicketCategory | undefined;
export declare function inferPriorityFromText(title: string, description: string): TicketPriority;
export declare function isTicketWizardActiveInHistory(history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function wizardAskTitle(name: string | undefined, lang: 'en' | 'fr'): string;
export declare function wizardStartFromProblemReport(name: string | undefined, lang: 'en' | 'fr', userMessage: string): string;
export declare function wizardAckTitleAskDescription(name: string | undefined, title: string, lang: 'en' | 'fr'): string;
export declare function wizardAskLocation(lang: 'en' | 'fr'): string;
export declare function buildTicketSummary(draft: Partial<CreateTicketDto>, lang: 'en' | 'fr'): string;
export declare function wizardInvalidTitle(lang: 'en' | 'fr'): string;
export declare function wizardInvalidDescription(lang: 'en' | 'fr'): string;
export declare function wizardInvalidLocation(lang: 'en' | 'fr'): string;
export declare function wizardCancelled(lang: 'en' | 'fr'): string;
export declare function wizardCreatedReply(name: string | undefined, created: {
    id: string;
    title: string;
    priority: string;
    category: string;
}, lang: 'en' | 'fr'): string;
export declare function wizardRemindConfirm(lang: 'en' | 'fr'): string;
export declare function wizardEnhancementIntro(lang: 'en' | 'fr'): string;
export declare function wizardAskAcceptEnhancement(lang: 'en' | 'fr'): string;
