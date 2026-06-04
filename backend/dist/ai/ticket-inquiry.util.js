"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_INQUIRY_MARKER_RE = void 0;
exports.tagInquiryReply = tagInquiryReply;
exports.stripInquiryMarker = stripInquiryMarker;
exports.getLastAssistantText = getLastAssistantText;
exports.isAwaitingTicketLookupQuery = isAwaitingTicketLookupQuery;
exports.hasRecentTicketInquiryContext = hasRecentTicketInquiryContext;
exports.isTicketInquiryFollowUp = isTicketInquiryFollowUp;
exports.findRecentTicketSearchTermFromHistory = findRecentTicketSearchTermFromHistory;
exports.extractBareSearchQuery = extractBareSearchQuery;
exports.shouldProcessTicketInquiry = shouldProcessTicketInquiry;
exports.isTicketInquiryIntent = isTicketInquiryIntent;
exports.extractTicketIdFromText = extractTicketIdFromText;
exports.extractTicketSearchQuery = extractTicketSearchQuery;
exports.extractTicketInquiryAspect = extractTicketInquiryAspect;
exports.formatTicketInquiryReply = formatTicketInquiryReply;
exports.formatMultipleTicketsReply = formatMultipleTicketsReply;
exports.formatNoTicketReply = formatNoTicketReply;
exports.formatNeedQueryReply = formatNeedQueryReply;
const order_intent_util_1 = require("../order-techo/order-intent.util");
const ticket_wizard_util_1 = require("./ticket-wizard.util");
const ticket_action_util_1 = require("./ticket-action.util");
const conversation_wrap_util_1 = require("./conversation-wrap.util");
exports.TICKET_INQUIRY_MARKER_RE = /\[TICKET_INQUIRY:(await_query|found)\]/;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
function tagInquiryReply(kind, text) {
    return `[TICKET_INQUIRY:${kind}]\n${text}`;
}
function stripInquiryMarker(text) {
    return text.replace(/^\[TICKET_INQUIRY:[^\]]+\]\n?/, '').trim();
}
function getLastAssistantText(history) {
    if (!history?.length)
        return null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'assistant') {
            return stripInquiryMarker(history[i].content ?? '');
        }
    }
    return null;
}
function isLookupPromptMessage(content) {
    if (/\[TICKET_INQUIRY:await_query\]/.test(content))
        return true;
    const c = stripInquiryMarker(content);
    return /which ticket should i look up|quel ticket voulez-vous consulter/i.test(c);
}
function isAwaitingTicketLookupQuery(history) {
    if (!history?.length)
        return false;
    let lastPromptIdx = -1;
    for (let i = 0; i < history.length; i++) {
        if (history[i].role === 'assistant' && isLookupPromptMessage(history[i].content ?? '')) {
            lastPromptIdx = i;
        }
    }
    if (lastPromptIdx < 0)
        return false;
    for (let i = lastPromptIdx + 1; i < history.length; i++) {
        if (history[i].role === 'user')
            return false;
    }
    return true;
}
function hasRecentTicketInquiryContext(history) {
    if (!history?.length)
        return false;
    if (isAwaitingTicketLookupQuery(history))
        return true;
    const userBlob = history
        .filter((h) => h.role === 'user')
        .slice(-6)
        .map((h) => h.content ?? '')
        .join('\n')
        .toLowerCase();
    return (/\b(ask|question|info|check|look up|lookup|find|search|tell me|show me|about|know|consulter)\b.*\btickets?\b/.test(userBlob) ||
        /\btickets?\b.*\b(about|status|open|assign|problem|description|info)\b/.test(userBlob) ||
        history.some((h) => h.role === 'assistant' && /\[TICKET_INQUIRY:found\]/.test(h.content ?? '')));
}
function isTicketInquiryFollowUp(message) {
    const m = message.trim().toLowerCase();
    if (!m)
        return false;
    if (/\b(create|open|make|créer)\s+(a\s+)?(new\s+)?ticket\b/.test(m))
        return false;
    if ((0, ticket_action_util_1.isTicketActionIntent)(message))
        return false;
    return (/\b(it|this|that|the ticket|ce ticket|same one)\b/.test(m) ||
        (m.length <= 100 &&
            /\b(open|closed|assign|assigned|status|priority|description|problem|who|machine|area|still|yet)\b/.test(m)));
}
function findRecentTicketSearchTermFromHistory(history) {
    if (!history?.length)
        return null;
    let afterLookupPrompt = false;
    for (const h of history) {
        if (h.role === 'assistant') {
            const c = h.content ?? '';
            if (/\[TICKET_INQUIRY:await_query\]/i.test(c) || /which ticket should i look up/i.test(c)) {
                afterLookupPrompt = true;
            }
            if (/\[TICKET_INQUIRY:found\]/i.test(c)) {
                afterLookupPrompt = false;
            }
        }
        if (h.role === 'user' && afterLookupPrompt) {
            const bare = h.content.trim().replace(/^["']|["']$/g, '');
            if (bare.length >= 3 &&
                bare.length <= 200 &&
                !/\?/.test(bare) &&
                !/\b(ask about|create|hello|hi|bonjour)\b/i.test(bare)) {
                return bare;
            }
        }
    }
    return null;
}
function extractBareSearchQuery(message) {
    const bare = message.trim().replace(/^["']|["']$/g, '');
    if (bare.length < 3 || bare.length > 200)
        return null;
    if ((0, conversation_wrap_util_1.isConversationEndUserMessage)(bare))
        return null;
    if (/\b(create|make|open|créer)\s+(a\s+)?ticket\b/i.test(bare))
        return null;
    if (/^(hello|hi|hey|bonjour|thanks|merci)\b/i.test(bare))
        return null;
    return bare;
}
function shouldProcessTicketInquiry(message, history, hasCachedTicket) {
    if ((0, order_intent_util_1.isOrderIntentMessage)(message, history))
        return false;
    if ((0, ticket_wizard_util_1.isTicketWizardActiveInHistory)(history) || (0, ticket_wizard_util_1.isAwaitingWizardUserInput)(history))
        return false;
    if ((0, ticket_action_util_1.isTicketActionIntent)(message) || (0, ticket_action_util_1.isAwaitingTicketActionConfirm)(history))
        return false;
    if ((0, conversation_wrap_util_1.isAwaitingMissionDoneConfirm)(history))
        return false;
    if ((0, conversation_wrap_util_1.isConversationEndUserMessage)(message))
        return false;
    if (isTicketInquiryIntent(message))
        return true;
    if (isAwaitingTicketLookupQuery(history) && extractBareSearchQuery(message))
        return true;
    if (hasCachedTicket && isTicketInquiryFollowUp(message))
        return true;
    if (hasRecentTicketInquiryContext(history) && isTicketInquiryFollowUp(message))
        return true;
    if (hasRecentTicketInquiryContext(history) && extractBareSearchQuery(message))
        return true;
    return false;
}
function isTicketInquiryIntent(message) {
    const m = message.trim().toLowerCase();
    if (!m)
        return false;
    if (/\b(ask|question|info|check|look up|lookup|find|search|tell me|show me|know about|consulter)\b/.test(m) &&
        /\btickets?\b/.test(m) &&
        !/\b(create|open|make|créer|new ticket)\b/.test(m)) {
        return true;
    }
    if ((0, ticket_wizard_util_1.isBareTicketTrigger)(message) || /^(please\s+)?(create|open|make|créer)\b/.test(m)) {
        if (!/\b(about|existing|that|the|my|check|find|lookup|search|show|what|status|assign)\b/.test(m)) {
            if ((0, ticket_wizard_util_1.isTicketWizardTrigger)(message) && !/\b(about|check|find|what|status|assign|describe)\b/.test(m)) {
                return false;
            }
        }
    }
    const mentionsTicket = /\btickets?\b/.test(m) ||
        UUID_RE.test(message) ||
        /\b(that ticket|this ticket|ce ticket|cet ticket|the one)\b/.test(m);
    if (!mentionsTicket)
        return false;
    const inquirySignals = [
        /\b(what|whats|what's|tell me|show me|check|look up|find|search|give me)\b/,
        /\b(description|describe|detail|details|problem|issue|wrong|happened|about)\b/,
        /\b(status|open|closed|solved|resolved|fermé|ouvert|statut|résolu)\b/,
        /\b(assign|assigned|assignment|technician|tech\b|who is working|qui est assigné)\b/,
        /\b(priority|priorité|urgent|critical)\b/,
        /\b(machine|area|zone|line|ligne)\b/,
        /\b(is it|are they|still|yet)\b/,
        /\b(problème|décri|renseign|inform)/,
    ];
    return inquirySignals.some((r) => r.test(m));
}
function extractTicketIdFromText(message) {
    return message.match(UUID_RE)?.[0];
}
function extractTicketSearchQuery(message, history) {
    if ((0, order_intent_util_1.isOrderIntentMessage)(message, history))
        return null;
    const uuid = extractTicketIdFromText(message);
    if (uuid)
        return uuid;
    if (isAwaitingTicketLookupQuery(history)) {
        const bare = extractBareSearchQuery(message);
        if (bare)
            return bare;
    }
    const tryFromText = (text) => {
        if (!text?.trim())
            return null;
        const patterns = [
            /ticket\s+(?:about|for|regarding|on)\s+["']?(.+?)["']?\s*$/i,
            /ticket\s+(?:named|called|titled?|with\s+(?:the\s+)?title)\s+["']?(.+?)["']?\s*$/i,
            /(?:about|for)\s+(?:the\s+)?ticket\s+["']?(.+?)["']?\s*$/i,
            /(?:what|tell me).*(?:problem|issue|description|status).*?\bticket\b\s+["']?(.+?)["']?\s*$/i,
            /(?:the\s+)?ticket\s+["'](.+?)["']/i,
            /ticket\s+(.+?)\s*[-–—]?\s*(?:what|is it|status|open|assign)/i,
            /(?:check|find|lookup|search)\s+(?:the\s+)?ticket\s+["']?(.+?)["']?\s*$/i,
            /ticket\s+(.+?)\s*\?\s*$/i,
        ];
        for (const p of patterns) {
            const hit = text.match(p);
            const q = hit?.[1]?.trim().replace(/^["']|["']$/g, '');
            if (q && q.length >= 3 && q.length <= 200)
                return q;
        }
        return null;
    };
    const fromMsg = tryFromText(message);
    if (fromMsg)
        return fromMsg;
    const followUp = isTicketInquiryFollowUp(message) &&
        (hasRecentTicketInquiryContext(history) || /\b(it|this|that|the ticket|ce ticket)\b/i.test(message));
    if (followUp && history?.length) {
        const recentTerm = findRecentTicketSearchTermFromHistory(history);
        if (recentTerm)
            return recentTerm;
        for (const h of [...history].reverse()) {
            if (h.role !== 'user')
                continue;
            const q = tryFromText(h.content);
            if (q)
                return q;
            const bare = h.content.trim();
            if (bare.length >= 5 &&
                bare.length <= 180 &&
                !/\?/.test(bare) &&
                !/\b(create|open|make|status|list|show all)\b/i.test(bare)) {
                return bare.replace(/^["']|["']$/g, '');
            }
        }
    }
    return null;
}
function extractTicketInquiryAspect(message) {
    const m = message.toLowerCase();
    if (/\b(description|describe|detail|what.*(wrong|happened|problem|issue)|problème|décri)/.test(m)) {
        return 'description';
    }
    if (/\b(assign|assigned|technician|tech\b|who.*(working|handling)|qui est assigné)/.test(m)) {
        return 'assignment';
    }
    if (/\b(open|closed|status|statut|ouvert|fermé|solved|résolu|still open)\b/.test(m)) {
        return 'status';
    }
    if (/\b(priority|priorité|urgent|critical|high|low)\b/.test(m)) {
        return 'priority';
    }
    if (/\b(machine|area|zone|line|ligne)\b/.test(m)) {
        return 'location';
    }
    return 'overview';
}
function assignedLabel(ticket) {
    if (ticket.assignedTo?.fullName)
        return ticket.assignedTo.fullName;
    if (ticket.assignedTo?.username)
        return ticket.assignedTo.username;
    if (ticket.assignedTo?.email)
        return ticket.assignedTo.email.split('@')[0] ?? ticket.assignedTo.email;
    if (ticket.assignedToId)
        return `Technician (${ticket.assignedToId.slice(0, 8)}…)`;
    return '';
}
function formatTicketInquiryReply(ticket, aspect, lang) {
    const assigned = assignedLabel(ticket);
    const unassigned = lang === 'fr' ? 'Personne pour l’instant' : 'Not assigned yet';
    const assignText = assigned || unassigned;
    const shortId = ticket.id.slice(0, 8);
    if (lang === 'fr') {
        switch (aspect) {
            case 'description':
                return (`Ticket « ${ticket.title} » (${shortId}…)\n\n` +
                    `Description :\n${ticket.description}\n\n` +
                    `Statut : ${ticket.status} · Priorité : ${ticket.priority} · Assigné : ${assignText}`);
            case 'status':
                return (`Ticket « ${ticket.title} » (${shortId}…)\n` +
                    `Statut : ${ticket.status}` +
                    (ticket.status === 'open'
                        ? ' — le ticket est encore ouvert.'
                        : ticket.status === 'closed'
                            ? ' — le ticket est fermé.'
                            : '') +
                    `\nPriorité : ${ticket.priority}`);
            case 'assignment':
                return assigned
                    ? `Ticket « ${ticket.title} » (${shortId}…) est assigné à ${assigned}.`
                    : `Ticket « ${ticket.title} » (${shortId}…) n’est assigné à aucun technicien pour le moment.`;
            case 'priority':
                return `Ticket « ${ticket.title} » (${shortId}…) — priorité : ${ticket.priority}.`;
            case 'location': {
                const parts = [ticket.machine, ticket.area].filter(Boolean);
                return parts.length
                    ? `Ticket « ${ticket.title} » — machine/zone : ${parts.join(' · ')}.`
                    : `Ticket « ${ticket.title} » — aucune machine ou zone renseignée.`;
            }
            default:
                return (`Voici le ticket « ${ticket.title} » (${shortId}…)\n` +
                    `Statut : ${ticket.status} · Priorité : ${ticket.priority} · Catégorie : ${ticket.category}\n` +
                    `Assigné : ${assignText}\n` +
                    (ticket.machine ? `Machine : ${ticket.machine}\n` : '') +
                    (ticket.area ? `Zone : ${ticket.area}\n` : '') +
                    `\nDescription :\n${ticket.description}`);
        }
    }
    switch (aspect) {
        case 'description':
            return (`Ticket "${ticket.title}" (${shortId}…)\n\n` +
                `Description:\n${ticket.description}\n\n` +
                `Status: ${ticket.status} · Priority: ${ticket.priority} · Assigned: ${assignText}`);
        case 'status': {
            const openHint = ticket.status === 'open'
                ? ' — this ticket is still open.'
                : ticket.status === 'closed'
                    ? ' — this ticket is closed.'
                    : '';
            return (`Ticket "${ticket.title}" (${shortId}…)\n` +
                `Status: ${ticket.status}${openHint}\n` +
                `Priority: ${ticket.priority}`);
        }
        case 'assignment':
            return assigned
                ? `Ticket "${ticket.title}" (${shortId}…) is assigned to ${assigned}.`
                : `Ticket "${ticket.title}" (${shortId}…) is not assigned to a technician yet.`;
        case 'priority':
            return `Ticket "${ticket.title}" (${shortId}…) — priority: ${ticket.priority}.`;
        case 'location': {
            const parts = [ticket.machine, ticket.area].filter(Boolean);
            return parts.length
                ? `Ticket "${ticket.title}" — machine/area: ${parts.join(' · ')}.`
                : `Ticket "${ticket.title}" — no machine or area recorded.`;
        }
        default:
            return (`Here’s ticket "${ticket.title}" (${shortId}…)\n` +
                `Status: ${ticket.status} · Priority: ${ticket.priority} · Category: ${ticket.category}\n` +
                `Assigned: ${assignText}\n` +
                (ticket.machine ? `Machine: ${ticket.machine}\n` : '') +
                (ticket.area ? `Area: ${ticket.area}\n` : '') +
                `\nDescription:\n${ticket.description}`);
    }
}
function formatMultipleTicketsReply(tickets, lang) {
    const lines = tickets.map((t) => `- ${t.title} (${t.id.slice(0, 8)}…) · ${t.status} · ${t.priority}`);
    if (lang === 'fr') {
        return (`J’ai trouvé plusieurs tickets :\n${lines.join('\n')}\n\n` +
            `Précisez le titre exact ou collez l’ID du ticket.`);
    }
    return (`I found several matching tickets:\n${lines.join('\n')}\n\n` +
        `Tell me the exact title or paste the ticket ID so I can answer precisely.`);
}
function formatNoTicketReply(query, lang) {
    if (lang === 'fr') {
        return `Je n’ai pas trouvé de ticket accessible correspondant à « ${query} ». Essayez le titre exact, un mot de la description, ou l’ID complet.`;
    }
    return `I couldn’t find an accessible ticket matching "${query}". Try the exact title, a few words from the description, or the full ticket ID.`;
}
function formatNeedQueryReply(lang) {
    const text = lang === 'fr'
        ? 'Quel ticket voulez-vous consulter ? Donnez le titre, un extrait de la description, ou l’ID.'
        : 'Which ticket should I look up? Give me the title, a few words from the description, or the ticket ID.';
    return tagInquiryReply('await_query', text);
}
//# sourceMappingURL=ticket-inquiry.util.js.map