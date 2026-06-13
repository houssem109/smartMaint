import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReferenceDataLoadLogService } from './reference-data-load-log.service';
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
export interface MagasinRow {
    nomMagasin: string;
    status: number;
}
export declare class OrderDataService implements OnModuleInit, OnModuleDestroy {
    private readonly loadLog;
    private readonly logger;
    private loaded;
    private fileWatchers;
    private reloadDebounce;
    private fileFingerprints;
    private dataPlusByDoco;
    private orderLinesByKey;
    private articlesByKey;
    private magasinByName;
    constructor(loadLog: ReferenceDataLoadLogService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    isReady(): boolean;
    reload(): void;
    private loadAll;
    private captureFingerprints;
    private fingerprintFile;
    private startFileWatch;
    private stopFileWatch;
    private scheduleReloadFromFileChange;
    findDataPlus(doco: string): DataPlusRow | null;
    findOrderLine(doco: string, dcto: string): OrderLineExpanded | null;
    findMagasinByNom(nom: string): MagasinRow | null;
    findArticle(ref: string, mag: string): ArticleRow | null;
    articleKey(ref: string, mag: string): string;
    orderKey(doco: string, dcto: string): string;
    private normName;
}
