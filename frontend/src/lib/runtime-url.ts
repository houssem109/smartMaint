const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function backendPort(): string {
  return process.env.NEXT_PUBLIC_BACKEND_PORT?.trim() || '3001';
}

/**
 * API base URL for HTTP requests.
 * - Browser: empty string → axios uses `/api` (same origin, proxied by Next.js — no CORS).
 * - Server: INTERNAL_API_URL or NEXT_PUBLIC_API_URL.
 */
export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }

  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/$/, '');

  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return `http://localhost:${backendPort()}`;
}

/** Path prefix for API calls (always works in browser). */
export function getApiBasePath(): string {
  const base = resolveApiBaseUrl();
  return base ? `${base}/api` : '/api';
}

/** Label shown in UI for connection diagnostics. */
export function getApiDisplayLabel(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return getApiBasePath();
}

/** WebSockets must connect directly to the backend port (not proxied). */
export function resolveWsBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (!LOCAL_HOSTS.has(hostname)) {
      const scheme = protocol === 'https:' ? 'wss' : 'ws';
      return `${scheme}://${hostname}:${backendPort()}`;
    }
  }

  const base = process.env.NEXT_PUBLIC_API_URL?.trim() || `http://localhost:${backendPort()}`;
  return base.replace(/^http/, 'ws');
}

/** Direct backend URL for Socket.IO on LAN (bypasses Next proxy). */
export function resolveDirectBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (!LOCAL_HOSTS.has(hostname)) {
      const scheme = protocol === 'https:' ? 'https' : 'http';
      return `${scheme}://${hostname}:${backendPort()}`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL?.trim() || `http://localhost:${backendPort()}`;
}

/** URL encoded in the admin QR code for worker phones. */
export function resolveMobileAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MOBILE_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location;
    if (!LOCAL_HOSTS.has(hostname)) return origin;
  }

  return '';
}

export function getApiUrl(): string {
  return resolveApiBaseUrl();
}
