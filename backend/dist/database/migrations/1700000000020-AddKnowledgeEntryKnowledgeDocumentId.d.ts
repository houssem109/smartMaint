import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddKnowledgeEntryKnowledgeDocumentId1700000000020 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
