import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtractionFeedbackEvents1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "extraction_feedback_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "candidateId" uuid NOT NULL,
        "signal" varchar(32) NOT NULL,
        "docType" varchar(64) NULL,
        "sectionType" varchar(64) NULL,
        "entryType" varchar(64) NULL,
        "confidence" double precision NULL,
        "adminId" uuid NULL,
        "reason" text NULL,
        "editDelta" jsonb NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_extraction_feedback_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_extraction_feedback_document"
          FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_extraction_feedback_docType_created"
      ON "extraction_feedback_events" ("docType", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_extraction_feedback_signal_created"
      ON "extraction_feedback_events" ("signal", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_extraction_feedback_documentId"
      ON "extraction_feedback_events" ("documentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "extraction_feedback_events"`);
  }
}
