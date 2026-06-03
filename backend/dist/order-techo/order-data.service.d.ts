import { OnModuleInit } from '@nestjs/common';
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
export declare class OrderDataService implements OnModuleInit {
    private readonly logger;
    private loaded;
    private dataPlusByDoco;
    private orderLinesByKey;
    private articlesByKey;
    private magasinByName;
    onModuleInit(): void;
    isReady(): boolean;
    reload(): void;
    private loadAll;
    findDataPlus(doco: string): DataPlusRow | null;
    findOrderLine(doco: string, dcto: string): OrderLineExpanded | null;
    findMagasinByNom(nom: string): MagasinRow | null;
    findArticle(ref: string, mag: string): ArticleRow | null;
    articleKey(ref: string, mag: string): string;
    orderKey(doco: string, dcto: string): string;
    private normName;
}
