import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { AuditLog, ActionType } from '../common/entities/audit-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(createUserDto: Partial<User>): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: createUserDto.email }, { username: createUserDto.username }],
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    const user = this.usersRepository.create(createUserDto);
    const saved = await this.usersRepository.save(user);

    await this.logUserAction(saved.id, ActionType.CREATE, null, {
      email: saved.email,
      role: saved.role,
      isActive: saved.isActive,
    });

    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'username', 'email', 'role', 'fullName', 'phoneNumber', 'isActive', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const before = await this.findOne(id);
    await this.usersRepository.update(id, updateData);
    const updated = await this.findOne(id);

    const changes: Record<string, any> = {};
    if (updateData.fullName && updateData.fullName !== before.fullName) {
      changes.fullName = { from: before.fullName, to: updateData.fullName };
    }
    if (updateData.username && updateData.username !== before.username) {
      changes.username = { from: before.username, to: updateData.username };
    }
    if (typeof updateData.isActive !== 'undefined' && updateData.isActive !== before.isActive) {
      changes.isActive = { from: before.isActive, to: updateData.isActive };
    }
    if (updateData.role && updateData.role !== before.role) {
      changes.role = { from: before.role, to: updateData.role };
    }

    if (Object.keys(changes).length > 0) {
      await this.logUserAction(id, ActionType.UPDATE, null, changes);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.delete(id);

    await this.logUserAction(id, ActionType.DELETE, null, {
      deletedSnapshot: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
      },
    });
  }

  async findTechnicians(): Promise<User[]> {
    return this.usersRepository.find({
      where: { role: UserRole.TECHNICIAN, isActive: true },
      select: ['id', 'username', 'email', 'fullName'],
    });
  }

  async restore(id: string, currentUserRole: UserRole): Promise<User> {
    if (currentUserRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Only superadmin can restore users');
    }

    const existing = await this.usersRepository.findOne({ where: { id } });
    if (existing) {
      return existing;
    }

    const log = await this.auditLogRepository.findOne({
      where: { entityId: id, entityType: 'user', actionType: ActionType.DELETE },
      order: { timestamp: 'DESC' },
    });

    const snapshot = log?.changes?.deletedSnapshot as Partial<User> | undefined;
    if (!snapshot) {
      throw new NotFoundException('No restore information found for this user');
    }

    const restored = this.usersRepository.create(snapshot);
    const saved = await this.usersRepository.save(restored);

    await this.logUserAction(id, ActionType.ROLLBACK, null, {
      restoredFromDelete: true,
    });

    return saved;
  }

  private async logUserAction(
    userId: string,
    actionType: ActionType,
    actorUserId: string | null,
    changes?: Record<string, any>,
  ): Promise<void> {
    const log = this.auditLogRepository.create({
      actionType,
      entityId: userId,
      entityType: 'user',
      userId: actorUserId,
      changes: changes ?? null,
      reason: null,
    });
    await this.auditLogRepository.save(log);
  }
}
