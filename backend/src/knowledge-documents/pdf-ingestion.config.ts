/** 1 Ingestion & validation — env-driven limits and storage path (see PDF_KNOWLEDGE_ARCHITECTURE.md). */

import { mkdirSync } from 'fs';
import { join } from 'path';

export function getKnowledgePdfMaxBytes(): number {
  const raw = process.env.KNOWLEDGE_PDF_MAX_BYTES;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 30 * 1024 * 1024;
}

/** Directory for uploaded PDFs (relative to process.cwd()). */
export function getKnowledgePdfUploadDir(): string {
  const d = process.env.KNOWLEDGE_PDF_UPLOAD_DIR?.trim();
  return d && d.length > 0 ? d : 'uploads/knowledge-documents';
}

/** Directory for admin replacement page images (relative to process.cwd()). */
export function getPageFixImageUploadDir(): string {
  const d = process.env.KNOWLEDGE_PAGE_FIX_IMAGE_UPLOAD_DIR?.trim();
  if (d && d.length > 0) return d.replace(/\\/g, '/');
  return `${getKnowledgePdfUploadDir().replace(/\\/g, '/')}/page-fix-images`;
}

export function getPageFixImageMaxBytes(): number {
  const raw = process.env.KNOWLEDGE_PAGE_FIX_IMAGE_MAX_BYTES;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 8 * 1024 * 1024;
}

export function ensurePageFixImageUploadDir(): string {
  const dir = join(process.cwd(), getPageFixImageUploadDir());
  mkdirSync(dir, { recursive: true });
  return dir;
}
