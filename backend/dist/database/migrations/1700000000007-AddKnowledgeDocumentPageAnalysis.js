"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddKnowledgeDocumentPageAnalysis1700000000007 = void 0;
class AddKnowledgeDocumentPageAnalysis1700000000007 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_document_page_analysis" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "pageNumber" int NOT NULL,
        "quality" varchar(24) NOT NULL,
        "ocrConfidence" double precision NULL,
        "ocrText" text NULL,
        "visionUsed" boolean NOT NULL DEFAULT false,
        "processingMode" varchar(24) NOT NULL DEFAULT 'raw',
        "qualityWarnings" jsonb NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_document_page_analysis" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_document_page_analysis_document" FOREIGN KEY ("documentId")
          REFERENCES "knowledge_documents"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_document_page_analysis_documentId"
      ON "knowledge_document_page_analysis" ("documentId")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_document_page_analysis_pageNumber"
      ON "knowledge_document_page_analysis" ("pageNumber")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_document_page_analysis"`);
    }
}
exports.AddKnowledgeDocumentPageAnalysis1700000000007 = AddKnowledgeDocumentPageAnalysis1700000000007;
//# sourceMappingURL=1700000000007-AddKnowledgeDocumentPageAnalysis.js.map