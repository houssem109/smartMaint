"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OrderTechoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderTechoService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const ai_service_1 = require("../ai/ai.service");
const order_errors_1 = require("./order-errors");
const order_data_service_1 = require("./order-data.service");
const magasin_status_util_1 = require("./magasin-status.util");
const order_rule_engine_service_1 = require("./order-rule-engine.service");
const ORDER_CONTEXT_TTL_MS = Number(process.env.ORDER_CONTEXT_TTL_MS ?? 24 * 60 * 60 * 1000);
const WIZARD_QUESTIONS_FR = {
    order_type: 'Quel est le type de commande ? (ex. CS, CA)',
    total_articles: 'Combien d’articles au total sur la commande ?',
    available_articles: 'Combien d’articles sont disponibles ?',
    store_status: 'Le magasin est-il actif ou inactif ?',
    accounted: 'La commande est-elle comptabilisée ? (oui / non)',
    blocked_items: 'Y a-t-il des articles bloqués ou obsolètes ? (oui / non / précisez)',
};
const WIZARD_QUESTIONS_EN = {
    order_type: 'What is the order type? (e.g. CS, CA)',
    total_articles: 'How many line items on the order in total?',
    available_articles: 'How many items are available?',
    store_status: 'Is the store active or inactive?',
    accounted: 'Is the order accounted/posted? (yes / no)',
    blocked_items: 'Any blocked or obsolete items? (yes / no / details)',
};
const STEP_ORDER = [
    'order_type',
    'total_articles',
    'available_articles',
    'store_status',
    'accounted',
    'blocked_items',
    'done',
];
let OrderTechoService = OrderTechoService_1 = class OrderTechoService {
    constructor(data, rules, ai) {
        this.data = data;
        this.rules = rules;
        this.ai = ai;
        this.logger = new common_1.Logger(OrderTechoService_1.name);
        this.wizardByUser = new Map();
        this.orderContextByUser = new Map();
        this.explainPrompt = this.loadPrompt('order-explain.prompt.md');
        this.fallbackPrompt = this.loadPrompt('order-fallback.prompt.md');
    }
    async handleMessage(userId, message, history, threadId) {
        if (!this.data.isReady())
            return null;
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
            const dataPlus = this.data.findDataPlus(orderNumber);
            if (dataPlus) {
                this.setOrderContext(ctxKey, orderNumber, lang);
                if (!this.needsFullDiagnosis(trimmed)) {
                    const facts = this.answerOrderFacts(dataPlus, trimmed, lang);
                    if (facts) {
                        return { ...facts, orderNumber: orderNumber };
                    }
                }
                this.wizardByUser.delete(ctxKey);
                return this.handleMode1(ctxKey, orderNumber, dataPlus, trimmed, lang);
            }
        }
        const explicitOrder = this.extractOrderNumber(trimmed);
        if (!explicitOrder)
            return null;
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
        const intro = lang === 'en'
            ? 'This order was not found in the reference database. I will ask a few diagnostic questions.\n\n'
            : 'Je ne trouve pas cette commande dans la base de référence. Je vais vous poser quelques questions pour diagnostiquer le problème.\n\n';
        return {
            reply: intro + this.wizardQuestion('order_type', lang),
            mode: 'order_wizard',
            orderNumber: explicitOrder,
        };
    }
    contextKey(userId, threadId) {
        const tid = threadId?.trim();
        return tid ? `${userId}:${tid}` : userId;
    }
    setOrderContext(ctxKey, orderNumber, lang) {
        this.orderContextByUser.set(ctxKey, { orderNumber, lang, at: Date.now() });
    }
    getOrderContext(ctxKey) {
        const ctx = this.orderContextByUser.get(ctxKey);
        if (!ctx)
            return null;
        if (Date.now() - ctx.at > ORDER_CONTEXT_TTL_MS) {
            this.orderContextByUser.delete(ctxKey);
            return null;
        }
        return ctx;
    }
    resolveOrderNumber(message, history, ctxKey) {
        const direct = this.extractOrderNumber(message);
        if (direct)
            return direct;
        const fromHistory = this.extractOrderFromHistory(history);
        if (fromHistory)
            return fromHistory;
        return this.getOrderContext(ctxKey)?.orderNumber ?? null;
    }
    extractOrderFromHistory(history) {
        if (!history?.length)
            return null;
        for (let i = history.length - 1; i >= 0; i--) {
            const n = this.extractOrderNumber(history[i].content ?? '');
            if (n)
                return n;
        }
        return null;
    }
    isOrderFollowUp(message, history) {
        if (this.extractOrderNumber(message))
            return true;
        const t = message.toLowerCase();
        if (/\b(commande|order|dcto|magasin|store|erreur|error|bloqu|blocked|comptabilis|accounted)\b/i.test(t)) {
            return true;
        }
        if (/\b(cs|ca|so|co)\b/i.test(t))
            return true;
        if (/\b(type|typo)\b/i.test(t) && /\b(commande|order|cs|ca|her|its|elle)\b/i.test(t)) {
            return true;
        }
        if (/\b(what|which|quel|quelle)\b/i.test(t) && history?.some((h) => /\b\d{8}\b/.test(h.content))) {
            return true;
        }
        return false;
    }
    needsFullDiagnosis(message) {
        const t = message.toLowerCase();
        if (/\b(only|just|seulement)\b/.test(t) && /\b(type|dcto)\b/.test(t))
            return false;
        return /\b(why|pourquoi|bloqu|block|problème|problem|erreur|error|diagnos|cause)\b/i.test(t);
    }
    answerOrderFacts(dataPlus, message, lang) {
        const field = this.inferFactField(message);
        const magasin = this.data.findMagasinByNom(dataPlus.sqalph);
        const rule = this.rules.evaluate(dataPlus);
        const storeLabel = magasin != null ? (0, magasin_status_util_1.magasinStatusLabel)(magasin.status, lang) : lang === 'en' ? 'unknown' : 'inconnu';
        const errorLabel = rule ? this.rules.labelFor(rule.code, lang) : dataPlus.errorType || '—';
        const lines = [];
        const push = (en, fr) => lines.push(lang === 'en' ? en : fr);
        if (field === 'dcto' || field === 'summary') {
            push(`Order type (dcto): ${dataPlus.dcto || '—'}.`, `Type de commande (dcto) : ${dataPlus.dcto || '—'}.`);
        }
        if (field === 'store' || field === 'summary') {
            push(`Store: ${dataPlus.sqalph || '—'} (${storeLabel}).`, `Magasin : ${dataPlus.sqalph || '—'} (${storeLabel}).`);
        }
        if (field === 'error' || field === 'summary') {
            push(`Recorded issue: ${errorLabel}.`, `Erreur enregistrée : ${errorLabel}.`);
        }
        if (!lines.length)
            return null;
        return {
            reply: lines.join(' '),
            mode: 'order_facts',
            orderNumber: dataPlus.doco,
            detectedError: rule?.code,
        };
    }
    inferFactField(message) {
        const t = message.toLowerCase();
        if (/\b(dcto|cs|ca|so|co)\b/.test(t))
            return 'dcto';
        if (/\btype\b/.test(t) && /\b(commande|order|cs|ca)\b/.test(t))
            return 'dcto';
        if (/\b(erreur|error|bloqu|block|problème|problem)\b/.test(t))
            return 'error';
        if (/\b(magasin|store)\b/.test(t))
            return 'store';
        return 'summary';
    }
    async handleMode1(ctxKey, orderNumber, dataPlus, userMessage, lang) {
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
    detectReplyLanguage(message, history) {
        const recentUser = [
            message,
            ...(history ?? [])
                .filter((h) => h.role === 'user')
                .slice(-4)
                .map((h) => h.content),
        ].join(' ');
        const t = recentUser.trim().toLowerCase();
        const frenchHits = (t.match(/\b(pourquoi|commande|magasin|bloquée|bloqué|comptabilis|réactiver|veuillez|bonjour|merci)\b/g) ?? [])
            .length + (/[àâäéèêëïîôùûç]/.test(t) ? 2 : 0);
        const englishHits = (t.match(/\b(why|how|what|order|blocked|inactive|active|please|solve|help|hello|thanks)\b/g) ?? []).length;
        if (englishHits > frenchHits)
            return 'en';
        if (frenchHits > englishHits)
            return 'fr';
        if (/\b(why|how|what)\b/.test(t))
            return 'en';
        if (/\b(pourquoi|est-ce)\b/.test(t))
            return 'fr';
        return 'fr';
    }
    wizardQuestion(step, lang) {
        return lang === 'en' ? WIZARD_QUESTIONS_EN[step] : WIZARD_QUESTIONS_FR[step];
    }
    buildMode1Context(dataPlus, rule, orderLine, magasin, lang) {
        const storeStatus = magasin != null ? (0, magasin_status_util_1.magasinStatusLabel)(magasin.status, lang) : lang === 'en' ? 'unknown' : 'inconnu';
        const lines = lang === 'en'
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
            lines.push(lang === 'en'
                ? `Recorded error (error_type column — do not change): ${errorLabel} (${rule.code})`
                : `Erreur enregistrée (colonne error_type — ne pas changer) : ${errorLabel} (${rule.code})`);
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
    async explainWithLlm(context, rule, userMessage, lang) {
        const errorLabel = rule ? this.rules.labelFor(rule.code, lang) : null;
        const errorBlock = rule
            ? `Error to explain (from error_type — do NOT change, do NOT blame inactive store unless error is INACTIVE_CUSTOMER): ${errorLabel} (${rule.code})`
            : 'No standard error recorded; state that manual review is needed.';
        const langRule = lang === 'en'
            ? 'You MUST write your entire answer in English (same language as the user).'
            : 'Vous DEVEZ répondre entièrement en français (même langue que l’utilisateur).';
        const messages = [
            { role: 'system', content: `${this.explainPrompt}\n\n${langRule}` },
            {
                role: 'user',
                content: `User question:\n${userMessage}\n\n${errorBlock}\n\nBusiness context:\n${context}`,
            },
        ];
        try {
            return (await this.ai.chat(messages)).trim();
        }
        catch (e) {
            this.logger.warn(`Order explain LLM failed: ${e instanceof Error ? e.message : e}`);
            if (rule) {
                return this.fallbackExplain(rule, lang);
            }
            return lang === 'en'
                ? 'This order needs manual review. Contact commercial support if the block persists.'
                : 'La commande nécessite une vérification manuelle. Contactez le support commercial si le blocage persiste.';
        }
    }
    fallbackExplain(rule, lang) {
        const texts = {
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
    async advanceWizard(ctxKey, answer, session) {
        if (!answer) {
            const q = this.wizardQuestion(session.step, session.lang);
            const prompt = session.lang === 'en'
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
                reply: this.wizardQuestion(nextStep, session.lang),
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
    async handleMode2Complete(session) {
        const a = session.answers;
        const rulesText = Object.entries(order_errors_1.ORDER_ERROR_LABELS)
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
            { role: 'system', content: this.fallbackPrompt },
            {
                role: 'user',
                content: `Known business rules:\n${rulesText}\n\nUser answers:\n${userContext}\n\n` +
                    `Reply in ${lang === 'en' ? 'English' : 'French'}.`,
            },
        ];
        try {
            return (await this.ai.chat(messages)).trim();
        }
        catch (e) {
            this.logger.warn(`Order fallback LLM failed: ${e instanceof Error ? e.message : e}`);
            return this.heuristicMode2(a, lang);
        }
    }
    heuristicMode2(a, lang) {
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
    extractOrderNumber(message) {
        const m = message.match(/\b(\d{8})\b/);
        return m ? m[1] : null;
    }
    loadPrompt(filename) {
        const paths = [
            (0, path_1.join)(process.cwd(), 'src', 'order-techo', 'prompts', filename),
            (0, path_1.join)(__dirname, 'prompts', filename),
        ];
        for (const p of paths) {
            try {
                return (0, fs_1.readFileSync)(p, 'utf8');
            }
            catch {
            }
        }
        return 'You are Techo, order business assistant.';
    }
};
exports.OrderTechoService = OrderTechoService;
exports.OrderTechoService = OrderTechoService = OrderTechoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => ai_service_1.AiService))),
    __metadata("design:paramtypes", [order_data_service_1.OrderDataService,
        order_rule_engine_service_1.OrderRuleEngineService,
        ai_service_1.AiService])
], OrderTechoService);
//# sourceMappingURL=order-techo.service.js.map