import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import * as ExcelJS from 'exceljs';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { UserRole } from '../users/entities/user.entity';
import { RagService } from '../ai/rag.service';
import { AiService } from '../ai/ai.service';
import { AuditLog, ActionType } from '../common/entities/audit-log.entity';
import {
  buildFieldPhotoVisionPrompt,
  isFieldPhotoVisionEnabled,
} from '../knowledge-documents/page-explanation.config';
import { getKnowledgePhotoUploadDir } from './knowledge-photo.config';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(KnowledgeEntry)
    private readonly knowledgeRepository: Repository<KnowledgeEntry>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly ragService: RagService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
  ) {}

  buildIndexText(entry: KnowledgeEntry): string {
    const parts = [
      entry.machineName ? `Machine: ${entry.machineName}` : null,
      `Title: ${entry.title}`,
      `Problem: ${entry.problemDescription}`,
      entry.symptom ? `Symptom: ${entry.symptom}` : null,
      entry.rootCause ? `Cause: ${entry.rootCause}` : null,
      `Solution: ${entry.solution}`,
      entry.tags ? `Tags: ${entry.tags}` : null,
      entry.photoVisionDescription?.trim()
        ? `Field photo description: ${entry.photoVisionDescription.trim()}`
        : entry.photoPath
          ? `Field photo on file: ${entry.photoPath}`
          : null,
    ].filter(Boolean) as string[];
    return parts.join('\n');
  }

  private async indexEntryIfApproved(entry: KnowledgeEntry): Promise<void> {
    if (entry.reviewStatus !== 'approved') return;
    try {
      await this.ragService.indexKnowledgeEntry(entry.id, this.buildIndexText(entry), {
        source: entry.source ?? 'knowledge_entry',
        title: entry.title,
        machineName: entry.machineName,
        entryType: entry.entryType,
        photoPath: entry.photoPath,
      });
    } catch (e: any) {
      this.logger.warn(`RAG index failed for knowledge entry ${entry.id}: ${e?.message ?? e}`);
    }
  }

  async create(
    dto: CreateKnowledgeEntryDto,
    userId: string,
    role: UserRole,
    options?: { skipAutoIndex?: boolean },
  ): Promise<KnowledgeEntry> {
    const isFieldContributor = role === UserRole.TECHNICIAN || role === UserRole.WORKER;
    const reviewStatus = isFieldContributor ? 'pending_review' : 'approved';
    const { knowledgeDocumentId, ...rest } = dto;

    const entry = this.knowledgeRepository.create({
      ...rest,
      knowledgeDocument:
        !isFieldContributor && knowledgeDocumentId ? ({ id: knowledgeDocumentId } as KnowledgeDocument) : null,
      createdById: userId,
      reviewStatus,
      entryType: dto.entryType?.trim() || (isFieldContributor ? 'experience' : null),
      source: dto.source?.trim() || (isFieldContributor ? 'field_experience' : null),
      machineName: dto.machineName?.trim() || null,
      symptom: dto.symptom?.trim() || null,
      rootCause: dto.rootCause?.trim() || null,
      severity: dto.severity?.trim() || null,
    });

    const saved = await this.knowledgeRepository.save(entry);
    if (isFieldContributor) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actionType: ActionType.CREATE,
          entityId: saved.id,
          entityType: 'knowledge_entry',
          userId,
          changes: {
            event: 'knowledge_entry_submitted',
            title: saved.title,
            reviewStatus: saved.reviewStatus,
            createdById: saved.createdById,
          },
          reason: null,
        }),
      );
    }
    if (reviewStatus === 'approved' && !options?.skipAutoIndex) {
      await this.indexEntryIfApproved(saved);
    }
    return saved;
  }

  async findAllForRole(userId: string, role: UserRole): Promise<KnowledgeEntry[]> {
    const qb = this.knowledgeRepository.createQueryBuilder('k').leftJoinAndSelect('k.createdBy', 'createdBy');
    if (role === UserRole.TECHNICIAN || role === UserRole.WORKER) {
      qb.where('(k.reviewStatus = :approved OR k.createdById = :userId)', {
        approved: 'approved',
        userId,
      });
    }
    qb.orderBy('k.createdAt', 'DESC');
    return qb.getMany();
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['createdBy'],
    });
  }

  async listPendingReview(): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepository.find({
      where: { reviewStatus: 'pending_review' },
      order: { createdAt: 'ASC' },
      relations: ['createdBy'],
    });
  }

  async countPendingReview(): Promise<number> {
    return this.knowledgeRepository.count({ where: { reviewStatus: 'pending_review' } });
  }

  async searchRelevantEntries(query: string, limit = 3): Promise<KnowledgeEntry[]> {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return [];

    const safe = q.slice(0, 200);

    return this.knowledgeRepository
      .createQueryBuilder('k')
      .leftJoinAndSelect('k.createdBy', 'createdBy')
      .where('k.reviewStatus = :rs', { rs: 'approved' })
      .andWhere(
        'LOWER(k.title) LIKE :q OR LOWER(k.problemDescription) LIKE :q OR LOWER(k.solution) LIKE :q OR LOWER(COALESCE(k.tags, :empty)) LIKE :q',
        { q: `%${safe}%`, empty: '' },
      )
      .orderBy('k.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async findOne(id: string): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async findOneForUser(id: string, userId: string, role: UserRole): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    if (
      (role === UserRole.TECHNICIAN || role === UserRole.WORKER) &&
      entry.reviewStatus !== 'approved' &&
      entry.createdById !== userId
    ) {
      throw new ForbiddenException('You can only view your own non-approved knowledge entries');
    }
    return entry;
  }

  async update(id: string, dto: UpdateKnowledgeEntryDto, userId: string, role: UserRole): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    const isFieldContributor = role === UserRole.TECHNICIAN || role === UserRole.WORKER;

    if (isFieldContributor && entry.createdById !== userId) {
      throw new ForbiddenException('You can only update your own knowledge entries');
    }
    if (isFieldContributor && entry.reviewStatus === 'approved') {
      throw new BadRequestException('Approved entries cannot be edited by field users');
    }

    Object.assign(entry, dto);
    if (isFieldContributor) {
      entry.reviewStatus = 'pending_review';
      entry.reviewedById = null;
      entry.reviewedAt = null;
      entry.rejectReason = null;
    }
    const saved = await this.knowledgeRepository.save(entry);
    if (saved.reviewStatus === 'approved') {
      await this.indexEntryIfApproved(saved);
    }
    return saved;
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const entry = await this.findOne(id);

    if ((role === UserRole.TECHNICIAN || role === UserRole.WORKER) && entry.createdById !== userId) {
      throw new ForbiddenException('You can only delete your own knowledge entries');
    }

    await this.knowledgeRepository.delete(id);
  }

  async approveKnowledgeEntry(id: string, adminId: string): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    if (entry.reviewStatus !== 'pending_review') {
      throw new BadRequestException('Entry is not pending review');
    }
    entry.reviewStatus = 'approved';
    entry.reviewedById = adminId;
    entry.reviewedAt = new Date();
    entry.rejectReason = null;
    const saved = await this.knowledgeRepository.save(entry);
    await this.indexEntryIfApproved(saved);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.APPROVE,
        entityId: saved.id,
        entityType: 'knowledge_entry',
        userId: adminId,
        changes: {
          event: 'knowledge_entry_approved',
          forUserId: saved.createdById,
          title: saved.title,
          reviewStatus: saved.reviewStatus,
        },
        reason: null,
      }),
    );
    return saved;
  }

  async rejectKnowledgeEntry(id: string, adminId: string, reason?: string | null): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    if (entry.reviewStatus !== 'pending_review') {
      throw new BadRequestException('Entry is not pending review');
    }
    entry.reviewStatus = 'rejected';
    entry.reviewedById = adminId;
    entry.reviewedAt = new Date();
    entry.rejectReason = reason?.trim() || null;
    const saved = await this.knowledgeRepository.save(entry);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.REJECT,
        entityId: saved.id,
        entityType: 'knowledge_entry',
        userId: adminId,
        changes: {
          event: 'knowledge_entry_rejected',
          forUserId: saved.createdById,
          title: saved.title,
          reviewStatus: saved.reviewStatus,
          rejectReason: saved.rejectReason,
        },
        reason: saved.rejectReason,
      }),
    );
    return saved;
  }

  async setPhotoPath(entryId: string, relativePath: string, userId: string, role: UserRole): Promise<KnowledgeEntry> {
    const entry = await this.findOne(entryId);
    const isFieldContributor = role === UserRole.TECHNICIAN || role === UserRole.WORKER;
    if (isFieldContributor && entry.createdById !== userId) {
      throw new ForbiddenException('You can only attach photos to your own entries');
    }
    if (isFieldContributor && entry.reviewStatus === 'approved') {
      throw new BadRequestException('Cannot change photo on approved entries');
    }
    entry.photoPath = relativePath;
    entry.photoVisionDescription = null;
    if (isFieldContributor) {
      entry.reviewStatus = 'pending_review';
      entry.reviewedById = null;
      entry.reviewedAt = null;
    }
    const saved = await this.knowledgeRepository.save(entry);
    await this.describeFieldPhotoForEntry(saved);
    const refreshed = await this.findOne(saved.id);
    if (refreshed.reviewStatus === 'approved') {
      await this.indexEntryIfApproved(refreshed);
    }
    return refreshed;
  }

  /** Vision-describe a field photo and persist text for Qdrant when the entry is approved. */
  private async describeFieldPhotoForEntry(entry: KnowledgeEntry): Promise<void> {
    if (!isFieldPhotoVisionEnabled() || !entry.photoPath?.trim()) return;

    const root = resolve(join(process.cwd(), getKnowledgePhotoUploadDir()));
    const abs = resolve(join(process.cwd(), entry.photoPath));
    if (!abs.startsWith(root) || !existsSync(abs)) {
      this.logger.warn(`Field photo missing for entry ${entry.id}: ${entry.photoPath}`);
      return;
    }

    try {
      const b64 = readFileSync(abs).toString('base64');
      const prompt = buildFieldPhotoVisionPrompt(entry.machineName, entry.title);
      const description = (await this.aiService.describeImageBase64ForPdf(b64, prompt)).trim().slice(0, 50000);
      if (!description) return;
      await this.knowledgeRepository.update(entry.id, { photoVisionDescription: description });
    } catch (e: any) {
      this.logger.warn(`Field photo vision failed for ${entry.id}: ${e?.message ?? e}`);
    }
  }

  async exportCsvForUser(userId: string, role: UserRole): Promise<string> {
    const rows =
      role === UserRole.TECHNICIAN || role === UserRole.WORKER
        ? await this.knowledgeRepository.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } })
        : await this.knowledgeRepository.find({ order: { createdAt: 'DESC' } });

    const header = [
      'id',
      'title',
      'problemDescription',
      'solution',
      'tags',
      'machineName',
      'symptom',
      'rootCause',
      'severity',
      'entryType',
      'source',
      'reviewStatus',
      'photoPath',
      'createdById',
      'createdAt',
    ].join(',');
    const esc = (v: string | null | undefined) => {
      const s = (v ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = rows.map((r) =>
      [
        r.id,
        esc(r.title),
        esc(r.problemDescription),
        esc(r.solution),
        esc(r.tags),
        esc(r.machineName),
        esc(r.symptom),
        esc(r.rootCause),
        esc(r.severity),
        esc(r.entryType),
        esc(r.source),
        esc(r.reviewStatus),
        esc(r.photoPath),
        r.createdById,
        r.createdAt?.toISOString() ?? '',
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async exportXlsxForUser(userId: string, role: UserRole): Promise<Buffer> {
    const rows =
      role === UserRole.TECHNICIAN || role === UserRole.WORKER
        ? await this.knowledgeRepository.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } })
        : await this.knowledgeRepository.find({ order: { createdAt: 'DESC' } });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Knowledge entries');
    ws.columns = [
      { header: 'id', key: 'id', width: 38 },
      { header: 'title', key: 'title', width: 28 },
      { header: 'problemDescription', key: 'problemDescription', width: 40 },
      { header: 'solution', key: 'solution', width: 40 },
      { header: 'tags', key: 'tags', width: 20 },
      { header: 'machineName', key: 'machineName', width: 22 },
      { header: 'symptom', key: 'symptom', width: 24 },
      { header: 'rootCause', key: 'rootCause', width: 24 },
      { header: 'severity', key: 'severity', width: 12 },
      { header: 'entryType', key: 'entryType', width: 14 },
      { header: 'source', key: 'source', width: 18 },
      { header: 'reviewStatus', key: 'reviewStatus', width: 16 },
      { header: 'photoPath', key: 'photoPath', width: 36 },
      { header: 'createdById', key: 'createdById', width: 38 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
    ];
    for (const r of rows) {
      ws.addRow({
        id: r.id,
        title: r.title,
        problemDescription: r.problemDescription,
        solution: r.solution,
        tags: r.tags,
        machineName: r.machineName,
        symptom: r.symptom,
        rootCause: r.rootCause,
        severity: r.severity,
        entryType: r.entryType,
        source: r.source,
        reviewStatus: r.reviewStatus,
        photoPath: r.photoPath,
        createdById: r.createdById,
        createdAt: r.createdAt?.toISOString() ?? '',
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
