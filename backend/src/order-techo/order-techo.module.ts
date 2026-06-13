import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditLog } from '../common/entities/audit-log.entity';
import { OrderDataService } from './order-data.service';
import { OrderRuleEngineService } from './order-rule-engine.service';
import { OrderTechoService } from './order-techo.service';
import { ReferenceDataLoadLogService } from './reference-data-load-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), forwardRef(() => AiModule)],
  providers: [
    OrderDataService,
    OrderRuleEngineService,
    OrderTechoService,
    ReferenceDataLoadLogService,
  ],
  exports: [OrderTechoService, OrderDataService],
})
export class OrderTechoModule {}
