import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrderDataService } from './order-data.service';
import { OrderRuleEngineService } from './order-rule-engine.service';
import { OrderTechoService } from './order-techo.service';

@Module({
  imports: [forwardRef(() => AiModule)],
  providers: [OrderDataService, OrderRuleEngineService, OrderTechoService],
  exports: [OrderTechoService, OrderDataService],
})
export class OrderTechoModule {}