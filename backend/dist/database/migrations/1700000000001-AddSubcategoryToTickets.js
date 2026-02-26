"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSubcategoryToTickets1700000000001 = void 0;
class AddSubcategoryToTickets1700000000001 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "subcategory" varchar
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "tickets" DROP COLUMN IF EXISTS "subcategory"
    `);
    }
}
exports.AddSubcategoryToTickets1700000000001 = AddSubcategoryToTickets1700000000001;
//# sourceMappingURL=1700000000001-AddSubcategoryToTickets.js.map