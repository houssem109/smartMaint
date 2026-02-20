import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubcategoryToTickets1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "subcategory" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tickets" DROP COLUMN IF EXISTS "subcategory"
    `);
  }
}
