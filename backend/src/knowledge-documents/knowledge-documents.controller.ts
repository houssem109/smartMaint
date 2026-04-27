import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Delete,
  Param,
  Patch,
  Post,
  Res,
  Request,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Express } from 'express';
import { IsOptional, IsString } from 'class-validator';
import {
  ApproveMachineNameSuggestionDto,
  RejectMachineNameSuggestionDto,
  SuggestMachineNameDto,
  UpdateMachineNameDto,
} from './dto/machine-name.dto';

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

@ApiTags('Knowledge Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-documents')
export class KnowledgeDocumentsController {
  constructor(private readonly knowledgeDocumentsService: KnowledgeDocumentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a PDF to the knowledge documents library' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const baseDir = 'uploads/knowledge-documents';
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
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    if (!file.mimetype.includes('pdf')) {
      throw new HttpException('Only PDF files are allowed', HttpStatus.BAD_REQUEST);
    }

    const doc = await this.knowledgeDocumentsService.createFromUpload({
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      uploadedById: req.user.id,
    });

    void this.knowledgeDocumentsService
      .processDocumentExtraction(doc.id)
      .catch(() => undefined);

    return {
      document: doc,
      resume: {
        extractedCandidates: 0,
        approvedCandidates: 0,
        rejectedCandidates: 0,
        chunksIndexed: 0,
        message: 'Extraction started. Please refresh the document details to see extracted candidates.',
      },
    };
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
    return this.knowledgeDocumentsService.approveExtractionCandidate(candidateId, req.user.id, body);
  }

  @Post('extractions/:candidateId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject an extracted candidate' })
  async rejectExtraction(
    @Param('candidateId') candidateId: string,
    @Request() req,
  ) {
    return this.knowledgeDocumentsService.rejectExtractionCandidate(candidateId, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'List uploaded knowledge documents' })
  async list() {
    return this.knowledgeDocumentsService.findAll();
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
