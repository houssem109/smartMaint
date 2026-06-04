"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTurnRouterEnabled = isTurnRouterEnabled;
exports.mapActionKindToTurnAction = mapActionKindToTurnAction;
exports.buildTurnRouterPrompt = buildTurnRouterPrompt;
exports.parseTurnRouterJson = parseTurnRouterJson;
exports.detectTurnRouteHeuristic = detectTurnRouteHeuristic;
exports.mergeTurnRoutes = mergeTurnRoutes;
exports.shouldClarifyInsteadOfLoop = shouldClarifyInsteadOfLoop;
exports.buildRouterClarifyReply = buildRouterClarifyReply;
exports.routeImpliesTicketAction = routeImpliesTicketAction;
exports.routeImpliesTicketLookup = routeImpliesTicketLookup;
exports.routeImpliesTicketCreate = routeImpliesTicketCreate;
exports.routeImpliesWizardContinue = routeImpliesWizardContinue;
const ticket_action_util_1 = require("./ticket-action.util");
const ticket_inquiry_util_1 = require("./ticket-inquiry.util");
const ticket_wizard_util_1 = require("./ticket-wizard.util");
const CONFIDENCE_FLOOR = 0.4;
const CLARIFY_THRESHOLD = 0.52;
function isTurnRouterEnabled() {
    return String(process.env.TICKET_INTENT_ROUTER ?? 'true').toLowerCase() !== 'false';
}
function mapActionKindToTurnAction(kind) {
    if (!kind)
        return null;
    if (kind === 'delete' || kind === 'close' || kind === 'reopen')
        return kind;
    return 'update';
}
function buildTurnRouterPrompt(ctx) {
    const recent = (ctx.history ?? [])
        .slice(-8)
        .map((h) => `${h.role}: ${(h.content ?? '').slice(0, 500)}`)
        .join('\n');
    const ticketLine = ctx.lastTicket
        ? `Last ticket discussed: "${ctx.lastTicket.title}" (id ${ctx.lastTicket.id.slice(0, 8)}…).`
        : 'No ticket cached for this thread yet.';
    const pendingLine = ctx.pendingActionKind
        ? `Pending destructive action awaiting yes/cancel: ${ctx.pendingActionKind}.`
        : '';
    const wizardLine = ctx.wizardStep ? `Ticket creation wizard step: ${ctx.wizardStep}.` : '';
    return (`Classify the LATEST user message in a factory maintenance chat (SmartMaint / Techo).\n` +
        `Reply with JSON ONLY (no markdown):\n` +
        `{"intent":"...","action":null|"delete"|"close"|"reopen"|"update","search_query":null|"text","confidence":0.0-1.0,"reason":"short"}\n\n` +
        `intent values:\n` +
        `- general_chat: manuals, how-to, greetings, off-topic, general maintenance Q&A\n` +
        `- ticket_lookup: user wants info on an EXISTING ticket (status, description, assignment)\n` +
        `- ticket_action: user wants to change/remove a ticket (delete, close, reopen, update priority/description)\n` +
        `- ticket_create: user reports a new problem or asks to create/open a ticket\n` +
        `- wizard_continue: user is answering wizard fields (title, description, location) or confirming create\n` +
        `- action_confirm: user confirms pending action (yes, ok, confirm, oui)\n` +
        `- action_cancel: user cancels (cancel, annuler, no)\n` +
        `- clarify: ambiguous — not sure if lookup vs action vs create\n\n` +
        `Rules:\n` +
        `- "delete it" / "can you remove that" after a ticket was shown → ticket_action + action delete\n` +
        `- "is it open?" / "who is assigned?" → ticket_lookup\n` +
        `- "machine down on line 3" / "create a ticket" → ticket_create\n` +
        `- Pronouns (it, this, that) refer to Last ticket discussed when present\n` +
        `- action_confirm / action_cancel only when Pending action or wizard confirm is active\n` +
        `- Prefer ticket_action over ticket_lookup when user asks to DO something to the ticket\n\n` +
        `Examples:\n` +
        `User: "can you delete it?" (after ticket HMI frozen) → {"intent":"ticket_action","action":"delete","search_query":null,"confidence":0.9,"reason":"delete pronoun"}\n` +
        `User: "is it still open?" → {"intent":"ticket_lookup","action":null,"search_query":null,"confidence":0.85,"reason":"status question"}\n` +
        `User: "HMI screen frozen" (after "which ticket?") → {"intent":"ticket_lookup","action":null,"search_query":"HMI screen frozen","confidence":0.88,"reason":"search term"}\n` +
        `User: "yes" (pending delete confirm) → {"intent":"action_confirm","action":null,"search_query":null,"confidence":0.95,"reason":"confirm"}\n\n` +
        `${ticketLine}\n${pendingLine}\n${wizardLine}\n\n` +
        `Recent chat:\n${recent || '(empty)'}\n\n` +
        `Latest user message: ${ctx.message}`);
}
function parseTurnRouterJson(raw) {
    if (!raw?.trim())
        return null;
    let obj;
    try {
        obj = JSON.parse(raw.trim());
    }
    catch {
        const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (!fenced?.[1])
            return null;
        try {
            obj = JSON.parse(fenced[1].trim());
        }
        catch {
            return null;
        }
    }
    const intent = String(obj.intent ?? '').trim();
    const allowedIntents = [
        'general_chat',
        'ticket_lookup',
        'ticket_action',
        'ticket_create',
        'wizard_continue',
        'action_confirm',
        'action_cancel',
        'clarify',
    ];
    if (!allowedIntents.includes(intent))
        return null;
    const actionRaw = obj.action;
    let action = null;
    if (actionRaw === 'delete' || actionRaw === 'close' || actionRaw === 'reopen' || actionRaw === 'update') {
        action = actionRaw;
    }
    const searchQuery = typeof obj.search_query === 'string' && obj.search_query.trim().length >= 2
        ? obj.search_query.trim().slice(0, 200)
        : null;
    let confidence = Number(obj.confidence);
    if (!Number.isFinite(confidence))
        confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));
    const reason = typeof obj.reason === 'string' ? obj.reason.trim().slice(0, 200) : '';
    return { intent, action, searchQuery, confidence, reason };
}
function detectTurnRouteHeuristic(ctx) {
    const { message, history, lastTicket, pendingActionKind, wizardStep, hasCachedTicket } = ctx;
    const hist = history ?? [];
    if (pendingActionKind && (0, ticket_action_util_1.isActionConfirmation)(message)) {
        return {
            intent: 'action_confirm',
            action: null,
            searchQuery: null,
            confidence: 0.98,
            reason: 'heuristic confirm',
        };
    }
    if ((pendingActionKind || (0, ticket_action_util_1.isAwaitingTicketActionConfirm)(hist)) && (0, ticket_action_util_1.isActionCancellation)(message)) {
        return {
            intent: 'action_cancel',
            action: null,
            searchQuery: null,
            confidence: 0.98,
            reason: 'heuristic cancel',
        };
    }
    const stepFromHistory = (0, ticket_wizard_util_1.getWizardStepFromHistory)(hist);
    const activeWizardStep = wizardStep ?? ((0, ticket_wizard_util_1.isWizardSupersededByCreatedTicket)(hist) ? null : stepFromHistory);
    if (activeWizardStep && !(0, ticket_inquiry_util_1.isTicketInquiryIntent)(message) && !(0, ticket_action_util_1.isTicketActionIntent)(message)) {
        return {
            intent: 'wizard_continue',
            action: null,
            searchQuery: null,
            confidence: 0.92,
            reason: 'wizard active',
        };
    }
    if ((0, ticket_inquiry_util_1.shouldProcessTicketInquiry)(message, hist, hasCachedTicket) && (0, ticket_inquiry_util_1.isTicketInquiryIntent)(message)) {
        return {
            intent: 'ticket_lookup',
            action: null,
            searchQuery: null,
            confidence: 0.88,
            reason: 'heuristic inquiry',
        };
    }
    if (hasCachedTicket && (0, ticket_action_util_1.isTicketActionIntent)(message)) {
        const parsed = (0, ticket_action_util_1.parseTicketActionIntent)(message);
        if (parsed.kind) {
            return {
                intent: 'ticket_action',
                action: mapActionKindToTurnAction(parsed.kind),
                searchQuery: null,
                confidence: 0.92,
                reason: 'heuristic action',
            };
        }
    }
    if ((0, ticket_wizard_util_1.shouldStartTicketWizard)(message, hist)) {
        return {
            intent: 'ticket_create',
            action: null,
            searchQuery: null,
            confidence: 0.9,
            reason: 'heuristic create',
        };
    }
    if ((0, ticket_inquiry_util_1.isAwaitingTicketLookupQuery)(hist) &&
        !activeWizardStep &&
        message.trim().length >= 3) {
        return {
            intent: 'ticket_lookup',
            action: null,
            searchQuery: message.trim().slice(0, 200),
            confidence: 0.9,
            reason: 'lookup answer',
        };
    }
    if (lastTicket && (0, ticket_action_util_1.isTicketActionIntent)(message)) {
        const parsed = (0, ticket_action_util_1.parseTicketActionIntent)(message);
        return {
            intent: 'ticket_action',
            action: mapActionKindToTurnAction(parsed.kind),
            searchQuery: null,
            confidence: parsed.kind ? 0.88 : 0.45,
            reason: parsed.kind ? 'heuristic action' : 'action unclear',
        };
    }
    return null;
}
function mergeTurnRoutes(llm, heuristic) {
    if (!llm && !heuristic)
        return null;
    if (!llm)
        return heuristic;
    if (!heuristic)
        return llm;
    if (heuristic.confidence >= 0.9)
        return heuristic;
    if (llm.intent === heuristic.intent) {
        return {
            ...llm,
            confidence: Math.min(1, Math.max(llm.confidence, heuristic.confidence) + 0.05),
            action: llm.action ?? heuristic.action,
            searchQuery: llm.searchQuery ?? heuristic.searchQuery,
        };
    }
    if (llm.confidence >= heuristic.confidence + 0.15)
        return llm;
    if (heuristic.confidence >= llm.confidence + 0.15)
        return heuristic;
    return llm.confidence >= heuristic.confidence ? llm : heuristic;
}
function shouldClarifyInsteadOfLoop(route) {
    if (!route)
        return false;
    if (route.intent === 'clarify')
        return true;
    return (route.confidence < CLARIFY_THRESHOLD &&
        (route.intent === 'ticket_action' || route.intent === 'ticket_lookup'));
}
function buildRouterClarifyReply(route, lang, lastTicket) {
    const ticketHint = lastTicket ? ` « ${lastTicket.title} »` : '';
    if (lang === 'fr') {
        return (`Je ne suis pas sûr de ce que vous voulez faire${ticketHint}.\n` +
            `Dites par exemple :\n` +
            `• « supprime le ticket » ou « ferme le ticket »\n` +
            `• « est-il ouvert ? » pour consulter le statut\n` +
            `• « annuler » pour abandonner`);
    }
    return (`I'm not sure what you want to do${ticketHint ? ` with "${lastTicket.title}"` : ''}.\n` +
        `Try for example:\n` +
        `• "delete the ticket" or "close the ticket"\n` +
        `• "is it still open?" to check status\n` +
        `• "cancel" to abort`);
}
function routeImpliesTicketAction(route) {
    return Boolean(route && route.intent === 'ticket_action' && route.confidence >= CONFIDENCE_FLOOR);
}
function routeImpliesTicketLookup(route) {
    return Boolean(route && route.intent === 'ticket_lookup' && route.confidence >= CONFIDENCE_FLOOR);
}
function routeImpliesTicketCreate(route) {
    return Boolean(route && route.intent === 'ticket_create' && route.confidence >= CONFIDENCE_FLOOR);
}
function routeImpliesWizardContinue(route) {
    return Boolean(route && route.intent === 'wizard_continue' && route.confidence >= CONFIDENCE_FLOOR);
}
//# sourceMappingURL=ticket-intent-router.util.js.map