import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
export declare class KnowledgeController {
    private readonly knowledgeService;
    constructor(knowledgeService: KnowledgeService);
    create(dto: CreateKnowledgeEntryDto, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    findAll(): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry[]>;
    findOne(id: string): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    update(id: string, dto: UpdateKnowledgeEntryDto, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    remove(id: string, req: any): Promise<void>;
}
