import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationThreadId1700000000023 implements MigrationInterface {
  name = 'AddConversationThreadId1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "threadId" varchar(128) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversations_threadId_timestamp"
      ON "conversations" ("threadId", "timestamp")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_conversations_threadId_timestamp"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "threadId"`);
  }
}
