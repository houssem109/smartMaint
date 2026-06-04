/** 1 Ingestion & validation — env-driven limits and storage path (see PDF_KNOWLEDGE_ARCHITECTURE.md). */

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
