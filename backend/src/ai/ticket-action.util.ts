import { UpdateTicketDto } from '../tickets/dto/update-ticket.dto';
import { TicketPriority, TicketStatus } from '../tickets/entities/ticket.entity';
import { isConfirmCreate, isWizardCancel } from './ticket-wizard.util';

export type TicketActionKind = 'close' | 'delete' | 'reopen' | 'update';

export interface PendingTicketAction {
  kind: TicketActionKind;
  ticketId: string;
  ticketTitle: string;
  updates: Partial<UpdateTicketDto>;
  lang: 'en' | 'fr';
  summary: string;
}

export const TICKET_ACTION_MARKER_RE = /\[TICKET_ACTION:await_confirm:([^\]]+)\]/;

export function tagActionConfirmReply(actionKey: string, text: string): string {
  return `[TICKET_ACTION:await_confirm:${actionKey}]\n${text}`;
}

export function stripActionMarker(text: string): string {
  return text.replace(/^\[TICKET_ACTION:[^\]]+\]\n?/, '').trim();
}

export function isAwaitingTicketActionConfirm(
  history?: { role: string; content: string }[],
): boolean {
  if (!history?.length) return false;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.role !== 'assistant') continue;
    return TICKET_ACTION_MARKER_RE.test(history[i]!.content ?? '');
  }
  return false;
}

export function parseActionKeyFromHistory(
  history?: { role: string; content: string }[],
): string | null {
  if (!history?.length) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.role !== 'assistant') continue;
    const m = (history[i]!.content ?? '').match(TICKET_ACTION_MARKER_RE);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isActionConfirmation(message: string): boolean {
  if (isWizardCancel(message)) return false;
  return isConfirmCreate(message);
}

export function isActionCancellation(message: string): boolean {
  return isWizardCancel(message);
}

/** User wants to change or remove an existing ticket (not read-only lookup). */
export function isTicketActionIntent(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) return false;

  if (isAwaitingTicketActionConfirm([{ role: 'user', content: message }])) return false;

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

function wantsOpenStatus(m: string): boolean {
  if (/\b(reopen|re-open|rouvrir)\b/.test(m)) return true;
  if (/\bopen\b.*\b(again|it|this|ticket)\b/.test(m)) return true;
  if (/\b(want|need|like)\b.*\bopen\b/.test(m)) return true;
  if (/\b(make|set|change|update|switch|turn)\b.*\b(open|ouvert)\b/.test(m)) return true;
  return false;
}

export function parseTicketActionIntent(message: string): {
  kind: TicketActionKind | null;
  updates: Partial<UpdateTicketDto>;
  summaryEn: string;
  summaryFr: string;
} {
  const m = message.trim().toLowerCase();
  const empty = { kind: null as TicketActionKind | null, updates: {}, summaryEn: '', summaryFr: '' };

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
      updates: { status: TicketStatus.OPEN },
      summaryEn: 'reopen this ticket (status → open)',
      summaryFr: 'rouvrir ce ticket (statut → ouvert)',
    };
  }

  if (
    /\b(close|fermer|ferme|closed|fermé)\b/.test(m) ||
    /\bcan.*close|\bplease close|\bclose it\b|\bclose this\b|\bmake it close/.test(m)
  ) {
    return {
      kind: 'close',
      updates: { status: TicketStatus.CLOSED },
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
      kind: status === TicketStatus.OPEN ? 'reopen' : 'update',
      updates: { status },
      summaryEn:
        status === TicketStatus.OPEN
          ? 'reopen this ticket (status → open)'
          : `set status to ${status}`,
      summaryFr:
        status === TicketStatus.OPEN
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

function parsePriorityFromMessage(m: string): TicketPriority | null {
  if (/\b(critical|critique)\b/.test(m)) return TicketPriority.CRITICAL;
  if (/\b(high|haute|élevée)\b/.test(m)) return TicketPriority.HIGH;
  if (/\b(medium|moyenne)\b/.test(m)) return TicketPriority.MEDIUM;
  if (/\b(low|basse|faible)\b/.test(m)) return TicketPriority.LOW;
  return null;
}

function parseStatusFromMessage(m: string): TicketStatus | null {
  if (/\b(in progress|en cours)\b/.test(m)) return TicketStatus.IN_PROGRESS;
  if (/\b(in review|en revue)\b/.test(m)) return TicketStatus.IN_REVIEW;
  if (/\b(solved|résolu|resolved)\b/.test(m)) return TicketStatus.SOLVED;
  if (/\b(closed|fermé|close)\b/.test(m)) return TicketStatus.CLOSED;
  if (/\b(open|ouvert)\b/.test(m)) return TicketStatus.OPEN;
  return null;
}

function parseFieldUpdate(message: string, field: 'description' | 'title'): string | null {
  const patterns =
    field === 'description'
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
    if (hit?.[1]?.trim()) return hit[1].trim();
  }
  return null;
}

export function buildActionConfirmPrompt(
  action: PendingTicketAction,
  lang: 'en' | 'fr',
): string {
  const shortId = action.ticketId.slice(0, 8);
  if (lang === 'fr') {
    return (
      `Je vais ${action.summary} pour le ticket « ${action.ticketTitle} » (${shortId}…).\n` +
      `Êtes-vous sûr ? Répondez « oui » pour confirmer ou « annuler » pour abandonner.`
    );
  }
  return (
    `I'll ${action.summary} for ticket "${action.ticketTitle}" (${shortId}…).\n` +
    `Are you sure? Reply "yes" to confirm or "cancel" to abort.`
  );
}

export function buildActionSuccessReply(
  action: PendingTicketAction,
  lang: 'en' | 'fr',
): string {
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

export function buildActionCancelledReply(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? "D'accord — je n'ai rien modifié sur le ticket."
    : "Okay — I didn't change the ticket.";
}

export function buildActionErrorReply(error: string, lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? `Je n'ai pas pu effectuer cette action : ${error}`
    : `I couldn't complete that action: ${error}`;
}

export function buildNoTicketForActionReply(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? 'Quel ticket voulez-vous modifier ? Donnez le titre ou l’ID (après une recherche, je me souviens du dernier ticket consulté).'
    : 'Which ticket should I update? Give me the title or ID (after a lookup, I remember the last ticket we discussed).';
}

export function shouldProcessTicketAction(
  message: string,
  history?: { role: string; content: string }[],
  hasPendingAction?: boolean,
  hasTicketContext?: boolean,
): boolean {
  if (hasPendingAction || isAwaitingTicketActionConfirm(history)) return true;
  if (isTicketActionIntent(message) && hasTicketContext) return true;
  if (!hasTicketContext && !isTicketActionIntent(message)) return false;
  return false;
}
