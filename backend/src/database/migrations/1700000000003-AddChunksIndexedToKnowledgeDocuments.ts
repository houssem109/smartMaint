import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChunksIndexedToKnowledgeDocuments1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "chunksIndexed" int NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "chunksIndexed"`);
  }
}

