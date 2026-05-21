"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddVectorChunkHashes1700000000015 = void 0;
class AddVectorChunkHashes1700000000015 {
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "vector_chunk_hashes"`);
    }
}
exports.AddVectorChunkHashes1700000000015 = AddVectorChunkHashes1700000000015;
//# sourceMappingURL=1700000000015-AddVectorChunkHashes.js.map