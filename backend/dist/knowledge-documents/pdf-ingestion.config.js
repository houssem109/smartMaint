"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKnowledgePdfMaxBytes = getKnowledgePdfMaxBytes;
exports.getKnowledgePdfUploadDir = getKnowledgePdfUploadDir;
exports.getPageFixImageUploadDir = getPageFixImageUploadDir;
exports.getPageFixImageMaxBytes = getPageFixImageMaxBytes;
exports.ensurePageFixImageUploadDir = ensurePageFixImageUploadDir;
const fs_1 = require("fs");
const path_1 = require("path");
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
function getPageFixImageUploadDir() {
    const d = process.env.KNOWLEDGE_PAGE_FIX_IMAGE_UPLOAD_DIR?.trim();
    if (d && d.length > 0)
        return d.replace(/\\/g, '/');
    return `${getKnowledgePdfUploadDir().replace(/\\/g, '/')}/page-fix-images`;
}
function getPageFixImageMaxBytes() {
    const raw = process.env.KNOWLEDGE_PAGE_FIX_IMAGE_MAX_BYTES;
    if (raw != null && String(raw).trim() !== '') {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    return 8 * 1024 * 1024;
}
function ensurePageFixImageUploadDir() {
    const dir = (0, path_1.join)(process.cwd(), getPageFixImageUploadDir());
    (0, fs_1.mkdirSync)(dir, { recursive: true });
    return dir;
}
//# sourceMappingURL=pdf-ingestion.config.js.map