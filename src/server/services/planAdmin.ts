import { desc, eq, gte, sql } from 'drizzle-orm'
import { planAudit, planMetrics, subscriptions, teams, user } from '@/db/schema'
import { isActive, type SubscriptionLike } from '@/lib/plans'
import type { Db } from '@/server/db'

/** Correos con acceso a la pantalla de administración de planes (`ADMIN_EMAILS`, separados por comas). */
export function adminEmailsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

/**
 * ¿Es administración? Hace falta estar en la lista **y** que el correo esté verificado por el proveedor (Google, Microsoft
 * o GitHub). Con contraseña `emailVerified` es siempre falso: así nadie accede registrándose con el correo de otra persona.
 */
export function isPlanAdmin(u: { email: string; emailVerified: boolean }, env: Record<string, string | undefined> = process.env): boolean {
  return u.emailVerified && adminEmailsFromEnv(env).includes(u.email.trim().toLowerCase())
}

export interface PlanOverview {
  subscriptions: { owner: string; kind: 'persona' | 'equipo'; plan: string; state: 'activo' | 'prueba' | 'caducado'; ends_at: string | null; provider: string; since: string }[]
  /** Últimos 30 días. */
  metrics: { event: string; kind: string; n: number }[]
  audit: { at: string; actor: string; action: string; owner: string; plan: string | null; ends_at: string | null }[]
}

export async function planOverview(db: Db, now = new Date()): Promise<PlanOverview> {
  const rows = await db
    .select({
      plan: subscriptions.plan, status: subscriptions.status, ends_at: subscriptions.ends_at, provider: subscriptions.provider, since: subscriptions.created_at,
      email: user.email, team: teams.name, team_id: subscriptions.team_id,
    })
    .from(subscriptions)
    .leftJoin(user, eq(user.id, subscriptions.user_id))
    .leftJoin(teams, eq(teams.id, subscriptions.team_id))
    .orderBy(desc(subscriptions.created_at))

  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
  const metrics = await db
    .select({ event: planMetrics.event, kind: planMetrics.kind, n: sql<number>`sum(${planMetrics.n})::int` })
    .from(planMetrics)
    .where(gte(planMetrics.day, since))
    .groupBy(planMetrics.event, planMetrics.kind)
    .orderBy(planMetrics.event, desc(sql`sum(${planMetrics.n})`))

  const audit = await db
    .select({ at: planAudit.at, actor: planAudit.actor, action: planAudit.action, owner: planAudit.owner, plan: planAudit.plan, ends_at: planAudit.ends_at })
    .from(planAudit)
    .orderBy(desc(planAudit.at))
    .limit(50)

  return {
    subscriptions: rows.map((r) => ({
      owner: r.email ?? `${r.team ?? 'equipo'}`,
      kind: r.team_id ? 'equipo' : 'persona',
      plan: r.plan,
      state: !isActive(r as SubscriptionLike, now) ? 'caducado' : r.status === 'trialing' ? 'prueba' : 'activo',
      ends_at: r.ends_at,
      provider: r.provider,
      since: r.since,
    })),
    metrics,
    audit,
  }
}
