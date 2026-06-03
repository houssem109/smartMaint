export declare const CONV_WRAP_MARKER_RE: RegExp;
export declare function hasContinuingTaskIntent(message: string): boolean;
export declare function tagWrapReply(text: string): string;
export declare function stripWrapMarker(text: string): string;
export declare function isAwaitingMissionDoneConfirm(history?: {
    role: string;
    content: string;
}[]): boolean;
export declare function isConversationEndUserMessage(message: string): boolean;
export declare function isMissionCompleteConfirmation(message: string): boolean;
export declare function isMissionCompleteDeclined(message: string): boolean;
export declare function isUserRequestingConversationEnd(message: string): boolean;
export declare function buildMissionDoneQuestion(name: string | undefined, lang: 'en' | 'fr'): string;
export declare function buildFarewellReply(name: string | undefined, lang: 'en' | 'fr'): string;
export declare function buildMissionContinuesReply(lang: 'en' | 'fr'): string;
export declare function buildEndConversationConfirm(name: string | undefined, lang: 'en' | 'fr'): string;
export declare function appendMissionDonePrompt(reply: string, lang: 'en' | 'fr', name?: string): {
    reply: string;
    persistReply: string;
};
export declare function shouldProcessConversationWrap(message: string, history?: {
    role: string;
    content: string;
}[]): boolean;
