import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { RagModule } from '../ai/rag.module';
import { AiModule } from '../ai/ai.module';
import { AuditLog } from '../common/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeEntry, AuditLog]), RagModule, forwardRef(() => AiModule)],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}

