import { displayChatContent } from '@/lib/techo-chat-display';
import type { ChatMessage, ChatThread } from '@/store/chat-store';

export const WIDGET_RECENT_TAB_LIMIT = 3;

const GENERIC_TITLE_RE =
  /^(conversation\s*\d+|saved conversation|new chat|techo chat|chat|untitled)$/i;

const SKIP_USER_PHRASES =
  /^(hi|hello|hey|bonjour|thanks|thank you|merci|yes|no|ok|okay|oui|non|sure|please|create ticket|create a ticket|open ticket|new ticket)$/i;

export function isGenericThreadTitle(title: string | undefined | null): boolean {
  const t = title?.trim();
  if (!t) return true;
  return GENERIC_TITLE_RE.test(t);
}

export function sanitizeThreadTitle(title: string, maxLen = 56): string {
  const cleaned = title
    .replace(/\s+/g, ' ')
    .replace(/^["'«]|["'»]$/g, '')
    .trim();
  if (!cleaned) return 'Maintenance chat';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

function extractTicketTitleFromAssistant(text: string): string | null {
  const patterns = [
    /ticket\s+[«""]([^»""\n]+)[»""]/i,
    /ticket\s+"([^"\n]+)"/i,
    /(?:Titre|Title)\s*:\s*(.+?)(?:\n|$)/i,
    /Here(?:'|')?s ticket\s+"([^"\n]+)"/i,
  ];
  for (const p of patterns) {
    const hit = text.match(p);
    const raw = hit?.[1]?.trim();
    if (raw && raw.length >= 3 && raw !== '—') {
      return sanitizeThreadTitle(raw);
    }
  }
  return null;
}

export function deriveThreadTitleFromMessages(messages: ChatMessage[]): string | null {
  if (!messages.length) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== 'assistant') continue;
    const fromTicket = extractTicketTitleFromAssistant(displayChatContent(m.content));
    if (fromTicket) return fromTicket;
  }

  for (const m of messages) {
    if (m.role !== 'user') continue;
    const bare = displayChatContent(m.content).replace(/\n\[photo attached\]$/, '').trim();
    if (bare.length < 8 || SKIP_USER_PHRASES.test(bare)) continue;
    if (/^(create|open|make)\s+(a\s+)?ticket\b/i.test(bare) && bare.length < 40) continue;

    const ticketInMsg = bare.match(
      /(?:ticket|about|for|regarding)\s+["']?([^"'\n.?!]{8,80})/i,
    )?.[1];
    if (ticketInMsg?.trim()) {
      return sanitizeThreadTitle(ticketInMsg.trim());
    }

    const firstLine = bare.split(/\n/)[0]?.trim() ?? bare;
    return sanitizeThreadTitle(firstLine);
  }

  return null;
}

export function getThreadLastActivity(
  thread: ChatThread,
  messages: ChatMessage[] | undefined,
): number {
  if (messages?.length) {
    return messages[messages.length - 1]!.createdAt;
  }
  return thread.lastActivityAt ?? thread.createdAt;
}

export function getThreadDisplayTitle(
  thread: ChatThread,
  messages: ChatMessage[] | undefined,
): string {
  if (!isGenericThreadTitle(thread.title)) {
    return thread.title;
  }
  const derived = deriveThreadTitleFromMessages(messages ?? []);
  if (derived) return derived;
  return thread.title?.trim() || 'New chat';
}

export function sortThreadsByActivity(
  threads: ChatThread[],
  messagesByThread: Record<string, ChatMessage[]>,
): ChatThread[] {
  return [...threads].sort((a, b) => {
    const aTs = getThreadLastActivity(a, messagesByThread[a.id]);
    const bTs = getThreadLastActivity(b, messagesByThread[b.id]);
    return bTs - aTs;
  });
}

/** Thread has no user messages yet (only Techo greeting or empty). */
export function isGreetingOnlyThread(messages: ChatMessage[] | undefined): boolean {
  const msgs = messages ?? [];
  return !msgs.some((m) => m.role === 'user');
}

/** Reuse an empty active thread instead of creating another "New chat". */
export function findReusableEmptyThread(
  threads: ChatThread[],
  messagesByThread: Record<string, ChatMessage[]>,
): ChatThread | null {
  const sorted = sortThreadsByActivity(threads, messagesByThread);
  return sorted.find((t) => !t.archived && isGreetingOnlyThread(messagesByThread[t.id])) ?? null;
}

/** Short label for widget thread picker (avoids duplicate "New chat"). */
export function getWidgetThreadLabel(
  thread: ChatThread,
  messages: ChatMessage[] | undefined,
  allThreads: ChatThread[],
  messagesByThread: Record<string, ChatMessage[]>,
): string {
  const full = getThreadDisplayTitle(thread, messages);
  if (full !== 'New chat' && !isGenericThreadTitle(full)) {
    return full.length > 32 ? `${full.slice(0, 31)}…` : full;
  }

  const genericThreads = sortThreadsByActivity(
    allThreads.filter((t) => {
      const label = getThreadDisplayTitle(t, messagesByThread[t.id]);
      return label === 'New chat' || isGenericThreadTitle(t.title);
    }),
    messagesByThread,
  );
  const rank = genericThreads.findIndex((t) => t.id === thread.id);
  if (genericThreads.length > 1 && rank >= 0) {
    return `Chat ${genericThreads.length - rank}`;
  }

  const ts = getThreadLastActivity(thread, messages);
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Pick the best thread to show when the widget opens. */
export function pickWidgetActiveThread(
  threads: ChatThread[],
  messagesByThread: Record<string, ChatMessage[]>,
  preferredId: string | null,
): ChatThread | null {
  if (!threads.length) return null;
  const sorted = sortThreadsByActivity(threads, messagesByThread);

  if (preferredId) {
    const preferred = sorted.find((t) => t.id === preferredId);
    if (preferred && !preferred.archived) return preferred;
  }

  const withUser = sorted.find(
    (t) => !t.archived && !isGreetingOnlyThread(messagesByThread[t.id]),
  );
  if (withUser) return withUser;

  const empty = findReusableEmptyThread(threads, messagesByThread);
  if (empty) return empty;

  return sorted.find((t) => !t.archived) ?? sorted[0] ?? null;
}

/** Recent tabs for the floating widget — always includes the active thread. */
export function pickWidgetRecentThreads(
  threads: ChatThread[],
  messagesByThread: Record<string, ChatMessage[]>,
  activeThreadId: string | null,
  limit = WIDGET_RECENT_TAB_LIMIT,
): ChatThread[] {
  const sorted = sortThreadsByActivity(threads, messagesByThread);
  const picked = sorted.slice(0, limit);
  if (!activeThreadId) return picked;
  if (picked.some((t) => t.id === activeThreadId)) return picked;
  const active = threads.find((t) => t.id === activeThreadId);
  if (!active) return picked;
  return [active, ...picked.filter((t) => t.id !== activeThreadId)].slice(0, limit + 1);
}
