/** Resolve which page text to embed in Qdrant (Poppler vs OCR vs vision). */

export type PageIndexQuality = 'good' | 'degraded' | 'poor' | 'unreadable';

export interface PageIndexRowHints {
  quality?: PageIndexQuality | null;
  visionUsed?: boolean;
  extractionMode?: 'text' | 'ocr' | 'vision' | null;
  sectionType?: string | null;
  qualityWarnings?: string[] | null;
}

const VISION_MARKER = '--- Vision description ---';

export function pageTextNeedsVisionEnrichment(row: PageIndexRowHints | null | undefined): boolean {
  if (!row) return true;
  if (row.visionUsed) return false;
  return (
    row.quality === 'unreadable' ||
    row.quality === 'poor' ||
    row.quality === 'degraded' ||
    row.sectionType === 'wiring'
  );
}

/** Skip indexing Poppler-only slices on pages that still need OCR/vision enrichment. */
export function shouldSkipPopplerOnlyForRow(
  row: PageIndexRowHints | null | undefined,
  rawPageText: string,
  hasOcr: boolean,
  minChars = 200,
): boolean {
  if (hasOcr) return false;
  const rawLen = String(rawPageText || '').trim().length;
  if (!rawLen) return true;
  if (row?.quality === 'unreadable' || row?.quality === 'poor') return true;
  if (pageTextNeedsVisionEnrichment(row) && rawLen < minChars) return true;
  return false;
}

export function extractVisionPreferredPageText(
  storedText: string,
  rawPageText: string,
  row: PageIndexRowHints | null | undefined,
  isGlyphCorrupted: boolean,
): string {
  const pageText = String(storedText || rawPageText || '').trim();
  if (!pageText) return '';

  if (pageText.includes(VISION_MARKER)) {
    const [rawPart, ...visionParts] = pageText.split(VISION_MARKER);
    const visionOnly = visionParts.join(VISION_MARKER).trim();
    const rawLikelyCorrupted = isGlyphCorrupted;
    if (
      visionOnly &&
      (rawLikelyCorrupted ||
        row?.visionUsed ||
        row?.quality === 'unreadable' ||
        row?.quality === 'poor')
    ) {
      return visionOnly;
    }
    void rawPart;
  }

  if (row?.visionUsed && row.extractionMode === 'vision') {
    return pageText;
  }

  return pageText;
}

export function shouldReplacePageTextWithVision(
  row: PageIndexRowHints | null | undefined,
  previousText: string,
  opts: {
    usesDisplayFont?: boolean;
    warnedGlyph?: boolean;
    previousGlyphCorrupted?: boolean;
    minGoodChars?: number;
  },
): boolean {
  const minGood = opts.minGoodChars ?? 200;
  const prevLen = String(previousText || '').trim().length;
  return (
    !!opts.usesDisplayFont ||
    !!opts.warnedGlyph ||
    !!opts.previousGlyphCorrupted ||
    row?.quality === 'unreadable' ||
    row?.quality === 'poor' ||
    row?.quality === 'degraded' ||
    row?.sectionType === 'wiring' ||
    (prevLen > 0 && prevLen < minGood)
  );
}

export function formatPageChunkPrefix(pageNumber: number, sectionType: string | null, visionUsed: boolean): string {
  const section = sectionType?.trim() || 'general';
  const source = visionUsed ? 'vision' : 'text';
  return `[Page ${pageNumber} | ${section} | ${source}]`;
}

export function isDiagramHeavyDocument(pageRows: PageIndexRowHints[]): boolean {
  if (pageRows.length < 3) return false;
  const weak = pageRows.filter(
    (r) => r.quality === 'unreadable' || r.quality === 'poor' || r.sectionType === 'wiring',
  ).length;
  return weak / pageRows.length >= 0.5;
}
