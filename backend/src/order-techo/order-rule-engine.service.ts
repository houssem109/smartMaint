import { Injectable } from '@nestjs/common';
import {
  ORDER_ERROR_LABELS,
  ORDER_ERROR_LABELS_EN,
  ORDER_ERROR_PRIORITY,
  OrderErrorCode,
  parseOrderErrorCode,
} from './order-errors';
import { DataPlusRow, OrderDataService, OrderLinePair } from './order-data.service';
import { isMagasinInactive, magasinStatusLabel } from './magasin-status.util';

export interface RuleEngineResult {
  code: OrderErrorCode;
  label: string;
  details: Record<string, unknown>;
}

@Injectable()
export class OrderRuleEngineService {
  constructor(private readonly data: OrderDataService) {}

  /**
   * Primary: `error_type` on the order row (source of truth in CSV).
   * Fallback: rule engine when column is empty or unknown.
   */
  evaluate(dataPlus: DataPlusRow): RuleEngineResult | null {
    const fromColumn = this.resolveFromErrorTypeColumn(dataPlus);
    if (fromColumn) return fromColumn;

    const hits: RuleEngineResult[] = [];

    const inactive = this.checkInactiveCustomer(dataPlus);
    if (inactive) hits.push(inactive);

    const dateCmd = this.checkProblemeDateCmd(dataPlus);
    if (dateCmd) hits.push(dateCmd);

    const orderLine = this.data.findOrderLine(dataPlus.doco, dataPlus.dcto);
    if (orderLine) {
      const branch = this.checkItemBranchRecords(orderLine.pairs);
      if (branch) hits.push(branch);

      const obsolete = this.checkItemIsObsolete(orderLine.pairs);
      if (obsolete) hits.push(obsolete);
    }

    if (!hits.length) return null;

    for (const code of ORDER_ERROR_PRIORITY) {
      const found = hits.find((h) => h.code === code);
      if (found) return found;
    }
    return hits[0];
  }

  private resolveFromErrorTypeColumn(dataPlus: DataPlusRow): RuleEngineResult | null {
    const code = parseOrderErrorCode(dataPlus.errorType);
    if (!code) return null;

    const orderLine = this.data.findOrderLine(dataPlus.doco, dataPlus.dcto);
    const base = {
      code,
      label: ORDER_ERROR_LABELS[code],
      details: { source: 'error_type_column', orderType: dataPlus.dcto || null } as Record<string, unknown>,
    };

    switch (code) {
      case 'INACTIVE_CUSTOMER': {
        const mag = dataPlus.sqalph ? this.data.findMagasinByNom(dataPlus.sqalph) : null;
        return {
          ...base,
          details: {
            ...base.details,
            magasin: mag?.nomMagasin ?? dataPlus.sqalph,
            statutMagasin: mag != null ? magasinStatusLabel(mag.status, 'fr') : 'inconnu',
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

  labelFor(code: OrderErrorCode, lang: 'fr' | 'en'): string {
    return lang === 'en' ? ORDER_ERROR_LABELS_EN[code] : ORDER_ERROR_LABELS[code];
  }

  private checkInactiveCustomer(dataPlus: DataPlusRow): RuleEngineResult | null {
    const nom = dataPlus.sqalph?.trim();
    if (!nom) return null;
    const mag = this.data.findMagasinByNom(nom);
    if (!mag || !isMagasinInactive(mag.status)) return null;
    return {
      code: 'INACTIVE_CUSTOMER',
      label: ORDER_ERROR_LABELS.INACTIVE_CUSTOMER,
      details: {
        magasin: mag.nomMagasin,
        statutMagasin: 'inactif',
      },
    };
  }

  private checkProblemeDateCmd(dataPlus: DataPlusRow): RuleEngineResult | null {
    const sdnxtr = Number(dataPlus.sdnxtr);
    const fromType = parseOrderErrorCode(dataPlus.errorType) === 'PROBLEME_DATE_CMD';
    if (!fromType && (!Number.isFinite(sdnxtr) || sdnxtr !== 990)) return null;
    return {
      code: 'PROBLEME_DATE_CMD',
      label: ORDER_ERROR_LABELS.PROBLEME_DATE_CMD,
      details: {
        dateAjout: dataPlus.sdaddj || null,
        dateTransaction: dataPlus.sdtrdj || null,
        indicateurComptabilisation: sdnxtr,
      },
    };
  }

  private checkItemBranchRecords(pairs: OrderLinePair[]): RuleEngineResult | null {
    const missing: { article: string; magasin: string }[] = [];
    for (const p of pairs) {
      if (!this.data.findArticle(p.articleRef, p.magasinCode)) {
        missing.push({ article: p.articleRef, magasin: p.magasinCode });
      }
    }
    if (!missing.length) return null;
    return {
      code: 'ITEM_BRANCH_RECORDS',
      label: ORDER_ERROR_LABELS.ITEM_BRANCH_RECORDS,
      details: { pairesNonReferencees: missing.slice(0, 15), total: missing.length },
    };
  }

  private checkItemIsObsolete(pairs: OrderLinePair[]): RuleEngineResult | null {
    const blocked: { article: string; magasin: string; status: string; issueType: string }[] = [];
    for (const p of pairs) {
      const art = this.data.findArticle(p.articleRef, p.magasinCode);
      if (!art) continue;
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
    if (!blocked.length) return null;
    return {
      code: 'ITEM_IS_OBSOLETE',
      label: ORDER_ERROR_LABELS.ITEM_IS_OBSOLETE,
      details: { articlesBloques: blocked.slice(0, 15), total: blocked.length },
    };
  }
}
