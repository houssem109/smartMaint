"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageTextNeedsVisionEnrichment = pageTextNeedsVisionEnrichment;
exports.shouldSkipPopplerOnlyForRow = shouldSkipPopplerOnlyForRow;
exports.extractVisionPreferredPageText = extractVisionPreferredPageText;
exports.shouldReplacePageTextWithVision = shouldReplacePageTextWithVision;
exports.formatPageChunkPrefix = formatPageChunkPrefix;
exports.isDiagramHeavyDocument = isDiagramHeavyDocument;
const VISION_MARKER = '--- Vision description ---';
function pageTextNeedsVisionEnrichment(row) {
    if (!row)
        return true;
    if (row.visionUsed)
        return false;
    return (row.quality === 'unreadable' ||
        row.quality === 'poor' ||
        row.quality === 'degraded' ||
        row.sectionType === 'wiring');
}
function shouldSkipPopplerOnlyForRow(row, rawPageText, hasOcr, minChars = 200) {
    if (hasOcr)
        return false;
    const rawLen = String(rawPageText || '').trim().length;
    if (!rawLen)
        return true;
    if (row?.quality === 'unreadable' || row?.quality === 'poor')
        return true;
    if (pageTextNeedsVisionEnrichment(row) && rawLen < minChars)
        return true;
    return false;
}
function extractVisionPreferredPageText(storedText, rawPageText, row, isGlyphCorrupted) {
    const pageText = String(storedText || rawPageText || '').trim();
    if (!pageText)
        return '';
    if (pageText.includes(VISION_MARKER)) {
        const [rawPart, ...visionParts] = pageText.split(VISION_MARKER);
        const visionOnly = visionParts.join(VISION_MARKER).trim();
        const rawLikelyCorrupted = isGlyphCorrupted;
        if (visionOnly &&
            (rawLikelyCorrupted ||
                row?.visionUsed ||
                row?.quality === 'unreadable' ||
                row?.quality === 'poor')) {
            return visionOnly;
        }
        void rawPart;
    }
    if (row?.visionUsed && row.extractionMode === 'vision') {
        return pageText;
    }
    return pageText;
}
function shouldReplacePageTextWithVision(row, previousText, opts) {
    const minGood = opts.minGoodChars ?? 200;
    const prevLen = String(previousText || '').trim().length;
    return (!!opts.usesDisplayFont ||
        !!opts.warnedGlyph ||
        !!opts.previousGlyphCorrupted ||
        row?.quality === 'unreadable' ||
        row?.quality === 'poor' ||
        row?.quality === 'degraded' ||
        row?.sectionType === 'wiring' ||
        (prevLen > 0 && prevLen < minGood));
}
function formatPageChunkPrefix(pageNumber, sectionType, visionUsed) {
    const section = sectionType?.trim() || 'general';
    const source = visionUsed ? 'vision' : 'text';
    return `[Page ${pageNumber} | ${section} | ${source}]`;
}
function isDiagramHeavyDocument(pageRows) {
    if (pageRows.length < 3)
        return false;
    const weak = pageRows.filter((r) => r.quality === 'unreadable' || r.quality === 'poor' || r.sectionType === 'wiring').length;
    return weak / pageRows.length >= 0.5;
}
//# sourceMappingURL=pdf-page-index-text.util.js.map