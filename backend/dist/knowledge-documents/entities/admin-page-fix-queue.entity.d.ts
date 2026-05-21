export declare class AdminPageFixQueueItem {
    id: string;
    documentId: string;
    pageNumber: number;
    status: 'open' | 'fixed' | 'dismissed';
    reason: string | null;
    adminFixedText: string | null;
    replacementImagePath: string | null;
    fixedByAdminId: string | null;
    fixedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
