import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Serenboard',
    short_name: 'Serenboard',
    description: 'Organiza tus proyectos con paz y fluidez.',
    start_url: '/board',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0620',
    theme_color: '#0b0620',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
