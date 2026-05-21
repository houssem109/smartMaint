import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtractionStructuredFields1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "entryType" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "symptom" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "rootCause" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "sourcePages" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "confidence" double precision NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "sectionType" varchar(64) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "sectionType"`);
    await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "confidence"`);
    await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "sourcePages"`);
    await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "rootCause"`);
    await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "symptom"`);
    await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "entryType"`);
  }
}

