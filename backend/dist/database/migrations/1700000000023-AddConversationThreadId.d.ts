import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddConversationThreadId1700000000023 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
