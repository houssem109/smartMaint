"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPaddleOcrVl = isPaddleOcrVl;
exports.getOcrRenderDpi = getOcrRenderDpi;
exports.shouldSkipSharpPreprocess = shouldSkipSharpPreprocess;
exports.getPdfOcrMaxPagesAuto = getPdfOcrMaxPagesAuto;
exports.getPdfOcrManualMaxPages = getPdfOcrManualMaxPages;
exports.isPdfOcrAutoReindexEnabled = isPdfOcrAutoReindexEnabled;
exports.isPdfOcrInlineBeforeIndexEnabled = isPdfOcrInlineBeforeIndexEnabled;
function isPaddleOcrVl() {
    const v = process.env.PADDLE_OCR_ENGINE?.trim().toLowerCase();
    return v === 'vl' || v === 'paddleocr-vl';
}
function getOcrRenderDpi() {
    const n = Number(process.env.PDF_OCR_RENDER_DPI ?? (isPaddleOcrVl() ? 300 : 200));
    if (!Number.isFinite(n) || n < 72)
        return isPaddleOcrVl() ? 300 : 200;
    return Math.min(400, Math.floor(n));
}
function shouldSkipSharpPreprocess() {
    if (String(process.env.PDF_OCR_SKIP_SHARP_PREPROCESS ?? '').toLowerCase() === 'true')
        return true;
    if (String(process.env.PDF_OCR_SKIP_SHARP_PREPROCESS ?? '').toLowerCase() === 'false')
        return false;
    return isPaddleOcrVl();
}
function getPdfOcrMaxPagesAuto() {
    const n = Number(process.env.PDF_OCR_MAX_PAGES ?? 60);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 60;
}
function getPdfOcrManualMaxPages() {
    const n = Number(process.env.PDF_OCR_MANUAL_MAX_PAGES ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function isPdfOcrAutoReindexEnabled() {
    return String(process.env.PDF_OCR_AUTO_REINDEX ?? 'true').toLowerCase() !== 'false';
}
function isPdfOcrInlineBeforeIndexEnabled() {
    return String(process.env.PDF_OCR_INLINE_BEFORE_INDEX ?? 'true').toLowerCase() !== 'false';
}
//# sourceMappingURL=pdf-ocr.config.js.map