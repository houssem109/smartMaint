import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { createReadStream, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { RejectKnowledgeEntryDto } from './dto/review-knowledge-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ensureKnowledgePhotoUploadDir, getKnowledgePhotoUploadDir } from './knowledge-photo.config';

@ApiTags('Knowledge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN, UserRole.WORKER)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('pending-review/count')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Count knowledge entries awaiting admin approval' })
  pendingReviewCount() {
    return this.knowledgeService.countPendingReview().then((count) => ({ count }));
  }

  @Get('pending-review')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List knowledge entries awaiting admin approval' })
  listPendingReview() {
    return this.knowledgeService.listPendingReview();
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export knowledge entries as CSV (technicians: own rows only)' })
  async exportCsv(@Request() req, @Res() res: Response) {
    const csv = await this.knowledgeService.exportCsvForUser(req.user.id, req.user.role);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="knowledge-entries.csv"');
    return res.send(csv);
  }

  @Get('export/xlsx')
  @ApiOperation({ summary: 'Export knowledge entries as Excel (technicians: own rows only)' })
  async exportXlsx(@Request() req, @Res() res: Response) {
    const buf = await this.knowledgeService.exportXlsxForUser(req.user.id, req.user.role);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="knowledge-entries.xlsx"');
    return res.send(buf);
  }

  @Post()
  @ApiOperation({ summary: 'Create a knowledge entry (technicians submit for review)' })
  create(@Body() dto: CreateKnowledgeEntryDto, @Request() req) {
    return this.knowledgeService.create(dto, req.user.id, req.user.role);
  }

  @Get()
  @ApiOperation({ summary: 'List knowledge entries (technicians: own entries only)' })
  findAll(@Request() req) {
    return this.knowledgeService.findAllForRole(req.user.id, req.user.role);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Approve a pending technician knowledge entry and index to RAG' })
  approve(@Param('id') id: string, @Request() req) {
    return this.knowledgeService.approveKnowledgeEntry(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject a pending technician knowledge entry' })
  reject(@Param('id') id: string, @Body() body: RejectKnowledgeEntryDto, @Request() req) {
    return this.knowledgeService.rejectKnowledgeEntry(id, req.user.id, body.reason);
  }

  @Post(':id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Attach a field photo to a knowledge entry (JPEG/PNG/WebP)' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
        cb(ok ? null : new BadRequestException('Only JPEG, PNG, or WebP images are allowed'), ok);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, ensureKnowledgePhotoUploadDir());
        },
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname).toLowerCase() || '.jpg'}`);
        },
      }),
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req,
  ) {
    if (!file?.filename) throw new BadRequestException('file is required');
    const rel = join(getKnowledgePhotoUploadDir(), file.filename).replace(/\\/g, '/');
    return this.knowledgeService.setPhotoPath(id, rel, req.user.id, req.user.role);
  }

  @Get(':id/photo-file')
  @ApiOperation({ summary: 'Download field photo for a knowledge entry' })
  async photoFile(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const entry = await this.knowledgeService.findOneForUser(id, req.user.id, req.user.role);
    if (!entry.photoPath?.trim()) throw new BadRequestException('No photo on this entry');
    const root = resolve(join(process.cwd(), getKnowledgePhotoUploadDir()));
    const abs = resolve(join(process.cwd(), entry.photoPath));
    if (!abs.startsWith(root)) {
      throw new ForbiddenException('Invalid photo path');
    }
    if (!existsSync(abs)) throw new BadRequestException('Photo file missing');
    return res.sendFile(abs);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single knowledge entry' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.knowledgeService.findOneForUser(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a knowledge entry' })
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeEntryDto, @Request() req) {
    return this.knowledgeService.update(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a knowledge entry' })
  remove(@Param('id') id: string, @Request() req) {
    return this.knowledgeService.remove(id, req.user.id, req.user.role);
  }
}
