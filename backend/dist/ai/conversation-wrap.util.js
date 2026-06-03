"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONV_WRAP_MARKER_RE = void 0;
exports.hasContinuingTaskIntent = hasContinuingTaskIntent;
exports.tagWrapReply = tagWrapReply;
exports.stripWrapMarker = stripWrapMarker;
exports.isAwaitingMissionDoneConfirm = isAwaitingMissionDoneConfirm;
exports.isConversationEndUserMessage = isConversationEndUserMessage;
exports.isMissionCompleteConfirmation = isMissionCompleteConfirmation;
exports.isMissionCompleteDeclined = isMissionCompleteDeclined;
exports.isUserRequestingConversationEnd = isUserRequestingConversationEnd;
exports.buildMissionDoneQuestion = buildMissionDoneQuestion;
exports.buildFarewellReply = buildFarewellReply;
exports.buildMissionContinuesReply = buildMissionContinuesReply;
exports.buildEndConversationConfirm = buildEndConversationConfirm;
exports.appendMissionDonePrompt = appendMissionDonePrompt;
exports.shouldProcessConversationWrap = shouldProcessConversationWrap;
const ticket_wizard_util_1 = require("./ticket-wizard.util");
exports.CONV_WRAP_MARKER_RE = /\[CONV_WRAP:(await_done)\]/;
function normalizeEndPhrase(message) {
    return message
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^(iam|im)(?=done|finished|complete)/, '$1 ');
}
function hasContinuingTaskIntent(message) {
    const raw = message.trim();
    if (!raw)
        return false;
    const m = raw.toLowerCase().replace(/\s+/g, ' ');
    const stripped = m.replace(/^(ok|okay|sure|yeah|yep|yes|well|alright|right|so|and|also|thanks|thank you|merci),?\s+/i, '');
    const body = stripped.length >= 5 ? stripped : m;
    if (/^(ok|okay|sure|yeah|yes|yep|thanks|thank you|merci|oui|c'est bon|cest bon)$/i.test(body)) {
        return false;
    }
    const taskSignals = [
        /\b(can (you|u)|could you|would you|please|peux-tu|pourrais-tu)\b/,
        /\b(change|update|edit|modify|set|make|close|open|reopen|delete|create|assign|add|show|tell|find|check|look up|lower|raise)\b/,
        /\b(priority|priorité|status|statut|ticket|description|title|machine|area|assign)\b/,
        /\b(what|how|why|when|who|where|another|one more|also|need|want|help me|i need)\b/,
    ];
    return body.length >= 8 && taskSignals.some((r) => r.test(body));
}
function tagWrapReply(text) {
    return `[CONV_WRAP:await_done]\n${text}`;
}
function stripWrapMarker(text) {
    return text.replace(/^\[CONV_WRAP:[^\]]+\]\n?/, '').trim();
}
function isAwaitingMissionDoneConfirm(history) {
    if (!history?.length)
        return false;
    for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i];
        if (h.role !== 'assistant')
            continue;
        if (/\[CONV_WRAP:await_done\]/.test(h.content ?? ''))
            return true;
        const c = stripWrapMarker(h.content ?? '');
        if (/should I mark this conversation as done|je marque cette conversation comme terminée/i.test(c)) {
            return true;
        }
        return (/(mission done|anything else|autre chose|mission terminée|besoin d'autre chose)/i.test(c) &&
            /\?/.test(c));
    }
    return false;
}
function isConversationEndUserMessage(message) {
    const t = normalizeEndPhrase(message);
    if (!t)
        return false;
    if (isMissionCompleteConfirmation(message))
        return true;
    if (isUserRequestingConversationEnd(message))
        return true;
    return (/^(iam done|i am done|im done|i'm done|done|finished|fin|complete|mission complete|all done|that's all|thats all)$/i.test(t) || /\b(mission complete|all done|nothing else)\b/.test(t));
}
function isMissionCompleteConfirmation(message) {
    const t = normalizeEndPhrase(message);
    if ((0, ticket_wizard_util_1.isWizardCancel)(t))
        return false;
    if (hasContinuingTaskIntent(message))
        return false;
    if (t === 'y' || t === 'k')
        return true;
    if (/^(yes|yeah|yep|ye|yup|sure|ok|okay|oui|all good|that's good|thats good|perfect|done|finished|complete|nothing else|no thanks|non merci|c'est bon|cest bon|mission done|all done|that's all|thats all|iam done|i am done|im done|i'm done|mission complete)\b/.test(t)) {
        return true;
    }
    return (0, ticket_wizard_util_1.isConfirmCreate)(message) && t.length <= 40 && !hasContinuingTaskIntent(message);
}
function isMissionCompleteDeclined(message) {
    const t = message.trim().toLowerCase();
    return /^(no|nope|not yet|wait|actually|non|pas encore|j'ai encore|i still|one more|another)/.test(t);
}
function isUserRequestingConversationEnd(message) {
    const t = normalizeEndPhrase(message);
    return (/\b(close|end|finish|terminer|fermer)\b.*\b(conversation|chat|discussion|convo)\b/.test(t) ||
        /\b(i'm done|im done|i am done|iam done|that's all|thats all|all done|mission complete|nothing else to do|je suis bon|j'ai fini)\b/.test(t) ||
        /^(done|finished|complete|mission complete|all done)$/i.test(t));
}
function buildMissionDoneQuestion(name, lang) {
    if (lang === 'fr') {
        return `${name ? `${name}, ` : ''}Besoin d'autre chose, ou votre mission est terminée ?`;
    }
    return `${name ? `${name}, ` : ''}Anything else I can help with, or you are done?`;
}
function buildFarewellReply(name, lang) {
    if (lang === 'fr') {
        return `${name ? `${name}, ` : ''}Parfait — content d'avoir pu aider. À bientôt sur le floor !`;
    }
    return `${name ? `${name}, ` : ''}Great — glad I could help. See you on the floor!`;
}
function buildMissionContinuesReply(lang) {
    return lang === 'fr'
        ? "D'accord — que puis-je faire d'autre pour vous ?"
        : 'Sure — what else can I help you with?';
}
function buildEndConversationConfirm(name, lang) {
    if (lang === 'fr') {
        return `${name ? `${name}, ` : ''}Je marque cette conversation comme terminée ? Répondez « oui » pour fermer ou « non » pour continuer.`;
    }
    return `${name ? `${name}, ` : ''}Should I mark this conversation as done? Reply "yes" to close it or "no" to keep chatting.`;
}
function appendMissionDonePrompt(reply, lang, name) {
    const prompt = buildMissionDoneQuestion(name, lang);
    const combined = `${reply.trim()}\n\n${prompt}`;
    return { reply: combined, persistReply: tagWrapReply(combined) };
}
function shouldProcessConversationWrap(message, history) {
    if (isAwaitingMissionDoneConfirm(history) && hasContinuingTaskIntent(message))
        return false;
    if (isAwaitingMissionDoneConfirm(history))
        return true;
    if (isUserRequestingConversationEnd(message))
        return true;
    if (isConversationEndUserMessage(message) && isAwaitingMissionDoneConfirm(history))
        return true;
    return false;
}
//# sourceMappingURL=conversation-wrap.util.js.map