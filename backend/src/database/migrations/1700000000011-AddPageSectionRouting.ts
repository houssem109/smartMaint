import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageSectionRouting1700000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_document_page_analysis"
      ADD COLUMN IF NOT EXISTS "sectionType" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_document_page_analysis"
      ADD COLUMN IF NOT EXISTS "extractionMode" varchar(24) NOT NULL DEFAULT 'text'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_document_page_analysis" DROP COLUMN IF EXISTS "extractionMode"`);
    await queryRunner.query(`ALTER TABLE "knowledge_document_page_analysis" DROP COLUMN IF EXISTS "sectionType"`);
  }
}
