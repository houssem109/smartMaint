"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPageFixQueueReplacementImage1700000000017 = void 0;
class AddPageFixQueueReplacementImage1700000000017 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "admin_page_fix_queue"
      ADD COLUMN IF NOT EXISTS "replacementImagePath" varchar(1024) NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "admin_page_fix_queue" DROP COLUMN IF EXISTS "replacementImagePath"
    `);
    }
}
exports.AddPageFixQueueReplacementImage1700000000017 = AddPageFixQueueReplacementImage1700000000017;
//# sourceMappingURL=1700000000017-AddPageFixQueueReplacementImage.js.map