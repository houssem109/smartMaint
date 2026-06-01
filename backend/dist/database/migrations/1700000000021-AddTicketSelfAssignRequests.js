"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTicketSelfAssignRequests1700000000021 = void 0;
class AddTicketSelfAssignRequests1700000000021 {
    constructor() {
        this.name = 'AddTicketSelfAssignRequests1700000000021';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tickets_assignmentrequeststatus_enum" AS ENUM('none', 'pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
        await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "assignmentRequestedById" uuid NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "assignmentRequestStatus" "public"."tickets_assignmentrequeststatus_enum" NOT NULL DEFAULT 'none'
    `);
        await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "assignmentRequestNote" text NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "assignmentRequestedAt" TIMESTAMP NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "assignmentReviewedById" uuid NULL
    `);
        await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "assignmentReviewedAt" TIMESTAMP NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "assignmentReviewedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "assignmentReviewedById"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "assignmentRequestedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "assignmentRequestNote"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "assignmentRequestStatus"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "assignmentRequestedById"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."tickets_assignmentrequeststatus_enum"`);
    }
}
exports.AddTicketSelfAssignRequests1700000000021 = AddTicketSelfAssignRequests1700000000021;
//# sourceMappingURL=1700000000021-AddTicketSelfAssignRequests.js.map