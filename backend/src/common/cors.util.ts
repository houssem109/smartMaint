const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

const LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

/**
 * Parse FRONTEND_URL for CORS / Socket.IO.
 * Supports comma-separated origins, e.g.
 *   http://localhost:3000,http://192.168.1.50:3000
 */
export function parseCorsOrigins(raw?: string): string | string[] {
  const value = raw?.trim() || DEFAULT_FRONTEND_ORIGIN;
  const origins = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (origins.length === 0) return DEFAULT_FRONTEND_ORIGIN;
  return origins.length === 1 ? origins[0] : origins;
}

/** In development, also allow any LAN/private IP origin (phone IP may change). */
export function isDevLanOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'development') return false;
  return LAN_ORIGIN.test(origin);
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = parseCorsOrigins(process.env.FRONTEND_URL);
  const list = Array.isArray(allowed) ? allowed : [allowed];

  if (!origin || list.includes(origin) || isDevLanOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} not allowed by CORS`));
}
