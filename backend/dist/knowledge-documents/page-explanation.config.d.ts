export declare function isPdfPageExplanationBeforeIndexEnabled(): boolean;
export declare function getPdfPageExplanationMaxPages(): number;
export declare function getPdfPageExplanationMode(): 'full' | 'concise' | 'transcribe';
export declare function buildSchematicVisionPromptSuffix(): string;
export declare function buildPageExplanationVisionPrompt(langLabel: string, usesDisplayFont: boolean, opts?: {
    schematicPage?: boolean;
}): string;
export declare function isFieldPhotoVisionEnabled(): boolean;
export declare function buildFieldPhotoVisionPrompt(machineName: string | null, title: string): string;
