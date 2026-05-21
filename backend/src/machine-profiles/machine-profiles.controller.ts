import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MachineProfilesService } from './machine-profiles.service';
import { CreateMachineProfileDto, UpdateMachineProfileDto } from './dto/machine-profile-mutations.dto';

@ApiTags('Machine profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('machine-profiles')
export class MachineProfilesController {
  constructor(private readonly machineProfilesService: MachineProfilesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'List machine profiles' })
  findAll() {
    return this.machineProfilesService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create machine profile manually (admin)' })
  create(@Body() body: CreateMachineProfileDto) {
    return this.machineProfilesService.createManual(body);
  }

  @Get(':id/summary')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Profile + linked PDF count and approximate knowledge/photo counts (admin)' })
  adminSummary(@Param('id') id: string) {
    return this.machineProfilesService.getAdminProfileSummary(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update machine profile (admin)' })
  update(@Param('id') id: string, @Body() body: UpdateMachineProfileDto) {
    return this.machineProfilesService.updateManual(id, body);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Get machine profile by id' })
  findOne(@Param('id') id: string) {
    return this.machineProfilesService.findOne(id);
  }
}
