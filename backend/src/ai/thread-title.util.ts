export function stripThreadTitleSource(content: string): string {
  return content
    .replace(/^\[TICKET_WIZARD:[^\]]+\]\n?/, '')
    .replace(/^\[TICKET_INQUIRY:[^\]]+\]\n?/, '')
    .replace(/^\[TICKET_ACTION:[^\]]+\]\n?/, '')
    .replace(/^\[CONV_WRAP:[^\]]+\]\n?/, '')
    .replace(/\n\[photo attached\]$/, '')
    .trim();
}

const GENERIC_TITLE_RE =
  /^(conversation\s*\d+|saved conversation|new chat|techo chat|chat|untitled)$/i;

const SKIP_USER_PHRASES =
  /^(hi|hello|hey|bonjour|thanks|thank you|merci|yes|no|ok|okay|oui|non|sure|please|create ticket|create a ticket|open ticket|new ticket|créer un ticket|ok try to create ticket)$/i;

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
    /Voici le ticket\s+[«""]([^»""\n]+)[»""]/i,
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

function isSubstantiveUserMessage(text: string): boolean {
  const bare = stripThreadTitleSource(text);
  if (bare.length < 8) return false;
  if (SKIP_USER_PHRASES.test(bare)) return false;
  if (/^(create|open|make|créer)\s+(a\s+)?ticket\b/i.test(bare) && bare.length < 40) return false;
  return true;
}

/** Derive a short conversation title from chat turns (no LLM). */
export function deriveThreadTitleHeuristic(
  turns: { role: string; content: string }[],
): string | null {
  if (!turns?.length) return null;

  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]!;
    if (t.role !== 'assistant') continue;
    const fromTicket = extractTicketTitleFromAssistant(stripThreadTitleSource(t.content ?? ''));
    if (fromTicket) return fromTicket;
  }

  for (const t of turns) {
    if (t.role !== 'user') continue;
    const bare = stripThreadTitleSource(t.content ?? '');
    if (!isSubstantiveUserMessage(bare)) continue;

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

export function buildThreadTitleLlmPrompt(
  turns: { role: string; content: string }[],
): string {
  const snippet = turns
    .slice(-8)
    .map((t) => {
      const c = stripThreadTitleSource(t.content ?? '').slice(0, 220);
      return `${t.role}: ${c}`;
    })
    .join('\n');

  return (
    `Write a short title (3–8 words) for this factory maintenance chat thread.\n` +
    `Focus on the machine issue, ticket topic, or main task — not "conversation" or "chat".\n` +
    `Reply JSON only: {"title":"..."}\n\n` +
    `${snippet}`
  );
}

export function parseThreadTitleLlmJson(raw: string): string | null {
  if (!raw?.trim()) return null;
  try {
    const obj = JSON.parse(raw.trim()) as { title?: unknown };
    if (typeof obj.title === 'string' && obj.title.trim().length >= 3) {
      return sanitizeThreadTitle(obj.title.trim());
    }
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        const obj = JSON.parse(fenced[1].trim()) as { title?: unknown };
        if (typeof obj.title === 'string' && obj.title.trim().length >= 3) {
          return sanitizeThreadTitle(obj.title.trim());
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export function isThreadTitleLlmEnabled(): boolean {
  return String(process.env.THREAD_TITLE_LLM ?? 'true').toLowerCase() !== 'false';
}
