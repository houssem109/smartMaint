import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class FixUserForeignKeyOnDelete1700000000025 implements MigrationInterface {
    name: string;
    private readonly fixes;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
