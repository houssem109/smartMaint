import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeDocsAndCandidates1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Knowledge documents (PDF library)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_documents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "fileName" varchar NOT NULL,
        "originalName" varchar NOT NULL,
        "mimeType" varchar NOT NULL,
        "fileSize" bigint NOT NULL DEFAULT 0,
        "filePath" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'uploaded',
        "error" text,
        "uploadedById" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_knowledge_documents_uploadedById" ON "knowledge_documents"("uploadedById")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_knowledge_documents_status" ON "knowledge_documents"("status")`,
    );

    // Extraction candidates (Problem → Solution items from PDFs)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_extraction_candidates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "title" varchar NOT NULL,
        "problemDescription" text NOT NULL,
        "solution" text NOT NULL,
        "tags" text,
        "status" varchar NOT NULL DEFAULT 'candidate',
        "createdById" uuid NOT NULL,
        "reviewedById" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
        FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE,
        FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_knowledge_extraction_candidates_documentId" ON "knowledge_extraction_candidates"("documentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_knowledge_extraction_candidates_status" ON "knowledge_extraction_candidates"("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_extraction_candidates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_documents"`);
  }
}

