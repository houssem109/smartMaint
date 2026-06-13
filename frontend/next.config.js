/** @type {import('next').NextConfig} */
const internalApi = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/$/, '');

/** Next.js 15+ blocks /_next/* from non-localhost unless listed here (breaks all taps on phone). */
function getAllowedDevOrigins() {
  const origins = new Set(['localhost', '127.0.0.1', 'localhost:3000', '127.0.0.1:3000']);

  const addUrl = (raw) => {
    const value = raw?.trim();
    if (!value) return;
    try {
      const { host, hostname } = new URL(value);
      origins.add(host);
      origins.add(hostname);
    } catch {
      origins.add(value);
    }
  };

  for (const entry of (process.env.ALLOWED_DEV_ORIGINS || '').split(',')) {
    addUrl(entry);
  }

  for (const source of [process.env.FRONTEND_URL, process.env.NEXT_PUBLIC_MOBILE_APP_URL]) {
    if (!source) continue;
    for (const part of source.split(',')) {
      addUrl(part);
    }
  }

  return [...origins];
}

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: getAllowedDevOrigins(),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApi}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
