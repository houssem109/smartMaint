"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidPdfForIngestion = assertValidPdfForIngestion;
const common_1 = require("@nestjs/common");
function assertValidPdfForIngestion(buffer, maxBytes) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new common_1.BadRequestException('Invalid PDF: empty file');
    }
    if (buffer.length > maxBytes) {
        throw new common_1.BadRequestException(`File exceeds maximum allowed size (${maxBytes} bytes). Configure KNOWLEDGE_PDF_MAX_BYTES if needed.`);
    }
    const sig = buffer.subarray(0, Math.min(8, buffer.length)).toString('latin1');
    if (!sig.startsWith('%PDF-')) {
        throw new common_1.BadRequestException('Invalid PDF: file does not start with %PDF- signature');
    }
}
//# sourceMappingURL=pdf-ingestion.util.js.map