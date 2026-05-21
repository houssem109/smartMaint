import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTechnicianExperienceFields1700000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "entryType" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "reviewStatus" varchar(32) NOT NULL DEFAULT 'approved'
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "machineName" varchar(255) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "symptom" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "rootCause" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "severity" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "source" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "reviewedById" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "rejectReason" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "rejectReason"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "reviewedAt"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "reviewedById"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "source"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "severity"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "rootCause"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "symptom"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "machineName"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "reviewStatus"`);
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "entryType"`);
  }
}
