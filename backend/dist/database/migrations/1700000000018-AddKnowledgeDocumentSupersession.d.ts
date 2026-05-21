import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddKnowledgeDocumentSupersession1700000000018 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
