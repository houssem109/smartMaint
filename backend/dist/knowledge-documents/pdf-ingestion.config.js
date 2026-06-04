"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKnowledgePdfMaxBytes = getKnowledgePdfMaxBytes;
exports.getKnowledgePdfUploadDir = getKnowledgePdfUploadDir;
function getKnowledgePdfMaxBytes() {
    const raw = process.env.KNOWLEDGE_PDF_MAX_BYTES;
    if (raw != null && String(raw).trim() !== '') {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    return 30 * 1024 * 1024;
}
function getKnowledgePdfUploadDir() {
    const d = process.env.KNOWLEDGE_PDF_UPLOAD_DIR?.trim();
    return d && d.length > 0 ? d : 'uploads/knowledge-documents';
}
//# sourceMappingURL=pdf-ingestion.config.js.map