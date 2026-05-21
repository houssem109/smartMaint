"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExperiencePhotoPath1700000000014 = void 0;
class AddExperiencePhotoPath1700000000014 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "photoPath" varchar(1024) NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "photoPath"`);
    }
}
exports.AddExperiencePhotoPath1700000000014 = AddExperiencePhotoPath1700000000014;
//# sourceMappingURL=1700000000014-AddExperiencePhotoPath.js.map