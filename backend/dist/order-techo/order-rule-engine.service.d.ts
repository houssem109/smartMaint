import { OrderErrorCode } from './order-errors';
import { DataPlusRow, OrderDataService } from './order-data.service';
export interface RuleEngineResult {
    code: OrderErrorCode;
    label: string;
    details: Record<string, unknown>;
}
export declare class OrderRuleEngineService {
    private readonly data;
    constructor(data: OrderDataService);
    evaluate(dataPlus: DataPlusRow): RuleEngineResult | null;
    private resolveFromErrorTypeColumn;
    labelFor(code: OrderErrorCode, lang: 'fr' | 'en'): string;
    private checkInactiveCustomer;
    private checkProblemeDateCmd;
    private checkItemBranchRecords;
    private checkItemIsObsolete;
}
