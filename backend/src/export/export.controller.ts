import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  KnowledgeExportService,
  ProblemsSolutionsExportQuery,
  ProblemsSolutionsPreviewQuery,
} from './knowledge-export.service';
import { TicketExportService, TicketsExportQuery } from './ticket-export.service';

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(
    private readonly knowledgeExportService: KnowledgeExportService,
    private readonly ticketExportService: TicketExportService,
  ) {}

  @Get('problems-solutions-reference')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Section 23 read-only: problems/solutions export filters, columns, notes' })
  problemsSolutionsReference() {
    return this.knowledgeExportService.getProblemsSolutionsExportReference();
  }

  @Get('problems-solutions')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Export approved knowledge entries as CSV or Excel' })
  problemsSolutions(@Query() query: ProblemsSolutionsExportQuery) {
    return this.knowledgeExportService.exportProblemsSolutions(query);
  }

  @Get('problems-solutions-preview')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Preview exported problems/solutions rows in admin UI' })
  problemsSolutionsPreview(@Query() query: ProblemsSolutionsPreviewQuery) {
    return this.knowledgeExportService.previewProblemsSolutions(query);
  }

  @Get('tickets')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Export tickets as CSV or Excel (filter by creation period)' })
  tickets(@Query() query: TicketsExportQuery) {
    return this.ticketExportService.exportTickets(query);
  }
}
