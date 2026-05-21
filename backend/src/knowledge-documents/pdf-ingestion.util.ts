import { BadRequestException } from '@nestjs/common';

/** Validates buffer size and PDF magic header (%PDF-) before parsing. */
export function assertValidPdfForIngestion(buffer: Buffer, maxBytes: number): void {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BadRequestException('Invalid PDF: empty file');
  }
  if (buffer.length > maxBytes) {
    throw new BadRequestException(
      `File exceeds maximum allowed size (${maxBytes} bytes). Configure KNOWLEDGE_PDF_MAX_BYTES if needed.`,
    );
  }
  const sig = buffer.subarray(0, Math.min(8, buffer.length)).toString('latin1');
  if (!sig.startsWith('%PDF-')) {
    throw new BadRequestException('Invalid PDF: file does not start with %PDF- signature');
  }
}
