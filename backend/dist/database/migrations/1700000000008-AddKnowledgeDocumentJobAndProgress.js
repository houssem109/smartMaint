"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddKnowledgeDocumentJobAndProgress1700000000008 = void 0;
class AddKnowledgeDocumentJobAndProgress1700000000008 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "totalPages" int NOT NULL DEFAULT 0
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "pagesProcessed" int NOT NULL DEFAULT 0
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "lastProcessedPage" int NOT NULL DEFAULT 0
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "progressPercent" int NOT NULL DEFAULT 0
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "currentStage" varchar(64) NULL
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_document_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "queueName" varchar(64) NOT NULL,
        "jobType" varchar(64) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'queued',
        "progressPercent" int NOT NULL DEFAULT 0,
        "error" text NULL,
        "bullJobId" varchar(128) NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_document_jobs" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_document_jobs_documentId"
      ON "knowledge_document_jobs" ("documentId")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_document_jobs"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "currentStage"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "progressPercent"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "lastProcessedPage"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "pagesProcessed"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "totalPages"`);
    }
}
exports.AddKnowledgeDocumentJobAndProgress1700000000008 = AddKnowledgeDocumentJobAndProgress1700000000008;
//# sourceMappingURL=1700000000008-AddKnowledgeDocumentJobAndProgress.js.map