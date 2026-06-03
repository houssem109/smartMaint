"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_ACTION_MARKER_RE = void 0;
exports.tagActionConfirmReply = tagActionConfirmReply;
exports.stripActionMarker = stripActionMarker;
exports.isAwaitingTicketActionConfirm = isAwaitingTicketActionConfirm;
exports.parseActionKeyFromHistory = parseActionKeyFromHistory;
exports.isActionConfirmation = isActionConfirmation;
exports.isActionCancellation = isActionCancellation;
exports.isTicketActionIntent = isTicketActionIntent;
exports.parseTicketActionIntent = parseTicketActionIntent;
exports.buildActionConfirmPrompt = buildActionConfirmPrompt;
exports.buildActionSuccessReply = buildActionSuccessReply;
exports.buildActionCancelledReply = buildActionCancelledReply;
exports.buildActionErrorReply = buildActionErrorReply;
exports.buildNoTicketForActionReply = buildNoTicketForActionReply;
exports.shouldProcessTicketAction = shouldProcessTicketAction;
const ticket_entity_1 = require("../tickets/entities/ticket.entity");
const ticket_wizard_util_1 = require("./ticket-wizard.util");
exports.TICKET_ACTION_MARKER_RE = /\[TICKET_ACTION:await_confirm:([^\]]+)\]/;
function tagActionConfirmReply(actionKey, text) {
    return `[TICKET_ACTION:await_confirm:${actionKey}]\n${text}`;
}
function stripActionMarker(text) {
    return text.replace(/^\[TICKET_ACTION:[^\]]+\]\n?/, '').trim();
}
function isAwaitingTicketActionConfirm(history) {
    if (!history?.length)
        return false;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role !== 'assistant')
            continue;
        return exports.TICKET_ACTION_MARKER_RE.test(history[i].content ?? '');
    }
    return false;
}
function parseActionKeyFromHistory(history) {
    if (!history?.length)
        return null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role !== 'assistant')
            continue;
        const m = (history[i].content ?? '').match(exports.TICKET_ACTION_MARKER_RE);
        if (m?.[1])
            return m[1];
    }
    return null;
}
function isActionConfirmation(message) {
    if ((0, ticket_wizard_util_1.isWizardCancel)(message))
        return false;
    return (0, ticket_wizard_util_1.isConfirmCreate)(message);
}
function isActionCancellation(message) {
    return (0, ticket_wizard_util_1.isWizardCancel)(message);
}
function isTicketActionIntent(message) {
    const m = message.trim().toLowerCase();
    if (!m)
        return false;
    if (isAwaitingTicketActionConfirm([{ role: 'user', content: message }]))
        return false;
    const actionPatterns = [
        /\b(close|fermer|ferme)\b.*\bticket|\bticket\b.*\b(close|fermer)\b/,
        /\b(make|set|mark)\b.*\b(close|closed|fermé)\b/,
        /\bcan you close|\bcan u close|\bcould you close|\bplease close|\bclose it\b|\bclose this\b/,
        /\b(delete|remove|supprimer|effacer)\b.*\bticket|\bticket\b.*\b(delete|remove|supprimer)\b/,
        /\b(reopen|re-open|rouvrir)\b/,
        /\bopen\b.*\b(again|it|this|ticket)\b/,
        /\b(make|set|change|update|switch|turn)\b.*\b(open|closed|ouvert|fermé|in progress|solved)\b/,
        /\b(update|change|edit|modify|mettre à jour|changer)\b.*\b(ticket|description|title|priority|priorité|status|statut|machine|area|it|this|that)\b/,
        /\b(set|change)\b.*\b(priority|priorité)\b.*\b(to|à)\b/,
        /\bcan't you close|\bcant close|\bwhy can't you close|\bpourquoi.*fermer/,
        /\bdo it\b.*\b(close|delete|update|open|reopen)\b|\b(close|delete|open|reopen)\b.*\bdo it\b/,
        /\bcan (you|u) (update|change|open|reopen|close)\b/,
    ];
    return actionPatterns.some((r) => r.test(m));
}
function wantsOpenStatus(m) {
    if (/\b(reopen|re-open|rouvrir)\b/.test(m))
        return true;
    if (/\bopen\b.*\b(again|it|this|ticket)\b/.test(m))
        return true;
    if (/\b(want|need|like)\b.*\bopen\b/.test(m))
        return true;
    if (/\b(make|set|change|update|switch|turn)\b.*\b(open|ouvert)\b/.test(m))
        return true;
    return false;
}
function parseTicketActionIntent(message) {
    const m = message.trim().toLowerCase();
    const empty = { kind: null, updates: {}, summaryEn: '', summaryFr: '' };
    if (/\b(delete|remove|supprimer|effacer)\b/.test(m)) {
        return {
            kind: 'delete',
            updates: {},
            summaryEn: 'delete this ticket (move to trash)',
            summaryFr: 'supprimer ce ticket (corbeille)',
        };
    }
    if (wantsOpenStatus(m)) {
        return {
            kind: 'reopen',
            updates: { status: ticket_entity_1.TicketStatus.OPEN },
            summaryEn: 'reopen this ticket (status → open)',
            summaryFr: 'rouvrir ce ticket (statut → ouvert)',
        };
    }
    if (/\b(close|fermer|ferme|closed|fermé)\b/.test(m) ||
        /\bcan.*close|\bplease close|\bclose it\b|\bclose this\b|\bmake it close/.test(m)) {
        return {
            kind: 'close',
            updates: { status: ticket_entity_1.TicketStatus.CLOSED },
            summaryEn: 'close this ticket (status → closed)',
            summaryFr: 'fermer ce ticket (statut → fermé)',
        };
    }
    const priority = parsePriorityFromMessage(m);
    if (priority) {
        return {
            kind: 'update',
            updates: { priority },
            summaryEn: `set priority to ${priority}`,
            summaryFr: `passer la priorité à ${priority}`,
        };
    }
    const status = parseStatusFromMessage(m);
    if (status) {
        return {
            kind: status === ticket_entity_1.TicketStatus.OPEN ? 'reopen' : 'update',
            updates: { status },
            summaryEn: status === ticket_entity_1.TicketStatus.OPEN
                ? 'reopen this ticket (status → open)'
                : `set status to ${status}`,
            summaryFr: status === ticket_entity_1.TicketStatus.OPEN
                ? 'rouvrir ce ticket (statut → ouvert)'
                : `passer le statut à ${status}`,
        };
    }
    const desc = parseFieldUpdate(message, 'description');
    if (desc) {
        return {
            kind: 'update',
            updates: { description: desc },
            summaryEn: 'update the description',
            summaryFr: 'modifier la description',
        };
    }
    const title = parseFieldUpdate(message, 'title');
    if (title) {
        return {
            kind: 'update',
            updates: { title },
            summaryEn: 'update the title',
            summaryFr: 'modifier le titre',
        };
    }
    return empty;
}
function parsePriorityFromMessage(m) {
    if (/\b(critical|critique)\b/.test(m))
        return ticket_entity_1.TicketPriority.CRITICAL;
    if (/\b(high|haute|élevée)\b/.test(m))
        return ticket_entity_1.TicketPriority.HIGH;
    if (/\b(medium|moyenne)\b/.test(m))
        return ticket_entity_1.TicketPriority.MEDIUM;
    if (/\b(low|basse|faible)\b/.test(m))
        return ticket_entity_1.TicketPriority.LOW;
    return null;
}
function parseStatusFromMessage(m) {
    if (/\b(in progress|en cours)\b/.test(m))
        return ticket_entity_1.TicketStatus.IN_PROGRESS;
    if (/\b(in review|en revue)\b/.test(m))
        return ticket_entity_1.TicketStatus.IN_REVIEW;
    if (/\b(solved|résolu|resolved)\b/.test(m))
        return ticket_entity_1.TicketStatus.SOLVED;
    if (/\b(closed|fermé|close)\b/.test(m))
        return ticket_entity_1.TicketStatus.CLOSED;
    if (/\b(open|ouvert)\b/.test(m))
        return ticket_entity_1.TicketStatus.OPEN;
    return null;
}
function parseFieldUpdate(message, field) {
    const patterns = field === 'description'
        ? [
            /(?:description|desc)\s*(?:to|:)\s*["']?(.+?)["']?\s*$/i,
            /(?:update|change|edit)\s+(?:the\s+)?description\s+(?:to\s+)?["']?(.+?)["']?\s*$/i,
        ]
        : [
            /(?:title|titre)\s*(?:to|:)\s*["']?(.+?)["']?\s*$/i,
            /(?:update|change|edit)\s+(?:the\s+)?title\s+(?:to\s+)?["']?(.+?)["']?\s*$/i,
        ];
    for (const p of patterns) {
        const hit = message.match(p);
        if (hit?.[1]?.trim())
            return hit[1].trim();
    }
    return null;
}
function buildActionConfirmPrompt(action, lang) {
    const shortId = action.ticketId.slice(0, 8);
    if (lang === 'fr') {
        return (`Je vais ${action.summary} pour le ticket « ${action.ticketTitle} » (${shortId}…).\n` +
            `Êtes-vous sûr ? Répondez « oui » pour confirmer ou « annuler » pour abandonner.`);
    }
    return (`I'll ${action.summary} for ticket "${action.ticketTitle}" (${shortId}…).\n` +
        `Are you sure? Reply "yes" to confirm or "cancel" to abort.`);
}
function buildActionSuccessReply(action, lang) {
    const shortId = action.ticketId.slice(0, 8);
    if (action.kind === 'delete') {
        return lang === 'fr'
            ? `C’est fait — le ticket « ${action.ticketTitle} » (${shortId}…) a été supprimé (corbeille).`
            : `Done — ticket "${action.ticketTitle}" (${shortId}…) has been deleted.`;
    }
    if (action.kind === 'close') {
        return lang === 'fr'
            ? `C’est fait — le ticket « ${action.ticketTitle} » (${shortId}…) est maintenant fermé.`
            : `Done — ticket "${action.ticketTitle}" (${shortId}…) is now closed.`;
    }
    if (action.kind === 'reopen') {
        return lang === 'fr'
            ? `C’est fait — le ticket « ${action.ticketTitle} » (${shortId}…) est rouvert.`
            : `Done — ticket "${action.ticketTitle}" (${shortId}…) is reopened.`;
    }
    return lang === 'fr'
        ? `C’est fait — le ticket « ${action.ticketTitle} » (${shortId}…) a été mis à jour.`
        : `Done — ticket "${action.ticketTitle}" (${shortId}…) has been updated.`;
}
function buildActionCancelledReply(lang) {
    return lang === 'fr'
        ? "D'accord — je n'ai rien modifié sur le ticket."
        : "Okay — I didn't change the ticket.";
}
function buildActionErrorReply(error, lang) {
    return lang === 'fr'
        ? `Je n'ai pas pu effectuer cette action : ${error}`
        : `I couldn't complete that action: ${error}`;
}
function buildNoTicketForActionReply(lang) {
    return lang === 'fr'
        ? 'Quel ticket voulez-vous modifier ? Donnez le titre ou l’ID (après une recherche, je me souviens du dernier ticket consulté).'
        : 'Which ticket should I update? Give me the title or ID (after a lookup, I remember the last ticket we discussed).';
}
function shouldProcessTicketAction(message, history, hasPendingAction, hasTicketContext) {
    if (hasPendingAction || isAwaitingTicketActionConfirm(history))
        return true;
    if (isTicketActionIntent(message) && hasTicketContext)
        return true;
    if (!hasTicketContext && !isTicketActionIntent(message))
        return false;
    return false;
}
//# sourceMappingURL=ticket-action.util.js.map