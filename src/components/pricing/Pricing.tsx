import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import {
  teamComparison, TEAM_PLAN_LISTED, TEAM_PLANS, TRIAL_DAYS, userComparison, USER_PLAN_LISTED, USER_PLANS,
  type Cell, type ComparisonRow, type TeamPlan, type UserPlan,
} from '@/lib/plans'
import { PeriodProvider, PeriodToggle, Price } from './Period'

/**
 * Planes y comparativa. Todo sale de `lib/plans.ts`, la misma fuente que usan los servicios para aplicar los límites:
 * lo que aquí se anuncia es lo que el servidor hace cumplir. Las tarjetas solo muestran lo que existe; lo planificado
 * va en las tablas, rotulado «Próximamente».
 */

const GRID = { 2: 'lg:grid-cols-2 lg:max-w-3xl', 3: 'lg:grid-cols-3' } as const

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

      <Price monthly={plan.monthly} yearly={plan.yearly} />

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
      <table className="w-full min-w-[30rem] border-collapse text-sm">
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
              <th scope="row" className="px-4 py-3 text-left font-medium text-on-surface-variant">{r.label}{r.hint && <span className="mt-0.5 block text-xs font-normal text-on-surface-variant/70">{r.hint}</span>}</th>
              {r.cells.map((c, i) => <td key={i} className="px-4 py-3 text-center"><CellView cell={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Explica con un caso concreto qué es un «recordatorio antes del vencimiento», que es lo que más se malinterpreta. */
function ReminderExample() {
  return (
    <aside className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6" aria-labelledby="recordatorios-title">
      <h4 id="recordatorios-title" className="text-sm font-bold text-on-surface">¿Qué son los recordatorios antes del vencimiento?</h4>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
        Cada recordatorio es un aviso que eliges recibir un rato antes de la fecha límite de una tarea tuya. Lo configuras una vez y se aplica a todas tus tareas.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Con 2 recordatorios (Gratis)</p>
          <p className="mt-2 text-sm text-on-surface">La tarea «Entregar el informe» vence el viernes a las 18:00. Marcas «1 día antes» y «1 hora antes» y recibes:</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-on-surface-variant">
            <li>🔔 Jueves, 18:00 · «Entregar el informe vence mañana»</li>
            <li>🔔 Viernes, 17:00 · «Entregar el informe vence en 1 hora»</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Con 4 recordatorios (Plus)</p>
          <p className="mt-2 text-sm text-on-surface">Para esa misma tarea puedes marcar, por ejemplo, 2 días, 1 día, 3 horas y 15 minutos antes, y recibes cuatro avisos en esos momentos.</p>
          <p className="mt-2 text-xs text-on-surface-variant/80">El aviso de «te han asignado una tarea» es aparte y no cuenta.</p>
        </div>
      </div>
    </aside>
  )
}

export function Pricing({ heading = true }: { heading?: boolean }) {
  const userPlans = USER_PLAN_LISTED.map((id) => USER_PLANS[id])
  const teamPlans = TEAM_PLAN_LISTED.map((id) => TEAM_PLANS[id])
  const cols = (n: number) => GRID[(n === 2 ? 2 : 3) as 2 | 3]

  return (
    <section id="planes" className="relative z-20 border-t border-surface-container-high bg-background py-24" aria-label="Planes y precios">
      <div className="mx-auto max-w-7xl px-6">
        {heading && (
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-on-surface md:text-5xl">Empieza gratis. Mejora solo lo que necesites.</h2>
            <p className="mt-5 text-lg leading-relaxed text-on-surface-variant">
              Hay dos tipos de plan y se suman: el de <strong className="text-on-surface">equipo</strong> lo paga el grupo y el <strong className="text-on-surface">personal</strong> lo paga cada persona y la acompaña a cualquier equipo. El plan Equipo Pro incluye Personal Plus para todos sus miembros.
            </p>
          </div>
        )}

        <PeriodProvider>
          <PeriodToggle />

          <div id="personas" className="scroll-mt-24">
            <h3 className="text-2xl font-bold text-on-surface">Para ti</h3>
            <p className="mt-1 text-on-surface-variant">Mejoras que te siguen aunque cambies de equipo.</p>
            <div className={`mt-8 grid grid-cols-1 gap-6 ${cols(userPlans.length)}`}>
              {userPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
            </div>
            <Comparison caption="Comparativa de planes personales" names={userPlans.map((p) => p.name)} rows={userComparison()} />
            <ReminderExample />
          </div>

          <div id="equipos" className="mt-24 scroll-mt-24">
            <h3 className="text-2xl font-bold text-on-surface">Para tu equipo</h3>
            <p className="mt-1 text-on-surface-variant">Más personas y más espacio compartido, con un solo pago por equipo.</p>
            <div className={`mt-8 grid grid-cols-1 gap-6 ${cols(teamPlans.length)}`}>
              {teamPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
            </div>
            <Comparison caption="Comparativa de planes de equipo" names={teamPlans.map((p) => p.name)} rows={teamComparison()} />
          </div>
        </PeriodProvider>

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
  ['¿Cuál es la diferencia entre un plan personal y uno de equipo?', 'El de equipo lo paga el grupo y sube los miembros y el espacio compartido. El personal lo pagas tú y mejora tu experiencia en cualquier equipo (recordatorios, exportar, más equipos propios). Se suman, y Equipo Pro ya incluye Personal Plus a todos sus miembros.'],
  ['¿Qué pasa si termina la prueba o bajo de plan?', 'No se borra nada. Todo lo que ya tienes sigue ahí; solo dejas de poder superar los límites gratuitos (por ejemplo, añadir más miembros o subir más archivos). Antes de que termine una prueba te lo avisamos dentro de la app.'],
  ['¿Cuándo puedo pagar?', 'Estamos terminando los pagos en línea. Mientras tanto puedes probar cualquier plan de pago 14 días sin dar ningún dato de tarjeta.'],
]

export function Faq({ openSignup = false }: { openSignup?: boolean }) {
  const signup: [string, string] = openSignup
    ? ['¿Cómo me registro?', 'Crea tu cuenta con Google, Microsoft, GitHub, un passkey o una contraseña. Es gratis y no pedimos tarjeta.']
    : ['¿Cómo me registro?', 'Durante la beta el registro es por invitación de un equipo. Si alguien te manda un enlace de invitación, entras con Google, Microsoft, GitHub, un passkey o contraseña.']
  return (
    <section className="border-t border-surface-container-high bg-surface-container-lowest py-24" aria-labelledby="faq-title">
      <div className="mx-auto max-w-3xl px-6">
        <h2 id="faq-title" className="text-center text-3xl font-black tracking-tight text-on-surface">Preguntas frecuentes</h2>
        <div className="mt-10 flex flex-col gap-3">
          {[...FAQ, signup].map(([q, a]) => (
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
