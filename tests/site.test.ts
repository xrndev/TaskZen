import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { PUBLIC_PATHS, siteUrl } from '@/lib/site'

describe('SEO: dirección pública, robots y sitemap', () => {
  it('toma la dirección de BETTER_AUTH_URL y cae a localhost si falta o es inválida', () => {
    expect(siteUrl({ BETTER_AUTH_URL: 'https://serenboard.com' }).origin).toBe('https://serenboard.com')
    expect(siteUrl({}).origin).toBe('http://localhost:3000')
    expect(siteUrl({ BETTER_AUTH_URL: 'no es una url' }).origin).toBe('http://localhost:3000')
  })

  it('el sitemap lista solo páginas públicas, con URL absoluta', () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname)
    expect(urls).toEqual([...PUBLIC_PATHS])
    for (const privada of ['/board', '/login', '/admin/planes']) expect(urls).not.toContain(privada)
  })

  it('robots.txt cierra lo privado y apunta al sitemap', () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.disallow).toEqual(expect.arrayContaining(['/api/', '/board', '/admin/', '/invite/']))
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
