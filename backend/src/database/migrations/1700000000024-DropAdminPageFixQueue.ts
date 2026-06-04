import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAdminPageFixQueue1700000000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_page_fix_queue"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_page_fix_queue" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "pageNumber" integer NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'open',
        "reason" text,
        "adminFixedText" text,
        "replacementImagePath" varchar(1024),
        "fixedByAdminId" uuid,
        "fixedAt" TIMESTAMPTZ,
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
}
