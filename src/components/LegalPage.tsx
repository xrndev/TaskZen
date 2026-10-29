import Link from 'next/link'
import type { ReactNode } from 'react'
import { LEGAL_UPDATED, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'

/** Estructura común de las páginas legales: cabecera con la marca, título, fecha y pie con enlaces cruzados. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-on-surface font-sans">
      <header className="border-b border-surface-container-high/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-lg shadow-primary/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
            </span>
            <span className="text-xl font-black tracking-tight">Serenboard</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">Entrar</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Última actualización: {LEGAL_UPDATED}</p>
        <p className="mt-6 text-base leading-relaxed text-on-surface/90">{intro}</p>
        <div className="mt-8 flex flex-col gap-8">{children}</div>
      </main>

      <footer className="border-t border-surface-container-high bg-surface-container-low py-8 text-center text-sm text-on-surface-variant">
        <nav aria-label="Textos legales" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href={PRIVACY_PATH} className="hover:text-primary hover:underline">Política de privacidad</Link>
          <Link href={TERMS_PATH} className="hover:text-primary hover:underline">Condiciones del servicio</Link>
          <Link href="/" className="hover:text-primary hover:underline">Inicio</Link>
        </nav>
      </footer>
    </div>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20">
      <h2 id={`${id}-t`} className="mb-3 text-xl font-bold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-on-surface/90">{children}</div>
    </section>
  )
}

export const P = ({ children }: { children: ReactNode }) => <p>{children}</p>

export const List = ({ children }: { children: ReactNode }) => <ul className="ml-5 flex list-disc flex-col gap-1.5 marker:text-primary">{children}</ul>

export const Strong = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-on-surface">{children}</strong>

export const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{children}</a>
)

/** Enlaces a las dos páginas, para pies de página y menús. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Textos legales" className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <Link href={PRIVACY_PATH} className="hover:text-primary hover:underline">Política de privacidad</Link>
      <Link href={TERMS_PATH} className="hover:text-primary hover:underline">Condiciones del servicio</Link>
    </nav>
  )
}
