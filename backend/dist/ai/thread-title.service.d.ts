import { deriveThreadTitleHeuristic, isGenericThreadTitle, sanitizeThreadTitle, stripThreadTitleSource } from './thread-title.util';
export { deriveThreadTitleHeuristic, isGenericThreadTitle, sanitizeThreadTitle, stripThreadTitleSource, };
export declare function suggestThreadTitle(chatFn: (messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
}[]) => Promise<string>, turns: {
    role: string;
    content: string;
}[]): Promise<string | null>;
