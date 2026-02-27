import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TicketStatus } from './entities/ticket.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';
import { Response } from 'express';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  create(@Body() createTicketDto: CreateTicketDto, @Request() req) {
    return this.ticketsService.create(createTicketDto, req.user.id);
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: 'uploads/tickets',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Upload attachments for a ticket' })
  @ApiConsumes('multipart/form-data')
  uploadAttachments(
    @Param('id') ticketId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.ticketsService.addAttachments(ticketId, files, req.user.id, req.user.role);
  }

  @Get('attachments/:attachmentId')
  @ApiOperation({ summary: 'Download ticket attachment' })
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
    );
    return res.sendFile(attachment.filePath, { root: process.cwd() });
  }

  @Get()
  @ApiOperation({ summary: 'Get all tickets (filtered by role)' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  findAll(
    @Request() req,
    @Query('status') status?: TicketStatus,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.ticketsService.findAll(req.user.id, req.user.role, {
      status,
      category,
      priority,
      assignedToId,
    });
  }

  @Get('history')
  @ApiOperation({ summary: 'Get ticket history (latest changes)' })
  @ApiQuery({ name: 'ticketId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async history(
    @Query('ticketId') ticketId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) || 50 : 50;
    return this.ticketsService.getHistory(ticketId, take);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notifications for current user (worker/technician)' })
  async notifications(@Request() req, @Query('limit') limit?: string) {
    const take = limit ? Number(limit) || 50 : 50;
    return this.ticketsService.getNotificationsForUser(req.user.id, req.user.role, take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.ticketsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket' })
  update(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req,
  ) {
    return this.ticketsService.update(id, updateTicketDto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ticket (Admin or ticket creator)' })
  remove(@Param('id') id: string, @Request() req) {
    return this.ticketsService.remove(id, req.user.id, req.user.role);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Restore a previously deleted ticket (Admin/Superadmin only)' })
  restore(@Param('id') id: string, @Request() req) {
    return this.ticketsService.restore(id, req.user.id, req.user.role);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Assign ticket to technician' })
  assignTicket(
    @Param('id') ticketId: string,
    @Body('technicianId') technicianId: string,
    @Request() req,
  ) {
    return this.ticketsService.assignTicket(
      ticketId,
      technicianId,
      req.user.id,
      req.user.role,
    );
  }
}
