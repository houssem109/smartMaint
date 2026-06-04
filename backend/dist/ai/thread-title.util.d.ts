export declare function stripThreadTitleSource(content: string): string;
export declare function isGenericThreadTitle(title: string | undefined | null): boolean;
export declare function sanitizeThreadTitle(title: string, maxLen?: number): string;
export declare function deriveThreadTitleHeuristic(turns: {
    role: string;
    content: string;
}[]): string | null;
export declare function buildThreadTitleLlmPrompt(turns: {
    role: string;
    content: string;
}[]): string;
export declare function parseThreadTitleLlmJson(raw: string): string | null;
export declare function isThreadTitleLlmEnabled(): boolean;
