/**
 * Idioma de la interfaz. Código puro (sin framework): lo usan servidor y cliente, y se puede probar sin navegador.
 * Los textos viven en `es.ts` (la fuente) y `en.ts` (el compilador exige que tenga las mismas claves).
 */
import { en } from './en'
import { es, type Key } from './es'

export const LANGS = ['es', 'en'] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = 'es'
export const LANG_COOKIE = 'lang'
export const LANG_LABEL: Record<Lang, string> = { es: 'Español', en: 'English' }

export type { Key }
export type Params = Record<string, string | number>
export type T = (key: Key, params?: Params) => string

const DICTS: Record<Lang, Record<Key, string>> = { es, en }

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v)

/**
 * Elige el idioma: primero la cookie (lo que la persona eligió), después las preferencias del navegador
 * (`Accept-Language`, por orden de prioridad) y, si no hay coincidencia, el español.
 */
export function pickLang(cookie?: string | null, acceptLanguage?: string | null): Lang {
  if (isLang(cookie)) return cookie
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part, i) => {
      const [tag, ...rest] = part.trim().split(';')
      const q = Number(rest.find((r) => r.trim().startsWith('q='))?.trim().slice(2) ?? 1)
      return { base: tag.trim().toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0, i }
    })
    .filter((l) => l.base && l.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  return wanted.map((l) => l.base).find(isLang) ?? DEFAULT_LANG
}

export function makeT(lang: Lang): T {
  const dict = DICTS[lang]
  return (key, params) => {
    const text = dict[key] ?? es[key] ?? key
    return params ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : text
  }
}

/** Fechas y números en el idioma elegido. */
export const LOCALE: Record<Lang, string> = { es: 'es-ES', en: 'en-GB' }
