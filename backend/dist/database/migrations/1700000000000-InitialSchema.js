"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialSchema1700000000000 = void 0;
class InitialSchema1700000000000 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "username" varchar UNIQUE NOT NULL,
        "email" varchar UNIQUE NOT NULL,
        "password" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'worker',
        "factoryId" varchar,
        "fullName" varchar,
        "phoneNumber" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tickets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "category" varchar NOT NULL DEFAULT 'other',
        "priority" varchar NOT NULL DEFAULT 'medium',
        "status" varchar NOT NULL DEFAULT 'open',
        "machine" varchar,
        "area" varchar,
        "source" varchar NOT NULL DEFAULT 'web',
        "createdById" uuid NOT NULL,
        "assignedToId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE,
        FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ticketId" uuid NOT NULL,
        "message" text NOT NULL,
        "senderType" varchar NOT NULL DEFAULT 'user',
        "senderId" uuid,
        "timestamp" timestamp NOT NULL DEFAULT now(),
        FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attachments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ticketId" uuid NOT NULL,
        "fileName" varchar NOT NULL,
        "filePath" varchar NOT NULL,
        "fileSize" integer NOT NULL,
        "mimeType" varchar NOT NULL,
        "uploadedById" uuid NOT NULL,
        "uploadedAt" timestamp NOT NULL DEFAULT now(),
        FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
        FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actionType" varchar NOT NULL,
        "entityId" varchar NOT NULL,
        "entityType" varchar NOT NULL,
        "userId" uuid,
        "changes" jsonb,
        "reason" text,
        "timestamp" timestamp NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_createdById" ON "tickets"("createdById")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_assignedToId" ON "tickets"("assignedToId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_status" ON "tickets"("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_conversations_ticketId" ON "conversations"("ticketId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entityId" ON "audit_logs"("entityId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tickets"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }
}
exports.InitialSchema1700000000000 = InitialSchema1700000000000;
//# sourceMappingURL=1700000000000-InitialSchema.js.map