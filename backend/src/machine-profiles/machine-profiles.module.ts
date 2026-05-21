import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineProfile } from './entities/machine-profile.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
import { MachineProfilesService } from './machine-profiles.service';
import { MachineProfilesController } from './machine-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MachineProfile, KnowledgeDocument, KnowledgeEntry])],
  controllers: [MachineProfilesController],
  providers: [MachineProfilesService],
  exports: [MachineProfilesService],
})
export class MachineProfilesModule {}
