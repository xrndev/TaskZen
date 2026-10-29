import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import {
  teamComparison, TEAM_PLAN_LISTED, TEAM_PLANS, TRIAL_DAYS, userComparison, USER_PLAN_LISTED, USER_PLANS,
  type Cell, type ComparisonRow, type TeamPlan, type UserPlan,
} from '@/lib/plans'
import { localizePlan, localizeRows } from '@/lib/plans.i18n'
import { getT } from '@/lib/i18n/server'
import type { Key, T } from '@/lib/i18n/core'
import { PeriodProvider, PeriodToggle, Price } from './Period'

/**
 * Planes y comparativa. Todo sale de `lib/plans.ts`, la misma fuente que usan los servicios para aplicar los límites:
 * lo que aquí se anuncia es lo que el servidor hace cumplir. Las tarjetas solo muestran lo que existe; lo planificado
 * va en las tablas, rotulado «Próximamente». Los textos se traducen en `lib/plans.i18n.ts`.
 */

const GRID = { 2: 'lg:grid-cols-2 lg:max-w-3xl lg:mx-auto', 3: 'lg:grid-cols-3' } as const

function PlanCard({ plan, t }: { plan: TeamPlan | UserPlan; t: T }) {
  const free = plan.monthly === null
  return (
    <article
      className={`relative flex flex-col rounded-3xl border p-6 ${plan.featured ? 'border-primary/60 bg-surface-container shadow-[0_0_40px] shadow-primary/10' : 'border-surface-container-high bg-surface-container-low'}`}
      aria-labelledby={`plan-${plan.id}`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-black">{t('pricing.mostPopular')}</span>
      )}
      <h3 id={`plan-${plan.id}`} className="text-lg font-bold text-on-surface">{plan.name}</h3>
      <p className="mt-1 text-sm text-on-surface-variant">{plan.tagline}</p>

      <Price monthly={plan.monthly} yearly={plan.yearly} />

      <Link
        href="/login"
        className={`mt-5 flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-xs font-extrabold uppercase tracking-widest transition-all ${plan.featured ? 'bg-gradient-to-br from-primary to-primary-dim text-black hover:brightness-110' : 'border border-outline-variant/40 text-on-surface hover:border-primary hover:text-primary'}`}
      >
        {free ? t('pricing.startFree') : t('pricing.try', { days: TRIAL_DAYS })}
      </Link>

      <ul className="mt-6 flex flex-col gap-3 text-sm text-on-surface">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function CellView({ cell, t }: { cell: Cell; t: T }) {
  if (cell === true) return <Check className="mx-auto h-5 w-5 text-tertiary" aria-label={t('pricing.included')} role="img" />
  if (cell === false) return <Minus className="mx-auto h-5 w-5 text-on-surface-variant/40" aria-label={t('pricing.notIncluded')} role="img" />
  if (cell === 'soon') return <span className="rounded-full bg-surface-container-highest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('pricing.soon')}</span>
  return <span className="font-semibold text-on-surface">{cell}</span>
}

function Comparison({ caption, names, rows, t }: { caption: string; names: string[]; rows: ComparisonRow[]; t: T }) {
  return (
    <div className="mt-10 overflow-x-auto rounded-2xl border border-surface-container-high">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-container-low text-left">
            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('pricing.col.includes')}</th>
            {names.map((n) => <th key={n} scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-surface-container-high">
              <th scope="row" className="px-4 py-3 text-left font-medium text-on-surface-variant">{r.label}{r.hint && <span className="mt-0.5 block text-xs font-normal text-on-surface-variant/70">{r.hint}</span>}</th>
              {r.cells.map((c, i) => <td key={i} className="px-4 py-3 text-center"><CellView cell={c} t={t} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Explica con un caso concreto qué es un «recordatorio antes del vencimiento», que es lo que más se malinterpreta. */
function ReminderExample({ t }: { t: T }) {
  return (
    <aside className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6" aria-labelledby="recordatorios-title">
      <h4 id="recordatorios-title" className="text-sm font-bold text-on-surface">{t('pricing.rem.title')}</h4>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{t('pricing.rem.intro')}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('pricing.rem.free')}</p>
          <p className="mt-2 text-sm text-on-surface">{t('pricing.rem.freeText')}</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-on-surface-variant">
            <li>{t('pricing.rem.n1')}</li>
            <li>{t('pricing.rem.n2')}</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('pricing.rem.plus')}</p>
          <p className="mt-2 text-sm text-on-surface">{t('pricing.rem.plusText')}</p>
          <p className="mt-2 text-xs text-on-surface-variant/80">{t('pricing.rem.note')}</p>
        </div>
      </div>
    </aside>
  )
}

export async function Pricing({ heading = true }: { heading?: boolean }) {
  const { lang, t } = await getT()
  const userPlans = USER_PLAN_LISTED.map((id) => localizePlan(USER_PLANS[id], lang))
  const teamPlans = TEAM_PLAN_LISTED.map((id) => localizePlan(TEAM_PLANS[id], lang))
  const cols = (n: number) => GRID[(n === 2 ? 2 : 3) as 2 | 3]

  return (
    <section id="planes" className="relative z-20 border-t border-surface-container-high bg-background py-24" aria-label={t('pricing.sectionLabel')}>
      <div className="mx-auto max-w-7xl px-6">
        {heading && (
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-on-surface md:text-5xl">{t('pricing.title')}</h2>
            <p className="mt-5 text-lg leading-relaxed text-on-surface-variant">{t('pricing.intro')}</p>
          </div>
        )}

        <PeriodProvider>
          <PeriodToggle />

          <div id="personas" className="scroll-mt-24">
            <h3 className="text-2xl font-bold text-on-surface">{t('pricing.forYou')}</h3>
            <p className="mt-1 text-on-surface-variant">{t('pricing.forYouSub')}</p>
            <div className={`mt-8 grid grid-cols-1 gap-6 ${cols(userPlans.length)}`}>
              {userPlans.map((plan) => <PlanCard key={plan.id} plan={plan} t={t} />)}
            </div>
            <Comparison caption={t('pricing.table.personal')} names={userPlans.map((p) => p.name)} rows={localizeRows(userComparison(), lang)} t={t} />
            <ReminderExample t={t} />
          </div>

          <div id="equipos" className="mt-24 scroll-mt-24">
            <h3 className="text-2xl font-bold text-on-surface">{t('pricing.forTeam')}</h3>
            <p className="mt-1 text-on-surface-variant">{t('pricing.forTeamSub')}</p>
            <div className={`mt-8 grid grid-cols-1 gap-6 ${cols(teamPlans.length)}`}>
              {teamPlans.map((plan) => <PlanCard key={plan.id} plan={plan} t={t} />)}
            </div>
            <Comparison caption={t('pricing.table.team')} names={teamPlans.map((p) => p.name)} rows={localizeRows(teamComparison(), lang)} t={t} />
          </div>
        </PeriodProvider>

        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 text-center">
          <p className="text-sm leading-relaxed text-on-surface-variant">{t('pricing.soonNote', { days: TRIAL_DAYS })}</p>
        </div>
      </div>
    </section>
  )
}

const FAQ: [Key, Key][] = [
  ['faq.1.q', 'faq.1.a'],
  ['faq.2.q', 'faq.2.a'],
  ['faq.3.q', 'faq.3.a'],
  ['faq.4.q', 'faq.4.a'],
]

export async function Faq({ openSignup = false }: { openSignup?: boolean }) {
  const { t } = await getT()
  const items: [string, string][] = [
    ...FAQ.map(([q, a]): [string, string] => [t(q), t(a)]),
    [t('faq.signup.q'), t(openSignup ? 'faq.signup.open' : 'faq.signup.invite')],
  ]
  return (
    <section className="border-t border-surface-container-high bg-surface-container-lowest py-24" aria-labelledby="faq-title">
      <div className="mx-auto max-w-3xl px-6">
        <h2 id="faq-title" className="text-center text-3xl font-black tracking-tight text-on-surface">{t('faq.title')}</h2>
        <div className="mt-10 flex flex-col gap-3">
          {items.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-surface-container-high bg-surface-container-low px-5 py-4 open:border-primary/40">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-on-surface">
                {q}
                <span aria-hidden className="text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
