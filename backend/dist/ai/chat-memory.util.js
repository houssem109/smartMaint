"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatHistoryMaxTurns = getChatHistoryMaxTurns;
exports.mergeChatHistories = mergeChatHistories;
exports.trimHistoryForModel = trimHistoryForModel;
exports.buildConversationMemorySummary = buildConversationMemorySummary;
function getChatHistoryMaxTurns() {
    const n = Number(process.env.CHAT_HISTORY_MAX_TURNS ?? 80);
    return Number.isFinite(n) ? Math.max(8, Math.min(200, Math.floor(n))) : 80;
}
function mergeChatHistories(client, server) {
    if (!server.length)
        return client;
    if (!client.length)
        return server;
    return client.length >= server.length ? client : server;
}
function trimHistoryForModel(history, maxTurns) {
    const cap = maxTurns ?? getChatHistoryMaxTurns();
    if (history.length <= cap)
        return history;
    return history.slice(-cap);
}
function buildConversationMemorySummary(history) {
    if (history.length < 6)
        return null;
    const orders = new Set();
    const ticketIds = new Set();
    let orderTopic = false;
    let maintenanceTopic = false;
    for (const h of history) {
        const c = h.content ?? '';
        const orderMatches = c.match(/\b\d{8}\b/g);
        orderMatches?.forEach((o) => orders.add(o));
        const ticketMatch = c.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
        if (ticketMatch)
            ticketIds.add(ticketMatch[0]);
        if (/\b(commande|order|dcto|cs|ca|magasin|store)\b/i.test(c))
            orderTopic = true;
        if (/\b(ticket|machine|maintenance|pdf|manual|fault)\b/i.test(c))
            maintenanceTopic = true;
    }
    const parts = [];
    if (orders.size) {
        parts.push(`Orders discussed in this thread: ${[...orders].slice(-5).join(', ')}.`);
    }
    if (ticketIds.size) {
        parts.push(`Tickets mentioned: ${[...ticketIds].slice(-3).join(', ')}.`);
    }
    if (orderTopic && !maintenanceTopic) {
        parts.push('User is in a sales-order troubleshooting flow — do not switch to PDF/manual topics.');
    }
    if (orderTopic && maintenanceTopic) {
        parts.push('Thread mixes orders and maintenance — answer only what the latest question asks.');
    }
    if (!parts.length)
        return null;
    return `Conversation memory (do not repeat verbatim):\n${parts.join('\n')}`;
}
//# sourceMappingURL=chat-memory.util.js.map