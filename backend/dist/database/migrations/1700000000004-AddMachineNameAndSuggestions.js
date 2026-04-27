"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMachineNameAndSuggestions1700000000004 = void 0;
class AddMachineNameAndSuggestions1700000000004 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "machineName" varchar(500) NULL
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "machine_name_suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "suggestedById" uuid NOT NULL,
        "proposedName" varchar(500) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "rejectReason" text NULL,
        "reviewedById" uuid NULL,
        "reviewedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_machine_name_suggestions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_machine_name_suggestions_document" FOREIGN KEY ("documentId")
          REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_machine_name_suggestions_suggestedBy" FOREIGN KEY ("suggestedById")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_machine_name_suggestions_reviewedBy" FOREIGN KEY ("reviewedById")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machine_name_suggestions_documentId"
      ON "machine_name_suggestions" ("documentId")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machine_name_suggestions_status"
      ON "machine_name_suggestions" ("status")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "machine_name_suggestions"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "machineName"`);
    }
}
exports.AddMachineNameAndSuggestions1700000000004 = AddMachineNameAndSuggestions1700000000004;
//# sourceMappingURL=1700000000004-AddMachineNameAndSuggestions.js.map