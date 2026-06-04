import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { TicketIntentRouterService } from './ticket-intent-router.service';
import { AiController } from './ai.controller';
import { ChatController } from './chat.controller';
import { Conversation } from '../tickets/entities/conversation.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagModule } from './rag.module';
import { OrderTechoModule } from '../order-techo/order-techo.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Conversation]),
    TicketsModule,
    forwardRef(() => KnowledgeModule),
    RagModule,
    forwardRef(() => OrderTechoModule),
  ],
  controllers: [AiController, ChatController],
  providers: [AiService, TicketIntentRouterService],
  exports: [AiService, RagModule, TicketIntentRouterService],
})
export class AiModule {}

