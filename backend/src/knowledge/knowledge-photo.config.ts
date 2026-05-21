import { mkdirSync } from 'fs';
import { join } from 'path';

export function getKnowledgePhotoUploadDir(): string {
  const d = process.env.KNOWLEDGE_PHOTO_UPLOAD_DIR?.trim();
  return d && d.length > 0 ? d : 'uploads/knowledge-photos';
}

export function ensureKnowledgePhotoUploadDir(): string {
  const dir = join(process.cwd(), getKnowledgePhotoUploadDir());
  mkdirSync(dir, { recursive: true });
  return dir;
}
