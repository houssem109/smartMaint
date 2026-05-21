"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKnowledgePhotoUploadDir = getKnowledgePhotoUploadDir;
exports.ensureKnowledgePhotoUploadDir = ensureKnowledgePhotoUploadDir;
const fs_1 = require("fs");
const path_1 = require("path");
function getKnowledgePhotoUploadDir() {
    const d = process.env.KNOWLEDGE_PHOTO_UPLOAD_DIR?.trim();
    return d && d.length > 0 ? d : 'uploads/knowledge-photos';
}
function ensureKnowledgePhotoUploadDir() {
    const dir = (0, path_1.join)(process.cwd(), getKnowledgePhotoUploadDir());
    (0, fs_1.mkdirSync)(dir, { recursive: true });
    return dir;
}
//# sourceMappingURL=knowledge-photo.config.js.map