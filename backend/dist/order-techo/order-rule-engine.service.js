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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRuleEngineService = void 0;
const common_1 = require("@nestjs/common");
const order_errors_1 = require("./order-errors");
const order_data_service_1 = require("./order-data.service");
const magasin_status_util_1 = require("./magasin-status.util");
let OrderRuleEngineService = class OrderRuleEngineService {
    constructor(data) {
        this.data = data;
    }
    evaluate(dataPlus) {
        const fromColumn = this.resolveFromErrorTypeColumn(dataPlus);
        if (fromColumn)
            return fromColumn;
        const hits = [];
        const inactive = this.checkInactiveCustomer(dataPlus);
        if (inactive)
            hits.push(inactive);
        const dateCmd = this.checkProblemeDateCmd(dataPlus);
        if (dateCmd)
            hits.push(dateCmd);
        const orderLine = this.data.findOrderLine(dataPlus.doco, dataPlus.dcto);
        if (orderLine) {
            const branch = this.checkItemBranchRecords(orderLine.pairs);
            if (branch)
                hits.push(branch);
            const obsolete = this.checkItemIsObsolete(orderLine.pairs);
            if (obsolete)
                hits.push(obsolete);
        }
        if (!hits.length)
            return null;
        for (const code of order_errors_1.ORDER_ERROR_PRIORITY) {
            const found = hits.find((h) => h.code === code);
            if (found)
                return found;
        }
        return hits[0];
    }
    resolveFromErrorTypeColumn(dataPlus) {
        const code = (0, order_errors_1.parseOrderErrorCode)(dataPlus.errorType);
        if (!code)
            return null;
        const orderLine = this.data.findOrderLine(dataPlus.doco, dataPlus.dcto);
        const base = {
            code,
            label: order_errors_1.ORDER_ERROR_LABELS[code],
            details: { source: 'error_type_column', orderType: dataPlus.dcto || null },
        };
        switch (code) {
            case 'INACTIVE_CUSTOMER': {
                const mag = dataPlus.sqalph ? this.data.findMagasinByNom(dataPlus.sqalph) : null;
                return {
                    ...base,
                    details: {
                        ...base.details,
                        magasin: mag?.nomMagasin ?? dataPlus.sqalph,
                        statutMagasin: mag != null ? (0, magasin_status_util_1.magasinStatusLabel)(mag.status, 'fr') : 'inconnu',
                    },
                };
            }
            case 'PROBLEME_DATE_CMD':
                return {
                    ...base,
                    details: {
                        ...base.details,
                        SDADDJ: dataPlus.sdaddj || null,
                        SDTRDJ: dataPlus.sdtrdj || null,
                        SDNXTR: dataPlus.sdnxtr || null,
                    },
                };
            case 'ITEM_BRANCH_RECORDS':
                return orderLine ? this.checkItemBranchRecords(orderLine.pairs) ?? base : base;
            case 'ITEM_IS_OBSOLETE':
                return orderLine ? this.checkItemIsObsolete(orderLine.pairs) ?? base : base;
            default:
                return base;
        }
    }
    labelFor(code, lang) {
        return lang === 'en' ? order_errors_1.ORDER_ERROR_LABELS_EN[code] : order_errors_1.ORDER_ERROR_LABELS[code];
    }
    checkInactiveCustomer(dataPlus) {
        const nom = dataPlus.sqalph?.trim();
        if (!nom)
            return null;
        const mag = this.data.findMagasinByNom(nom);
        if (!mag || !(0, magasin_status_util_1.isMagasinInactive)(mag.status))
            return null;
        return {
            code: 'INACTIVE_CUSTOMER',
            label: order_errors_1.ORDER_ERROR_LABELS.INACTIVE_CUSTOMER,
            details: {
                magasin: mag.nomMagasin,
                statutMagasin: 'inactif',
            },
        };
    }
    checkProblemeDateCmd(dataPlus) {
        const sdnxtr = Number(dataPlus.sdnxtr);
        const fromType = (0, order_errors_1.parseOrderErrorCode)(dataPlus.errorType) === 'PROBLEME_DATE_CMD';
        if (!fromType && (!Number.isFinite(sdnxtr) || sdnxtr !== 990))
            return null;
        return {
            code: 'PROBLEME_DATE_CMD',
            label: order_errors_1.ORDER_ERROR_LABELS.PROBLEME_DATE_CMD,
            details: {
                dateAjout: dataPlus.sdaddj || null,
                dateTransaction: dataPlus.sdtrdj || null,
                indicateurComptabilisation: sdnxtr,
            },
        };
    }
    checkItemBranchRecords(pairs) {
        const missing = [];
        for (const p of pairs) {
            if (!this.data.findArticle(p.articleRef, p.magasinCode)) {
                missing.push({ article: p.articleRef, magasin: p.magasinCode });
            }
        }
        if (!missing.length)
            return null;
        return {
            code: 'ITEM_BRANCH_RECORDS',
            label: order_errors_1.ORDER_ERROR_LABELS.ITEM_BRANCH_RECORDS,
            details: { pairesNonReferencees: missing.slice(0, 15), total: missing.length },
        };
    }
    checkItemIsObsolete(pairs) {
        const blocked = [];
        for (const p of pairs) {
            const art = this.data.findArticle(p.articleRef, p.magasinCode);
            if (!art)
                continue;
            const isObsolete = art.status === 'O' || art.pfIssueType === 'BLOCKED_STATUS';
            if (isObsolete) {
                blocked.push({
                    article: art.refArticle,
                    magasin: art.magazin,
                    status: art.status,
                    issueType: art.pfIssueType,
                });
            }
        }
        if (!blocked.length)
            return null;
        return {
            code: 'ITEM_IS_OBSOLETE',
            label: order_errors_1.ORDER_ERROR_LABELS.ITEM_IS_OBSOLETE,
            details: { articlesBloques: blocked.slice(0, 15), total: blocked.length },
        };
    }
};
exports.OrderRuleEngineService = OrderRuleEngineService;
exports.OrderRuleEngineService = OrderRuleEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [order_data_service_1.OrderDataService])
], OrderRuleEngineService);
//# sourceMappingURL=order-rule-engine.service.js.map