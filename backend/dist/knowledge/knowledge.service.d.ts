import { Repository } from 'typeorm';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { UserRole } from '../users/entities/user.entity';
import { RagService } from '../ai/rag.service';
import { AiService } from '../ai/ai.service';
import { AuditLog } from '../common/entities/audit-log.entity';
export declare class KnowledgeService {
    private readonly knowledgeRepository;
    private readonly auditLogRepository;
    private readonly ragService;
    private readonly aiService;
    private readonly logger;
    constructor(knowledgeRepository: Repository<KnowledgeEntry>, auditLogRepository: Repository<AuditLog>, ragService: RagService, aiService: AiService);
    buildIndexText(entry: KnowledgeEntry): string;
    private indexEntryIfApproved;
    create(dto: CreateKnowledgeEntryDto, userId: string, role: UserRole, options?: {
        skipAutoIndex?: boolean;
    }): Promise<KnowledgeEntry>;
    findAllForRole(userId: string, role: UserRole): Promise<KnowledgeEntry[]>;
    findAll(): Promise<KnowledgeEntry[]>;
    listPendingReview(): Promise<KnowledgeEntry[]>;
    countPendingReview(): Promise<number>;
    searchRelevantEntries(query: string, limit?: number): Promise<KnowledgeEntry[]>;
    findOne(id: string): Promise<KnowledgeEntry>;
    findOneForUser(id: string, userId: string, role: UserRole): Promise<KnowledgeEntry>;
    update(id: string, dto: UpdateKnowledgeEntryDto, userId: string, role: UserRole): Promise<KnowledgeEntry>;
    remove(id: string, userId: string, role: UserRole): Promise<void>;
    approveKnowledgeEntry(id: string, adminId: string): Promise<KnowledgeEntry>;
    rejectKnowledgeEntry(id: string, adminId: string, reason?: string | null): Promise<KnowledgeEntry>;
    setPhotoPath(entryId: string, relativePath: string, userId: string, role: UserRole): Promise<KnowledgeEntry>;
    private describeFieldPhotoForEntry;
    exportCsvForUser(userId: string, role: UserRole): Promise<string>;
    exportXlsxForUser(userId: string, role: UserRole): Promise<Buffer>;
}
