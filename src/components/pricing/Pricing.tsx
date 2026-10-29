import Link from 'next/link'
import { Check, Clock, Minus } from 'lucide-react'
import {
  formatPrice, teamComparison, TEAM_PLAN_ORDER, TEAM_PLANS, TRIAL_DAYS, userComparison, USER_PLAN_ORDER, USER_PLANS,
  type Cell, type ComparisonRow, type TeamPlan, type UserPlan,
} from '@/lib/plans'

/**
 * Planes y comparativa. Todo sale de `lib/plans.ts`, la misma fuente que usan los servicios para aplicar los límites:
 * lo que aquí se anuncia es lo que el servidor hace cumplir. Lo planificado se rotula «Próximamente».
 */

function PlanCard({ plan }: { plan: TeamPlan | UserPlan }) {
  const free = plan.monthly === null
  return (
    <article
      className={`relative flex flex-col rounded-3xl border p-6 ${plan.featured ? 'border-primary/60 bg-surface-container shadow-[0_0_40px] shadow-primary/10' : 'border-surface-container-high bg-surface-container-low'}`}
      aria-labelledby={`plan-${plan.id}`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-black">Más elegido</span>
      )}
      <h3 id={`plan-${plan.id}`} className="text-lg font-bold text-on-surface">{plan.name}</h3>
      <p className="mt-1 text-sm text-on-surface-variant">{plan.tagline}</p>

      <p className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-black tracking-tight text-on-surface">{formatPrice(plan.monthly)}</span>
        {!free && <span className="text-sm text-on-surface-variant">/ mes</span>}
      </p>
      <p className="mt-1 min-h-5 text-xs text-on-surface-variant">
        {free ? 'Sin caducidad, sin tarjeta' : `o ${formatPrice(plan.yearly)} al año · 2 meses gratis`}
      </p>

      <Link
        href="/login"
        className={`mt-5 flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-xs font-extrabold uppercase tracking-widest transition-all ${plan.featured ? 'bg-gradient-to-br from-primary to-primary-dim text-black hover:brightness-110' : 'border border-outline-variant/40 text-on-surface hover:border-primary hover:text-primary'}`}
      >
        {free ? 'Empezar gratis' : `Probar ${TRIAL_DAYS} días gratis`}
      </Link>

      <ul className="mt-6 flex flex-col gap-3 text-sm text-on-surface">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
            <span>{h}</span>
          </li>
        ))}
        {plan.soon.map((h) => (
          <li key={h} className="flex items-start gap-2.5 text-on-surface-variant">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 opacity-60" aria-hidden />
            <span>{h} <span className="ml-1 rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Próximamente</span></span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function CellView({ cell }: { cell: Cell }) {
  if (cell === true) return <Check className="mx-auto h-5 w-5 text-tertiary" aria-label="Incluido" role="img" />
  if (cell === false) return <Minus className="mx-auto h-5 w-5 text-on-surface-variant/40" aria-label="No incluido" role="img" />
  if (cell === 'soon') return <span className="rounded-full bg-surface-container-highest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Próximamente</span>
  return <span className="font-semibold text-on-surface">{cell}</span>
}

function Comparison({ caption, names, rows }: { caption: string; names: string[]; rows: ComparisonRow[] }) {
  return (
    <div className="mt-10 overflow-x-auto rounded-2xl border border-surface-container-high">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-container-low text-left">
            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Qué incluye</th>
            {names.map((n) => <th key={n} scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-surface-container-high">
              <th scope="row" className="px-4 py-3 text-left font-medium text-on-surface-variant">{r.label}</th>
              {r.cells.map((c, i) => <td key={i} className="px-4 py-3 text-center"><CellView cell={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pricing({ heading = true }: { heading?: boolean }) {
  return (
    <section id="planes" className="relative z-20 border-t border-surface-container-high bg-background py-24" aria-label="Planes y precios">
      <div className="mx-auto max-w-7xl px-6">
        {heading && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-on-surface md:text-5xl">Empieza gratis. Mejora solo lo que necesites.</h2>
            <p className="mt-5 text-lg leading-relaxed text-on-surface-variant">
              Hay dos tipos de plan y se suman: el de <strong className="text-on-surface">equipo</strong> lo paga el grupo y el <strong className="text-on-surface">personal</strong> lo paga cada persona y la acompaña a cualquier equipo. El plan Equipo Pro incluye Personal Plus para todos sus miembros.
            </p>
          </div>
        )}

        <div id="personas" className="scroll-mt-24">
          <h3 className="text-2xl font-bold text-on-surface">Para ti</h3>
          <p className="mt-1 text-on-surface-variant">Mejoras que te siguen aunque cambies de equipo.</p>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {USER_PLAN_ORDER.map((id) => <PlanCard key={id} plan={USER_PLANS[id]} />)}
          </div>
          <Comparison caption="Comparativa de planes personales" names={USER_PLAN_ORDER.map((id) => USER_PLANS[id].name)} rows={userComparison()} />
        </div>

        <div id="equipos" className="mt-24 scroll-mt-24">
          <h3 className="text-2xl font-bold text-on-surface">Para tu equipo</h3>
          <p className="mt-1 text-on-surface-variant">Más personas y más espacio compartido, con un solo pago por equipo.</p>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {TEAM_PLAN_ORDER.map((id) => <PlanCard key={id} plan={TEAM_PLANS[id]} />)}
          </div>
          <Comparison caption="Comparativa de planes de equipo" names={TEAM_PLAN_ORDER.map((id) => TEAM_PLANS[id].name)} rows={teamComparison()} />
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 text-center">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface">Los pagos en línea se activarán próximamente.</strong> Hasta entonces, cada plan de pago se puede probar {TRIAL_DAYS} días sin tarjeta desde la propia app. Los precios son orientativos y pueden cambiar antes del lanzamiento de pago; si bajas de plan, no se borra nada: solo dejas de poder superar los límites gratuitos.
          </p>
        </div>
      </div>
    </section>
  )
}

const FAQ: [string, string][] = [
  ['¿El plan gratuito caduca?', 'No. Puedes usar Serenboard gratis todo el tiempo que quieras, con los límites de cada plan gratuito.'],
  ['¿Cuál es la diferencia entre un plan personal y uno de equipo?', 'El de equipo lo paga el grupo y sube los miembros y el espacio compartido. El personal lo pagas tú y mejora tu experiencia en cualquier equipo (avisos, exportar, más equipos propios). Se suman, y Equipo Pro ya incluye Personal Plus a todos sus miembros.'],
  ['¿Qué pasa si termina la prueba o bajo de plan?', 'No se borra nada. Todo lo que ya tienes sigue ahí; solo dejas de poder superar los límites gratuitos (por ejemplo, añadir más miembros o subir más archivos).'],
  ['¿Cuándo puedo pagar?', 'Estamos terminando los pagos en línea. Mientras tanto puedes probar cualquier plan de pago 14 días sin dar ningún dato de tarjeta.'],
  ['¿Cómo me registro?', 'Durante la beta el registro es por invitación de un equipo. Si alguien te manda un enlace de invitación, entras con Google, Microsoft, GitHub, un passkey o contraseña.'],
]

export function Faq() {
  return (
    <section className="border-t border-surface-container-high bg-surface-container-lowest py-24" aria-labelledby="faq-title">
      <div className="mx-auto max-w-3xl px-6">
        <h2 id="faq-title" className="text-center text-3xl font-black tracking-tight text-on-surface">Preguntas frecuentes</h2>
        <div className="mt-10 flex flex-col gap-3">
          {FAQ.map(([q, a]) => (
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
