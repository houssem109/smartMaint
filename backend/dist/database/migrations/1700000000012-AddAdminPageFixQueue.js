"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAdminPageFixQueue1700000000012 = void 0;
class AddAdminPageFixQueue1700000000012 {
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_page_fix_queue"`);
    }
}
exports.AddAdminPageFixQueue1700000000012 = AddAdminPageFixQueue1700000000012;
//# sourceMappingURL=1700000000012-AddAdminPageFixQueue.js.map