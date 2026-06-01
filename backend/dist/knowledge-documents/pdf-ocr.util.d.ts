export { getOcrRenderDpi, getPdfOcrManualMaxPages, getPdfOcrMaxPagesAuto, isPaddleOcrVl, isPdfOcrAutoReindexEnabled, isPdfOcrInlineBeforeIndexEnabled, shouldSkipSharpPreprocess, } from './pdf-ocr.config';
export { buildFieldPhotoVisionPrompt, buildPageExplanationVisionPrompt, getPdfPageExplanationMaxPages, isFieldPhotoVisionEnabled, isPdfPageExplanationBeforeIndexEnabled, } from './page-explanation.config';
export declare function getPaddleOcrUrl(): string;
export declare function getPaddleOcrTimeoutMs(): number;
export declare function resolvePaddleOcrLang(): string;
export declare function normalizeOcrOutput(text: string): string;
export declare function runOcrOnPng(pngPath: string): Promise<{
    text: string;
    confidence: number | null;
}>;
