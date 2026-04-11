
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PhotoBooth',
    short_name: 'PhotoBooth',
    description: 'A web-based photobooth application for events.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f9fa',
    theme_color: '#ff6bb5',
    icons: [
      {
        src: '/heart_no_background.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/heart_no_background.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
