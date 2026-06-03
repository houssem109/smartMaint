export type PageIndexQuality = 'good' | 'degraded' | 'poor' | 'unreadable';
export interface PageIndexRowHints {
    quality?: PageIndexQuality | null;
    visionUsed?: boolean;
    extractionMode?: 'text' | 'ocr' | 'vision' | null;
    sectionType?: string | null;
    qualityWarnings?: string[] | null;
}
export declare function pageTextNeedsVisionEnrichment(row: PageIndexRowHints | null | undefined): boolean;
export declare function shouldSkipPopplerOnlyForRow(row: PageIndexRowHints | null | undefined, rawPageText: string, hasOcr: boolean, minChars?: number): boolean;
export declare function extractVisionPreferredPageText(storedText: string, rawPageText: string, row: PageIndexRowHints | null | undefined, isGlyphCorrupted: boolean): string;
export declare function shouldReplacePageTextWithVision(row: PageIndexRowHints | null | undefined, previousText: string, opts: {
    usesDisplayFont?: boolean;
    warnedGlyph?: boolean;
    previousGlyphCorrupted?: boolean;
    minGoodChars?: number;
}): boolean;
export declare function formatPageChunkPrefix(pageNumber: number, sectionType: string | null, visionUsed: boolean): string;
export declare function isDiagramHeavyDocument(pageRows: PageIndexRowHints[]): boolean;
