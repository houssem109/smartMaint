/** 6 Employee 3 — vision fallback (Ollama multimodal). */

/** `ENABLE_PDF_VISION` in environment (master switch). Admin may still turn vision off in DB — see `KnowledgeDocumentsService`. */
export function isPdfVisionEnabled(): boolean {
  return String(process.env.ENABLE_PDF_VISION ?? 'false').toLowerCase() === 'true';
}

/** Max pages per document to send through vision (after OCR or direct). */
export function getPdfVisionMaxPages(): number {
  const n = Number(process.env.PDF_VISION_MAX_PAGES ?? 5);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(20, Math.floor(n)));
}

/**
 * After OCR, enqueue vision if mean word confidence (0–1) is below this,
 * or if OCR text is shorter than {@link getVisionMinOcrTextChars}.
 */
export function getVisionTriggerOcrConfidenceBelow(): number {
  const v = Number(process.env.PDF_VISION_TRIGGER_OCR_CONFIDENCE_BELOW ?? 0.45);
  if (!Number.isFinite(v)) return 0.45;
  return Math.max(0, Math.min(1, v));
}

export function getVisionMinOcrTextChars(): number {
  const n = Number(process.env.PDF_VISION_MIN_OCR_TEXT_CHARS ?? 40);
  if (!Number.isFinite(n)) return 40;
  return Math.max(0, Math.min(500, Math.floor(n)));
}
