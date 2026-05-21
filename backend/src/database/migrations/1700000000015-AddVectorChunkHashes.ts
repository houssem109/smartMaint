import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVectorChunkHashes1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vector_chunk_hashes" (
        "hash" varchar(64) NOT NULL,
        "documentId" uuid NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vector_chunk_hashes" PRIMARY KEY ("hash")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vector_chunk_hashes_documentId"
      ON "vector_chunk_hashes" ("documentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vector_chunk_hashes"`);
  }
}
