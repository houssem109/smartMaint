"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPipelineAuditExcelBuffer = buildPipelineAuditExcelBuffer;
exports.pipelineAuditExcelFilename = pipelineAuditExcelFilename;
const exceljs_1 = __importDefault(require("exceljs"));
function styleHeaderRow(sheet, rowNumber = 1) {
    const row = sheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B8D4' },
    };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}
function autoColumnWidths(sheet, maxWidth = 60) {
    const colCount = sheet.columnCount;
    for (let c = 1; c <= colCount; c++) {
        let max = 10;
        sheet.eachRow((row) => {
            const v = row.getCell(c).value;
            const len = v != null ? String(v).length : 0;
            if (len > max)
                max = Math.min(len, maxWidth);
        });
        sheet.getColumn(c).width = max + 2;
    }
}
function addKeyValueBlock(sheet, rows) {
    for (const [label, value] of rows) {
        const r = sheet.addRow([label, value ?? '—']);
        r.getCell(1).font = { bold: true };
        r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    }
}
function extractionModeLabel(mode) {
    const map = {
        text: 'Texte PDF (Poppler)',
        ocr: 'OCR (PaddleOCR-VL)',
        vision: 'Vision (Ollama)',
    };
    return map[mode] ?? mode;
}
function qualityLabel(q) {
    const map = {
        good: 'Bonne',
        degraded: 'Dégradée',
        poor: 'Faible',
        unreadable: 'Illisible',
    };
    return map[q] ?? q;
}
function candidateStatusLabel(s) {
    const map = {
        candidate: 'En attente',
        approved: 'Approuvé',
        rejected: 'Rejeté',
    };
    return map[s] ?? s;
}
async function buildPipelineAuditExcelBuffer(report, candidates) {
    const wb = new exceljs_1.default.Workbook();
    wb.creator = 'SmartMaint';
    wb.created = new Date();
    const doc = report.document;
    const m = report.metrics;
    const summary = wb.addWorksheet('Résumé');
    summary.addRow(['Rapport pipeline — extraction & recherche']);
    summary.getRow(1).font = { bold: true, size: 14 };
    summary.addRow([]);
    addKeyValueBlock(summary, [
        ['Document', doc.originalName],
        ['Machine', doc.machineName ?? '—'],
        ['Type', doc.docType ?? '—'],
        ['Statut', doc.status],
        ['Progression', `${report.status.progressPercent}% (${report.status.currentStage ?? '—'})`],
        ['Pages totales', m.totalPages],
        ['Chunks indexés (Qdrant)', report.status.chunksIndexed],
        ['Erreur', doc.error ?? '—'],
        ['Généré le', new Date(report.generatedAt).toLocaleString('fr-FR')],
    ]);
    summary.addRow([]);
    summary.addRow(['Indicateurs clés']);
    summary.getRow(summary.rowCount).font = { bold: true, size: 12 };
    addKeyValueBlock(summary, [
        ['Vision activée', report.visionPreference.enabledEffective ? 'Oui' : 'Non'],
        ['Pages avec vision', `${m.pagesVisionUsed} / ${m.totalPages}`],
        ['Pages avec texte OCR', m.pagesWithOcrText],
        ['Chunks RAG (recherche)', m.ragChunkCount],
        ['Chunks « points » (mauvaise qualité)', m.ragMostlyDotsChunks],
        ['Candidats extraction LLM', m.candidateTotal],
        ['Candidats approuvés', m.candidateApproved],
        ['Taux approbation admin', m.approvalRatePercent != null ? `${m.approvalRatePercent}%` : '—'],
        [
            'Filtre chunks',
            `Construits ${report.chunkAudit.builtCount} → dédoublonnés ${report.chunkAudit.afterNearDuplicateCount} → propres ${report.chunkAudit.afterLowValueFilterCount}`,
        ],
    ]);
    autoColumnWidths(summary, 70);
    const pages = wb.addWorksheet('Pages OCR');
    pages.addRow([
        'Page',
        'Qualité',
        'Source texte',
        'Vision utilisée',
        'Confiance OCR',
        'Type section',
        'Long. OCR',
        'Long. Poppler',
        'Avertissements',
        'Texte OCR / Vision',
        'Texte couche PDF (Poppler)',
    ]);
    styleHeaderRow(pages);
    for (const p of report.pages) {
        const row = pages.addRow([
            p.pageNumber,
            qualityLabel(p.quality),
            extractionModeLabel(p.extractionMode),
            p.visionUsed ? 'Oui' : 'Non',
            p.ocrConfidence != null ? Math.round(p.ocrConfidence * 100) / 100 : '',
            p.sectionType ?? '',
            p.ocrTextLength,
            p.popplerTextLength,
            (p.qualityWarnings ?? []).join('; '),
            p.ocrText ?? '',
            p.popplerTextPreview
                ? p.popplerTextPreview + (p.popplerTextLength > p.popplerTextPreview.length ? '…' : '')
                : '',
        ]);
        row.getCell(10).alignment = { wrapText: true, vertical: 'top' };
        row.getCell(11).alignment = { wrapText: true, vertical: 'top' };
    }
    pages.views = [{ state: 'frozen', ySplit: 1 }];
    autoColumnWidths(pages, 50);
    const rag = wb.addWorksheet('Chunks recherche');
    rag.addRow([
        'N° chunk',
        'Type section',
        'Utilisable recherche',
        'Points / séparateurs',
        'Ratio lettres',
        'Titre',
        'Confiance',
        'Texte indexé (aperçu)',
        'Texte complet',
    ]);
    styleHeaderRow(rag);
    for (const c of report.ragChunks) {
        const row = rag.addRow([
            c.chunkIndex,
            c.sectionType ?? '',
            c.quality.embedWorthy ? 'Oui' : 'Non',
            c.quality.mostlyDots ? 'Oui' : 'Non',
            c.quality.alnumRatio != null ? Math.round(c.quality.alnumRatio * 100) / 100 : '',
            c.title ?? '',
            c.confidence ?? '',
            c.textPreview,
            c.text,
        ]);
        row.getCell(8).alignment = { wrapText: true, vertical: 'top' };
        row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
    }
    rag.views = [{ state: 'frozen', ySplit: 1 }];
    autoColumnWidths(rag, 55);
    const ext = wb.addWorksheet('Extraction LLM');
    ext.addRow([
        'Statut',
        'Type',
        'Titre',
        'Problème',
        'Solution',
        'Symptôme',
        'Cause racine',
        'Pages source',
        'Confiance',
        'Type section',
        'Tags',
    ]);
    styleHeaderRow(ext);
    for (const c of candidates) {
        const row = ext.addRow([
            candidateStatusLabel(c.status),
            c.entryType ?? '',
            c.title,
            c.problemDescription,
            c.solution,
            c.symptom ?? '',
            c.rootCause ?? '',
            c.sourcePages ?? '',
            c.confidence ?? '',
            c.sectionType ?? '',
            c.tags ?? '',
        ]);
        for (let col = 3; col <= 7; col++) {
            row.getCell(col).alignment = { wrapText: true, vertical: 'top' };
        }
    }
    ext.views = [{ state: 'frozen', ySplit: 1 }];
    autoColumnWidths(ext, 55);
    const help = wb.addWorksheet('Guide');
    help.addRow(['Comment lire ce fichier']);
    help.getRow(1).font = { bold: true, size: 12 };
    addKeyValueBlock(help, [
        ['Résumé', 'Vue d’ensemble : statut du PDF, KPIs vision/OCR, chunks indexés.'],
        ['Pages OCR', 'Une ligne par page : texte extrait par OCR/Vision vs texte natif du PDF (Poppler).'],
        ['Chunks recherche', 'Morceaux de texte envoyés à Qdrant pour la recherche du chatbot.'],
        ['Extraction LLM', 'Problèmes / solutions détectés par l’IA — à approuver dans l’admin.'],
        ['Long. OCR = 0', 'OCR pas encore exécuté sur cette page. Poppler peut quand même avoir du texte.'],
        ['Vision utilisée', 'Page enrichie par le modèle multimodal (llava) pour schémas / photos.'],
    ]);
    autoColumnWidths(help, 80);
    return Buffer.from(await wb.xlsx.writeBuffer());
}
function pipelineAuditExcelFilename(doc) {
    const base = (doc.originalName || 'document')
        .replace(/\.pdf$/i, '')
        .replace(/[^\w\u00C0-\u024F.-]+/g, '_')
        .slice(0, 50);
    return `pipeline-${base}.xlsx`;
}
//# sourceMappingURL=pipeline-audit-export.util.js.map