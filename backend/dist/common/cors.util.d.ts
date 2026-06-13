export declare function parseCorsOrigins(raw?: string): string | string[];
export declare function isDevLanOrigin(origin?: string): boolean;
export declare function corsOriginCallback(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void;
