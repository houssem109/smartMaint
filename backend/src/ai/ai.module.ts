import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ChatController } from './chat.controller';
import { Conversation } from '../tickets/entities/conversation.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { RagService } from './rag.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Conversation]), TicketsModule, KnowledgeModule],
  controllers: [AiController, ChatController],
  providers: [AiService, RagService],
  exports: [AiService, RagService],
})
export class AiModule {}

