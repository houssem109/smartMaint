/** PaddleOCR-VL (HF) vs classic PP-OCR — controls preprocessing and render quality. */

export function isPaddleOcrVl(): boolean {
  const v = process.env.PADDLE_OCR_ENGINE?.trim().toLowerCase();
  return v === 'vl' || v === 'paddleocr-vl';
}

export function getOcrRenderDpi(): number {
  const n = Number(process.env.PDF_OCR_RENDER_DPI ?? (isPaddleOcrVl() ? 300 : 200));
  if (!Number.isFinite(n) || n < 72) return isPaddleOcrVl() ? 300 : 200;
  return Math.min(400, Math.floor(n));
}

export function shouldSkipSharpPreprocess(): boolean {
  if (String(process.env.PDF_OCR_SKIP_SHARP_PREPROCESS ?? '').toLowerCase() === 'true') return true;
  if (String(process.env.PDF_OCR_SKIP_SHARP_PREPROCESS ?? '').toLowerCase() === 'false') return false;
  return isPaddleOcrVl();
}

export function getPdfOcrMaxPagesAuto(): number {
  const n = Number(process.env.PDF_OCR_MAX_PAGES ?? 60);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 60;
}

/** Manual "Run OCR" cap; 0 = no cap (all selected pages). */
export function getPdfOcrManualMaxPages(): number {
  const n = Number(process.env.PDF_OCR_MANUAL_MAX_PAGES ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function isPdfOcrAutoReindexEnabled(): boolean {
  return String(process.env.PDF_OCR_AUTO_REINDEX ?? 'true').toLowerCase() !== 'false';
}

/** Run VL OCR on selected pages before first Qdrant index (upload pipeline). */
export function isPdfOcrInlineBeforeIndexEnabled(): boolean {
  return String(process.env.PDF_OCR_INLINE_BEFORE_INDEX ?? 'true').toLowerCase() !== 'false';
}
