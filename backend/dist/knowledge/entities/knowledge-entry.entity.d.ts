import { User } from '../../users/entities/user.entity';
export declare class KnowledgeEntry {
    id: string;
    title: string;
    problemDescription: string;
    solution: string;
    tags: string | null;
    createdById: string;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}
