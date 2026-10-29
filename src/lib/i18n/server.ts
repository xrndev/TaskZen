import { cookies, headers } from 'next/headers'
import { LANG_COOKIE, makeT, pickLang, type Lang, type T } from './core'

/** Idioma de la petición actual (solo en servidor). */
export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()])
  return pickLang(c.get(LANG_COOKIE)?.value, h.get('accept-language'))
}

export async function getT(): Promise<{ lang: Lang; t: T }> {
  const lang = await getLang()
  return { lang, t: makeT(lang) }
}
