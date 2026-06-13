import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionType, AuditLog } from '../common/entities/audit-log.entity';

export type ReferenceDataLoadSource = 'startup' | 'file_change' | 'manual_reload';

export interface ReferenceDataLoadCounts {
  dataPlus: number;
  orderLines: number;
  articles: number;
  magasins: number;
}

export const REFERENCE_DATA_ENTITY_ID = 'order-reference-data';

@Injectable()
export class ReferenceDataLoadLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async logSuccess(
    source: ReferenceDataLoadSource,
    dataDir: string,
    counts: ReferenceDataLoadCounts,
    changedFiles?: string[],
  ): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: source === 'startup' ? ActionType.CREATE : ActionType.UPDATE,
        entityType: 'reference_data',
        entityId: REFERENCE_DATA_ENTITY_ID,
        userId: null,
        changes: {
          event: source === 'startup' ? 'reference_data_loaded' : 'reference_data_reloaded',
          source,
          dataDir,
          data_plus: counts.dataPlus,
          order_lines: counts.orderLines,
          articles: counts.articles,
          magasins: counts.magasins,
          changedFiles: changedFiles?.length ? changedFiles : undefined,
        },
        reason: null,
      }),
    );
  }

  async logFailure(source: ReferenceDataLoadSource, dataDir: string, error: string): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: 'error' as ActionType,
        entityType: 'reference_data',
        entityId: REFERENCE_DATA_ENTITY_ID,
        userId: null,
        changes: {
          event: 'reference_data_load_failed',
          source,
          dataDir,
          error,
        },
        reason: error,
      }),
    );
  }
}
