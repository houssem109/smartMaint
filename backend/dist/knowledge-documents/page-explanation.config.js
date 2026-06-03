"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPdfPageExplanationBeforeIndexEnabled = isPdfPageExplanationBeforeIndexEnabled;
exports.getPdfPageExplanationMaxPages = getPdfPageExplanationMaxPages;
exports.getPdfPageExplanationMode = getPdfPageExplanationMode;
exports.buildSchematicVisionPromptSuffix = buildSchematicVisionPromptSuffix;
exports.buildPageExplanationVisionPrompt = buildPageExplanationVisionPrompt;
exports.isFieldPhotoVisionEnabled = isFieldPhotoVisionEnabled;
exports.buildFieldPhotoVisionPrompt = buildFieldPhotoVisionPrompt;
function isPdfPageExplanationBeforeIndexEnabled() {
    return String(process.env.PDF_PAGE_EXPLAIN_BEFORE_INDEX ?? 'true').toLowerCase() !== 'false';
}
function getPdfPageExplanationMaxPages() {
    const n = Number(process.env.PDF_PAGE_EXPLAIN_MAX_PAGES ?? 150);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 150;
}
function getPdfPageExplanationMode() {
    const raw = String(process.env.PDF_PAGE_EXPLAIN_MODE ?? 'concise').toLowerCase();
    if (raw === 'full' || raw === 'transcribe')
        return raw;
    return 'concise';
}
function buildSchematicVisionPromptSuffix() {
    return ('\nThis page is primarily an electrical schematic or MCC circuit diagram.\n' +
        'Describe it for a maintenance technician searching this manual later:\n' +
        '- Sheet title, drawing number, revision if visible.\n' +
        '- Major components: contactors, relays, fuses, terminals, motors, PLC I/O, disconnects.\n' +
        '- Wire/circuit identifiers (e.g. K1, M1, F1, TB1, L1/L2/L3, 24VDC).\n' +
        '- Connections: what feeds what, interlocks, safety chains, control vs power paths.\n' +
        '- Any fault/alarm labels, setpoints, or notes on the drawing.\n' +
        'Use plain searchable text — not a vague summary.');
}
function buildPageExplanationVisionPrompt(langLabel, usesDisplayFont, opts) {
    const mode = getPdfPageExplanationMode();
    const lcd = usesDisplayFont
        ? ' LCD/seven-segment fonts: transcribe digits and short codes EXACTLY (OPtr, SLCt, ULoc). Keys: [UP], [DOWN], [RETURN].'
        : ' LCD/display fonts: transcribe digits and short codes exactly.';
    if (mode === 'transcribe') {
        return (`Transcribe this industrial manual page in ${langLabel} only. Plain text, no markdown.\n` +
            'Headings, table rows, fault codes, menu labels — preserve structure. One short line for diagrams if needed.' +
            lcd +
            (opts?.schematicPage ? buildSchematicVisionPromptSuffix() : ''));
    }
    if (mode === 'concise') {
        return (`Transcribe this manual page in ${langLabel}. Plain text, no markdown.\n` +
            'Include headings, tables (row by row), fault codes, menu items. For diagrams: one short paragraph on components/connections.\n' +
            'Do NOT write a long narrative — related pages share context; search needs keywords, not essays.' +
            lcd +
            (opts?.schematicPage ? buildSchematicVisionPromptSuffix() : ''));
    }
    return ('You are helping a maintenance technician understand one page of an industrial manual.\n' +
        `Write in ${langLabel} only (standard numerals/symbols). No markdown code fences.\n` +
        'Explain the page as if the user uploaded a photo and asked: "What is on this page? Explain clearly."\n' +
        '1) Transcribe ALL readable text: headings, table rows/columns, labels, fault codes, menu names.\n' +
        '2) For tables, preserve structure (row by row).\n' +
        '3) For wiring diagrams or schematics, describe components, terminals, connections, and identifiers.\n' +
        '4) For HMI/menu screenshots, list each menu option and what the operator sees.\n' +
        '5) Keep the explanation complete but concise — this text will power search and chat.' +
        lcd +
        (opts?.schematicPage ? buildSchematicVisionPromptSuffix() : ''));
}
function isFieldPhotoVisionEnabled() {
    return String(process.env.ENABLE_FIELD_PHOTO_VISION ?? 'true').toLowerCase() !== 'false';
}
function buildFieldPhotoVisionPrompt(machineName, title) {
    const machine = machineName?.trim() ? `Machine: ${machineName.trim()}.` : '';
    const t = title?.trim() ? `Context: ${title.trim()}.` : '';
    return ('You are documenting field maintenance knowledge from a photo taken on site.\n' +
        `${machine} ${t}\n` +
        'Describe everything visible: equipment model labels, panel lights, error codes, damaged parts, ' +
        'wiring, gauges, and what a technician should notice. Plain text only, no markdown fences.');
}
//# sourceMappingURL=page-explanation.config.js.map