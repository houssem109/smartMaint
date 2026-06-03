"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_ERROR_LABELS_EN = exports.ORDER_ERROR_LABELS = exports.ORDER_ERROR_PRIORITY = void 0;
exports.parseOrderErrorCode = parseOrderErrorCode;
exports.ORDER_ERROR_PRIORITY = [
    'INACTIVE_CUSTOMER',
    'PROBLEME_DATE_CMD',
    'ITEM_BRANCH_RECORDS',
    'ITEM_IS_OBSOLETE',
];
exports.ORDER_ERROR_LABELS = {
    INACTIVE_CUSTOMER: 'Client inactif',
    PROBLEME_DATE_CMD: 'Problème de comptabilisation / date',
    ITEM_BRANCH_RECORDS: 'Article non référencé dans son magasin',
    ITEM_IS_OBSOLETE: 'Article obsolète ou bloqué',
};
exports.ORDER_ERROR_LABELS_EN = {
    INACTIVE_CUSTOMER: 'Inactive customer / store',
    PROBLEME_DATE_CMD: 'Order posting / date issue',
    ITEM_BRANCH_RECORDS: 'Item not set up for this store',
    ITEM_IS_OBSOLETE: 'Obsolete or blocked item',
};
const KNOWN_CODES = new Set(Object.keys(exports.ORDER_ERROR_LABELS));
function parseOrderErrorCode(raw) {
    const code = String(raw ?? '')
        .trim()
        .toUpperCase();
    if (KNOWN_CODES.has(code))
        return code;
    return null;
}
//# sourceMappingURL=order-errors.js.map