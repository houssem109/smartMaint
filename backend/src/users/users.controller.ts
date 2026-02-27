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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { EmailService } from '../common/services/email.service';
import * as bcrypt from 'bcrypt';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create new user (Admin/Superadmin only)' })
  async create(@Request() req, @Body() createUserDto: CreateUserDto) {
    // No one can create additional superadmin accounts via API
    if (createUserDto.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Creating superadmin users is not allowed');
    }

    // Normal admin cannot create admin accounts (only technicians/workers)
    if (
      req.user.role === UserRole.ADMIN &&
      createUserDto.role === UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only superadmin can create admin users');
    }
    // Store plain password before hashing for email
    const plainPassword = createUserDto.password;
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
      isActive: true, // Ensure new users are active by default
    });
    
    // Send welcome email with credentials (non-blocking)
    this.emailService.sendWelcomeEmail(
      createUserDto.email,
      plainPassword, // Send plain password
      createUserDto.fullName,
      createUserDto.username,
    ).catch((error) => {
      // Log error but don't fail user creation
      console.error('Failed to send welcome email:', error);
    });
    
    return user;
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all users (Admin/Superadmin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('technicians')
  @ApiOperation({ summary: 'Get all technicians' })
  findTechnicians() {
    return this.usersService.findTechnicians();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile (email cannot be changed)' })
  async updateMe(
    @Request() req,
    @Body() body: { fullName?: string; username?: string; phoneNumber?: string; password?: string },
  ) {
    const updateData: Record<string, unknown> = {};
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }
    return this.usersService.update(req.user.id, updateData);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update user (Admin/Superadmin only; admin cannot edit other admins)' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    const target = await this.usersService.findOne(id);

    // Prevent changing anyone into a superadmin (only the seeded superadmin should exist)
    if (updateData.role === UserRole.SUPERADMIN && target.email !== 'superadmin@smartmaint.com') {
      throw new ForbiddenException('Promoting users to superadmin is not allowed');
    }

    // Admin cannot edit admin or superadmin users; only superadmin can
    if (req.user.role === UserRole.ADMIN) {
      if (target.role === UserRole.ADMIN || target.role === UserRole.SUPERADMIN) {
        throw new ForbiddenException('Only superadmin can modify admin or superadmin users');
      }
    }
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    return this.usersService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete user (Admin/Superadmin only; admin cannot delete other admins)' })
  async remove(@Request() req, @Param('id') id: string) {
    if (req.user.role === UserRole.ADMIN) {
      const target = await this.usersService.findOne(id);
      if (target.role === UserRole.ADMIN || target.role === UserRole.SUPERADMIN) {
        throw new ForbiddenException('Only superadmin can delete admin or superadmin users');
      }
    }
    return this.usersService.remove(id);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Restore a previously deleted user (Superadmin only)' })
  async restore(@Param('id') id: string, @Request() req) {
    return this.usersService.restore(id, req.user.role);
  }
}
