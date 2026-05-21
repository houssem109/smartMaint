import { StreamableFile } from '@nestjs/common';
import { Repository } from 'typeorm';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { MachineProfile } from '../machine-profiles/entities/machine-profile.entity';
export type ProblemsSolutionsExportQuery = {
    format?: 'xlsx' | 'csv';
    machine?: string;
    documentId?: string;
    severity?: string;
    from?: string;
    to?: string;
};
export type ProblemsSolutionsPreviewQuery = ProblemsSolutionsExportQuery & {
    limit?: string | number;
};
export declare class KnowledgeExportService {
    private readonly knowledgeEntryRepository;
    private readonly knowledgeDocumentRepository;
    private readonly machineProfileRepository;
    constructor(knowledgeEntryRepository: Repository<KnowledgeEntry>, knowledgeDocumentRepository: Repository<KnowledgeDocument>, machineProfileRepository: Repository<MachineProfile>);
    getProblemsSolutionsExportReference(): {
        checkedAt: string;
        responsibility: string;
        dataSource: string;
        reviewFilter: string;
        queryParams: {
            name: string;
            type: string;
            notes: string;
        }[];
        columns: string[];
        adminUi: string;
        notes: string[];
    };
    private dispositionFilename;
    private buildFilename;
    exportProblemsSolutions(query: ProblemsSolutionsExportQuery): Promise<StreamableFile>;
    previewProblemsSolutions(query: ProblemsSolutionsPreviewQuery): Promise<{
        count: number;
        rows: Array<{
            id: string;
            title: string;
            problemDescription: string;
            solution: string;
            machineName: string;
            severity: string;
            sourceDocument: string;
            manufacturer: string;
            createdAt: string;
            knowledgeDocumentId: string | null;
        }>;
    }>;
}
