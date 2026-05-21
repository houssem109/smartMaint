"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPageSectionRouting1700000000011 = void 0;
class AddPageSectionRouting1700000000011 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_document_page_analysis"
      ADD COLUMN IF NOT EXISTS "sectionType" varchar(64) NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_document_page_analysis"
      ADD COLUMN IF NOT EXISTS "extractionMode" varchar(24) NOT NULL DEFAULT 'text'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_document_page_analysis" DROP COLUMN IF EXISTS "extractionMode"`);
        await queryRunner.query(`ALTER TABLE "knowledge_document_page_analysis" DROP COLUMN IF EXISTS "sectionType"`);
    }
}
exports.AddPageSectionRouting1700000000011 = AddPageSectionRouting1700000000011;
//# sourceMappingURL=1700000000011-AddPageSectionRouting.js.map