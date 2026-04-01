import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocument, KnowledgeExtractionCandidate]),
    KnowledgeModule,
    AiModule,
  ],
  providers: [KnowledgeDocumentsService],
  controllers: [KnowledgeDocumentsController],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeDocumentsModule {}

