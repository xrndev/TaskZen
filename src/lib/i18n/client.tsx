'use client'

import { createContext, useContext, useMemo } from 'react'
import { DEFAULT_LANG, LANG_COOKIE, LOCALE, makeT, type Lang, type T } from './core'

const LangContext = createContext<Lang>(DEFAULT_LANG)

/** Lo monta el layout con el idioma ya decidido en servidor: así servidor y cliente pintan lo mismo. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

export function useT(): T {
  const lang = useLang()
  return useMemo(() => makeT(lang), [lang])
}

/** Guarda el idioma elegido en una cookie de un año. */
export function setLangCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
}

/** Código de idioma para `toLocaleString` y similares. */
export const useLocale = () => LOCALE[useLang()]
