import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import { TicketCategory, TicketPriority } from '../tickets/entities/ticket.entity';

export type TicketWizardStep =
  | 'await_title'
  | 'await_description'
  | 'await_location'
  | 'await_confirm'
  | 'await_suggestion_accept';

export type TicketIntentKind =
  | 'none'
  | 'explicit_ticket'
  | 'problem_report'
  | 'wizard_continue';

export interface TicketIntentResult {
  kind: TicketIntentKind;
  /** Short title guessed from a problem description (optional). */
  suggestedTitle?: string;
  confidence: 'high' | 'medium';
}

export interface TicketWizardSession {
  step: TicketWizardStep;
  draft: Partial<CreateTicketDto>;
  /** Suggested text waiting for user approval ("add that"). */
  pendingEnhancement?: string;
  lang: 'en' | 'fr';
  /** How the user entered the wizard (explicit request vs describing a problem). */
  entryKind?: 'explicit_ticket' | 'problem_report';
}

export const TICKET_WIZARD_MARKER_RE =
  /\[TICKET_WIZARD:(await_title|await_description|await_location|await_confirm|await_suggestion_accept)\]/;

const TICKET_TRIGGERS = [
  'create ticket',
  'create a ticket',
  'open a ticket',
  'open ticket',
  'new ticket',
  'submit ticket',
  'raise ticket',
  'make ticket',
  'report incident',
  'report a problem',
  'report problem',
  'i have a problem',
  "j'ai un problème",
  'signaler un problème',
  'signaler un problem',
  'creer ticket',
  'créer ticket',
  'créer un ticket',
  'ouvrir ticket',
  'faire un ticket',
  'create an issue',
];

export function isTicketWizardTrigger(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (TICKET_TRIGGERS.some((w) => lower.includes(w))) return true;
  // "create a ticket" does NOT include substring "create ticket" (extra "a ")
  if (/\b(create|open|make|créer|ouvrir|faire)(\s+(a|an|un))?\s+ticket\b/.test(lower)) return true;
  if (/\b(want|need|would like|i'd like|i would like|i need)\s+to\s+(create|open|make|créer|ouvrir)\b/.test(lower) && /\bticket\b/.test(lower)) {
    return true;
  }
  if (/\breport\s+(an?\s+)?(incident|problem)\b/.test(lower)) return true;
  if (/\b(signaler|faire)\s+(un\s+)?(problème|problem|ticket)\b/.test(lower)) return true;
  return false;
}

/** User refers to a ticket for something already discussed in the thread. */
export function isContextualTicketRequest(
  message: string,
  history?: { role: string; content: string }[],
): boolean {
  const lower = message.trim().toLowerCase();
  if (/\b(create|make|open|créer|ouvrir)\s+(a\s+)?(one|it|this)\b/.test(lower) && /\b(ticket|ticket pour)\b/.test(lower)) {
    return true;
  }
  if (/\b(put|log|register|file|enregistrer)\s+(this|it|that|ça)\s+(as\s+)?(a\s+)?ticket\b/.test(lower)) {
    return true;
  }
  if (/\b(make|create|créer)\s+(a\s+)?ticket\s+(for\s+)?(this|that|it|ça)\b/.test(lower)) {
    return true;
  }
  if (/\bturn\s+this\s+into\s+(a\s+)?ticket\b/.test(lower)) return true;

  const recentUserText = [
    ...(history ?? []).filter((h) => h.role === 'user').slice(-3).map((h) => h.content ?? ''),
    message,
  ]
    .join('\n')
    .toLowerCase();

  const hadProblemContext =
    isProblemReportPhrase(recentUserText) ||
    /\b(hmi|machine|line|ligne|filler|panel|plc|production|arrêt|stopped)\b/.test(recentUserText);

  if (
    hadProblemContext &&
    lower.length < 90 &&
    /\b(yes|yeah|ok|please|go ahead|do it|create|ticket|créer|oui|valider)\b/.test(lower)
  ) {
    return true;
  }
  return false;
}

/** Describes a floor problem — not a pure how-to / documentation question. */
export function isProblemReportPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  if (isTriggerOnlyPhrase(text)) return false;

  const strongPatterns = [
    /\bi have (a |an )?(problem|issue|trouble)\b/,
    /\bi'?ve got (a |an )?(problem|issue)\b/,
    /\b(j'ai|jai) (un |le )?(problème|problem|souci|panne)\b/,
    /\bon a (un )?(problème|panne)\b/,
    /\bsomething('s| is) wrong\b/,
    /\b(not working|doesn't work|doesnt work|won't start|wont start|ne marche pas|ne fonctionne pas)\b/,
    /\b(broken|down|stopped|frozen|blank screen|écran noir|no power|en panne)\b/,
    /\bproduction (stopped|down|halted|arrêtée)\b/,
    /\b(line|ligne|machine) (is )?(down|stopped|arrêtée)\b/,
    /\b(need|want) (to )?(report|log|file|signaler)\b/,
    /\bhelp me (with|fix)\b/,
    /\bcan you help (me )?(with|fix)\b/,
    /\b(there is|there's|we have) (a |an )?(problem|issue|fault|alarm)\b/,
    /\b(il y a|y'a) (un )?(problème|panne|souci)\b/,
  ];
  if (strongPatterns.some((r) => r.test(lower))) return true;

  const equipment =
    /\b(hmi|plc|machine|line|ligne|filler|panel|convoyeur|motor|pump|sensor|écran|remplisseuse)\b/;
  const symptom =
    /\b(frozen|stuck|error|alarm|fault|leak|noise|overheat|vibration|blank|offline|arrêt|panne|erreur)\b/;
  if (text.trim().length >= 28 && equipment.test(lower) && symptom.test(lower)) return true;

  return false;
}

export function isGeneralHowToOnly(message: string): boolean {
  const t = message.trim();
  const lower = t.toLowerCase();
  if (/^(how do i|how to|how can i|what is|what are|what does|can you explain|why is|where can i find)\b/i.test(t)) {
    return !isProblemReportPhrase(t);
  }
  if (/\?\s*$/.test(t) && !/\b(not working|broken|stopped|problem|issue|down|frozen|alarm)\b/.test(lower)) {
    return t.length < 120;
  }
  return false;
}

export function extractTitleFromProblemReport(message: string): string | undefined {
  const msg = message.trim();
  const withMatch = msg.match(
    /\b(?:problem|issue|trouble|problème|panne)\s+(?:with|on|sur|avec)\s+(?:the\s+|la\s+|le\s+)?(.+?)(?:[.!,]|\s+(?:it|and|et)\s|$)/i,
  );
  if (withMatch?.[1]) {
    const core = withMatch[1].trim();
    const title = `Problem with ${core}`;
    return title.length > 200 ? `${title.slice(0, 197)}...` : title;
  }
  const first = msg.split(/[.!?\n]/)[0]?.trim();
  if (first && first.length >= 8 && !isTriggerOnlyPhrase(first)) {
    return first.length > 200 ? `${first.slice(0, 197)}...` : first;
  }
  return undefined;
}

/** Decide from message + chat context if the ticket wizard should run. */
export function analyzeTicketCreationIntent(
  message: string,
  history?: { role: string; content: string }[],
): TicketIntentResult {
  const msg = message.trim();
  if (!msg) return { kind: 'none', confidence: 'high' };

  if (getWizardStepFromHistory(history)) {
    return { kind: 'wizard_continue', confidence: 'high' };
  }

  if (/^\d{8}\b/.test(msg)) {
    return { kind: 'none', confidence: 'high' };
  }

  if (isGeneralHowToOnly(msg)) {
    return { kind: 'none', confidence: 'high' };
  }

  if (isProblemReportPhrase(msg) && !isTriggerOnlyPhrase(msg)) {
    return {
      kind: 'problem_report',
      suggestedTitle: extractTitleFromProblemReport(msg),
      confidence: 'medium',
    };
  }

  if (
    isTicketWizardTrigger(msg) ||
    isBareTicketTrigger(msg) ||
    isContextualTicketRequest(msg, history)
  ) {
    return { kind: 'explicit_ticket', confidence: 'high' };
  }

  return { kind: 'none', confidence: 'high' };
}

export function shouldStartTicketWizard(
  message: string,
  history?: { role: string; content: string }[],
): boolean {
  return analyzeTicketCreationIntent(message, history).kind !== 'none';
}

export function isBareTicketTrigger(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (TICKET_TRIGGERS.some((w) => t === w || t === `${w}.` || t === `please ${w}`)) return true;
  return /^(please\s+)?(create|open|make|créer|ouvrir|faire)(\s+(a|un))?\s+ticket\.?$/.test(t);
}

export function isTriggerOnlyPhrase(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (isBareTicketTrigger(t)) return true;
  // Long messages that mention "problem" are real reports, not just "I have a problem".
  if (t.length > 36) return false;
  return isTicketWizardTrigger(t);
}

export function tagWizardReply(step: TicketWizardStep, text: string): string {
  return `[TICKET_WIZARD:${step}]\n${text}`;
}

export function stripWizardMarker(text: string): string {
  return text.replace(/^\[TICKET_WIZARD:[^\]]+\]\n?/, '').trim();
}

export function getWizardStepFromHistory(
  history?: { role: string; content: string }[],
): TicketWizardStep | null {
  if (!history?.length) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.role !== 'assistant') continue;
    const m = String(h.content ?? '').match(TICKET_WIZARD_MARKER_RE);
    if (m) return m[1] as TicketWizardStep;
  }
  return null;
}

export function parseDraftFromSummaryHistory(
  history?: { role: string; content: string }[],
): Partial<CreateTicketDto> {
  const assistantText = (history ?? [])
    .filter((h) => h.role === 'assistant')
    .map((h) => stripWizardMarker(h.content ?? ''))
    .join('\n');
  const title =
    assistantText.match(/(?:Titre|Title)\s*:\s*(.+)/i)?.[1]?.trim() ||
    assistantText.match(/(?:Titre|Title)\s*:\s*(.+?)(?=\n)/i)?.[1]?.trim();
  const description = assistantText.match(
    /(?:Description)\s*:\s*([\s\S]+?)(?=\n(?:Machine|Area|Zone|Catégorie|Category|━━)|$)/i,
  )?.[1]?.trim();
  const machine = assistantText.match(/(?:Machine)\s*:\s*(.+)/i)?.[1]?.trim();
  const area =
    assistantText.match(/(?:Zone|Area)\s*:\s*(.+)/i)?.[1]?.trim() ||
    assistantText.match(/(?:Area)\s*:\s*(.+)/i)?.[1]?.trim();
  const draft: Partial<CreateTicketDto> = {};
  if (title && title !== '—') draft.title = sanitizeTicketTitle(title);
  if (description) draft.description = description;
  if (machine && machine !== '—') draft.machine = machine.replace(/\.\s*$/, '');
  if (area && area !== '—') draft.area = area.replace(/\.\s*$/, '');
  return draft;
}

/** Pick EN/FR from user messages only (assistant greeting must not skew detection). */
export function detectWizardLang(message: string, userHistoryText?: string): 'en' | 'fr' {
  const userLines = `${userHistoryText ?? ''}\n${message}`
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let frScore = 0;
  let enScore = 0;
  for (let i = 0; i < userLines.length; i++) {
    const line = userLines[i]!.toLowerCase();
    const weight = i === userLines.length - 1 ? 3 : 1;
    if (/\b(je |j'|nous |un problème|une panne|créer|créé|oui|merci|arrêt|panne|décri|signaler|besoin|veux|peux|comment|avec|sur|le |la |les |des )\b/.test(line)) {
      frScore += weight;
    }
    if (/\b(i |we |my |the |a problem|create|created|yes|thanks|stopped|describe|report|need|want|can you|what |when |how |show |please|operator|production)\b/.test(line)) {
      enScore += weight;
    }
  }

  if (frScore > enScore) return 'fr';
  if (enScore > frScore) return 'en';

  const latest = message.trim().toLowerCase();
  if (/\b(oui|merci|problème|créer|panne|arrêt|zone|ligne)\b/.test(latest)) return 'fr';
  return 'en';
}

export function isWizardCancel(message: string): boolean {
  return /^(cancel|stop|never\s*mind|forget\s*it|annuler|abandonner)\b/i.test(message.trim());
}

export function isConfirmCreate(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (
    /^(yes|yeah|yep|ye|ok|okay|sure|oui|confirm|confirmed|go ahead|proceed|do it|create it|yes create|créer|valider|that's good|thats good|looks good|perfect|go for it|c'est bon|cest bon)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return (
    /\b(yes|yeah|ok|sure|confirm|create|créer|valider|good|bon)\b/.test(t) &&
    /\b(create|ticket|it|do|go|créer|valider)\b/.test(t)
  );
}

export function wantsTicketImprovement(message: string): boolean {
  const t = message.trim().toLowerCase();
  return (
    /\b(improve|clearer|more detail|add more|anything else|advice|suggest|help me describe|make it clearer|better description|conseil|améliorer|plus clair|autre chose|ajouter)\b/.test(
      t,
    ) && !isConfirmCreate(message)
  );
}

export function acceptsEnhancement(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /\b(add that|add it|yes add|good add|include that|use that|add this|ajoute|ajouter ça|oui ajoute)\b/.test(
    t,
  );
}

/** Parse "title is X Description: Y Machine: Z Area: W" style blobs. */
export function parseStructuredTicketInput(text: string): Partial<CreateTicketDto> {
  const blob = text.trim();
  if (!blob) return {};

  let title =
    blob.match(/(?:title|titre)\s*(?:is\s*)?:?\s*(.+?)(?=\s*(?:description|détails|details)\s*:|$)/is)?.[1]?.trim();
  let description =
    blob.match(
      /(?:description|détails|details)\s*:\s*([\s\S]+?)(?=\s*(?:machine|area|zone|priority|priorité|category)\s*:|$)/i,
    )?.[1]?.trim() ||
    blob.match(/(?:description|détails|details)\s*:\s*(.+)/i)?.[1]?.trim();

  const machine = blob
    .match(/(?:machine)\s*:\s*(.+?)(?=\s*(?:area|zone)\s*:|$)/i)?.[1]
    ?.trim()
    .replace(/\.\s*$/, '');
  const area = blob
    .match(/(?:area|zone)\s*:\s*(.+)/i)?.[1]
    ?.trim()
    .replace(/\.\s*$/, '');

  if (title) title = sanitizeTicketTitle(title);

  return {
    title: title || undefined,
    description: description || undefined,
    machine,
    area,
  };
}

export function sanitizeTicketTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^(title|titre)\s*(is\s*)?:?\s*/i, '');
  const cutPatterns = [/\bdescription\s*:/i, /\bmachine\s*:/i, /\barea\s*:/i, /\bzone\s*:/i];
  for (const p of cutPatterns) {
    const idx = t.search(p);
    if (idx > 0) t = t.slice(0, idx).trim();
  }
  if (t.length > 200) t = `${t.slice(0, 197)}...`;
  return t;
}

export function parseMachineAndArea(text: string): { machine?: string; area?: string } {
  const blob = text.trim();
  const structured = parseStructuredTicketInput(blob);
  if (structured.machine || structured.area) {
    return { machine: structured.machine, area: structured.area };
  }

  if (blob.includes(',')) {
    const parts = blob.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const areaPart = parts[1]!.replace(/^(?:area|zone)\s*[:.]?\s*/i, '').trim();
      return { machine: parts[0], area: areaPart };
    }
  }

  const machineArea = blob.match(/^(.+?)\s*[,;]\s*(?:line|ligne|area|zone)\s*[:.]?\s*(.+)$/i);
  if (machineArea) {
    return { machine: machineArea[1]!.trim(), area: machineArea[2]!.trim() };
  }

  const onLine = blob.match(/^(.+?)\s+(?:on|at|dans|zone|line|ligne)\s+(.+)$/i);
  if (onLine) {
    return { machine: onLine[1]!.trim(), area: onLine[2]!.trim() };
  }

  if (blob.length > 0 && blob.length <= 120) {
    return { machine: blob };
  }
  return {};
}

export function inferCategoryFromText(
  title: string,
  description: string,
): TicketCategory | undefined {
  const blob = `${title} ${description}`.toLowerCase();
  if (/\b(hmi|plc|scada|network|it\b|software|écran|screen|panel|pc\b)/.test(blob)) return TicketCategory.IT;
  if (/\b(electrical|motor|vfd|wiring|câble|électri)/.test(blob)) return TicketCategory.ELECTRICAL;
  if (/\b(hydraulic|pneumatic|bearing|mechanical|mécani|filler|convoyeur)/.test(blob))
    return TicketCategory.MECHANICAL;
  if (/\b(leak|pipe|plumb)/.test(blob)) return TicketCategory.PLUMBING;
  return TicketCategory.OTHER;
}

export function inferPriorityFromText(title: string, description: string): TicketPriority {
  const blob = `${title} ${description}`.toLowerCase();
  if (/\b(production stopped|line down|arrêt production|critique|critical|urgent|safety)\b/.test(blob)) {
    return TicketPriority.HIGH;
  }
  return TicketPriority.MEDIUM;
}

export function isTicketWizardActiveInHistory(history?: { role: string; content: string }[]): boolean {
  if (!history?.length) return false;
  if (getWizardStepFromHistory(history)) return true;
  const text = history.map((h) => h.content ?? '').join('\n');
  return (
    /what problem are you reporting|quel problème|tell me more about what happened|décrivez ce qui s'est passé|which machine or area|quelle machine|ticket summary|récapitulatif du ticket|before i create this ticket|avant de créer ce ticket|would you like me to add this/i.test(
      text,
    ) || history.some((h) => h.role === 'assistant' && /━━|ticket summary|récapitulatif/i.test(h.content ?? ''))
  );
}

function friendlyName(name: string | undefined): string {
  return name?.trim() ? `${name.trim()}, ` : '';
}

export function wizardAskTitle(name: string | undefined, lang: 'en' | 'fr'): string {
  if (lang === 'fr') {
    return `${friendlyName(name)}Bien sûr — je peux ouvrir un ticket pour vous. En quelques mots, c’est quoi le problème ?`;
  }
  return `${friendlyName(name)}Sure — I can open a ticket for you. In a few words, what’s going on?`;
}

/** When the user described a problem in natural language (not only "create ticket"). */
export function wizardStartFromProblemReport(
  name: string | undefined,
  lang: 'en' | 'fr',
  userMessage: string,
): string {
  const preview = userMessage.trim().slice(0, 120);
  if (lang === 'fr') {
    return (
      `${friendlyName(name)}Je vois` +
      (preview ? ` : « ${preview}${userMessage.length > 120 ? '…' : ''} »` : ' qu’il y a un souci') +
      `. On va ouvrir un ticket pour que la maintenance s’en occupe.\n` +
      `Comment voulez-vous intituler le problème, en une phrase courte ?`
    );
  }
  return (
    `${friendlyName(name)}I see` +
    (preview ? `: "${preview}${userMessage.length > 120 ? '…' : ''}"` : " there's an issue") +
    `. Let's open a ticket so maintenance can pick it up.\n` +
    `What should we call it in one short line?`
  );
}

export function wizardAckTitleAskDescription(
  name: string | undefined,
  title: string,
  lang: 'en' | 'fr',
): string {
  if (lang === 'fr') {
    return `${friendlyName(name)}D’accord — « ${title} ».\nQu’est-ce que vous pouvez ajouter ? Ce que vous voyez, depuis quand, ce que vous avez déjà essayé, et si la production est touchée.`;
  }
  return `${friendlyName(name)}Got it — "${title}".\nWhat else should maintenance know? What you’re seeing, when it started, anything you tried, and whether production is affected.`;
}

export function wizardAskLocation(lang: 'en' | 'fr'): string {
  if (lang === 'fr') {
    return `Merci pour ces infos. Quelle machine ou quelle zone est concernée ?`;
  }
  return `Thanks — that helps. Which machine or area is this on?`;
}

export function buildTicketSummary(draft: Partial<CreateTicketDto>, lang: 'en' | 'fr'): string {
  const title = String(draft.title ?? '').trim();
  const description = String(draft.description ?? '').trim();
  const machine = String(draft.machine ?? '').trim() || '—';
  const area = String(draft.area ?? '').trim() || '—';
  const category = draft.category ?? inferCategoryFromText(title, description) ?? TicketCategory.OTHER;
  const priority = draft.priority ?? inferPriorityFromText(title, description);

  if (lang === 'fr') {
    return (
      `Voici le ticket que je vais créer :\n\n` +
      `Titre : ${title}\n` +
      `Description :\n${description}\n` +
      `Machine : ${machine}\n` +
      `Zone : ${area}\n` +
      `Catégorie : ${category}\n` +
      `Priorité : ${priority}\n\n` +
      `Ça vous convient ? Dites par exemple « oui, créer » — ou dites-moi ce qu’il faut changer. ` +
      `Je peux aussi vous proposer des idées pour clarifier la description si vous voulez.`
    );
  }
  return (
    `Here’s the ticket I’ll create:\n\n` +
    `Title: ${title}\n` +
    `Description:\n${description}\n` +
    `Machine: ${machine}\n` +
    `Area: ${area}\n` +
    `Category: ${category}\n` +
    `Priority: ${priority}\n\n` +
    `Does that look right? You can say "yes, create it" — or tell me what to change. ` +
    `I can also suggest ways to make the description clearer if you’d like.`
  );
}

export function wizardInvalidTitle(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? 'Donnez-moi juste un titre court pour l’instant — on fera le détail juste après.'
    : 'Just a short title for now — we’ll get into the details next.';
}

export function wizardInvalidDescription(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? 'Un peu plus de détail m’aiderait — une phrase ou deux sur ce que vous voyez.'
    : 'A little more detail would help — a sentence or two about what you’re seeing.';
}

export function wizardInvalidLocation(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? 'Quelle machine ou zone est touchée ? Même un nom court suffit.'
    : 'Which machine or area is involved? Even a short name is fine.';
}

export function wizardCancelled(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? "Pas de souci — j’ai annulé le brouillon. Dites-moi quand vous voulez recommencer."
    : "No problem — I cancelled the draft. Just say when you'd like to start again.";
}

export function wizardCreatedReply(
  name: string | undefined,
  created: { id: string; title: string; priority: string; category: string },
  lang: 'en' | 'fr',
): string {
  if (lang === 'fr') {
    return (
      `${friendlyName(name)}C’est fait — ticket « ${created.title} » créé.\n` +
      `Référence : ${created.id}\n` +
      `Priorité : ${created.priority} · Catégorie : ${created.category}\n` +
      `L’équipe maintenance pourra le voir sur le tableau de bord.`
    );
  }
  return (
    `${friendlyName(name)}All set — ticket "${created.title}" is created.\n` +
    `Reference: ${created.id}\n` +
    `Priority: ${created.priority} · Category: ${created.category}\n` +
    `Maintenance can pick it up from the dashboard.`
  );
}

export function wizardRemindConfirm(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? 'Dites « oui » pour créer le ticket, ou dites-moi ce qu’il faut ajuster.'
    : 'Say "yes" to create the ticket, or tell me what to adjust.';
}

export function wizardEnhancementIntro(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? 'Voici quelques idées pour rendre le ticket plus clair :\n\n'
    : 'Here are a few ideas to make the ticket clearer:\n\n';
}

export function wizardAskAcceptEnhancement(lang: 'en' | 'fr'): string {
  return lang === 'fr'
    ? '\n\nJ’ajoute ça à la description ? (dites « oui » ou proposez votre formulation)'
    : '\n\nShould I add that to the description? (say "yes" or give me your own wording)';
}
