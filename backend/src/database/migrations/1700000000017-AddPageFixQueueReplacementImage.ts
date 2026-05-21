import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageFixQueueReplacementImage1700000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_page_fix_queue"
      ADD COLUMN IF NOT EXISTS "replacementImagePath" varchar(1024) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_page_fix_queue" DROP COLUMN IF EXISTS "replacementImagePath"
    `);
  }
}
