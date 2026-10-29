import type { Metadata } from 'next'
import { LegalLinks } from '@/components/LegalPage'
import { Faq, Pricing } from '@/components/pricing/Pricing'
import { SiteHeader } from '@/components/pricing/SiteHeader'
import { policyFromEnv } from '@/server/services/registration'

export const metadata: Metadata = {
  title: 'Planes y precios',
  description: 'Compara los planes gratuitos, personales y de equipo de Serenboard y qué incluye cada uno.',
}

export const dynamic = 'force-dynamic'

export default function PreciosPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background font-sans text-on-surface selection:bg-primary/30">
      <SiteHeader />
      <main className="pt-16">
        <div className="mx-auto max-w-3xl px-6 pb-4 pt-20 text-center">
          <h1 className="text-5xl font-black tracking-tighter md:text-6xl">Planes y precios</h1>
          <p className="mt-5 text-lg text-on-surface-variant">Compara lo que incluye cada plan, sin letra pequeña.</p>
        </div>
        <Pricing heading={false} />
        <Faq openSignup={policyFromEnv().openSignup} />
      </main>
      <footer className="border-t border-surface-container-high bg-surface-container-low py-8 text-center text-sm text-on-surface-variant">
        <p>© {new Date().getFullYear()} Serenboard</p>
        <LegalLinks className="mt-3 justify-center" />
      </footer>
    </div>
  )
}
