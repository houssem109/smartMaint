"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPdfPageExplanationBeforeIndexEnabled = exports.isFieldPhotoVisionEnabled = exports.getPdfPageExplanationMaxPages = exports.buildPageExplanationVisionPrompt = exports.buildFieldPhotoVisionPrompt = exports.shouldSkipSharpPreprocess = exports.isPdfOcrInlineBeforeIndexEnabled = exports.isPdfOcrAutoReindexEnabled = exports.isPaddleOcrVl = exports.getPdfOcrMaxPagesAuto = exports.getPdfOcrManualMaxPages = exports.getOcrRenderDpi = void 0;
exports.getPaddleOcrUrl = getPaddleOcrUrl;
exports.getPaddleOcrTimeoutMs = getPaddleOcrTimeoutMs;
exports.resolvePaddleOcrLang = resolvePaddleOcrLang;
exports.normalizeOcrOutput = normalizeOcrOutput;
exports.runOcrOnPng = runOcrOnPng;
const fs_1 = require("fs");
var pdf_ocr_config_1 = require("./pdf-ocr.config");
Object.defineProperty(exports, "getOcrRenderDpi", { enumerable: true, get: function () { return pdf_ocr_config_1.getOcrRenderDpi; } });
Object.defineProperty(exports, "getPdfOcrManualMaxPages", { enumerable: true, get: function () { return pdf_ocr_config_1.getPdfOcrManualMaxPages; } });
Object.defineProperty(exports, "getPdfOcrMaxPagesAuto", { enumerable: true, get: function () { return pdf_ocr_config_1.getPdfOcrMaxPagesAuto; } });
Object.defineProperty(exports, "isPaddleOcrVl", { enumerable: true, get: function () { return pdf_ocr_config_1.isPaddleOcrVl; } });
Object.defineProperty(exports, "isPdfOcrAutoReindexEnabled", { enumerable: true, get: function () { return pdf_ocr_config_1.isPdfOcrAutoReindexEnabled; } });
Object.defineProperty(exports, "isPdfOcrInlineBeforeIndexEnabled", { enumerable: true, get: function () { return pdf_ocr_config_1.isPdfOcrInlineBeforeIndexEnabled; } });
Object.defineProperty(exports, "shouldSkipSharpPreprocess", { enumerable: true, get: function () { return pdf_ocr_config_1.shouldSkipSharpPreprocess; } });
var page_explanation_config_1 = require("./page-explanation.config");
Object.defineProperty(exports, "buildFieldPhotoVisionPrompt", { enumerable: true, get: function () { return page_explanation_config_1.buildFieldPhotoVisionPrompt; } });
Object.defineProperty(exports, "buildPageExplanationVisionPrompt", { enumerable: true, get: function () { return page_explanation_config_1.buildPageExplanationVisionPrompt; } });
Object.defineProperty(exports, "getPdfPageExplanationMaxPages", { enumerable: true, get: function () { return page_explanation_config_1.getPdfPageExplanationMaxPages; } });
Object.defineProperty(exports, "isFieldPhotoVisionEnabled", { enumerable: true, get: function () { return page_explanation_config_1.isFieldPhotoVisionEnabled; } });
Object.defineProperty(exports, "isPdfPageExplanationBeforeIndexEnabled", { enumerable: true, get: function () { return page_explanation_config_1.isPdfPageExplanationBeforeIndexEnabled; } });
function getPaddleOcrUrl() {
    return process.env.PADDLE_OCR_URL?.trim() || 'http://paddle-ocr:8000';
}
function getPaddleOcrTimeoutMs() {
    const n = Number(process.env.PADDLE_OCR_TIMEOUT_MS ?? 120_000);
    if (!Number.isFinite(n) || n < 5_000)
        return 120_000;
    return Math.min(600_000, Math.floor(n));
}
function resolvePaddleOcrLang() {
    return process.env.PADDLE_OCR_LANG?.trim() || 'latin';
}
function normalizeOcrOutput(text) {
    return String(text || '')
        .replace(/\u0000/g, '')
        .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
        .normalize('NFC')
        .trim();
}
async function runOcrOnPng(pngPath) {
    const imageBytes = (0, fs_1.readFileSync)(pngPath);
    const b64 = imageBytes.toString('base64');
    const baseUrl = getPaddleOcrUrl().replace(/\/+$/, '');
    const timeoutMs = getPaddleOcrTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${baseUrl}/ocr/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: b64 }),
            signal: controller.signal,
        });
        const bodyText = await res.text();
        if (!res.ok) {
            throw new Error(`PaddleOCR HTTP ${res.status}: ${bodyText.slice(0, 500)}`);
        }
        let data;
        try {
            data = JSON.parse(bodyText);
        }
        catch {
            throw new Error('PaddleOCR returned non-JSON response');
        }
        const text = normalizeOcrOutput(String(data?.text ?? ''));
        const rawConf = data?.confidence;
        const confidence = rawConf == null || rawConf === ''
            ? null
            : Math.max(0, Math.min(1, Number(rawConf)));
        return {
            text,
            confidence: Number.isFinite(confidence) ? confidence : null,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=pdf-ocr.util.js.map