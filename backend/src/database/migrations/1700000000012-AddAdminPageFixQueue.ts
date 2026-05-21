import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminPageFixQueue1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_page_fix_queue" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "pageNumber" int NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'open',
        "reason" text NULL,
        "adminFixedText" text NULL,
        "fixedByAdminId" uuid NULL,
        "fixedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_page_fix_queue" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_page_fix_queue_documentId"
      ON "admin_page_fix_queue" ("documentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_page_fix_queue_status"
      ON "admin_page_fix_queue" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_page_fix_queue"`);
  }
}
