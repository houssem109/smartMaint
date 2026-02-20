export declare enum ActionType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    APPROVE = "approve",
    REJECT = "reject",
    ROLLBACK = "rollback"
}
export declare class AuditLog {
    id: string;
    actionType: ActionType;
    entityId: string;
    entityType: string;
    userId: string;
    changes: Record<string, any>;
    reason: string;
    timestamp: Date;
}
