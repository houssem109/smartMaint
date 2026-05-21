"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddKnowledgeDocumentFingerprint1700000000009 = void 0;
class AddKnowledgeDocumentFingerprint1700000000009 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "fingerprint" varchar(128) NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_documents_fingerprint"
      ON "knowledge_documents" ("fingerprint")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_documents_fingerprint"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "fingerprint"`);
    }
}
exports.AddKnowledgeDocumentFingerprint1700000000009 = AddKnowledgeDocumentFingerprint1700000000009;
//# sourceMappingURL=1700000000009-AddKnowledgeDocumentFingerprint.js.map