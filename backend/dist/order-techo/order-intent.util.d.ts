export declare function extractOrderNumberFromText(text: string): string | null;
export declare function isOrderIntentMessage(message: string, history?: {
    role: string;
    content: string;
}[]): boolean;
