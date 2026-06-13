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
var OrderDataService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDataService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const order_csv_util_1 = require("./order-csv.util");
const reference_data_load_log_service_1 = require("./reference-data-load-log.service");
const REFERENCE_CSV_FILES = [
    'data_plus.csv',
    'order_lines.csv',
    'article.csv',
    'magasin.csv',
];
let OrderDataService = OrderDataService_1 = class OrderDataService {
    constructor(loadLog) {
        this.loadLog = loadLog;
        this.logger = new common_1.Logger(OrderDataService_1.name);
        this.loaded = false;
        this.fileWatchers = [];
        this.reloadDebounce = null;
        this.fileFingerprints = new Map();
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
        this.loadAll('startup');
    }
    onModuleDestroy() {
        this.stopFileWatch();
        if (this.reloadDebounce) {
            clearTimeout(this.reloadDebounce);
            this.reloadDebounce = null;
        }
    }
    isReady() {
        return this.loaded;
    }
    reload() {
        this.loadAll('manual_reload');
    }
    loadAll(source = 'startup', changedFiles) {
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
            const counts = {
                dataPlus: this.dataPlusByDoco.size,
                orderLines: this.orderLinesByKey.size,
                articles: this.articlesByKey.size,
                magasins: this.magasinByName.size,
            };
            this.logger.log(`Order Techo data loaded from ${dir}: data_plus=${counts.dataPlus}, order_lines=${counts.orderLines}, articles=${counts.articles}, magasins=${counts.magasins}`);
            this.fileFingerprints = this.captureFingerprints(dir);
            if (source === 'startup' && process.env.NODE_ENV !== 'test') {
                this.startFileWatch(dir);
            }
            void this.loadLog.logSuccess(source, dir, counts, changedFiles).catch((err) => {
                this.logger.warn(`Failed to write reference data activity log: ${err instanceof Error ? err.message : err}`);
            });
        }
        catch (e) {
            this.loaded = false;
            const message = e instanceof Error ? e.message : String(e);
            this.logger.error(`Failed to load order CSV from ${dir}: ${message}`);
            void this.loadLog.logFailure(source, dir, message).catch((err) => {
                this.logger.warn(`Failed to write reference data error log: ${err instanceof Error ? err.message : err}`);
            });
        }
    }
    captureFingerprints(dir) {
        const fingerprints = new Map();
        for (const file of REFERENCE_CSV_FILES) {
            fingerprints.set(file, this.fingerprintFile((0, path_1.join)(dir, file)));
        }
        return fingerprints;
    }
    fingerprintFile(filePath) {
        try {
            const stat = (0, fs_1.statSync)(filePath);
            return `${stat.mtimeMs}:${stat.size}`;
        }
        catch {
            return '';
        }
    }
    startFileWatch(dir) {
        this.stopFileWatch();
        for (const file of REFERENCE_CSV_FILES) {
            const fullPath = (0, path_1.join)(dir, file);
            if (!(0, fs_1.existsSync)(fullPath))
                continue;
            try {
                const watcher = (0, fs_1.watch)(fullPath, () => this.scheduleReloadFromFileChange(dir));
                this.fileWatchers.push(watcher);
            }
            catch (e) {
                this.logger.warn(`Could not watch ${fullPath}: ${e instanceof Error ? e.message : e}`);
            }
        }
    }
    stopFileWatch() {
        for (const watcher of this.fileWatchers) {
            watcher.close();
        }
        this.fileWatchers = [];
    }
    scheduleReloadFromFileChange(dir) {
        if (this.reloadDebounce)
            clearTimeout(this.reloadDebounce);
        this.reloadDebounce = setTimeout(() => {
            this.reloadDebounce = null;
            const nextFingerprints = this.captureFingerprints(dir);
            const changedFiles = [];
            for (const file of REFERENCE_CSV_FILES) {
                const prev = this.fileFingerprints.get(file);
                const next = nextFingerprints.get(file) ?? '';
                if (next && prev !== next)
                    changedFiles.push(file);
            }
            if (!changedFiles.length)
                return;
            this.loadAll('file_change', changedFiles);
        }, 1500);
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
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reference_data_load_log_service_1.ReferenceDataLoadLogService])
], OrderDataService);
//# sourceMappingURL=order-data.service.js.map