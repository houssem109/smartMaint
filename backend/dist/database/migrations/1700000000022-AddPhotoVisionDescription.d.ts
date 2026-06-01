import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddPhotoVisionDescription1700000000022 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
