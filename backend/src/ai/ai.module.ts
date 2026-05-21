import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ChatController } from './chat.controller';
import { Conversation } from '../tickets/entities/conversation.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagModule } from './rag.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Conversation]), TicketsModule, KnowledgeModule, RagModule],
  controllers: [AiController, ChatController],
  providers: [AiService],
  exports: [AiService, RagModule],
})
export class AiModule {}

