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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Knowledge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new knowledge entry' })
  create(@Body() dto: CreateKnowledgeEntryDto, @Request() req) {
    return this.knowledgeService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all knowledge entries' })
  findAll() {
    return this.knowledgeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single knowledge entry' })
  findOne(@Param('id') id: string) {
    return this.knowledgeService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a knowledge entry' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeEntryDto,
    @Request() req,
  ) {
    return this.knowledgeService.update(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a knowledge entry' })
  remove(@Param('id') id: string, @Request() req) {
    return this.knowledgeService.remove(id, req.user.id, req.user.role);
  }
}

