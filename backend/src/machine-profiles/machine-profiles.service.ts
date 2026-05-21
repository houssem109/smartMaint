import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { MachineProfile } from './entities/machine-profile.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';

export type FindOrCreateMachineProfileInput = {
  machineName: string;
  manufacturer?: string | null;
  family?: string | null;
  modelNumber?: string | null;
  components?: string | string[] | null;
};

@Injectable()
export class MachineProfilesService {
  constructor(
    @InjectRepository(MachineProfile)
    private readonly machineProfilesRepository: Repository<MachineProfile>,
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocumentsRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeEntry)
    private readonly knowledgeEntriesRepository: Repository<KnowledgeEntry>,
  ) {}

  async findAll(): Promise<MachineProfile[]> {
    return this.machineProfilesRepository.find({ order: { updatedAt: 'DESC' } });
  }

  async findOne(id: string): Promise<MachineProfile> {
    const row = await this.machineProfilesRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Machine profile not found');
    return row;
  }

  async getAdminProfileSummary(id: string): Promise<{
    profile: MachineProfile;
    pdfDocumentCount: number;
    knowledgeEntriesApproxCount: number;
    knowledgeEntriesWithPhotoApproxCount: number;
  }> {
    const profile = await this.findOne(id);
    const pdfDocumentCount = await this.knowledgeDocumentsRepository.count({
      where: { machineProfileId: id, status: Not('superseded') },
    });
    const nameNorm = profile.machineName?.trim().toLowerCase() || '';

    let knowledgeEntriesApproxCount = 0;
    let knowledgeEntriesWithPhotoApproxCount = 0;
    if (nameNorm) {
      knowledgeEntriesApproxCount = await this.knowledgeEntriesRepository
        .createQueryBuilder('k')
        .where('LOWER(TRIM(COALESCE(k.machineName, :empty))) = :name', {
          name: nameNorm,
          empty: '',
        })
        .getCount();

      knowledgeEntriesWithPhotoApproxCount = await this.knowledgeEntriesRepository
        .createQueryBuilder('k')
        .where('LOWER(TRIM(COALESCE(k.machineName, :empty))) = :name', {
          name: nameNorm,
          empty: '',
        })
        .andWhere('k.photoPath IS NOT NULL')
        .andWhere("TRIM(k.photoPath) <> ''")
        .getCount();
    }

    return {
      profile,
      pdfDocumentCount,
      knowledgeEntriesApproxCount,
      knowledgeEntriesWithPhotoApproxCount,
    };
  }

  async findOrCreate(input: FindOrCreateMachineProfileInput): Promise<MachineProfile> {
    const name = String(input.machineName ?? '').trim();
    if (!name) {
      throw new NotFoundException('Machine name is required');
    }
    const manufacturer = input.manufacturer?.trim() || null;

    const qb = this.machineProfilesRepository
      .createQueryBuilder('m')
      .where('LOWER(TRIM(m.machineName)) = LOWER(TRIM(:name))', { name });
    if (manufacturer) {
      qb.andWhere('LOWER(TRIM(COALESCE(m.manufacturer, :empty))) = LOWER(TRIM(:mf))', {
        mf: manufacturer,
        empty: '',
      });
    } else {
      qb.andWhere('m.manufacturer IS NULL');
    }

    const existing = await qb.getOne();
    if (existing) {
      let dirty = false;
      if (input.family != null && input.family !== existing.family) {
        existing.family = input.family;
        dirty = true;
      }
      if (input.modelNumber != null && input.modelNumber !== existing.modelNumber) {
        existing.modelNumber = input.modelNumber;
        dirty = true;
      }
      if (input.components != null) {
        const next =
          Array.isArray(input.components)
            ? input.components.map((c) => String(c).trim()).filter(Boolean).join(', ')
            : String(input.components).trim() || null;
        if (next !== existing.components) {
          existing.components = next;
          dirty = true;
        }
      }
      if (dirty) return this.machineProfilesRepository.save(existing);
      return existing;
    }

    const componentsStr =
      input.components == null
        ? null
        : Array.isArray(input.components)
          ? input.components.map((c) => String(c).trim()).filter(Boolean).join(', ')
          : String(input.components).trim() || null;

    const created = this.machineProfilesRepository.create({
      machineName: name,
      manufacturer,
      family: input.family?.trim() || null,
      modelNumber: input.modelNumber?.trim() || null,
      components: componentsStr,
    });
    return this.machineProfilesRepository.save(created);
  }

  async createManual(input: {
    machineName: string;
    manufacturer?: string | null;
    family?: string | null;
    modelNumber?: string | null;
    components?: string | null;
  }): Promise<MachineProfile> {
    const name = String(input.machineName ?? '').trim();
    if (!name) throw new BadRequestException('Machine name is required');
    const manufacturer = input.manufacturer?.trim() || null;

    const dup = await this.machineProfilesRepository
      .createQueryBuilder('m')
      .where('LOWER(TRIM(m.machineName)) = LOWER(TRIM(:name))', { name })
      .andWhere(
        manufacturer
          ? 'LOWER(TRIM(COALESCE(m.manufacturer, :empty))) = LOWER(TRIM(:mf))'
          : 'm.manufacturer IS NULL',
        manufacturer ? { mf: manufacturer, empty: '' } : {},
      )
      .getOne();
    if (dup) {
      throw new ConflictException('A profile with this machine name and manufacturer already exists');
    }

    const row = this.machineProfilesRepository.create({
      machineName: name,
      manufacturer,
      family: input.family?.trim() || null,
      modelNumber: input.modelNumber?.trim() || null,
      components: input.components?.trim() || null,
    });
    return this.machineProfilesRepository.save(row);
  }

  async updateManual(
    id: string,
    patch: {
      machineName?: string;
      manufacturer?: string | null;
      family?: string | null;
      modelNumber?: string | null;
      components?: string | null;
    },
  ): Promise<MachineProfile> {
    const row = await this.findOne(id);
    if (patch.machineName != null) {
      const t = String(patch.machineName).trim();
      if (!t) throw new ConflictException('machineName cannot be empty');
      row.machineName = t;
    }
    if (patch.manufacturer !== undefined) {
      row.manufacturer = patch.manufacturer?.trim() || null;
    }
    if (patch.family !== undefined) row.family = patch.family?.trim() || null;
    if (patch.modelNumber !== undefined) row.modelNumber = patch.modelNumber?.trim() || null;
    if (patch.components !== undefined) row.components = patch.components?.trim() || null;
    return this.machineProfilesRepository.save(row);
  }
}
