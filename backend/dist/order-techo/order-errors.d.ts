export type OrderErrorCode = 'INACTIVE_CUSTOMER' | 'PROBLEME_DATE_CMD' | 'ITEM_BRANCH_RECORDS' | 'ITEM_IS_OBSOLETE';
export declare const ORDER_ERROR_PRIORITY: OrderErrorCode[];
export declare const ORDER_ERROR_LABELS: Record<OrderErrorCode, string>;
export declare const ORDER_ERROR_LABELS_EN: Record<OrderErrorCode, string>;
export declare function parseOrderErrorCode(raw: string | null | undefined): OrderErrorCode | null;
