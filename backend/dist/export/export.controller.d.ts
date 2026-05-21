import { KnowledgeExportService, ProblemsSolutionsExportQuery, ProblemsSolutionsPreviewQuery } from './knowledge-export.service';
import { TicketExportService, TicketsExportQuery } from './ticket-export.service';
export declare class ExportController {
    private readonly knowledgeExportService;
    private readonly ticketExportService;
    constructor(knowledgeExportService: KnowledgeExportService, ticketExportService: TicketExportService);
    problemsSolutionsReference(): {
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
    problemsSolutions(query: ProblemsSolutionsExportQuery): Promise<import("@nestjs/common").StreamableFile>;
    problemsSolutionsPreview(query: ProblemsSolutionsPreviewQuery): Promise<{
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
    tickets(query: TicketsExportQuery): Promise<import("@nestjs/common").StreamableFile>;
}
