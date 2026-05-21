import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { MachineNameSuggestion } from './entities/machine-name-suggestion.entity';
import { KnowledgeDocumentPageAnalysis } from './entities/knowledge-document-page-analysis.entity';
import { KnowledgeDocumentJob } from './entities/knowledge-document-job.entity';
import { AdminPageFixQueueItem } from './entities/admin-page-fix-queue.entity';
import { ExtractionFeedbackEvent } from './entities/extraction-feedback-event.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { PipelinePreferences } from './entities/pipeline-preferences.entity';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../ai/rag.module';
import { MachineProfilesModule } from '../machine-profiles/machine-profiles.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentProgressGateway } from './document-progress.gateway';
import {
  KnowledgeDocumentsExtractionQueueProcessor,
  KnowledgeDocumentsIndexingQueueProcessor,
  KnowledgeDocumentsOcrQueueProcessor,
  KnowledgeDocumentsQueueProcessor,
  KnowledgeDocumentsVisionQueueProcessor,
} from './knowledge-documents.queue.processor';
import {
  EXTRACTION_QUEUE,
  GATE_QUEUE,
  INDEXING_QUEUE,
  OCR_QUEUE,
  VISION_QUEUE,
} from './queues.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeDocument,
      KnowledgeExtractionCandidate,
      MachineNameSuggestion,
      KnowledgeDocumentPageAnalysis,
      KnowledgeDocumentJob,
      AdminPageFixQueueItem,
      ExtractionFeedbackEvent,
      AuditLog,
      KnowledgeEntry,
      PipelinePreferences,
    ]),
    BullModule.registerQueue(
      { name: GATE_QUEUE },
      { name: EXTRACTION_QUEUE },
      { name: OCR_QUEUE },
      { name: VISION_QUEUE },
      { name: INDEXING_QUEUE },
    ),
    KnowledgeModule,
    AiModule,
    RagModule,
    MachineProfilesModule,
    AuthModule,
  ],
  providers: [
    DocumentProgressGateway,
    KnowledgeDocumentsService,
    KnowledgeDocumentsQueueProcessor,
    KnowledgeDocumentsExtractionQueueProcessor,
    KnowledgeDocumentsOcrQueueProcessor,
    KnowledgeDocumentsVisionQueueProcessor,
    KnowledgeDocumentsIndexingQueueProcessor,
  ],
  controllers: [KnowledgeDocumentsController],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeDocumentsModule {}

