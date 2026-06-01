export declare function isLowValueChunkText(text: string): boolean;
export declare function countAlphanumeric(text: string): number;
export declare function chunkQualityFlags(text: string): {
    alnumCount: number;
    charCount: number;
    alnumRatio: number;
    mostlyDots: boolean;
    embedWorthy: boolean;
};
