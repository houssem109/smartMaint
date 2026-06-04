import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TypeORM synchronize created user FKs without ON DELETE rules (defaults to NO ACTION),
 * which blocks user deletion when related rows exist. Align constraints with InitialSchema.
 */
export class FixUserForeignKeyOnDelete1700000000025 implements MigrationInterface {
  name = 'FixUserForeignKeyOnDelete1700000000025';

  private readonly fixes: Array<{
    table: string;
    column: string;
    onDelete: 'CASCADE' | 'SET NULL';
  }> = [
    { table: 'tickets', column: 'createdById', onDelete: 'CASCADE' },
    { table: 'tickets', column: 'assignedToId', onDelete: 'SET NULL' },
    { table: 'attachments', column: 'uploadedById', onDelete: 'CASCADE' },
    { table: 'knowledge_documents', column: 'uploadedById', onDelete: 'CASCADE' },
    { table: 'knowledge_entries', column: 'createdById', onDelete: 'CASCADE' },
    { table: 'machine_name_suggestions', column: 'suggestedById', onDelete: 'CASCADE' },
    { table: 'machine_name_suggestions', column: 'reviewedById', onDelete: 'SET NULL' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column, onDelete } of this.fixes) {
      const newName = `FK_${table}_${column}_users`;
      await queryRunner.query(`
        DO $$
        DECLARE
          con_name text;
        BEGIN
          SELECT tc.constraint_name INTO con_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = '${table}'
            AND kcu.column_name = '${column}'
            AND ccu.table_name = 'users'
          LIMIT 1;

          IF con_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${table}', con_name);
            EXECUTE format(
              'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE ${onDelete}',
              '${table}',
              '${newName}',
              '${column}'
            );
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of this.fixes) {
      const constraintName = `FK_${table}_${column}_users`;
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraintName}";
      `);
    }
  }
}
