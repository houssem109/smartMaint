"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMachineProfiles1700000000010 = void 0;
class AddMachineProfiles1700000000010 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "machine_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "machineName" varchar(200) NOT NULL,
        "manufacturer" varchar(200) NULL,
        "family" varchar(200) NULL,
        "modelNumber" varchar(200) NULL,
        "components" text NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_machine_profiles" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "machineProfileId" uuid NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "machineUnknown" boolean NOT NULL DEFAULT false
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machine_profiles_name_manufacturer"
      ON "machine_profiles" ("machineName", "manufacturer")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_documents_machineProfileId"
      ON "knowledge_documents" ("machineProfileId")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_documents_machineProfileId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_machine_profiles_name_manufacturer"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "machineUnknown"`);
        await queryRunner.query(`ALTER TABLE "knowledge_documents" DROP COLUMN IF EXISTS "machineProfileId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "machine_profiles"`);
    }
}
exports.AddMachineProfiles1700000000010 = AddMachineProfiles1700000000010;
//# sourceMappingURL=1700000000010-AddMachineProfiles.js.map