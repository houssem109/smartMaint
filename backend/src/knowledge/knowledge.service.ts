import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeEntry)
    private readonly knowledgeRepository: Repository<KnowledgeEntry>,
  ) {}

  async create(dto: CreateKnowledgeEntryDto, userId: string): Promise<KnowledgeEntry> {
    const entry = this.knowledgeRepository.create({
      ...dto,
      createdById: userId,
    });
    return this.knowledgeRepository.save(entry);
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['createdBy'],
    });
  }

  async findOne(id: string): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async update(
    id: string,
    dto: UpdateKnowledgeEntryDto,
    userId: string,
    role: UserRole,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);

    if (role === UserRole.TECHNICIAN && entry.createdById !== userId) {
      throw new ForbiddenException('You can only update your own knowledge entries');
    }

    Object.assign(entry, dto);
    return this.knowledgeRepository.save(entry);
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const entry = await this.findOne(id);

    if (role === UserRole.TECHNICIAN && entry.createdById !== userId) {
      throw new ForbiddenException('You can only delete your own knowledge entries');
    }

    await this.knowledgeRepository.delete(id);
  }
}

