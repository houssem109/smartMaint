import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AiService } from '../ai/ai.service';
import { ORDER_ERROR_LABELS, OrderErrorCode } from './order-errors';
import { OrderDataService } from './order-data.service';
import { magasinStatusLabel } from './magasin-status.util';
import { OrderRuleEngineService, RuleEngineResult } from './order-rule-engine.service';

export interface OrderChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface OrderTechoReply {
  reply: string;
  mode: 'order_data' | 'order_wizard' | 'order_wizard_complete' | 'order_facts';
  orderNumber?: string;
  detectedError?: OrderErrorCode;
}

interface OrderContext {
  orderNumber: string;
  lang: 'fr' | 'en';
  at: number;
}

const ORDER_CONTEXT_TTL_MS = Number(process.env.ORDER_CONTEXT_TTL_MS ?? 24 * 60 * 60 * 1000);

type WizardStep =
  | 'order_type'
  | 'total_articles'
  | 'available_articles'
  | 'store_status'
  | 'accounted'
  | 'blocked_items'
  | 'done';

interface WizardSession {
  orderNumber: string;
  step: WizardStep;
  answers: Partial<Record<WizardStep, string>>;
  lang: 'fr' | 'en';
}

const WIZARD_QUESTIONS_FR: Record<Exclude<WizardStep, 'done'>, string> = {
  order_type: 'Quel est le type de commande ? (ex. CS, CA)',
  total_articles: 'Combien d’articles au total sur la commande ?',
  available_articles: 'Combien d’articles sont disponibles ?',
  store_status: 'Le magasin est-il actif ou inactif ?',
  accounted: 'La commande est-elle comptabilisée ? (oui / non)',
  blocked_items: 'Y a-t-il des articles bloqués ou obsolètes ? (oui / non / précisez)',
};

const WIZARD_QUESTIONS_EN: Record<Exclude<WizardStep, 'done'>, string> = {
  order_type: 'What is the order type? (e.g. CS, CA)',
  total_articles: 'How many line items on the order in total?',
  available_articles: 'How many items are available?',
  store_status: 'Is the store active or inactive?',
  accounted: 'Is the order accounted/posted? (yes / no)',
  blocked_items: 'Any blocked or obsolete items? (yes / no / details)',
};

const STEP_ORDER: WizardStep[] = [
  'order_type',
  'total_articles',
  'available_articles',
  'store_status',
  'accounted',
  'blocked_items',
  'done',
];

@Injectable()
export class OrderTechoService {
  private readonly logger = new Logger(OrderTechoService.name);
  private readonly wizardByUser = new Map<string, WizardSession>();
  /** Last order discussed per user (follow-ups without repeating the 8-digit number). */
  private readonly orderContextByUser = new Map<string, OrderContext>();
  private readonly explainPrompt: string;
  private readonly fallbackPrompt: string;

  constructor(
    private readonly data: OrderDataService,
    private readonly rules: OrderRuleEngineService,
    @Inject(forwardRef(() => AiService))
    private readonly ai: AiService,
  ) {
    this.explainPrompt = this.loadPrompt('order-explain.prompt.md');
    this.fallbackPrompt = this.loadPrompt('order-fallback.prompt.md');
  }

  /**
   * Returns a reply when order Techo handles the message; null → default Techo (RAG).
   * Pass chat `history` so follow-ups (e.g. "is it CS or CA?") keep the same order.
   */
  async handleMessage(
    userId: string,
    message: string,
    history?: OrderChatHistoryItem[],
    threadId?: string,
  ): Promise<OrderTechoReply | null> {
    if (!this.data.isReady()) return null;

    const trimmed = message.trim();
    const lang = this.detectReplyLanguage(trimmed, history);
    const ctxKey = this.contextKey(userId, threadId);
    const activeWizard = this.wizardByUser.get(ctxKey);

    if (activeWizard && activeWizard.step !== 'done') {
      return this.advanceWizard(ctxKey, trimmed, activeWizard);
    }

    const orderNumber = this.resolveOrderNumber(trimmed, history, ctxKey);
    const hasOrderContext = !!orderNumber;

    if (hasOrderContext && this.isOrderFollowUp(trimmed, history)) {
      const dataPlus = this.data.findDataPlus(orderNumber!);
      if (dataPlus) {
        this.setOrderContext(ctxKey, orderNumber!, lang);
        if (!this.needsFullDiagnosis(trimmed)) {
          const facts = this.answerOrderFacts(dataPlus, trimmed, lang);
          if (facts) {
            return { ...facts, orderNumber: orderNumber! };
          }
        }
        this.wizardByUser.delete(ctxKey);
        return this.handleMode1(ctxKey, orderNumber!, dataPlus, trimmed, lang);
      }
    }

    const explicitOrder = this.extractOrderNumber(trimmed);
    if (!explicitOrder) return null;

    const dataPlus = this.data.findDataPlus(explicitOrder);
    if (dataPlus) {
      this.wizardByUser.delete(ctxKey);
      return this.handleMode1(ctxKey, explicitOrder, dataPlus, trimmed, lang);
    }

    this.wizardByUser.set(ctxKey, {
      orderNumber: explicitOrder,
      step: 'order_type',
      answers: {},
      lang,
    });
    this.setOrderContext(ctxKey, explicitOrder, lang);
    const intro =
      lang === 'en'
        ? 'This order was not found in the reference database. I will ask a few diagnostic questions.\n\n'
        : 'Je ne trouve pas cette commande dans la base de référence. Je vais vous poser quelques questions pour diagnostiquer le problème.\n\n';
    return {
      reply: intro + this.wizardQuestion('order_type', lang),
      mode: 'order_wizard',
      orderNumber: explicitOrder,
    };
  }

  private contextKey(userId: string, threadId?: string): string {
    const tid = threadId?.trim();
    return tid ? `${userId}:${tid}` : userId;
  }

  private setOrderContext(ctxKey: string, orderNumber: string, lang: 'fr' | 'en'): void {
    this.orderContextByUser.set(ctxKey, { orderNumber, lang, at: Date.now() });
  }

  private getOrderContext(ctxKey: string): OrderContext | null {
    const ctx = this.orderContextByUser.get(ctxKey);
    if (!ctx) return null;
    if (Date.now() - ctx.at > ORDER_CONTEXT_TTL_MS) {
      this.orderContextByUser.delete(ctxKey);
      return null;
    }
    return ctx;
  }

  private resolveOrderNumber(
    message: string,
    history: OrderChatHistoryItem[] | undefined,
    ctxKey: string,
  ): string | null {
    const direct = this.extractOrderNumber(message);
    if (direct) return direct;
    const fromHistory = this.extractOrderFromHistory(history);
    if (fromHistory) return fromHistory;
    return this.getOrderContext(ctxKey)?.orderNumber ?? null;
  }

  private extractOrderFromHistory(history?: OrderChatHistoryItem[]): string | null {
    if (!history?.length) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      const n = this.extractOrderNumber(history[i].content ?? '');
      if (n) return n;
    }
    return null;
  }

  /** Still about the same sales order (not maintenance manuals). */
  private isOrderFollowUp(message: string, history?: OrderChatHistoryItem[]): boolean {
    if (this.extractOrderNumber(message)) return true;
    const t = message.toLowerCase();
    if (
      /\b(commande|order|dcto|magasin|store|erreur|error|bloqu|blocked|comptabilis|accounted)\b/i.test(t)
    ) {
      return true;
    }
    if (/\b(cs|ca|so|co)\b/i.test(t)) return true;
    if (/\b(type|typo)\b/i.test(t) && /\b(commande|order|cs|ca|her|its|elle)\b/i.test(t)) {
      return true;
    }
    if (/\b(what|which|quel|quelle)\b/i.test(t) && history?.some((h) => /\b\d{8}\b/.test(h.content))) {
      return true;
    }
    return false;
  }

  private needsFullDiagnosis(message: string): boolean {
    const t = message.toLowerCase();
    if (/\b(only|just|seulement)\b/.test(t) && /\b(type|dcto)\b/.test(t)) return false;
    return /\b(why|pourquoi|bloqu|block|problème|problem|erreur|error|diagnos|cause)\b/i.test(t);
  }

  /** Direct answers from CSV (dcto, store, error_type) — no RAG / manuals. */
  private answerOrderFacts(
    dataPlus: NonNullable<ReturnType<OrderDataService['findDataPlus']>>,
    message: string,
    lang: 'fr' | 'en',
  ): OrderTechoReply | null {
    const field = this.inferFactField(message);
    const magasin = this.data.findMagasinByNom(dataPlus.sqalph);
    const rule = this.rules.evaluate(dataPlus);
    const storeLabel = magasin != null ? magasinStatusLabel(magasin.status, lang) : lang === 'en' ? 'unknown' : 'inconnu';
    const errorLabel = rule ? this.rules.labelFor(rule.code, lang) : dataPlus.errorType || '—';

    const lines: string[] = [];
    const push = (en: string, fr: string) => lines.push(lang === 'en' ? en : fr);

    if (field === 'dcto' || field === 'summary') {
      push(
        `Order type (dcto): ${dataPlus.dcto || '—'}.`,
        `Type de commande (dcto) : ${dataPlus.dcto || '—'}.`,
      );
    }
    if (field === 'store' || field === 'summary') {
      push(
        `Store: ${dataPlus.sqalph || '—'} (${storeLabel}).`,
        `Magasin : ${dataPlus.sqalph || '—'} (${storeLabel}).`,
      );
    }
    if (field === 'error' || field === 'summary') {
      push(`Recorded issue: ${errorLabel}.`, `Erreur enregistrée : ${errorLabel}.`);
    }

    if (!lines.length) return null;

    return {
      reply: lines.join(' '),
      mode: 'order_facts',
      orderNumber: dataPlus.doco,
      detectedError: rule?.code,
    };
  }

  private inferFactField(message: string): 'dcto' | 'store' | 'error' | 'summary' {
    const t = message.toLowerCase();
    if (/\b(dcto|cs|ca|so|co)\b/.test(t)) return 'dcto';
    if (/\btype\b/.test(t) && /\b(commande|order|cs|ca)\b/.test(t)) return 'dcto';
    if (/\b(erreur|error|bloqu|block|problème|problem)\b/.test(t)) return 'error';
    if (/\b(magasin|store)\b/.test(t)) return 'store';
    return 'summary';
  }

  private async handleMode1(
    ctxKey: string,
    orderNumber: string,
    dataPlus: ReturnType<OrderDataService['findDataPlus']>,
    userMessage: string,
    lang: 'fr' | 'en',
  ): Promise<OrderTechoReply> {
    if (!dataPlus) {
      const msg = lang === 'en' ? 'Order not found.' : 'Commande introuvable.';
      return { reply: msg, mode: 'order_data', orderNumber };
    }

    this.setOrderContext(ctxKey, orderNumber, lang);
    const ruleResult = this.rules.evaluate(dataPlus);
    const orderLine = this.data.findOrderLine(dataPlus.doco, dataPlus.dcto);
    const magasin = this.data.findMagasinByNom(dataPlus.sqalph);

    const context = this.buildMode1Context(dataPlus, ruleResult, orderLine, magasin, lang);
    const reply = await this.explainWithLlm(context, ruleResult, userMessage, lang);

    return {
      reply,
      mode: 'order_data',
      orderNumber,
      detectedError: ruleResult?.code,
    };
  }

  /** Reply in the same language as the user (FR or EN). */
  private detectReplyLanguage(message: string, history?: OrderChatHistoryItem[]): 'fr' | 'en' {
    const recentUser = [
      message,
      ...(history ?? [])
        .filter((h) => h.role === 'user')
        .slice(-4)
        .map((h) => h.content),
    ].join(' ');
    const t = recentUser.trim().toLowerCase();
    const frenchHits =
      (t.match(/\b(pourquoi|commande|magasin|bloquée|bloqué|comptabilis|réactiver|veuillez|bonjour|merci)\b/g) ?? [])
        .length + (/[àâäéèêëïîôùûç]/.test(t) ? 2 : 0);
    const englishHits = (
      t.match(/\b(why|how|what|order|blocked|inactive|active|please|solve|help|hello|thanks)\b/g) ?? []
    ).length;

    if (englishHits > frenchHits) return 'en';
    if (frenchHits > englishHits) return 'fr';
    if (/\b(why|how|what)\b/.test(t)) return 'en';
    if (/\b(pourquoi|est-ce)\b/.test(t)) return 'fr';
    return 'fr';
  }

  private wizardQuestion(step: Exclude<WizardStep, 'done'>, lang: 'fr' | 'en'): string {
    return lang === 'en' ? WIZARD_QUESTIONS_EN[step] : WIZARD_QUESTIONS_FR[step];
  }

  private buildMode1Context(
    dataPlus: NonNullable<ReturnType<OrderDataService['findDataPlus']>>,
    rule: RuleEngineResult | null,
    orderLine: ReturnType<OrderDataService['findOrderLine']>,
    magasin: ReturnType<OrderDataService['findMagasinByNom']>,
    lang: 'fr' | 'en',
  ): string {
    const storeStatus =
      magasin != null ? magasinStatusLabel(magasin.status, lang) : lang === 'en' ? 'unknown' : 'inconnu';

    const lines: string[] =
      lang === 'en'
        ? [
            `Order reference: ${dataPlus.doco}`,
            `Order type (dcto): ${dataPlus.dcto || '—'}`,
            `Store name: ${dataPlus.sqalph || '—'}`,
            `Store status in master data: ${storeStatus}`,
            `Line count: ${dataPlus.nbPf || (orderLine?.pairs.length ?? 0)}`,
          ]
        : [
            `Commande : ${dataPlus.doco}`,
            `Type de commande (dcto) : ${dataPlus.dcto || '—'}`,
            `Magasin : ${dataPlus.sqalph || '—'}`,
            `Statut magasin (référentiel) : ${storeStatus}`,
            `Nombre de lignes : ${dataPlus.nbPf || (orderLine?.pairs.length ?? 0)}`,
          ];

    const errorLabel = rule ? this.rules.labelFor(rule.code, lang) : null;
    if (rule) {
      lines.push(
        lang === 'en'
          ? `Recorded error (error_type column — do not change): ${errorLabel} (${rule.code})`
          : `Erreur enregistrée (colonne error_type — ne pas changer) : ${errorLabel} (${rule.code})`,
      );
      if (rule.code === 'PROBLEME_DATE_CMD') {
        lines.push(`SDADDJ=${dataPlus.sdaddj || '—'}, SDTRDJ=${dataPlus.sdtrdj || '—'}, SDNXTR=${dataPlus.sdnxtr || '—'}`);
      }
      lines.push(`Details: ${JSON.stringify(rule.details)}`);
    }

    if (orderLine?.pairs.length) {
      const sample = orderLine.pairs
        .slice(0, 8)
        .map((p) => `${p.articleRef} → ${p.magasinCode}`)
        .join(', ');
      lines.push(lang === 'en' ? `Sample items: ${sample}` : `Articles (échantillon) : ${sample}`);
    }

    return lines.join('\n');
  }

  private async explainWithLlm(
    context: string,
    rule: RuleEngineResult | null,
    userMessage: string,
    lang: 'fr' | 'en',
  ): Promise<string> {
    const errorLabel = rule ? this.rules.labelFor(rule.code, lang) : null;
    const errorBlock = rule
      ? `Error to explain (from error_type — do NOT change, do NOT blame inactive store unless error is INACTIVE_CUSTOMER): ${errorLabel} (${rule.code})`
      : 'No standard error recorded; state that manual review is needed.';

    const langRule =
      lang === 'en'
        ? 'You MUST write your entire answer in English (same language as the user).'
        : 'Vous DEVEZ répondre entièrement en français (même langue que l’utilisateur).';

    const messages = [
      { role: 'system' as const, content: `${this.explainPrompt}\n\n${langRule}` },
      {
        role: 'user' as const,
        content: `User question:\n${userMessage}\n\n${errorBlock}\n\nBusiness context:\n${context}`,
      },
    ];

    try {
      return (await this.ai.chat(messages)).trim();
    } catch (e) {
      this.logger.warn(`Order explain LLM failed: ${e instanceof Error ? e.message : e}`);
      if (rule) {
        return this.fallbackExplain(rule, lang);
      }
      return lang === 'en'
        ? 'This order needs manual review. Contact commercial support if the block persists.'
        : 'La commande nécessite une vérification manuelle. Contactez le support commercial si le blocage persiste.';
    }
  }

  private fallbackExplain(rule: RuleEngineResult, lang: 'fr' | 'en'): string {
    const texts: Record<OrderErrorCode, { fr: string; en: string }> = {
      INACTIVE_CUSTOMER: {
        fr: 'La commande est bloquée car le magasin associé est inactif dans le système. Veuillez réactiver le client avant traitement.',
        en: 'The order is blocked because the linked store is inactive. Reactivate the customer before processing.',
      },
      PROBLEME_DATE_CMD: {
        fr: 'La commande n’est pas comptabilisée (problème de date / comptabilisation). Vérifiez les dates et le statut comptable.',
        en: 'The order is not posted (date/accounting issue). Check entry dates and accounting status.',
      },
      ITEM_BRANCH_RECORDS: {
        fr: 'Un ou plusieurs articles ne sont pas référencés dans le magasin indiqué. Vérifiez la fiche article/magasin.',
        en: 'One or more items are not set up for the given store. Check item/store master data.',
      },
      ITEM_IS_OBSOLETE: {
        fr: 'La commande contient des articles obsolètes ou bloqués. Remplacez-les ou demandez le déblocage.',
        en: 'The order includes obsolete or blocked items. Replace them or request an unblock.',
      },
    };
    const entry = texts[rule.code];
    return entry ? entry[lang] : rule.label;
  }

  private async advanceWizard(
    ctxKey: string,
    answer: string,
    session: WizardSession,
  ): Promise<OrderTechoReply> {
    if (!answer) {
      const q = this.wizardQuestion(session.step as Exclude<WizardStep, 'done'>, session.lang);
      const prompt =
        session.lang === 'en'
          ? `Please answer:\n\n${q}`
          : `Merci de répondre à la question :\n\n${q}`;
      return {
        reply: prompt,
        mode: 'order_wizard',
        orderNumber: session.orderNumber,
      };
    }

    session.answers[session.step] = answer;
    const idx = STEP_ORDER.indexOf(session.step);
    const nextStep = STEP_ORDER[idx + 1] ?? 'done';
    session.step = nextStep;

    if (nextStep !== 'done') {
      return {
        reply: this.wizardQuestion(nextStep as Exclude<WizardStep, 'done'>, session.lang),
        mode: 'order_wizard',
        orderNumber: session.orderNumber,
      };
    }

    this.wizardByUser.delete(ctxKey);
    const reply = await this.handleMode2Complete(session);
    return {
      reply,
      mode: 'order_wizard_complete',
      orderNumber: session.orderNumber,
    };
  }

  private async handleMode2Complete(session: WizardSession): Promise<string> {
    const a = session.answers;
    const rulesText = Object.entries(ORDER_ERROR_LABELS)
      .map(([code, label]) => `- ${code}: ${label}`)
      .join('\n');

    const userContext = [
      `Référence commande saisie (non trouvée en base) : ${session.orderNumber}`,
      `Type de commande : ${a.order_type ?? '—'}`,
      `Articles total : ${a.total_articles ?? '—'}`,
      `Articles disponibles : ${a.available_articles ?? '—'}`,
      `Statut magasin : ${a.store_status ?? '—'}`,
      `Comptabilisée : ${a.accounted ?? '—'}`,
      `Articles bloqués/obsolètes : ${a.blocked_items ?? '—'}`,
    ].join('\n');

    const lang = session.lang;
    const messages = [
      { role: 'system' as const, content: this.fallbackPrompt },
      {
        role: 'user' as const,
        content:
          `Known business rules:\n${rulesText}\n\nUser answers:\n${userContext}\n\n` +
          `Reply in ${lang === 'en' ? 'English' : 'French'}.`,
      },
    ];

    try {
      return (await this.ai.chat(messages)).trim();
    } catch (e) {
      this.logger.warn(`Order fallback LLM failed: ${e instanceof Error ? e.message : e}`);
      return this.heuristicMode2(a, lang);
    }
  }

  private heuristicMode2(a: Partial<Record<WizardStep, string>>, lang: 'fr' | 'en'): string {
    const store = (a.store_status ?? '').toLowerCase();
    const accounted = (a.accounted ?? '').toLowerCase();
    const blocked = (a.blocked_items ?? '').toLowerCase();

  if (store.includes('inactif') || store.includes('inactive')) {
      return lang === 'en'
        ? 'The store appears inactive: reactivate the customer before resubmitting the order.'
        : 'Le magasin semble inactif : réactivez le client avant de relancer la commande.';
    }
    if (accounted.includes('non') || accounted.includes('no')) {
      return lang === 'en'
        ? 'The order may not be posted: check dates and the accounting workflow.'
        : 'La commande ne semble pas comptabilisée : vérifiez les dates et le cycle de validation comptable.';
    }
    if (blocked.includes('oui') || blocked.includes('yes')) {
      return lang === 'en'
        ? 'Blocked or obsolete items were reported: check references and update order lines.'
        : 'Des articles bloqués ou obsolètes sont signalés : contrôlez les références et remplacez les lignes concernées.';
    }
    return lang === 'en'
      ? 'From your answers, verify store status, posting, and item/store setup with commercial support.'
      : 'D’après vos réponses, vérifiez le statut magasin, la comptabilisation et les références article/magasin avec le support commercial.';
  }

  extractOrderNumber(message: string): string | null {
    const m = message.match(/\b(\d{8})\b/);
    return m ? m[1] : null;
  }

  private loadPrompt(filename: string): string {
    const paths = [
      join(process.cwd(), 'src', 'order-techo', 'prompts', filename),
      join(__dirname, 'prompts', filename),
    ];
    for (const p of paths) {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        // try next
      }
    }
    return 'You are Techo, order business assistant.';
  }
}
