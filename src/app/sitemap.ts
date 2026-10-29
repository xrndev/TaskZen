import type { MetadataRoute } from 'next'
import { PUBLIC_PATHS, siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return PUBLIC_PATHS.map((p) => ({
    url: new URL(p, base).toString(),
    changeFrequency: p === '/' || p === '/precios' ? 'weekly' : 'monthly',
    priority: p === '/' ? 1 : p === '/precios' ? 0.8 : 0.4,
  }))
}
