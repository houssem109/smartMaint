import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SmartMaint AI',
    short_name: 'SmartMaint',
    description: 'Maintenance tickets, knowledge base, and Techo assistant',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'fullscreen'],
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#1E40AF',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
