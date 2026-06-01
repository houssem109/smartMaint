import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Delete,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { DatabaseSchemaService } from '../database/database-schema.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getKnowledgePdfMaxBytes, getKnowledgePdfUploadDir, getPageFixImageMaxBytes, getPageFixImageUploadDir, ensurePageFixImageUploadDir } from './pdf-ingestion.config';
import type { Express } from 'express';
import { IsOptional, IsString } from 'class-validator';
import {
  ApproveMachineNameSuggestionDto,
  RejectMachineNameSuggestionDto,
  SuggestMachineNameDto,
  UpdateMachineNameDto,
} from './dto/machine-name.dto';
import { SetPdfVisionPreferenceDto } from './dto/set-pdf-vision-preference.dto';

class ApproveExtractionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}

class RejectExtractionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class GateDecisionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class AdminFixTextDto {
  @IsString()
  text: string;
}

@ApiTags('Knowledge Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-documents')
export class KnowledgeDocumentsController {
  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
    private readonly databaseSchemaService: DatabaseSchemaService,
  ) {}

  private async acceptPdfUpload(
    file: Express.Multer.File,
    req: any,
    supersedesDocumentId?: string,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    const mt = (file.mimetype || '').toLowerCase();
    if (!mt.includes('pdf') && mt !== 'application/octet-stream') {
      try {
        if (file.path && existsSync(file.path)) unlinkSync(file.path);
      } catch {
        // ignore
      }
      throw new HttpException('Only PDF files are allowed', HttpStatus.BAD_REQUEST);
    }

    try {
      const { document, jobId } = await this.knowledgeDocumentsService.ingestAndQueue({
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        uploadedById: req.user.id,
        supersedesDocumentId: supersedesDocumentId?.trim() || undefined,
      });

      return {
        documentId: document.id,
        jobId,
        document,
        resume: {
          extractedCandidates: 0,
          approvedCandidates: 0,
          rejectedCandidates: 0,
          chunksIndexed: 0,
          message: 'Upload accepted and queued for background processing.',
        },
      };
    } catch (err) {
      try {
        if (file?.path && existsSync(file.path)) unlinkSync(file.path);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a PDF to the knowledge documents library' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const baseDir = getKnowledgePdfUploadDir();
          if (!existsSync(baseDir)) {
            mkdirSync(baseDir, { recursive: true });
          }
          cb(null, baseDir);
        },
        filename: (_req, file, cb) => {
          const unique = uuidv4();
          const extension = extname(file.originalname || '') || '.pdf';
          cb(null, `${unique}${extension}`);
        },
      }),
      limits: { fileSize: getKnowledgePdfMaxBytes() },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('supersedesDocumentId') supersedesDocumentId?: string,
  ) {
    return this.acceptPdfUpload(file, req, supersedesDocumentId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload alias (same behavior as /upload)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const baseDir = getKnowledgePdfUploadDir();
          if (!existsSync(baseDir)) {
            mkdirSync(baseDir, { recursive: true });
          }
          cb(null, baseDir);
        },
        filename: (_req, file, cb) => {
          const unique = uuidv4();
          const extension = extname(file.originalname || '') || '.pdf';
          cb(null, `${unique}${extension}`);
        },
      }),
      limits: { fileSize: getKnowledgePdfMaxBytes() },
    }),
  )
  async uploadAlias(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('supersedesDocumentId') supersedesDocumentId?: string,
  ) {
    return this.acceptPdfUpload(file, req, supersedesDocumentId);
  }

  @Post('machine-name-suggestions/:suggestionId/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Approve a machine name suggestion (rejects other pending for same PDF)' })
  async approveMachineNameSuggestion(
    @Param('suggestionId') suggestionId: string,
    @Body() body: ApproveMachineNameSuggestionDto,
    @Request() req,
  ) {
    return this.knowledgeDocumentsService.approveMachineNameSuggestion(
      suggestionId,
      req.user.id,
      body.rejectOthersReason,
    );
  }

  @Post(':id/gate/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Approve gate-review document and continue pipeline' })
  async approveGate(@Param('id') id: string, @Request() req) {
    return this.knowledgeDocumentsService.approveGateAndContinue(id, req.user.id);
  }

  @Post(':id/gate/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject document at gate-review stage' })
  async rejectGate(@Param('id') id: string, @Body() body: GateDecisionDto, @Request() req) {
    return this.knowledgeDocumentsService.rejectGate(id, req.user.id, body.reason);
  }

  @Post('machine-name-suggestions/:suggestionId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject a single pending machine name suggestion' })
  async rejectMachineNameSuggestion(
    @Param('suggestionId') suggestionId: string,
    @Body() body: RejectMachineNameSuggestionDto,
    @Request() req,
  ) {
    return this.knowledgeDocumentsService.rejectMachineNameSuggestion(
      suggestionId,
      req.user.id,
      body.reason,
    );
  }

  @Post('extractions/:candidateId/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Approve an extracted candidate and create a KnowledgeEntry' })
  async approveExtraction(
    @Param('candidateId') candidateId: string,
    @Body() body: ApproveExtractionDto,
    @Request() req,
  ) {
    return this.knowledgeDocumentsService.approveExtractionCandidate(
      candidateId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Post('extractions/:candidateId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject an extracted candidate' })
  async rejectExtraction(
    @Param('candidateId') candidateId: string,
    @Body() body: RejectExtractionDto,
    @Request() req,
  ) {
    return this.knowledgeDocumentsService.rejectExtractionCandidate(candidateId, req.user.id, body.reason);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({
    summary: 'List uploaded knowledge documents',
    description:
      'Query includeSuperseded=true (admin/superadmin only) to list superseded revisions for 11 history.',
  })
  async list(
    @Request() req: { user: { role: UserRole } },
    @Query('includeSuperseded') includeSuperseded?: string,
  ) {
    const wants =
      includeSuperseded === 'true' || includeSuperseded === '1' || includeSuperseded === 'yes';
    const isAdmin = req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPERADMIN;
    return this.knowledgeDocumentsService.findAll({ includeSuperseded: wants && isAdmin });
  }

  @Get(':id/machine-name/suggestions')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List machine name suggestions for a document' })
  async machineNameSuggestions(@Param('id') id: string) {
    return this.knowledgeDocumentsService.listMachineNameSuggestions(id);
  }

  @Patch(':id/machine-name')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Set official machine name (admin)' })
  async patchMachineName(
    @Param('id') id: string,
    @Body() body: UpdateMachineNameDto,
    @Request() req,
  ) {
    return this.knowledgeDocumentsService.updateMachineName(id, body.machineName, req.user.id);
  }

  @Post(':id/machine-name/suggest')
  @Roles(UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Suggest a machine name for a PDF (pending admin review)' })
  async suggestMachineName(@Param('id') id: string, @Body() body: SuggestMachineNameDto, @Request() req) {
    return this.knowledgeDocumentsService.suggestMachineName(id, body.proposedName, req.user.id);
  }

  @Get(':id/extractions')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get extracted Problem→Solution candidates for a document' })
  async extractions(@Param('id') id: string) {
    return this.knowledgeDocumentsService.getExtractionsForDocument(id);
  }

  @Get(':id/page-analysis')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get OCR/quality page analysis for a document' })
  async pageAnalysis(@Param('id') id: string) {
    return this.knowledgeDocumentsService.getPageAnalysis(id);
  }

  @Get(':id/rag-stored-data')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get RAG chunks currently stored for this PDF in vector DB' })
  async ragStoredData(@Param('id') id: string, @Query('limit') limitRaw?: string) {
    const parsed = limitRaw != null ? parseInt(limitRaw, 10) : 120;
    const limit = Number.isFinite(parsed) ? parsed : 120;
    return this.knowledgeDocumentsService.getRagStoredData(id, limit);
  }

  @Get(':id/pipeline-audit-export/xlsx')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Excel report: summary, pages OCR, RAG chunks, LLM extraction (readable for jury / thesis)',
  })
  async pipelineAuditExportXlsx(@Param('id') id: string, @Query('ragLimit') ragLimitRaw?: string) {
    const parsed = ragLimitRaw != null ? parseInt(ragLimitRaw, 10) : 2000;
    const ragLimit = Number.isFinite(parsed) ? parsed : 2000;
    const { buffer, filename } = await this.knowledgeDocumentsService.exportPipelineAuditExcel(id, ragLimit);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':id/pipeline-audit-report')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary:
      'Full pipeline audit for jury/report: page OCR+vision text, Qdrant chunks, KPIs, chunk before/after filter',
  })
  async pipelineAuditReport(@Param('id') id: string, @Query('ragLimit') ragLimitRaw?: string) {
    const parsed = ragLimitRaw != null ? parseInt(ragLimitRaw, 10) : 2000;
    const ragLimit = Number.isFinite(parsed) ? parsed : 2000;
    return this.knowledgeDocumentsService.getPipelineAuditReport(id, ragLimit);
  }

  @Get('rag-stored-data-global')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get RAG chunks across all PDFs for admin inspection' })
  async ragStoredDataGlobal(@Query('limit') limitRaw?: string, @Query('documentId') documentId?: string) {
    const parsed = limitRaw != null ? parseInt(limitRaw, 10) : 400;
    const limit = Number.isFinite(parsed) ? parsed : 400;
    return this.knowledgeDocumentsService.getRagStoredDataGlobal(limit, documentId);
  }

  @Get(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Get document processing status/progress' })
  async status(@Param('id') id: string) {
    return this.knowledgeDocumentsService.getDocumentStatus(id);
  }

  @Get('page-fix-queue')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List unreadable pages waiting for admin fix' })
  async pageFixQueue() {
    return this.knowledgeDocumentsService.listPageFixQueue();
  }

  @Get('page-fix-queue/:itemId/replacement-image')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Serve replacement page image for admin preview (JPEG/PNG/WebP)' })
  async pageFixReplacementImage(@Param('itemId') itemId: string) {
    const { data, contentType } = await this.knowledgeDocumentsService.getPageFixReplacementImage(itemId);
    return new StreamableFile(data, { type: contentType });
  }

  @Get('admin-pipeline-counts')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Counts for admin nav: open page-fix items + pending extraction candidates',
  })
  adminPipelineCounts() {
    return this.knowledgeDocumentsService.getAdminPipelineSummary();
  }

  @Get('queues/health')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Bull/Redis health: PING + job counts per knowledge-documents queue',
  })
  queuesHealth() {
    return this.knowledgeDocumentsService.getBullQueuesHealth();
  }

  @Get('pipeline-config')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Read-only effective PDF pipeline env (16): gate, OCR, vision, extraction caps, Ollama/Qdrant URLs',
  })
  pipelineConfig() {
    return this.knowledgeDocumentsService.getPipelineConfigSnapshot();
  }

  @Get('database-inventory')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'PostgreSQL tables touched by the PDF knowledge pipeline (19); curated list aligned with architecture doc',
  })
  databaseInventory() {
    return this.knowledgeDocumentsService.getDatabaseInventory();
  }

  @Get('database-schema')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Live PostgreSQL public schema: all tables, columns, and foreign keys (from information_schema)',
  })
  databaseSchema() {
    return this.databaseSchemaService.getPublicSchema();
  }

  @Get('qa-success-criteria')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Section 20 QA matrix: original success criteria vs shipped/partial/gap (curated; read-only)',
  })
  qaSuccessCriteria() {
    return this.knowledgeDocumentsService.getQaSuccessCriteria();
  }

  @Get('troubleshooting-extraction-reference')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Section 22 read-only: troubleshooting extraction (service, queue, schema, endpoints)',
  })
  troubleshootingExtractionReference() {
    return this.knowledgeDocumentsService.getTroubleshootingExtractionReference();
  }

  @Get('pipeline-preferences/pdf-vision')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'PDF vision admin toggle vs env (ENABLE_PDF_VISION); effective = both true',
  })
  getPdfVisionPreference() {
    return this.knowledgeDocumentsService.getPdfVisionPreferenceReadModel();
  }

  @Patch('pipeline-preferences/pdf-vision')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary:
      'Turn PDF pipeline vision on/off without restarting the API. Enabling still requires ENABLE_PDF_VISION=true in environment.',
  })
  patchPdfVisionPreference(@Body() body: SetPdfVisionPreferenceDto, @Request() req) {
    return this.knowledgeDocumentsService.setPdfVisionAdminEnabled(body.enabled, req.user.id);
  }

  @Get('extraction-feedback/recent')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Recent extraction approve/reject feedback events (analytics)' })
  async extractionFeedbackRecent(@Query('limit') limitRaw?: string) {
    const parsed = limitRaw != null ? parseInt(limitRaw, 10) : 200;
    const limit = Number.isFinite(parsed) ? parsed : 200;
    return this.knowledgeDocumentsService.listRecentExtractionFeedback(limit);
  }

  @Post('page-fix-queue/:itemId/fix-text')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Admin manually fixes unreadable page by typing text' })
  async fixUnreadableText(@Param('itemId') itemId: string, @Body() body: AdminFixTextDto, @Request() req) {
    return this.knowledgeDocumentsService.fixPageWithText(itemId, body.text, req.user.id);
  }

  @Post('page-fix-queue/:itemId/fix-image')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a replacement page image; runs PDF vision on it (requires ENABLE_PDF_VISION)',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: getPageFixImageMaxBytes() },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
        cb(ok ? null : new BadRequestException('Only JPEG, PNG, or WebP images are allowed'), ok);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, ensurePageFixImageUploadDir());
        },
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname).toLowerCase() || '.jpg'}`);
        },
      }),
    }),
  )
  async fixUnreadableImage(
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req,
  ) {
    if (!file?.path) throw new BadRequestException('file is required');
    const rel = join(getPageFixImageUploadDir(), file.filename).replace(/\\/g, '/');
    try {
      return await this.knowledgeDocumentsService.fixPageWithReplacementImage(
        itemId,
        file.path,
        rel,
        req.user.id,
      );
    } catch (err) {
      try {
        if (file.path && existsSync(file.path)) unlinkSync(file.path);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  @Post('page-fix-queue/:itemId/dismiss')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Dismiss unreadable page (not useful)' })
  async dismissFixQueueItem(@Param('itemId') itemId: string, @Request() req) {
    return this.knowledgeDocumentsService.dismissFixQueueItem(itemId, req.user.id);
  }

  @Post(':id/run-ocr')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Run OCR on low-quality pages (best-effort)' })
  async runOcr(@Param('id') id: string, @Request() req) {
    return this.knowledgeDocumentsService.runOcrForDocument(id, req.user.id);
  }

  @Post(':id/run-vision')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Run vision LLM on low-quality / low-confidence pages (requires ENABLE_PDF_VISION)' })
  async runVision(@Param('id') id: string, @Request() req) {
    return this.knowledgeDocumentsService.runVisionForDocument(id, req.user.id);
  }

  @Post(':id/reindex-manual-chunks')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary:
      'Rebuild Qdrant manual chunks from current page_analysis (ocrText) — use after fixes or if vectors drifted',
  })
  async reindexManualChunks(@Param('id') id: string) {
    return this.knowledgeDocumentsService.reindexManualChunksForDocument(id);
  }

  @Post(':id/continue-extraction')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary:
      'Resume failed/partial extraction without re-upload — keeps OCR/vision page work, re-runs LLM + Qdrant',
  })
  async continueExtraction(@Param('id') id: string, @Request() req) {
    return this.knowledgeDocumentsService.continueDocumentExtraction(id, req.user.id);
  }

  @Get(':id/download')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Download uploaded PDF' })
  async download(@Param('id') id: string, @Res() res: any) {
    const doc = await this.knowledgeDocumentsService.findOne(id);

    if (!doc.filePath) {
      throw new HttpException('File path missing', HttpStatus.NOT_FOUND);
    }

    return res.download(doc.filePath, doc.originalName || doc.fileName, (err: any) => {
      if (err) {
        throw new HttpException('Failed to download file', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Get document details + resume' })
  async details(@Param('id') id: string) {
    const doc = await this.knowledgeDocumentsService.findOne(id);
    const stats = await this.knowledgeDocumentsService.getExtractionStats(id);

    const message =
      doc.status === 'failed'
        ? `Extraction failed${doc.error ? `: ${doc.error}` : ''}`
        : doc.status === 'rejected'
          ? `Upload rejected${doc.error ? `: ${doc.error}` : ''}`
          : doc.status === 'needs_review'
            ? 'Document needs admin review before trusting extracted results.'
            : doc.status === 'gated'
              ? 'Document passed relevance gate.'
              : doc.status === 'partially_indexed'
                ? `Extraction done, but indexing had issues${doc.error ? `: ${doc.error}` : ''}`
        : doc.status === 'processing'
          ? 'Extraction is running...'
          : doc.status === 'done'
            ? doc.error
              ? `Extraction done, but indexing had issues: ${doc.error}`
              : 'Extraction done.'
            : 'Extraction started.';

    return {
      document: doc,
      resume: {
        extractedCandidates: stats.extractedCandidates,
        approvedCandidates: stats.approvedCandidates,
        rejectedCandidates: stats.rejectedCandidates,
        chunksIndexed: doc.chunksIndexed ?? 0,
        docType: doc.docType ?? null,
        isWorkRelated: doc.isWorkRelated,
        gateConfidence: doc.gateConfidence ?? null,
        needsReview: doc.needsReview ?? false,
        message,
      },
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete a PDF document' })
  async remove(@Param('id') id: string, @Request() req) {
    await this.knowledgeDocumentsService.deleteDocument(id, req.user.id);
    return { ok: true };
  }
}
