import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagService } from './rag.service';
import { VectorChunkHash } from './entities/vector-chunk-hash.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([VectorChunkHash])],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
