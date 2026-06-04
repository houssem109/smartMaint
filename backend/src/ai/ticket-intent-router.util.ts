import {
  isActionCancellation,
  isActionConfirmation,
  isAwaitingTicketActionConfirm,
  isTicketActionIntent,
  parseTicketActionIntent,
  type TicketActionKind,
} from './ticket-action.util';
import { isOrderIntentMessage } from '../order-techo/order-intent.util';
import { isAwaitingTicketLookupQuery, isTicketInquiryIntent, shouldProcessTicketInquiry } from './ticket-inquiry.util';
import { getWizardStepFromHistory, isWizardSupersededByCreatedTicket, shouldStartTicketWizard } from './ticket-wizard.util';

export type TechoTurnIntent =
  | 'general_chat'
  | 'ticket_lookup'
  | 'ticket_action'
  | 'ticket_create'
  | 'wizard_continue'
  | 'action_confirm'
  | 'action_cancel'
  | 'clarify';

export type TechoTurnAction = 'delete' | 'close' | 'reopen' | 'update' | null;

export interface TechoTurnRoute {
  intent: TechoTurnIntent;
  action: TechoTurnAction;
  searchQuery: string | null;
  confidence: number;
  reason: string;
}

export interface TurnRouterContext {
  message: string;
  history?: { role: string; content: string }[];
  lastTicket: { id: string; title: string } | null;
  pendingActionKind: TicketActionKind | null;
  wizardStep: string | null;
  hasCachedTicket: boolean;
}

const CONFIDENCE_FLOOR = 0.4;
const CLARIFY_THRESHOLD = 0.52;

export function isTurnRouterEnabled(): boolean {
  return String(process.env.TICKET_INTENT_ROUTER ?? 'true').toLowerCase() !== 'false';
}

export function mapActionKindToTurnAction(kind: TicketActionKind | null): TechoTurnAction {
  if (!kind) return null;
  if (kind === 'delete' || kind === 'close' || kind === 'reopen') return kind;
  return 'update';
}

export function buildTurnRouterPrompt(ctx: TurnRouterContext): string {
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

  return (
    `Classify the LATEST user message in a factory maintenance chat (SmartMaint / Techo).\n` +
    `Reply with JSON ONLY (no markdown):\n` +
    `{"intent":"...","action":null|"delete"|"close"|"reopen"|"update","search_query":null|"text","confidence":0.0-1.0,"reason":"short"}\n\n` +
    `intent values:\n` +
    `- general_chat: manuals, how-to, greetings, off-topic, general maintenance Q&A, sales orders (commande + 8-digit order number)\n` +
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
    `- Prefer ticket_action over ticket_lookup when user asks to DO something to the ticket\n` +
    `- "commande 25109760" / "order 25108223 blocked" → general_chat (NOT ticket_lookup)\n` +
    `- 8-digit numbers are usually sales order references, not ticket IDs (tickets use UUIDs)\n\n` +
    `Examples:\n` +
    `User: "can you delete it?" (after ticket HMI frozen) → {"intent":"ticket_action","action":"delete","search_query":null,"confidence":0.9,"reason":"delete pronoun"}\n` +
    `User: "is it still open?" → {"intent":"ticket_lookup","action":null,"search_query":null,"confidence":0.85,"reason":"status question"}\n` +
    `User: "HMI screen frozen" (after "which ticket?") → {"intent":"ticket_lookup","action":null,"search_query":"HMI screen frozen","confidence":0.88,"reason":"search term"}\n` +
    `User: "i have commande 25109760 dont work" → {"intent":"general_chat","action":null,"search_query":null,"confidence":0.92,"reason":"sales order"}\n` +
    `User: "yes" (pending delete confirm) → {"intent":"action_confirm","action":null,"search_query":null,"confidence":0.95,"reason":"confirm"}\n\n` +
    `${ticketLine}\n${pendingLine}\n${wizardLine}\n\n` +
    `Recent chat:\n${recent || '(empty)'}\n\n` +
    `Latest user message: ${ctx.message}`
  );
}

export function parseTurnRouterJson(raw: string): TechoTurnRoute | null {
  if (!raw?.trim()) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw.trim());
  } catch {
    const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced?.[1]) return null;
    try {
      obj = JSON.parse(fenced[1].trim());
    } catch {
      return null;
    }
  }

  const intent = String(obj.intent ?? '').trim() as TechoTurnIntent;
  const allowedIntents: TechoTurnIntent[] = [
    'general_chat',
    'ticket_lookup',
    'ticket_action',
    'ticket_create',
    'wizard_continue',
    'action_confirm',
    'action_cancel',
    'clarify',
  ];
  if (!allowedIntents.includes(intent)) return null;

  const actionRaw = obj.action;
  let action: TechoTurnAction = null;
  if (actionRaw === 'delete' || actionRaw === 'close' || actionRaw === 'reopen' || actionRaw === 'update') {
    action = actionRaw;
  }

  const searchQuery =
    typeof obj.search_query === 'string' && obj.search_query.trim().length >= 2
      ? obj.search_query.trim().slice(0, 200)
      : null;

  let confidence = Number(obj.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const reason = typeof obj.reason === 'string' ? obj.reason.trim().slice(0, 200) : '';

  return { intent, action, searchQuery, confidence, reason };
}

/** Fast path: regex + state — skip Ollama when already obvious. */
export function detectTurnRouteHeuristic(ctx: TurnRouterContext): TechoTurnRoute | null {
  const { message, history, lastTicket, pendingActionKind, wizardStep, hasCachedTicket } = ctx;
  const hist = history ?? [];

  if (isOrderIntentMessage(message, hist)) {
    return {
      intent: 'general_chat',
      action: null,
      searchQuery: null,
      confidence: 0.96,
      reason: 'sales order',
    };
  }

  if (pendingActionKind && isActionConfirmation(message)) {
    return {
      intent: 'action_confirm',
      action: null,
      searchQuery: null,
      confidence: 0.98,
      reason: 'heuristic confirm',
    };
  }
  if ((pendingActionKind || isAwaitingTicketActionConfirm(hist)) && isActionCancellation(message)) {
    return {
      intent: 'action_cancel',
      action: null,
      searchQuery: null,
      confidence: 0.98,
      reason: 'heuristic cancel',
    };
  }

  const stepFromHistory = getWizardStepFromHistory(hist);
  const activeWizardStep =
    wizardStep ?? (isWizardSupersededByCreatedTicket(hist) ? null : stepFromHistory);
  if (activeWizardStep && !isTicketInquiryIntent(message) && !isTicketActionIntent(message)) {
    return {
      intent: 'wizard_continue',
      action: null,
      searchQuery: null,
      confidence: 0.92,
      reason: 'wizard active',
    };
  }

  if (shouldProcessTicketInquiry(message, hist, hasCachedTicket) && isTicketInquiryIntent(message)) {
    return {
      intent: 'ticket_lookup',
      action: null,
      searchQuery: null,
      confidence: 0.88,
      reason: 'heuristic inquiry',
    };
  }

  if (hasCachedTicket && isTicketActionIntent(message)) {
    const parsed = parseTicketActionIntent(message);
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

  if (shouldStartTicketWizard(message, hist)) {
    return {
      intent: 'ticket_create',
      action: null,
      searchQuery: null,
      confidence: 0.9,
      reason: 'heuristic create',
    };
  }

  if (
    isAwaitingTicketLookupQuery(hist) &&
    !activeWizardStep &&
    message.trim().length >= 3
  ) {
    return {
      intent: 'ticket_lookup',
      action: null,
      searchQuery: message.trim().slice(0, 200),
      confidence: 0.9,
      reason: 'lookup answer',
    };
  }

  if (lastTicket && isTicketActionIntent(message)) {
    const parsed = parseTicketActionIntent(message);
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

export function mergeTurnRoutes(
  llm: TechoTurnRoute | null,
  heuristic: TechoTurnRoute | null,
): TechoTurnRoute | null {
  if (!llm && !heuristic) return null;
  if (!llm) return heuristic;
  if (!heuristic) return llm;

  if (heuristic.confidence >= 0.9) return heuristic;
  if (llm.intent === heuristic.intent) {
    return {
      ...llm,
      confidence: Math.min(1, Math.max(llm.confidence, heuristic.confidence) + 0.05),
      action: llm.action ?? heuristic.action,
      searchQuery: llm.searchQuery ?? heuristic.searchQuery,
    };
  }
  if (llm.confidence >= heuristic.confidence + 0.15) return llm;
  if (heuristic.confidence >= llm.confidence + 0.15) return heuristic;
  return llm.confidence >= heuristic.confidence ? llm : heuristic;
}

export function shouldClarifyInsteadOfLoop(route: TechoTurnRoute | null): boolean {
  if (!route) return false;
  if (route.intent === 'clarify') return true;
  return (
    route.confidence < CLARIFY_THRESHOLD &&
    (route.intent === 'ticket_action' || route.intent === 'ticket_lookup')
  );
}

export function buildRouterClarifyReply(
  route: TechoTurnRoute | null,
  lang: 'en' | 'fr',
  lastTicket: { title: string } | null,
): string {
  const ticketHint = lastTicket ? ` « ${lastTicket.title} »` : '';
  if (lang === 'fr') {
    return (
      `Je ne suis pas sûr de ce que vous voulez faire${ticketHint}.\n` +
      `Dites par exemple :\n` +
      `• « supprime le ticket » ou « ferme le ticket »\n` +
      `• « est-il ouvert ? » pour consulter le statut\n` +
      `• « annuler » pour abandonner`
    );
  }
  return (
    `I'm not sure what you want to do${ticketHint ? ` with "${lastTicket!.title}"` : ''}.\n` +
    `Try for example:\n` +
    `• "delete the ticket" or "close the ticket"\n` +
    `• "is it still open?" to check status\n` +
    `• "cancel" to abort`
  );
}

export function routeImpliesTicketAction(route: TechoTurnRoute | null): boolean {
  return Boolean(route && route.intent === 'ticket_action' && route.confidence >= CONFIDENCE_FLOOR);
}

export function routeImpliesTicketLookup(route: TechoTurnRoute | null): boolean {
  return Boolean(route && route.intent === 'ticket_lookup' && route.confidence >= CONFIDENCE_FLOOR);
}

export function routeImpliesTicketCreate(route: TechoTurnRoute | null): boolean {
  return Boolean(route && route.intent === 'ticket_create' && route.confidence >= CONFIDENCE_FLOOR);
}

export function routeImpliesWizardContinue(route: TechoTurnRoute | null): boolean {
  return Boolean(route && route.intent === 'wizard_continue' && route.confidence >= CONFIDENCE_FLOOR);
}
