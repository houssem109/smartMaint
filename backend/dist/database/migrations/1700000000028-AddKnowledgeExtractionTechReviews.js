"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddKnowledgeExtractionTechReviews1700000000028 = void 0;
class AddKnowledgeExtractionTechReviews1700000000028 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_extraction_tech_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "candidateId" uuid NOT NULL,
        "technicianId" uuid NOT NULL,
        "action" varchar(32) NOT NULL,
        "editedTitle" text NULL,
        "editedProblemDescription" text NULL,
        "editedSolution" text NULL,
        "rejectReason" text NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_extraction_tech_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_extraction_tech_review_candidate_technician" UNIQUE ("candidateId", "technicianId"),
        CONSTRAINT "FK_extraction_tech_review_candidate"
          FOREIGN KEY ("candidateId") REFERENCES "knowledge_extraction_candidates"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_extraction_tech_review_technician"
          FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_extraction_tech_review_candidate"
      ON "knowledge_extraction_tech_reviews" ("candidateId")
    `);
        await queryRunner.query(`
      INSERT INTO "knowledge_extraction_tech_reviews" (
        "candidateId",
        "technicianId",
        "action",
        "editedTitle",
        "editedProblemDescription",
        "editedSolution",
        "rejectReason",
        "createdAt"
      )
      SELECT
        c."id",
        c."techReviewedById",
        c."techReviewStatus",
        c."techEditedTitle",
        c."techEditedProblemDescription",
        c."techEditedSolution",
        c."techRejectReason",
        COALESCE(c."techReviewedAt", c."updatedAt", now())
      FROM "knowledge_extraction_candidates" c
      WHERE c."techReviewStatus" IS NOT NULL
        AND c."techReviewedById" IS NOT NULL
      ON CONFLICT ("candidateId", "technicianId") DO NOTHING
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_extraction_tech_reviews"`);
    }
}
exports.AddKnowledgeExtractionTechReviews1700000000028 = AddKnowledgeExtractionTechReviews1700000000028;
//# sourceMappingURL=1700000000028-AddKnowledgeExtractionTechReviews.js.map