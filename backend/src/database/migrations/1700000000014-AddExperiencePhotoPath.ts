import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperiencePhotoPath1700000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "photoPath" varchar(1024) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "photoPath"`);
  }
}
