import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPipelinePreferences1700000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pipeline_preferences"`);
  }
}
