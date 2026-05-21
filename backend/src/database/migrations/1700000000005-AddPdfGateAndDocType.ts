import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPdfGateAndDocType1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "docType" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "isWorkRelated" boolean NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "gateConfidence" double precision NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "deepMode" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "needsReview" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "needsReview"`);
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "deepMode"`);
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "gateConfidence"`);
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "isWorkRelated"`);
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "docType"`);
  }
}

