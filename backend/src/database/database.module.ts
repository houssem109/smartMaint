import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Conversation } from '../tickets/entities/conversation.entity';
import { Attachment } from '../tickets/entities/attachment.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from '../knowledge-documents/entities/knowledge-extraction-candidate.entity';
import { MachineNameSuggestion } from '../knowledge-documents/entities/machine-name-suggestion.entity';
import { KnowledgeDocumentPageAnalysis } from '../knowledge-documents/entities/knowledge-document-page-analysis.entity';
import { KnowledgeDocumentJob } from '../knowledge-documents/entities/knowledge-document-job.entity';
import { AdminPageFixQueueItem } from '../knowledge-documents/entities/admin-page-fix-queue.entity';
import { MachineProfile } from '../machine-profiles/entities/machine-profile.entity';
import { PipelinePreferences } from '../knowledge-documents/entities/pipeline-preferences.entity';
import { VectorChunkHash } from '../ai/entities/vector-chunk-hash.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get('DATABASE_PORT', 5432),
        username: configService.get('DATABASE_USER', 'smartmaint'),
        password: configService.get('DATABASE_PASSWORD', 'smartmaint123'),
        database: configService.get('DATABASE_NAME', 'smartmaint_db'),
        entities: [
          User,
          Ticket,
          Conversation,
          Attachment,
          AuditLog,
          KnowledgeEntry,
          KnowledgeDocument,
          KnowledgeExtractionCandidate,
          MachineNameSuggestion,
          KnowledgeDocumentPageAnalysis,
          KnowledgeDocumentJob,
          AdminPageFixQueueItem,
          MachineProfile,
          PipelinePreferences,
          VectorChunkHash,
        ],
        // Never auto-sync in the API process: migrations own the schema. `synchronize: true`
        // drops migration FKs/indexes and fights TIMESTAMPTZ vs TIMESTAMP (see startup ALTER spam).
        synchronize: configService.get('DATABASE_SYNCHRONIZE', 'false') === 'true',
        logging: configService.get('NODE_ENV') === 'development',
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: configService.get('DATABASE_RUN_MIGRATIONS', 'false') === 'true',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
