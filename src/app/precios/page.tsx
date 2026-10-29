import type { Metadata } from 'next'
import { LegalLinks } from '@/components/LegalPage'
import { Faq, Pricing } from '@/components/pricing/Pricing'
import { SiteHeader } from '@/components/pricing/SiteHeader'
import { getT } from '@/lib/i18n/server'
import { policyFromEnv } from '@/server/services/registration'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return { title: t('precios.metaTitle'), description: t('precios.metaDesc') }
}

export const dynamic = 'force-dynamic'

export default async function PreciosPage() {
  const { t } = await getT()
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background font-sans text-on-surface selection:bg-primary/30">
      <SiteHeader />
      <main className="pt-16">
        <div className="mx-auto max-w-3xl px-6 pb-4 pt-20 text-center">
          <h1 className="text-5xl font-black tracking-tighter md:text-6xl">{t('precios.h1')}</h1>
          <p className="mt-5 text-lg text-on-surface-variant">{t('precios.lead')}</p>
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
