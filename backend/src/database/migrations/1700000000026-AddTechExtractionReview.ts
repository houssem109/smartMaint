import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTechExtractionReview1700000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "techReviewStatus" varchar(32) NULL,
      ADD COLUMN IF NOT EXISTS "techReviewedById" uuid NULL,
      ADD COLUMN IF NOT EXISTS "techReviewedAt" TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS "techEditedTitle" text NULL,
      ADD COLUMN IF NOT EXISTS "techEditedProblemDescription" text NULL,
      ADD COLUMN IF NOT EXISTS "techEditedSolution" text NULL,
      ADD COLUMN IF NOT EXISTS "techRejectReason" text NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_extraction_candidate_tech_reviewed_by'
        ) THEN
          ALTER TABLE "knowledge_extraction_candidates"
          ADD CONSTRAINT "FK_extraction_candidate_tech_reviewed_by"
          FOREIGN KEY ("techReviewedById") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_extraction_candidate_tech_review"
      ON "knowledge_extraction_candidates" ("documentId", "techReviewStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_extraction_candidate_tech_review"`);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      DROP CONSTRAINT IF EXISTS "FK_extraction_candidate_tech_reviewed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      DROP COLUMN IF EXISTS "techRejectReason",
      DROP COLUMN IF EXISTS "techEditedSolution",
      DROP COLUMN IF EXISTS "techEditedProblemDescription",
      DROP COLUMN IF EXISTS "techEditedTitle",
      DROP COLUMN IF EXISTS "techReviewedAt",
      DROP COLUMN IF EXISTS "techReviewedById",
      DROP COLUMN IF EXISTS "techReviewStatus"
    `);
  }
}
