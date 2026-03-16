
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PicClick Booth',
    short_name: 'PicClick',
    description: 'A web-based photobooth application for events.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f9fa',
    theme_color: '#ff6bb5',
    icons: [
      {
        src: 'https://picsum.photos/seed/pwa-1/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/pwa-2/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
