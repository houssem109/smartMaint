"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddKnowledgeEntryKnowledgeDocumentId1700000000020 = void 0;
class AddKnowledgeEntryKnowledgeDocumentId1700000000020 {
    constructor() {
        this.name = 'AddKnowledgeEntryKnowledgeDocumentId1700000000020';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "knowledgeDocumentId" uuid NULL
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "knowledge_entries"
        ADD CONSTRAINT "FK_knowledge_entries_knowledge_document"
        FOREIGN KEY ("knowledgeDocumentId") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_knowledge_document_id"
      ON "knowledge_entries"("knowledgeDocumentId")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_entries_knowledge_document_id"`);
        await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP CONSTRAINT IF EXISTS "FK_knowledge_entries_knowledge_document"`);
        await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "knowledgeDocumentId"`);
    }
}
exports.AddKnowledgeEntryKnowledgeDocumentId1700000000020 = AddKnowledgeEntryKnowledgeDocumentId1700000000020;
//# sourceMappingURL=1700000000020-AddKnowledgeEntryKnowledgeDocumentId.js.map