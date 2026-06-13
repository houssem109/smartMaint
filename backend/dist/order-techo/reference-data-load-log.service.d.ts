import { Repository } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
export type ReferenceDataLoadSource = 'startup' | 'file_change' | 'manual_reload';
export interface ReferenceDataLoadCounts {
    dataPlus: number;
    orderLines: number;
    articles: number;
    magasins: number;
}
export declare const REFERENCE_DATA_ENTITY_ID = "order-reference-data";
export declare class ReferenceDataLoadLogService {
    private readonly auditLogRepository;
    constructor(auditLogRepository: Repository<AuditLog>);
    logSuccess(source: ReferenceDataLoadSource, dataDir: string, counts: ReferenceDataLoadCounts, changedFiles?: string[]): Promise<void>;
    logFailure(source: ReferenceDataLoadSource, dataDir: string, error: string): Promise<void>;
}
