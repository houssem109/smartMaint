"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OrderDataService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDataService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const order_csv_util_1 = require("./order-csv.util");
let OrderDataService = OrderDataService_1 = class OrderDataService {
    constructor() {
        this.logger = new common_1.Logger(OrderDataService_1.name);
        this.loaded = false;
        this.dataPlusByDoco = new Map();
        this.orderLinesByKey = new Map();
        this.articlesByKey = new Map();
        this.magasinByName = new Map();
    }
    onModuleInit() {
        if (String(process.env.ORDER_TECHO_ENABLED ?? 'true').toLowerCase() === 'false') {
            this.logger.log('Order Techo disabled (ORDER_TECHO_ENABLED=false)');
            return;
        }
        this.loadAll();
    }
    isReady() {
        return this.loaded;
    }
    reload() {
        this.loadAll();
    }
    loadAll() {
        const dir = (0, order_csv_util_1.resolveOrderDataDir)();
        try {
            const articles = (0, order_csv_util_1.parseSemicolonCsv)((0, path_1.join)(dir, 'article.csv'));
            const magasins = (0, order_csv_util_1.parseSemicolonCsv)((0, path_1.join)(dir, 'magasin.csv'));
            const orderLines = (0, order_csv_util_1.parseSemicolonCsv)((0, path_1.join)(dir, 'order_lines.csv'));
            const dataPlus = (0, order_csv_util_1.parseSemicolonCsv)((0, path_1.join)(dir, 'data_plus.csv'));
            this.articlesByKey.clear();
            for (const r of articles) {
                const ref = (r.ref_article ?? r['ref_article '] ?? '').trim();
                const mag = (r.magazin ?? '').trim();
                if (!ref || !mag)
                    continue;
                const key = this.articleKey(ref, mag);
                this.articlesByKey.set(key, {
                    refArticle: ref,
                    magazin: mag,
                    pfName: (r.pf_name ?? '').trim(),
                    status: (r.status ?? '').trim().toUpperCase(),
                    pfIssueType: (r.pf_issue_type ?? '').trim().toUpperCase(),
                });
            }
            this.magasinByName.clear();
            for (const r of magasins) {
                const nom = (r.nom_magasin ?? '').trim();
                if (!nom)
                    continue;
                const status = Number((r.status ?? '').trim());
                this.magasinByName.set(this.normName(nom), {
                    nomMagasin: nom,
                    status: Number.isFinite(status) ? status : 0,
                });
            }
            this.orderLinesByKey.clear();
            for (const r of orderLines) {
                const doco = (r.doco ?? '').trim();
                const dcto = (r.dcto ?? '').trim();
                if (!doco)
                    continue;
                const pfs = (0, order_csv_util_1.splitCsvList)(r.pf_list ?? '');
                const mcus = (0, order_csv_util_1.splitCsvList)(r.mcu_list ?? '');
                const pairs = [];
                const len = Math.max(pfs.length, mcus.length);
                for (let i = 0; i < len; i++) {
                    const articleRef = pfs[i] ?? '';
                    const magasinCode = mcus[i] ?? '';
                    if (articleRef && magasinCode)
                        pairs.push({ articleRef, magasinCode });
                }
                this.orderLinesByKey.set(this.orderKey(doco, dcto), { doco, dcto, pairs });
            }
            this.dataPlusByDoco.clear();
            for (const r of dataPlus) {
                const doco = (r.doco ?? '').trim();
                if (!doco)
                    continue;
                this.dataPlusByDoco.set(doco, {
                    doco,
                    dcto: (r.dcto ?? '').trim(),
                    nbPf: (r.nb_pf ?? '').trim(),
                    sqalph: (r.sqalph ?? '').trim(),
                    sdnxtr: (r.SDNXTR ?? r.sdnxtr ?? '').trim(),
                    sdaddj: (r.SDADDJ ?? r.sdaddj ?? '').trim(),
                    sdtrdj: (r.SDTRDJ ?? r.sdtrdj ?? '').trim(),
                    errorType: (r.error_type ?? '').trim(),
                });
            }
            this.loaded = true;
            this.logger.log(`Order Techo data loaded from ${dir}: data_plus=${this.dataPlusByDoco.size}, order_lines=${this.orderLinesByKey.size}, articles=${this.articlesByKey.size}, magasins=${this.magasinByName.size}`);
        }
        catch (e) {
            this.loaded = false;
            this.logger.error(`Failed to load order CSV from ${dir}: ${e instanceof Error ? e.message : e}`);
        }
    }
    findDataPlus(doco) {
        return this.dataPlusByDoco.get(doco.trim()) ?? null;
    }
    findOrderLine(doco, dcto) {
        return this.orderLinesByKey.get(this.orderKey(doco, dcto)) ?? null;
    }
    findMagasinByNom(nom) {
        return this.magasinByName.get(this.normName(nom)) ?? null;
    }
    findArticle(ref, mag) {
        return this.articlesByKey.get(this.articleKey(ref, mag)) ?? null;
    }
    articleKey(ref, mag) {
        return `${ref.trim().toUpperCase()}|${mag.trim().toUpperCase()}`;
    }
    orderKey(doco, dcto) {
        return `${doco.trim()}|${dcto.trim().toUpperCase()}`;
    }
    normName(n) {
        return n.trim().toUpperCase();
    }
};
exports.OrderDataService = OrderDataService;
exports.OrderDataService = OrderDataService = OrderDataService_1 = __decorate([
    (0, common_1.Injectable)()
], OrderDataService);
//# sourceMappingURL=order-data.service.js.map