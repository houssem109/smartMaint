"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddChunksIndexedToKnowledgeDocuments1700000000003 = void 0;
class AddChunksIndexedToKnowledgeDocuments1700000000003 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "chunksIndexed" int NOT NULL DEFAULT 0
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "chunksIndexed"`);
    }
}
exports.AddChunksIndexedToKnowledgeDocuments1700000000003 = AddChunksIndexedToKnowledgeDocuments1700000000003;
//# sourceMappingURL=1700000000003-AddChunksIndexedToKnowledgeDocuments.js.map