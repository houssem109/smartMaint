import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeDocumentSupersession1700000000018 implements MigrationInterface {
  name = 'AddKnowledgeDocumentSupersession1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "supersedesDocumentId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "supersededByDocumentId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD CONSTRAINT "FK_knowledge_documents_supersedes"
      FOREIGN KEY ("supersedesDocumentId") REFERENCES "knowledge_documents"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD CONSTRAINT "FK_knowledge_documents_superseded_by"
      FOREIGN KEY ("supersededByDocumentId") REFERENCES "knowledge_documents"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_documents_supersedes"
      ON "knowledge_documents" ("supersedesDocumentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_documents_superseded_by"
      ON "knowledge_documents" ("supersededByDocumentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_documents_superseded_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_documents_supersedes"`);
    await queryRunner.query(
      `ALTER TABLE "knowledge_documents" DROP CONSTRAINT IF EXISTS "FK_knowledge_documents_superseded_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_documents" DROP CONSTRAINT IF EXISTS "FK_knowledge_documents_supersedes"`,
    );
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "supersededByDocumentId"`);
    await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "supersedesDocumentId"`);
  }
}
