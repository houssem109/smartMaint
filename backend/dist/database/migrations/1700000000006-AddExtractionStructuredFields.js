"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExtractionStructuredFields1700000000006 = void 0;
class AddExtractionStructuredFields1700000000006 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "entryType" varchar(64) NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "symptom" text NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "rootCause" text NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "sourcePages" text NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "confidence" double precision NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_extraction_candidates"
      ADD COLUMN IF NOT EXISTS "sectionType" varchar(64) NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "sectionType"`);
        await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "confidence"`);
        await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "sourcePages"`);
        await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "rootCause"`);
        await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "symptom"`);
        await queryRunner.query(`ALTER TABLE "knowledge_extraction_candidates" DROP COLUMN IF EXISTS "entryType"`);
    }
}
exports.AddExtractionStructuredFields1700000000006 = AddExtractionStructuredFields1700000000006;
//# sourceMappingURL=1700000000006-AddExtractionStructuredFields.js.map