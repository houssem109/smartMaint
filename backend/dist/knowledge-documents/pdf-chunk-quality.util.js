"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLowValueChunkText = isLowValueChunkText;
exports.countAlphanumeric = countAlphanumeric;
exports.chunkQualityFlags = chunkQualityFlags;
function isLowValueChunkText(text) {
    const t = String(text || '').trim();
    if (!t)
        return true;
    if (t.length < 12) {
        const alnum = countAlphanumeric(t);
        return alnum < 4;
    }
    const alnum = countAlphanumeric(t);
    const ratio = alnum / t.length;
    if (ratio < 0.06)
        return true;
    const withoutSeparators = t.replace(/[.\s\-_·•…:;,|]+/g, '');
    if (withoutSeparators.length < 20 && ratio < 0.15)
        return true;
    return false;
}
function countAlphanumeric(text) {
    const m = String(text || '').match(/[A-Za-z0-9\u00C0-\u024F]/g);
    return m?.length ?? 0;
}
function chunkQualityFlags(text) {
    const charCount = String(text || '').length;
    const alnumCount = countAlphanumeric(text);
    const alnumRatio = charCount > 0 ? alnumCount / charCount : 0;
    const mostlyDots = isLowValueChunkText(text);
    return {
        alnumCount,
        charCount,
        alnumRatio: Math.round(alnumRatio * 1000) / 1000,
        mostlyDots,
        embedWorthy: !mostlyDots,
    };
}
//# sourceMappingURL=pdf-chunk-quality.util.js.map