import Link from 'next/link'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getT } from '@/lib/i18n/server'

/** Cabecera pública (inicio y precios). */
export async function SiteHeader() {
  const { t } = await getT()
  return (
    <header className="fixed top-0 z-50 w-full border-b border-surface-container-high/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={t('nav.home')}>
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-primary/10">
            <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="text-xl font-black tracking-tight text-on-surface">Serenboard</span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6" aria-label={t('nav.main')}>
          <Link href="/precios" className="hidden text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary sm:block">{t('nav.plans')}</Link>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Link
            href="/login"
            className="relative z-[60] rounded-xl border border-outline-variant/30 bg-surface-container px-5 py-2 text-sm font-bold text-on-surface transition-all hover:border-primary/50 hover:text-primary"
          >
            {t('nav.login')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
