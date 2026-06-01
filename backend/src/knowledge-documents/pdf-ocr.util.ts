import { readFileSync } from 'fs';
export {
  getOcrRenderDpi,
  getPdfOcrManualMaxPages,
  getPdfOcrMaxPagesAuto,
  isPaddleOcrVl,
  isPdfOcrAutoReindexEnabled,
  isPdfOcrInlineBeforeIndexEnabled,
  shouldSkipSharpPreprocess,
} from './pdf-ocr.config';
export {
  buildFieldPhotoVisionPrompt,
  buildPageExplanationVisionPrompt,
  getPdfPageExplanationMaxPages,
  isFieldPhotoVisionEnabled,
  isPdfPageExplanationBeforeIndexEnabled,
} from './page-explanation.config';

export function getPaddleOcrUrl(): string {
  return process.env.PADDLE_OCR_URL?.trim() || 'http://paddle-ocr:8000';
}

export function getPaddleOcrTimeoutMs(): number {
  const n = Number(process.env.PADDLE_OCR_TIMEOUT_MS ?? 120_000);
  if (!Number.isFinite(n) || n < 5_000) return 120_000;
  return Math.min(600_000, Math.floor(n));
}

/** PaddleOCR model language: en, french, arabic, latin, etc. */
export function resolvePaddleOcrLang(): string {
  return process.env.PADDLE_OCR_LANG?.trim() || 'latin';
}

export function normalizeOcrOutput(text: string): string {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
    .normalize('NFC')
    .trim();
}

/** Run PaddleOCR on a PNG via the HTTP sidecar. */
export async function runOcrOnPng(pngPath: string): Promise<{ text: string; confidence: number | null }> {
  const imageBytes = readFileSync(pngPath);
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
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error('PaddleOCR returned non-JSON response');
    }
    const text = normalizeOcrOutput(String(data?.text ?? ''));
    const rawConf = data?.confidence;
    const confidence =
      rawConf == null || rawConf === ''
        ? null
        : Math.max(0, Math.min(1, Number(rawConf)));
    return {
      text,
      confidence: Number.isFinite(confidence as number) ? (confidence as number) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
