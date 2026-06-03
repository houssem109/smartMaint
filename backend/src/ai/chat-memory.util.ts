/** Chat history shaping for Techo (long memory within token limits). */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function getChatHistoryMaxTurns(): number {
  const n = Number(process.env.CHAT_HISTORY_MAX_TURNS ?? 80);
  return Number.isFinite(n) ? Math.max(8, Math.min(200, Math.floor(n))) : 80;
}

/** Merge client history with server history (longest wins by turn count). */
export function mergeChatHistories(client: ChatTurn[], server: ChatTurn[]): ChatTurn[] {
  if (!server.length) return client;
  if (!client.length) return server;
  return client.length >= server.length ? client : server;
}

/** Keep the most recent turns; each item is one user OR assistant message. */
export function trimHistoryForModel(history: ChatTurn[], maxTurns?: number): ChatTurn[] {
  const cap = maxTurns ?? getChatHistoryMaxTurns();
  if (history.length <= cap) return history;
  return history.slice(-cap);
}

/**
 * Short memory block injected for long threads (order numbers, topic hint).
 */
export function buildConversationMemorySummary(history: ChatTurn[]): string | null {
  if (history.length < 6) return null;

  const orders = new Set<string>();
  const ticketIds = new Set<string>();
  let orderTopic = false;
  let maintenanceTopic = false;

  for (const h of history) {
    const c = h.content ?? '';
    const orderMatches = c.match(/\b\d{8}\b/g);
    orderMatches?.forEach((o) => orders.add(o));
    const ticketMatch = c.match(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    );
    if (ticketMatch) ticketIds.add(ticketMatch[0]);
    if (/\b(commande|order|dcto|cs|ca|magasin|store)\b/i.test(c)) orderTopic = true;
    if (/\b(ticket|machine|maintenance|pdf|manual|fault)\b/i.test(c)) maintenanceTopic = true;
  }

  const parts: string[] = [];
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

  if (!parts.length) return null;
  return `Conversation memory (do not repeat verbatim):\n${parts.join('\n')}`;
}
