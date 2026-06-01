"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPhotoVisionDescription1700000000022 = void 0;
class AddPhotoVisionDescription1700000000022 {
    constructor() {
        this.name = 'AddPhotoVisionDescription1700000000022';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "photoVisionDescription" text`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "photoVisionDescription"`);
    }
}
exports.AddPhotoVisionDescription1700000000022 = AddPhotoVisionDescription1700000000022;
//# sourceMappingURL=1700000000022-AddPhotoVisionDescription.js.map