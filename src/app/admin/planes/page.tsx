import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { isPlanAdmin, planOverview } from '@/server/services/planAdmin'
import { getSession } from '@/server/session'

export const metadata: Metadata = { title: 'Administración de planes', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const EVENT_LABEL: Record<string, string> = {
  limit_hit: 'Límites alcanzados',
  trial_started: 'Pruebas iniciadas',
  plan_granted: 'Planes concedidos',
  plan_revoked: 'Planes retirados',
}
const KIND_LABEL: Record<string, string> = {
  members: 'miembros', teams: 'equipos propios', storage: 'espacio', file_size: 'tamaño de archivo', reminders: 'recordatorios', export_csv: 'exportar CSV', export_json: 'exportar JSON',
}
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—')

/**
 * Solo lectura: quién tiene qué plan, qué límites se alcanzan más y quién concedió qué. Las concesiones se hacen con
 * `scripts/plan.mjs` (queda anotado quién). No existe enlace a esta página; para el resto devuelve un 404.
 */
export default async function AdminPlanesPage() {
  const session = await getSession()
  if (!session || !isPlanAdmin(session.user)) notFound()
  const o = await planOverview(db)

  const active = o.subscriptions.filter((s) => s.state !== 'caducado')
  const byEvent = new Map<string, typeof o.metrics>()
  for (const m of o.metrics) byEvent.set(m.event, [...(byEvent.get(m.event) ?? []), m])

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-on-surface">
      <h1 className="text-3xl font-black tracking-tight">Administración de planes</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{active.length} planes vigentes de {o.subscriptions.length} registrados. Solo lectura: concede o retira con <code className="rounded bg-surface-container px-1.5 py-0.5">scripts/plan.mjs</code>.</p>

      <section className="mt-10" aria-labelledby="subs">
        <h2 id="subs" className="text-lg font-bold">Planes y pruebas</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-surface-container-high">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
              <tr><th className="px-4 py-3">Dueño</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Termina</th><th className="px-4 py-3">Origen</th></tr>
            </thead>
            <tbody>
              {o.subscriptions.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">Todavía no hay planes ni pruebas.</td></tr>}
              {o.subscriptions.map((s, i) => (
                <tr key={i} className="border-t border-surface-container-high">
                  <td className="px-4 py-3 font-medium">{s.owner}</td><td className="px-4 py-3">{s.kind}</td><td className="px-4 py-3">{s.plan}</td>
                  <td className="px-4 py-3">{s.state}</td><td className="px-4 py-3">{fmt(s.ends_at)}</td><td className="px-4 py-3">{s.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="metrics">
        <h2 id="metrics" className="text-lg font-bold">Contadores de los últimos 30 días</h2>
        <p className="mt-1 text-xs text-on-surface-variant">Agregados y anónimos: no identifican a nadie.</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {o.metrics.length === 0 && <p className="text-sm text-on-surface-variant">Aún no hay datos.</p>}
          {[...byEvent.entries()].map(([event, list]) => (
            <div key={event} className="rounded-2xl border border-surface-container-high bg-surface-container-low p-4">
              <h3 className="text-sm font-bold">{EVENT_LABEL[event] ?? event}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {list.map((m) => <li key={m.kind} className="flex justify-between"><span className="text-on-surface-variant">{KIND_LABEL[m.kind] ?? m.kind}</span><span className="font-semibold">{m.n}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="audit">
        <h2 id="audit" className="text-lg font-bold">Registro de concesiones</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-surface-container-high">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
              <tr><th className="px-4 py-3">Cuándo</th><th className="px-4 py-3">Quién</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3">Dueño</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Hasta</th></tr>
            </thead>
            <tbody>
              {o.audit.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">Sin movimientos.</td></tr>}
              {o.audit.map((a, i) => (
                <tr key={i} className="border-t border-surface-container-high">
                  <td className="px-4 py-3">{fmt(a.at)}</td><td className="px-4 py-3">{a.actor}</td><td className="px-4 py-3">{a.action === 'grant' ? 'concedido' : 'retirado'}</td>
                  <td className="px-4 py-3">{a.owner}</td><td className="px-4 py-3">{a.plan ?? '—'}</td><td className="px-4 py-3">{a.action === 'grant' ? (a.ends_at ? fmt(a.ends_at) : 'sin caducidad') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
