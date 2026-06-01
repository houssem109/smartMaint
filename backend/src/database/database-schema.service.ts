import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resolveColumnDescription } from './column-descriptions';

export type SchemaColumn = {
  name: string;
  description: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable: string | null;
  referencesColumn: string | null;
};

export type SchemaRelation = {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  enforced: boolean;
};

export type SchemaTable = {
  name: string;
  group: 'core' | 'knowledge' | 'pdf' | 'system';
  purpose: string;
  entity: string | null;
  columns: SchemaColumn[];
  /** This table points to others (outgoing). */
  references: SchemaRelation[];
  /** Other tables point here (incoming). */
  referencedBy: SchemaRelation[];
};

export type DatabaseSchemaSnapshot = {
  checkedAt: string;
  database: string;
  schema: string;
  tableCount: number;
  tables: SchemaTable[];
};

/** Curated metadata for every app table (purpose + logical links not enforced as DB FK). */
const TABLE_CATALOG: Record<
  string,
  {
    group: SchemaTable['group'];
    purpose: string;
    entity?: string;
    logicalReferences?: Omit<SchemaRelation, 'enforced'>[];
    logicalReferencedBy?: Omit<SchemaRelation, 'enforced'>[];
  }
> = {
  users: {
    group: 'core',
    entity: 'User',
    purpose: 'Accounts — workers, technicians, admins. Central hub for who creates and owns data.',
    logicalReferencedBy: [
      { column: 'createdById', referencesTable: 'tickets', referencesColumn: 'id' },
      { column: 'assignedToId', referencesTable: 'tickets', referencesColumn: 'id' },
      { column: 'uploadedById', referencesTable: 'attachments', referencesColumn: 'id' },
      { column: 'createdById', referencesTable: 'knowledge_entries', referencesColumn: 'id' },
      { column: 'uploadedById', referencesTable: 'knowledge_documents', referencesColumn: 'id' },
      { column: 'suggestedById', referencesTable: 'machine_name_suggestions', referencesColumn: 'id' },
      { column: 'reviewedById', referencesTable: 'machine_name_suggestions', referencesColumn: 'id' },
    ],
  },
  tickets: {
    group: 'core',
    entity: 'Ticket',
    purpose: 'Maintenance work orders — status, priority, machine, area, assignment.',
    logicalReferences: [
      { column: 'assignmentRequestedById', referencesTable: 'users', referencesColumn: 'id' },
      { column: 'assignmentReviewedById', referencesTable: 'users', referencesColumn: 'id' },
    ],
    logicalReferencedBy: [
      { column: 'ticketId', referencesTable: 'conversations', referencesColumn: 'id' },
      { column: 'ticketId', referencesTable: 'attachments', referencesColumn: 'id' },
    ],
  },
  conversations: {
    group: 'core',
    entity: 'Conversation',
    purpose: 'Chat messages on a ticket — user, AI, or system.',
  },
  attachments: {
    group: 'core',
    entity: 'Attachment',
    purpose: 'Files uploaded on a ticket (photos, documents).',
  },
  audit_logs: {
    group: 'core',
    entity: 'AuditLog',
    purpose: 'Change history — who did what (create/update/approve) on tickets, users, knowledge, PDFs.',
    logicalReferences: [
      { column: 'userId', referencesTable: 'users', referencesColumn: 'id' },
    ],
  },
  knowledge_entries: {
    group: 'knowledge',
    entity: 'KnowledgeEntry',
    purpose: 'Approved problem & solution library — technician experience + admin-approved PDF extractions.',
  },
  knowledge_documents: {
    group: 'pdf',
    entity: 'KnowledgeDocument',
    purpose: 'Uploaded PDF manuals — processing status, machine link, version supersession.',
    logicalReferences: [
      { column: 'machineProfileId', referencesTable: 'machine_profiles', referencesColumn: 'id' },
    ],
    logicalReferencedBy: [
      { column: 'documentId', referencesTable: 'knowledge_document_page_analysis', referencesColumn: 'id' },
      { column: 'documentId', referencesTable: 'knowledge_extraction_candidates', referencesColumn: 'id' },
      { column: 'documentId', referencesTable: 'knowledge_document_jobs', referencesColumn: 'id' },
      { column: 'documentId', referencesTable: 'admin_page_fix_queue', referencesColumn: 'id' },
      { column: 'documentId', referencesTable: 'machine_name_suggestions', referencesColumn: 'id' },
      { column: 'documentId', referencesTable: 'extraction_feedback_events', referencesColumn: 'id' },
      { column: 'knowledgeDocumentId', referencesTable: 'knowledge_entries', referencesColumn: 'id' },
      { column: 'documentId', referencesTable: 'vector_chunk_hashes', referencesColumn: 'id' },
    ],
  },
  knowledge_document_page_analysis: {
    group: 'pdf',
    entity: 'KnowledgeDocumentPageAnalysis',
    purpose: 'Per-page OCR/vision results — text, quality, extraction mode.',
  },
  knowledge_extraction_candidates: {
    group: 'pdf',
    entity: 'KnowledgeExtractionCandidate',
    purpose: 'AI-extracted problem/solution drafts awaiting admin approve or reject.',
    logicalReferences: [
      { column: 'createdById', referencesTable: 'users', referencesColumn: 'id' },
      { column: 'reviewedById', referencesTable: 'users', referencesColumn: 'id' },
    ],
    logicalReferencedBy: [
      { column: 'candidateId', referencesTable: 'extraction_feedback_events', referencesColumn: 'id' },
    ],
  },
  knowledge_document_jobs: {
    group: 'pdf',
    entity: 'KnowledgeDocumentJob',
    purpose: 'Background job rows (gate, OCR, vision, extract, index) and progress.',
    logicalReferences: [
      { column: 'documentId', referencesTable: 'knowledge_documents', referencesColumn: 'id' },
    ],
  },
  admin_page_fix_queue: {
    group: 'pdf',
    entity: 'AdminPageFixQueueItem',
    purpose: 'Unreadable PDF pages — admin can type text or upload a replacement image.',
    logicalReferences: [
      { column: 'documentId', referencesTable: 'knowledge_documents', referencesColumn: 'id' },
      { column: 'fixedByAdminId', referencesTable: 'users', referencesColumn: 'id' },
    ],
  },
  machine_profiles: {
    group: 'pdf',
    entity: 'MachineProfile',
    purpose: 'Machine catalog — manufacturer, model; PDFs link via machineProfileId.',
    logicalReferencedBy: [
      { column: 'machineProfileId', referencesTable: 'knowledge_documents', referencesColumn: 'id' },
    ],
  },
  machine_name_suggestions: {
    group: 'pdf',
    entity: 'MachineNameSuggestion',
    purpose: 'Proposed machine names for a PDF until admin approves one.',
  },
  vector_chunk_hashes: {
    group: 'pdf',
    entity: 'VectorChunkHash',
    purpose: 'Hash of embedded text chunks — dedup before storing vectors in Qdrant.',
    logicalReferences: [
      { column: 'documentId', referencesTable: 'knowledge_documents', referencesColumn: 'id' },
    ],
  },
  extraction_feedback_events: {
    group: 'pdf',
    entity: 'ExtractionFeedbackEvent',
    purpose: 'Analytics when admin approves, edits, or rejects an extraction candidate.',
    logicalReferences: [
      { column: 'candidateId', referencesTable: 'knowledge_extraction_candidates', referencesColumn: 'id' },
      { column: 'adminId', referencesTable: 'users', referencesColumn: 'id' },
    ],
  },
  pipeline_preferences: {
    group: 'pdf',
    entity: 'PipelinePreferences',
    purpose: 'Single-row admin settings (e.g. PDF vision on/off in UI).',
    logicalReferences: [
      { column: 'updatedById', referencesTable: 'users', referencesColumn: 'id' },
    ],
  },
  migrations: {
    group: 'system',
    purpose: 'TypeORM migration history — internal, not business data.',
  },
};

const GROUP_LABELS: Record<SchemaTable['group'], string> = {
  core: 'Core — users & tickets',
  knowledge: 'Knowledge base',
  pdf: 'PDF pipeline',
  system: 'System',
};

@Injectable()
export class DatabaseSchemaService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getPublicSchema(): Promise<DatabaseSchemaSnapshot> {
    const dbName =
      (this.dataSource.options as { database?: string }).database ?? 'unknown';

    const columnRows: {
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      ordinal_position: number;
    }[] = await this.dataSource.query(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
              character_maximum_length, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    );

    const pkRows: { table_name: string; column_name: string }[] = await this.dataSource.query(
      `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.ordinal_position`,
    );

    const fkRows: {
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }[] = await this.dataSource.query(
      `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name`,
    );

    const pkSet = new Set(pkRows.map((r) => `${r.table_name}.${r.column_name}`));
    const fkMap = new Map<string, { table: string; column: string }>();
    for (const row of fkRows) {
      fkMap.set(`${row.table_name}.${row.column_name}`, {
        table: row.foreign_table_name,
        column: row.foreign_column_name,
      });
    }

    const enforcedRefsByTable = new Map<string, SchemaRelation[]>();
    for (const row of fkRows) {
      const list = enforcedRefsByTable.get(row.table_name) ?? [];
      list.push({
        column: row.column_name,
        referencesTable: row.foreign_table_name,
        referencesColumn: row.foreign_column_name,
        enforced: true,
      });
      enforcedRefsByTable.set(row.table_name, list);
    }

    const tablesMap = new Map<string, Omit<SchemaTable, 'references' | 'referencedBy'>>();

    for (const row of columnRows) {
      let table = tablesMap.get(row.table_name);
      if (!table) {
        const meta = TABLE_CATALOG[row.table_name];
        table = {
          name: row.table_name,
          group: meta?.group ?? 'system',
          purpose: meta?.purpose ?? 'Application table.',
          entity: meta?.entity ?? null,
          columns: [],
        };
        tablesMap.set(row.table_name, table);
      }

      const fk = fkMap.get(`${row.table_name}.${row.column_name}`);
      table.columns.push({
        name: row.column_name,
        description: resolveColumnDescription(row.table_name, row.column_name),
        dataType: row.data_type,
        udtName: row.udt_name,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        maxLength: row.character_maximum_length,
        isPrimaryKey: pkSet.has(`${row.table_name}.${row.column_name}`),
        isForeignKey: !!fk,
        referencesTable: fk?.table ?? null,
        referencesColumn: fk?.column ?? null,
      });
    }

    const tables: SchemaTable[] = [...tablesMap.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((table) => {
        const meta = TABLE_CATALOG[table.name];
        const enforced = enforcedRefsByTable.get(table.name) ?? [];
        const logicalOut = (meta?.logicalReferences ?? []).map((r) => ({ ...r, enforced: false }));
        const references = mergeRelations([...enforced, ...logicalOut]);

        const enforcedIn: SchemaRelation[] = [];
        for (const [srcTable, refs] of enforcedRefsByTable) {
          for (const ref of refs) {
            if (ref.referencesTable === table.name) {
              enforcedIn.push({
                column: ref.referencesColumn,
                referencesTable: srcTable,
                referencesColumn: ref.column,
                enforced: true,
              });
            }
          }
        }
        const logicalIn = (meta?.logicalReferencedBy ?? []).map((r) => ({
          column: r.referencesColumn,
          referencesTable: r.referencesTable,
          referencesColumn: r.column,
          enforced: false,
        }));
        const referencedBy = mergeRelations([...enforcedIn, ...logicalIn]);

        return { ...table, references, referencedBy };
      });

    return {
      checkedAt: new Date().toISOString(),
      database: dbName,
      schema: 'public',
      tableCount: tables.length,
      tables,
    };
  }
}

function mergeRelations(rows: SchemaRelation[]): SchemaRelation[] {
  const seen = new Set<string>();
  const out: SchemaRelation[] = [];
  for (const r of rows) {
    const key = `${r.column}|${r.referencesTable}|${r.referencesColumn}|${r.enforced}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.sort((a, b) =>
    a.referencesTable === b.referencesTable
      ? a.column.localeCompare(b.column)
      : a.referencesTable.localeCompare(b.referencesTable),
  );
}

export { GROUP_LABELS };
