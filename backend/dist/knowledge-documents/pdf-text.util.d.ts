export declare function parsePdfWithPoppler(buffer: Buffer): Promise<{
    text: string;
    numpages: number;
    pages: string[];
}>;
