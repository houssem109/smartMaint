import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { MachineProfile } from '../machine-profiles/entities/machine-profile.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { ExportController } from './export.controller';
import { KnowledgeExportService } from './knowledge-export.service';
import { TicketExportService } from './ticket-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeEntry,
      KnowledgeDocument,
      MachineProfile,
      Ticket,
      User,
      AuditLog,
    ]),
  ],
  controllers: [ExportController],
  providers: [KnowledgeExportService, TicketExportService],
})
export class ExportModule {}
