import { Repository } from 'typeorm';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { UserRole } from '../users/entities/user.entity';
export declare class KnowledgeService {
    private readonly knowledgeRepository;
    constructor(knowledgeRepository: Repository<KnowledgeEntry>);
    create(dto: CreateKnowledgeEntryDto, userId: string): Promise<KnowledgeEntry>;
    findAll(): Promise<KnowledgeEntry[]>;
    findOne(id: string): Promise<KnowledgeEntry>;
    update(id: string, dto: UpdateKnowledgeEntryDto, userId: string, role: UserRole): Promise<KnowledgeEntry>;
    remove(id: string, userId: string, role: UserRole): Promise<void>;
}
