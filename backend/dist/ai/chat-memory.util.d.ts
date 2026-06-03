export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}
export declare function getChatHistoryMaxTurns(): number;
export declare function mergeChatHistories(client: ChatTurn[], server: ChatTurn[]): ChatTurn[];
export declare function trimHistoryForModel(history: ChatTurn[], maxTurns?: number): ChatTurn[];
export declare function buildConversationMemorySummary(history: ChatTurn[]): string | null;
