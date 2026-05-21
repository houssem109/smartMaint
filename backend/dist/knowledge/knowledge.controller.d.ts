import type { Response } from 'express';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { RejectKnowledgeEntryDto } from './dto/review-knowledge-entry.dto';
export declare class KnowledgeController {
    private readonly knowledgeService;
    constructor(knowledgeService: KnowledgeService);
    pendingReviewCount(): Promise<{
        count: number;
    }>;
    listPendingReview(): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry[]>;
    exportCsv(req: any, res: Response): Promise<Response<any, Record<string, any>>>;
    exportXlsx(req: any, res: Response): Promise<Response<any, Record<string, any>>>;
    create(dto: CreateKnowledgeEntryDto, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    findAll(req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry[]>;
    approve(id: string, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    reject(id: string, body: RejectKnowledgeEntryDto, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    uploadPhoto(id: string, file: Express.Multer.File | undefined, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    photoFile(id: string, req: any, res: Response): Promise<void>;
    findOne(id: string, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    update(id: string, dto: UpdateKnowledgeEntryDto, req: any): Promise<import("./entities/knowledge-entry.entity").KnowledgeEntry>;
    remove(id: string, req: any): Promise<void>;
}
