/** Supported business error codes (extensible). */
export type OrderErrorCode =
  | 'INACTIVE_CUSTOMER'
  | 'PROBLEME_DATE_CMD'
  | 'ITEM_BRANCH_RECORDS'
  | 'ITEM_IS_OBSOLETE';

export const ORDER_ERROR_PRIORITY: OrderErrorCode[] = [
  'INACTIVE_CUSTOMER',
  'PROBLEME_DATE_CMD',
  'ITEM_BRANCH_RECORDS',
  'ITEM_IS_OBSOLETE',
];

export const ORDER_ERROR_LABELS: Record<OrderErrorCode, string> = {
  INACTIVE_CUSTOMER: 'Client inactif',
  PROBLEME_DATE_CMD: 'Problème de comptabilisation / date',
  ITEM_BRANCH_RECORDS: 'Article non référencé dans son magasin',
  ITEM_IS_OBSOLETE: 'Article obsolète ou bloqué',
};

export const ORDER_ERROR_LABELS_EN: Record<OrderErrorCode, string> = {
  INACTIVE_CUSTOMER: 'Inactive customer / store',
  PROBLEME_DATE_CMD: 'Order posting / date issue',
  ITEM_BRANCH_RECORDS: 'Item not set up for this store',
  ITEM_IS_OBSOLETE: 'Obsolete or blocked item',
};

const KNOWN_CODES = new Set<string>(Object.keys(ORDER_ERROR_LABELS));

export function parseOrderErrorCode(raw: string | null | undefined): OrderErrorCode | null {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (KNOWN_CODES.has(code)) return code as OrderErrorCode;
  return null;
}
