"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPdfGateAndDocType1700000000005 = void 0;
class AddPdfGateAndDocType1700000000005 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "docType" varchar(64) NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "isWorkRelated" boolean NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "gateConfidence" double precision NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "deepMode" boolean NOT NULL DEFAULT true
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "needsReview" boolean NOT NULL DEFAULT false
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "needsReview"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "deepMode"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "gateConfidence"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "isWorkRelated"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "docType"`);
    }
}
exports.AddPdfGateAndDocType1700000000005 = AddPdfGateAndDocType1700000000005;
//# sourceMappingURL=1700000000005-AddPdfGateAndDocType.js.map