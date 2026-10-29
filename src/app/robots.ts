import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/board', '/admin/', '/invite/', '/login'] },
    sitemap: `${base.origin}/sitemap.xml`,
  }
}
