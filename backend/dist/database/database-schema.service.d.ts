import { DataSource } from 'typeorm';
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
    references: SchemaRelation[];
    referencedBy: SchemaRelation[];
};
export type DatabaseSchemaSnapshot = {
    checkedAt: string;
    database: string;
    schema: string;
    tableCount: number;
    tables: SchemaTable[];
};
declare const GROUP_LABELS: Record<SchemaTable['group'], string>;
export declare class DatabaseSchemaService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    getPublicSchema(): Promise<DatabaseSchemaSnapshot>;
}
export { GROUP_LABELS };
