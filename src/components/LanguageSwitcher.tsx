'use client'

import { useRouter } from 'next/navigation'
import { LANGS, LANG_LABEL, type Lang } from '@/lib/i18n/core'
import { setLangCookie, useLang, useT } from '@/lib/i18n/client'

/** Cambia el idioma: guarda la elección en una cookie de un año y recarga los datos de la página. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const lang = useLang()
  const t = useT()
  const router = useRouter()

  function choose(next: Lang) {
    if (next === lang) return
    setLangCookie(next)
    router.refresh()
  }

  return (
    <div role="group" aria-label={t('lang.label')} className={`inline-flex rounded-full border border-outline-variant/40 p-0.5 text-[11px] font-bold uppercase tracking-wider ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          title={LANG_LABEL[l]}
          onClick={() => choose(l)}
          className={`min-h-8 rounded-full px-2.5 transition-colors ${l === lang ? 'bg-primary text-black' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
