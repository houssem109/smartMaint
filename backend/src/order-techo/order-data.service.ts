import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { join } from 'path';
import { CsvRow, parseSemicolonCsv, resolveOrderDataDir, splitCsvList } from './order-csv.util';

export interface OrderLinePair {
  articleRef: string;
  magasinCode: string;
}

export interface OrderLineExpanded {
  doco: string;
  dcto: string;
  pairs: OrderLinePair[];
}

export interface DataPlusRow {
  doco: string;
  dcto: string;
  nbPf: string;
  sqalph: string;
  sdaddj: string;
  sdtrdj: string;
  sdnxtr: string;
  errorType: string;
}

export interface ArticleRow {
  refArticle: string;
  magazin: string;
  pfName: string;
  status: string;
  pfIssueType: string;
}

/** status in CSV: 0 = active, 1 = inactive */
export interface MagasinRow {
  nomMagasin: string;
  status: number;
}

@Injectable()
export class OrderDataService implements OnModuleInit {
  private readonly logger = new Logger(OrderDataService.name);
  private loaded = false;

  private dataPlusByDoco = new Map<string, DataPlusRow>();
  private orderLinesByKey = new Map<string, OrderLineExpanded>();
  private articlesByKey = new Map<string, ArticleRow>();
  private magasinByName = new Map<string, MagasinRow>();

  onModuleInit(): void {
    if (String(process.env.ORDER_TECHO_ENABLED ?? 'true').toLowerCase() === 'false') {
      this.logger.log('Order Techo disabled (ORDER_TECHO_ENABLED=false)');
      return;
    }
    this.loadAll();
  }

  isReady(): boolean {
    return this.loaded;
  }

  reload(): void {
    this.loadAll();
  }

  private loadAll(): void {
    const dir = resolveOrderDataDir();
    try {
      const articles = parseSemicolonCsv(join(dir, 'article.csv'));
      const magasins = parseSemicolonCsv(join(dir, 'magasin.csv'));
      const orderLines = parseSemicolonCsv(join(dir, 'order_lines.csv'));
      const dataPlus = parseSemicolonCsv(join(dir, 'data_plus.csv'));

      this.articlesByKey.clear();
      for (const r of articles) {
        const ref = (r.ref_article ?? r['ref_article '] ?? '').trim();
        const mag = (r.magazin ?? '').trim();
        if (!ref || !mag) continue;
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
        if (!nom) continue;
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
        if (!doco) continue;
        const pfs = splitCsvList(r.pf_list ?? '');
        const mcus = splitCsvList(r.mcu_list ?? '');
        const pairs: OrderLinePair[] = [];
        const len = Math.max(pfs.length, mcus.length);
        for (let i = 0; i < len; i++) {
          const articleRef = pfs[i] ?? '';
          const magasinCode = mcus[i] ?? '';
          if (articleRef && magasinCode) pairs.push({ articleRef, magasinCode });
        }
        this.orderLinesByKey.set(this.orderKey(doco, dcto), { doco, dcto, pairs });
      }

      this.dataPlusByDoco.clear();
      for (const r of dataPlus) {
        const doco = (r.doco ?? '').trim();
        if (!doco) continue;
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
      this.logger.log(
        `Order Techo data loaded from ${dir}: data_plus=${this.dataPlusByDoco.size}, order_lines=${this.orderLinesByKey.size}, articles=${this.articlesByKey.size}, magasins=${this.magasinByName.size}`,
      );
    } catch (e) {
      this.loaded = false;
      this.logger.error(`Failed to load order CSV from ${dir}: ${e instanceof Error ? e.message : e}`);
    }
  }

  findDataPlus(doco: string): DataPlusRow | null {
    return this.dataPlusByDoco.get(doco.trim()) ?? null;
  }

  findOrderLine(doco: string, dcto: string): OrderLineExpanded | null {
    return this.orderLinesByKey.get(this.orderKey(doco, dcto)) ?? null;
  }

  findMagasinByNom(nom: string): MagasinRow | null {
    return this.magasinByName.get(this.normName(nom)) ?? null;
  }

  findArticle(ref: string, mag: string): ArticleRow | null {
    return this.articlesByKey.get(this.articleKey(ref, mag)) ?? null;
  }

  articleKey(ref: string, mag: string): string {
    return `${ref.trim().toUpperCase()}|${mag.trim().toUpperCase()}`;
  }

  orderKey(doco: string, dcto: string): string {
    return `${doco.trim()}|${dcto.trim().toUpperCase()}`;
  }

  private normName(n: string): string {
    return n.trim().toUpperCase();
  }
}
