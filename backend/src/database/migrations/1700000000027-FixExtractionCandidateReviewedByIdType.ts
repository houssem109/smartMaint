import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixExtractionCandidateReviewedByIdType1700000000027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ALTER COLUMN "reviewedById" TYPE uuid
      USING (
        CASE
          WHEN "reviewedById" IS NULL OR TRIM("reviewedById"::text) = '' THEN NULL
          ELSE "reviewedById"::uuid
        END
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_extraction_candidate_reviewed_by'
        ) THEN
          ALTER TABLE "knowledge_extraction_candidates"
          ADD CONSTRAINT "FK_extraction_candidate_reviewed_by"
          FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      DROP CONSTRAINT IF EXISTS "FK_extraction_candidate_reviewed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ALTER COLUMN "reviewedById" TYPE varchar
      USING "reviewedById"::text
    `);
  }
}
