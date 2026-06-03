export type CsvRow = Record<string, string>;
export declare function parseSemicolonCsv(filePath: string): CsvRow[];
export declare function resolveOrderDataDir(): string;
export declare function splitCsvList(value: string): string[];
