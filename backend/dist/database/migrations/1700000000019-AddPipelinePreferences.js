"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPipelinePreferences1700000000019 = void 0;
class AddPipelinePreferences1700000000019 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pipeline_preferences" (
        "id" uuid NOT NULL,
        "pdfVisionEnabled" boolean NOT NULL DEFAULT true,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedById" uuid NULL,
        CONSTRAINT "PK_pipeline_preferences" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      INSERT INTO "pipeline_preferences" ("id", "pdfVisionEnabled")
      VALUES ('00000000-0000-0000-0000-000000000001', true)
      ON CONFLICT ("id") DO NOTHING
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "pipeline_preferences"`);
    }
}
exports.AddPipelinePreferences1700000000019 = AddPipelinePreferences1700000000019;
//# sourceMappingURL=1700000000019-AddPipelinePreferences.js.map