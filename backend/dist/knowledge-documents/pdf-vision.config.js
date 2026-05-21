"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPdfVisionEnabled = isPdfVisionEnabled;
exports.getPdfVisionMaxPages = getPdfVisionMaxPages;
exports.getVisionTriggerOcrConfidenceBelow = getVisionTriggerOcrConfidenceBelow;
exports.getVisionMinOcrTextChars = getVisionMinOcrTextChars;
function isPdfVisionEnabled() {
    return String(process.env.ENABLE_PDF_VISION ?? 'false').toLowerCase() === 'true';
}
function getPdfVisionMaxPages() {
    const n = Number(process.env.PDF_VISION_MAX_PAGES ?? 5);
    if (!Number.isFinite(n))
        return 5;
    return Math.max(0, Math.min(20, Math.floor(n)));
}
function getVisionTriggerOcrConfidenceBelow() {
    const v = Number(process.env.PDF_VISION_TRIGGER_OCR_CONFIDENCE_BELOW ?? 0.45);
    if (!Number.isFinite(v))
        return 0.45;
    return Math.max(0, Math.min(1, v));
}
function getVisionMinOcrTextChars() {
    const n = Number(process.env.PDF_VISION_MIN_OCR_TEXT_CHARS ?? 40);
    if (!Number.isFinite(n))
        return 40;
    return Math.max(0, Math.min(500, Math.floor(n)));
}
//# sourceMappingURL=pdf-vision.config.js.map