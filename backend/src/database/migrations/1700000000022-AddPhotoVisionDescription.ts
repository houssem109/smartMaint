import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoVisionDescription1700000000022 implements MigrationInterface {
  name = 'AddPhotoVisionDescription1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "photoVisionDescription" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "photoVisionDescription"`);
  }
}
