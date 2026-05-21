import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { RagService } from '../ai/rag.service';
import {
  EXTRACTION_JOB,
  EXTRACTION_QUEUE,
  GATE_JOB,
  GATE_QUEUE,
  INDEXING_JOB,
  INDEXING_QUEUE,
  OCR_JOB,
  OCR_QUEUE,
  VISION_JOB,
  VISION_QUEUE,
} from './queues.constants';

@Injectable()
@Processor(GATE_QUEUE)
export class KnowledgeDocumentsQueueProcessor {
  private readonly logger = new Logger(KnowledgeDocumentsQueueProcessor.name);

  constructor(private readonly knowledgeDocumentsService: KnowledgeDocumentsService) {}

  @Process(GATE_JOB)
  async handleGate(job: Job<{ documentId: string; trackingJobId?: string }>) {
    const { documentId, trackingJobId } = job.data;
    await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
    try {
      const decision = await this.knowledgeDocumentsService.runGateStage(documentId);
      if (decision === 'accepted') {
        await this.knowledgeDocumentsService.enqueueExtractionJob(documentId);
      }
      await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      this.logger.error(`Gate job failed for ${documentId}: ${msg}`);
      await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
      throw e;
    }
  }
}

@Injectable()
@Processor(EXTRACTION_QUEUE)
export class KnowledgeDocumentsExtractionQueueProcessor {
  private readonly logger = new Logger(KnowledgeDocumentsExtractionQueueProcessor.name);

  constructor(private readonly knowledgeDocumentsService: KnowledgeDocumentsService) {}

  @Process(EXTRACTION_JOB)
  async handleExtraction(job: Job<{ documentId: string; trackingJobId?: string }>) {
    const { documentId, trackingJobId } = job.data;
    await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
    try {
      await this.knowledgeDocumentsService.processDocumentExtraction(documentId);
      await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      this.logger.error(`Extraction job failed for ${documentId}: ${msg}`);
      await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
      throw e;
    }
  }
}

@Injectable()
@Processor(OCR_QUEUE)
export class KnowledgeDocumentsOcrQueueProcessor {
  private readonly logger = new Logger(KnowledgeDocumentsOcrQueueProcessor.name);

  constructor(private readonly knowledgeDocumentsService: KnowledgeDocumentsService) {}

  @Process(OCR_JOB)
  async handleOcr(job: Job<{ documentId: string; trackingJobId?: string; pageNumbers: number[] }>) {
    const { documentId, trackingJobId, pageNumbers } = job.data;
    await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
    try {
      await this.knowledgeDocumentsService.runOcrForDocumentPages(documentId, pageNumbers ?? []);
      await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      this.logger.error(`OCR job failed for ${documentId}: ${msg}`);
      await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
      throw e;
    }
  }
}

@Injectable()
@Processor(VISION_QUEUE)
export class KnowledgeDocumentsVisionQueueProcessor {
  private readonly logger = new Logger(KnowledgeDocumentsVisionQueueProcessor.name);

  constructor(private readonly knowledgeDocumentsService: KnowledgeDocumentsService) {}

  @Process(VISION_JOB)
  async handleVision(job: Job<{ documentId: string; trackingJobId?: string; pageNumbers: number[] }>) {
    const { documentId, trackingJobId, pageNumbers } = job.data;
    await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
    try {
      await this.knowledgeDocumentsService.runVisionForDocumentPages(documentId, pageNumbers ?? []);
      await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      this.logger.error(`Vision job failed for ${documentId}: ${msg}`);
      await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
      throw e;
    }
  }
}

@Injectable()
@Processor(INDEXING_QUEUE)
export class KnowledgeDocumentsIndexingQueueProcessor {
  private readonly logger = new Logger(KnowledgeDocumentsIndexingQueueProcessor.name);

  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly ragService: RagService,
  ) {}

  @Process(INDEXING_JOB)
  async handleIndexing(
    job: Job<{ documentId: string; trackingJobId?: string; knowledgeEntryId: string; candidateId?: string }>,
  ) {
    const { documentId, trackingJobId, knowledgeEntryId } = job.data;
    await this.knowledgeDocumentsService.markTrackingJobActive(trackingJobId, String(job.id));
    try {
      const entry = await this.knowledgeService.findOne(knowledgeEntryId);
      const text = this.knowledgeService.buildIndexText(entry);
      await this.ragService.indexKnowledgeEntry(entry.id, text, {
        source: entry.source ?? 'pdf_extraction',
        title: entry.title,
        machineName: entry.machineName,
        entryType: entry.entryType,
        photoPath: entry.photoPath,
      });
      await this.knowledgeDocumentsService.markTrackingJobCompleted(trackingJobId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      this.logger.error(`Indexing job failed for document ${documentId} entry ${job.data.knowledgeEntryId}: ${msg}`);
      await this.knowledgeDocumentsService.markTrackingJobFailed(trackingJobId, msg);
      throw e;
    }
  }
}
