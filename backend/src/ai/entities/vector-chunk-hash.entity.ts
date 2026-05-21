import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/** Tracks normalized manual chunk hashes so we skip re-embedding duplicates across PDFs. */
@Entity('vector_chunk_hashes')
export class VectorChunkHash {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  hash: string;

  /** First document that caused this chunk to be embedded (provenance). */
  @Column({ type: 'uuid', nullable: true })
  documentId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
