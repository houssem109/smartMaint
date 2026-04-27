import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeExtractionCandidate } from './entities/knowledge-extraction-candidate.entity';
import { MachineNameSuggestion } from './entities/machine-name-suggestion.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { RagService } from '../ai/rag.service';
import { AuditLog, ActionType } from '../common/entities/audit-log.entity';
import { join } from 'path';
import { readFileSync } from 'fs';
// pdf-parse v1 exports a function via module.exports (CommonJS).
// Use import = require(...) to avoid default-import interop issues.
import pdfParse = require('pdf-parse');

@Injectable()
export class KnowledgeDocumentsService {
  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocumentsRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeExtractionCandidate)
    private readonly extractionCandidatesRepository: Repository<KnowledgeExtractionCandidate>,
    @InjectRepository(MachineNameSuggestion)
    private readonly machineNameSuggestionsRepository: Repository<MachineNameSuggestion>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiService: AiService,
    private readonly ragService: RagService,
  ) {}

  async createFromUpload(params: {
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    uploadedById: string;
  }): Promise<KnowledgeDocument> {
    const doc = this.knowledgeDocumentsRepository.create({
      ...params,
      status: 'uploaded',
      error: null,
    });
    return this.knowledgeDocumentsRepository.save(doc);
  }

  async findAll(): Promise<KnowledgeDocument[]> {
    return this.knowledgeDocumentsRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['uploadedBy'],
    });
  }

  async findOne(id: string): Promise<KnowledgeDocument> {
    const doc = await this.knowledgeDocumentsRepository.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async getExtractionsForDocument(documentId: string): Promise<KnowledgeExtractionCandidate[]> {
    await this.findOne(documentId); // ensure exists
    return this.extractionCandidatesRepository.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async getExtractionStats(documentId: string): Promise<{
    extractedCandidates: number;
    approvedCandidates: number;
    rejectedCandidates: number;
  }> {
    // Ensure the document exists (throws NotFoundException if missing)
    await this.findOne(documentId);

    const extractedCandidates = await this.extractionCandidatesRepository.count({ where: { documentId } });
    const approvedCandidates = await this.extractionCandidatesRepository.count({
      where: { documentId, status: 'approved' },
    });
    const rejectedCandidates = await this.extractionCandidatesRepository.count({
      where: { documentId, status: 'rejected' },
    });

    return { extractedCandidates, approvedCandidates, rejectedCandidates };
  }

  async deleteDocument(documentId: string, adminId: string): Promise<void> {
    const doc = await this.findOne(documentId);

    // Admin/superadmin are allowed to delete any document.
    // We keep auth logic in the controller; here we only do the work.
    // Delete candidates and name suggestions first to avoid FK issues on older DBs.
    await this.extractionCandidatesRepository.delete({ documentId: doc.id });
    await this.machineNameSuggestionsRepository.delete({ documentId: doc.id });

    await this.knowledgeDocumentsRepository.delete({ id: doc.id });

    // Best-effort file removal (DB FK cascade already removes candidates).
    try {
      if (doc.filePath && existsSync(doc.filePath)) {
        unlinkSync(doc.filePath);
      }
    } catch {
      // ignore file deletion errors (e.g., already deleted)
    }
  }

  async approveExtractionCandidate(
    candidateId: string,
    adminId: string,
    payload?: {
      title?: string;
      problemDescription?: string;
      solution?: string;
      tags?: string;
    },
  ): Promise<KnowledgeExtractionCandidate> {
    const candidate = await this.extractionCandidatesRepository.findOne({
      where: { id: candidateId },
    });

    if (!candidate) throw new NotFoundException('Extraction candidate not found');

    // Create/Update knowledge entry from the approved candidate.
    // For MVP we create a new entry per approval.
    const normalizedTags =
      payload?.tags ??
      candidate.tags ??
      undefined;
    const tags = typeof normalizedTags === 'string' && normalizedTags.trim().length > 0 ? normalizedTags : undefined;

    const entry = await this.knowledgeService.create(
      {
        title: payload?.title ?? candidate.title,
        problemDescription: payload?.problemDescription ?? candidate.problemDescription,
        solution: payload?.solution ?? candidate.solution,
        tags,
      },
      adminId,
    );

    candidate.status = 'approved';
    candidate.reviewedById = adminId;
    await this.extractionCandidatesRepository.save(candidate);

    return candidate;
  }

  async rejectExtractionCandidate(candidateId: string, adminId: string): Promise<KnowledgeExtractionCandidate> {
    const candidate = await this.extractionCandidatesRepository.findOne({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Extraction candidate not found');

    candidate.status = 'rejected';
    candidate.reviewedById = adminId;
    return this.extractionCandidatesRepository.save(candidate);
  }

  async updateMachineName(documentId: string, machineName: string, _adminId: string): Promise<KnowledgeDocument> {
    const doc = await this.findOne(documentId);
    const trimmed = machineName.trim();
    if (!trimmed) throw new BadRequestException('Machine name cannot be empty');
    doc.machineName = trimmed;
    return this.knowledgeDocumentsRepository.save(doc);
  }

  async listMachineNameSuggestions(documentId: string): Promise<MachineNameSuggestion[]> {
    const doc = await this.findOne(documentId);
    if (doc.machineName != null && String(doc.machineName).trim() !== '') {
      return [];
    }
    return this.machineNameSuggestionsRepository.find({
      where: { documentId },
      relations: ['suggestedBy', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async suggestMachineName(
    documentId: string,
    proposedName: string,
    technicianId: string,
  ): Promise<MachineNameSuggestion> {
    const doc = await this.findOne(documentId);
    if (doc.machineName != null && String(doc.machineName).trim() !== '') {
      throw new BadRequestException('Machine name is already set; suggestions are not needed');
    }
    const trimmed = proposedName.trim();
    if (!trimmed) throw new BadRequestException('Proposed name cannot be empty');

    const row = this.machineNameSuggestionsRepository.create({
      documentId: doc.id,
      suggestedById: technicianId,
      proposedName: trimmed,
      status: 'pending',
      rejectReason: null,
      reviewedById: null,
      reviewedAt: null,
    });
    const saved = await this.machineNameSuggestionsRepository.save(row);

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.CREATE,
        entityType: 'knowledge_document',
        entityId: doc.id,
        userId: technicianId,
        changes: {
          event: 'machine_name_suggestion',
          suggestionId: saved.id,
          proposedName: saved.proposedName,
          documentOriginalName: doc.originalName,
        },
        reason: null,
      }),
    );

    return saved;
  }

  async approveMachineNameSuggestion(
    suggestionId: string,
    adminId: string,
    rejectOthersReason?: string,
  ): Promise<{ document: KnowledgeDocument; approved: MachineNameSuggestion }> {
    const suggestion = await this.machineNameSuggestionsRepository.findOne({
      where: { id: suggestionId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Only pending suggestions can be approved');
    }

    const doc = await this.findOne(suggestion.documentId);
    const sharedReason =
      rejectOthersReason?.trim() || 'Another suggestion was approved for this document.';
    const now = new Date();

    const pendingOthers = await this.machineNameSuggestionsRepository.find({
      where: { documentId: doc.id, status: 'pending' },
    });

    doc.machineName = suggestion.proposedName.trim();
    await this.knowledgeDocumentsRepository.save(doc);

    suggestion.status = 'approved';
    suggestion.reviewedById = adminId;
    suggestion.reviewedAt = now;
    suggestion.rejectReason = null;
    await this.machineNameSuggestionsRepository.save(suggestion);

    for (const o of pendingOthers) {
      if (o.id === suggestion.id) continue;
      o.status = 'rejected';
      o.rejectReason = sharedReason;
      o.reviewedById = adminId;
      o.reviewedAt = now;
      await this.machineNameSuggestionsRepository.save(o);

      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actionType: ActionType.REJECT,
          entityType: 'machine_name_suggestion',
          entityId: o.id,
          userId: o.suggestedById,
          changes: {
            forUserId: o.suggestedById,
            documentId: doc.id,
            documentOriginalName: doc.originalName,
            proposedName: o.proposedName,
            rejectReason: sharedReason,
            event: 'machine_name_suggestion_superseded',
          },
          reason: sharedReason,
        }),
      );
    }

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.APPROVE,
        entityType: 'machine_name_suggestion',
        entityId: suggestion.id,
        userId: suggestion.suggestedById,
        changes: {
          forUserId: suggestion.suggestedById,
          documentId: doc.id,
          documentOriginalName: doc.originalName,
          proposedName: suggestion.proposedName,
          adoptedName: suggestion.proposedName,
          event: 'machine_name_suggestion_approved',
        },
        reason: null,
      }),
    );

    return { document: doc, approved: suggestion };
  }

  async rejectMachineNameSuggestion(
    suggestionId: string,
    adminId: string,
    reason?: string,
  ): Promise<MachineNameSuggestion> {
    const suggestion = await this.machineNameSuggestionsRepository.findOne({
      where: { id: suggestionId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Only pending suggestions can be rejected');
    }

    const doc = await this.findOne(suggestion.documentId);
    const now = new Date();
    const r = reason?.trim() || null;

    suggestion.status = 'rejected';
    suggestion.rejectReason = r;
    suggestion.reviewedById = adminId;
    suggestion.reviewedAt = now;
    await this.machineNameSuggestionsRepository.save(suggestion);

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actionType: ActionType.REJECT,
        entityType: 'machine_name_suggestion',
        entityId: suggestion.id,
        userId: suggestion.suggestedById,
        changes: {
          forUserId: suggestion.suggestedById,
          documentId: doc.id,
          documentOriginalName: doc.originalName,
          proposedName: suggestion.proposedName,
          rejectReason: r,
          event: 'machine_name_suggestion_rejected',
        },
        reason: r,
      }),
    );

    return suggestion;
  }

  async processDocumentExtraction(documentId: string): Promise<void> {
    const doc = await this.findOne(documentId);
    // Update to processing
    doc.status = 'processing';
    doc.error = null;
    await this.knowledgeDocumentsRepository.save(doc);

    try {
      const promptPathCandidates = [
        join(process.cwd(), 'src', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
        join(__dirname, '..', 'ai', 'prompts', 'techo-pdf-extractor-system.prompt.md'),
        join(__dirname, 'prompts', 'techo-pdf-extractor-system.prompt.md'),
      ];

      const extractionPrompt = (() => {
        for (const p of promptPathCandidates) {
          try {
            return readFileSync(p, 'utf8');
          } catch {
            // try next candidate
          }
        }
        throw new Error('Could not load extractor prompt file');
      })();

      const fileBuffer = readFileSync(doc.filePath);
      const parsed: any = await (pdfParse as any)(fileBuffer);
      const fullText = parsed?.text || '';

      if (doc.machineName == null || String(doc.machineName).trim() === '') {
        let extractedName: string | null = null;
        try {
          extractedName = await this.extractMachineNameFromManual(fullText);
        } catch {
          extractedName = null;
        }
        if (extractedName) {
          doc.machineName = extractedName;
          await this.knowledgeDocumentsRepository.save(doc);
        }
      }

      // Prefer the troubleshooting-related part if present.
      const lower = fullText.toLowerCase();
      const idx = lower.indexOf('troubleshooting');
      const relevantText = idx >= 0 ? fullText.slice(idx) : fullText;

      // NOTE: Extraction time depends on how many chunks we send to the LLM.
      // For MVP we keep this bounded so it doesn't take forever on large manuals.
      // Defaults are intentionally higher so you can extract "many" problems from manuals.
      // You can further tune these in env vars if you want.
      const maxChunksToProcess = Number(process.env.DOC_EXTRACTION_MAX_CHUNKS ?? 20);
      const maxCandidatesTotal = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES ?? 200);
      const maxCandidatesPerChunk = Number(process.env.DOC_EXTRACTION_MAX_CANDIDATES_PER_CHUNK ?? 10);
      const chunkSize = Number(process.env.DOC_EXTRACTION_CHUNK_SIZE ?? 12000);
      const overlap = Number(process.env.DOC_EXTRACTION_CHUNK_OVERLAP ?? 1500);

      const chunks: string[] = [];
      for (let i = 0; i < relevantText.length; i += chunkSize - overlap) {
        const chunk = relevantText.slice(i, i + chunkSize);
        if (chunk.trim().length > 0) chunks.push(chunk);
      }

      const candidatesToSave: KnowledgeExtractionCandidate[] = [];
      const chunksToUse = chunks.slice(0, maxChunksToProcess);

      for (const [chunkIndex, chunk] of chunksToUse.entries()) {
        if (candidatesToSave.length >= maxCandidatesTotal) break;

        const userContent =
          `Extract Problem→Solution candidates from this manual text.\n` +
          `Return JSON ONLY with key "candidates".\n` +
          `Chunk index: ${chunkIndex}\n\n` +
          chunk;

        const messages = [
          { role: 'system' as const, content: extractionPrompt },
          { role: 'user' as const, content: userContent },
        ];

        const raw = await this.aiService.chat(messages);

        const parsedJson = this.tryParseJson(raw);
        const candidates = parsedJson?.candidates;
        if (!Array.isArray(candidates)) continue;

        const newCandidates: KnowledgeExtractionCandidate[] = [];

        for (const c of candidates.slice(0, maxCandidatesPerChunk)) {
          if (!c?.title || !c?.problemDescription || !c?.solution) continue;

          const candidate = this.extractionCandidatesRepository.create({
            documentId: doc.id,
            title: String(c.title),
            problemDescription: String(c.problemDescription),
            solution: String(c.solution),
            tags: Array.isArray(c.tags) ? c.tags.join(',') : c.tags ? String(c.tags) : null,
            status: 'candidate',
            createdById: doc.uploadedById,
            reviewedById: null,
          });

          candidatesToSave.push(candidate);
          newCandidates.push(candidate);
        }

        // Save progressively so the UI can show counts while we keep extracting.
        if (newCandidates.length > 0) {
          await this.extractionCandidatesRepository.save(newCandidates);
        }
      }

      // Ensure final persist (idempotent-ish since we save progressively already).
      // If candidatesToSave is empty, this is a no-op.
      if (candidatesToSave.length > 0) {
        await this.extractionCandidatesRepository.save(candidatesToSave);
      }

      doc.status = 'done';
      doc.error = null;
      doc.chunksIndexed = 0;
      await this.knowledgeDocumentsRepository.save(doc);

      // Part A (RAG): index the manual chunks into Qdrant.
      // Keep extraction MVP working even if indexing fails.
      try {
        await this.ragService.indexDocumentChunks(doc.id, chunksToUse);
        doc.chunksIndexed = chunksToUse.length;
        await this.knowledgeDocumentsRepository.save(doc);
      } catch (indexErr: any) {
        doc.error = `Indexing failed: ${indexErr?.message ? String(indexErr.message) : 'unknown error'}`;
        doc.chunksIndexed = 0;
        await this.knowledgeDocumentsRepository.save(doc);
      }
    } catch (e: any) {
      doc.status = 'failed';
      doc.error = e?.message ? String(e.message) : 'PDF extraction failed';
      await this.knowledgeDocumentsRepository.save(doc);
    }
  }

  private extractMachineNameHeuristic(text: string): string | null {
    const head = text.slice(0, 12000);
    const linePatterns = [
      /(?:^|\n)\s*(?:machine|equipment|device|model)\s*[:#]\s*([^\n]+)/i,
      /(?:^|\n)\s*model\s*(?:no\.?|number|#)?\s*[:#]?\s*([^\n]+)/i,
    ];
    for (const re of linePatterns) {
      const m = head.match(re);
      if (m?.[1]) {
        const name = m[1].replace(/\s+/g, ' ').trim();
        if (name.length >= 2 && name.length <= 500) return name;
      }
    }
    return null;
  }

  private async extractMachineNameWithLlm(excerpt: string): Promise<string | null> {
    const trimmed = excerpt.slice(0, 8000);
    if (!trimmed.trim()) return null;

    const messages = [
      {
        role: 'system' as const,
        content:
          'You read a technical manual excerpt. Return JSON only: {"machineName": string|null}. ' +
          'machineName is the primary equipment or machine model name as printed on the cover or title area (e.g. product line + model). ' +
          'Use null if you cannot identify it confidently.',
      },
      { role: 'user' as const, content: trimmed },
    ];

    try {
      const raw = await this.aiService.chat(messages);
      const parsed = this.tryParseJson(raw);
      const n = parsed?.machineName;
      if (n == null) return null;
      const s = String(n).replace(/\s+/g, ' ').trim();
      if (s.length < 2 || s.length > 500) return null;
      return s;
    } catch {
      return null;
    }
  }

  private async extractMachineNameFromManual(fullText: string): Promise<string | null> {
    const llmFirst = await this.extractMachineNameWithLlm(fullText);
    if (llmFirst) return llmFirst;
    return this.extractMachineNameHeuristic(fullText);
  }

  private tryParseJson(raw: string): any | null {
    if (!raw) return null;
    const cleaned = raw
      .replace(/```json/gi, '```')
      .replace(/```/g, '')
      .trim();
    // Try direct JSON parse
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to locate first/last JSON braces
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const slice = cleaned.slice(start, end + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

