import { and, count, eq, sql } from 'drizzle-orm'
import { attachments, comments, subscriptions, tasks, teamMembers, teams } from '@/db/schema'
import { can } from '@/lib/permissions'
import {
  bestUserPlan, formatBytes, isActive, isPaidPlan, isTeamPlan, isUserPlan, PLANS, TEAM_PLANS, TEAM_PRO_GIVES, TRIAL_DAYS, USER_PLANS,
  type PlanId, type PlanState, type SubscriptionLike, type TeamBilling, type TeamLimits, type TeamPlanId, type UserBilling, type UserLimits, type UserPlanId,
} from '@/lib/plans'
import type { Db } from '@/server/db'
import { requireRole, ServiceError } from './common'

/**
 * Planes y límites. Es la única fuente de verdad de «qué puede hacer» un equipo o una persona según su plan; el resto
 * de servicios solo llaman a las funciones `assert...` de aquí. Sin plan de pago, rigen los límites gratuitos.
 *
 * Los límites solo frenan lo NUEVO (añadir miembros, crear equipos, subir archivos): bajar de plan nunca borra
 * ni bloquea lo que ya existe.
 */

type Owner = { userId: string } | { teamId: string }

const DAY = 24 * 60 * 60_000
const addDays = (days: number, now = new Date()) => new Date(now.getTime() + days * DAY).toISOString()

async function findSubscription(db: Db, owner: Owner) {
  const where = 'userId' in owner ? eq(subscriptions.user_id, owner.userId) : eq(subscriptions.team_id, owner.teamId)
  const [row] = await db.select().from(subscriptions).where(where).limit(1)
  return row ?? null
}

type SubRow = typeof subscriptions.$inferSelect

function stateOf(row: SubRow | null, now: Date): PlanState {
  if (!row) return { status: 'free', ends_at: null, trial_available: true }
  const live = isActive(row as SubscriptionLike, now)
  return { status: live ? (row.status as PlanState['status']) : 'free', ends_at: live ? row.ends_at : null, trial_available: false }
}

/* ---------- Plan vigente ---------- */
export async function teamPlanOf(db: Db, teamId: string, now = new Date()): Promise<TeamPlanId> {
  const row = await findSubscription(db, { teamId })
  return row && isTeamPlan(row.plan) && isActive(row as SubscriptionLike, now) ? row.plan : 'team_free'
}

/** El plan personal propio, sin contar lo que regala un equipo Pro. */
async function ownUserPlan(db: Db, userId: string, now: Date): Promise<UserPlanId> {
  const row = await findSubscription(db, { userId })
  return row && isUserPlan(row.plan) && isActive(row as SubscriptionLike, now) ? row.plan : 'user_free'
}

/** ¿Pertenece a algún equipo con plan Pro vigente? Ese plan regala Personal Plus a sus miembros. */
async function giftedByTeam(db: Db, userId: string, now: Date): Promise<boolean> {
  const rows = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status, ends_at: subscriptions.ends_at })
    .from(teamMembers)
    .innerJoin(subscriptions, eq(subscriptions.team_id, teamMembers.team_id))
    .where(and(eq(teamMembers.user_id, userId), eq(subscriptions.plan, 'team_pro')))
  return rows.some((r) => isActive(r as SubscriptionLike, now))
}

export async function userPlanOf(db: Db, userId: string, now = new Date()): Promise<UserPlanId> {
  const own = await ownUserPlan(db, userId, now)
  return bestUserPlan(own, (await giftedByTeam(db, userId, now)) ? TEAM_PRO_GIVES : 'user_free')
}

export async function userLimits(db: Db, userId: string): Promise<UserLimits> {
  return USER_PLANS[await userPlanOf(db, userId)].limits
}

/** Límites efectivos de un equipo. El espacio personal no tiene plan propio: usa el de su dueña o dueño. */
export async function teamLimits(db: Db, teamId: string): Promise<TeamLimits & { personal: boolean }> {
  const [team] = await db.select({ owner_id: teams.owner_id, is_personal: teams.is_personal }).from(teams).where(eq(teams.id, teamId))
  if (!team) throw new ServiceError('NOT_FOUND', 'Equipo no encontrado.')
  if (team.is_personal) {
    const u = await userLimits(db, team.owner_id)
    return { maxMembers: 1, storageBytes: u.personalStorageBytes, exportCsv: u.exportCsv, exportFull: u.exportFull, personal: true }
  }
  return { ...TEAM_PLANS[await teamPlanOf(db, teamId)].limits, personal: false }
}

/* ---------- Uso ---------- */
export async function teamStorageUsed(db: Db, teamId: string): Promise<number> {
  const total = sql<string>`coalesce(sum(${attachments.size}), 0)::text`
  // Un adjunto cuelga de una tarea o de un comentario (que a su vez cuelga de una tarea).
  const [direct] = await db.select({ n: total }).from(attachments).innerJoin(tasks, eq(tasks.id, attachments.task_id)).where(eq(tasks.team_id, teamId))
  const [viaComment] = await db
    .select({ n: total })
    .from(attachments)
    .innerJoin(comments, eq(comments.id, attachments.comment_id))
    .innerJoin(tasks, eq(tasks.id, comments.task_id))
    .where(eq(tasks.team_id, teamId))
  return Number(direct.n) + Number(viaComment.n)
}

async function memberCount(db: Db, teamId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(teamMembers).where(eq(teamMembers.team_id, teamId))
  return row.n
}

async function ownedTeamCount(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(teams).where(and(eq(teams.owner_id, userId), eq(teams.is_personal, false)))
  return row.n
}

async function personalTeamId(db: Db, userId: string): Promise<string | null> {
  const [row] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.owner_id, userId), eq(teams.is_personal, true))).limit(1)
  return row?.id ?? null
}

/* ---------- Comprobaciones (las usan los demás servicios) ---------- */
const HINT_TEAM = 'Un administrador puede mejorar el plan desde Ajustes del equipo.'
const HINT_USER = 'Mejora tu plan desde tu perfil.'

export async function assertCanAddMember(db: Db, teamId: string) {
  const limits = await teamLimits(db, teamId)
  if (limits.maxMembers === null) return
  if ((await memberCount(db, teamId)) >= limits.maxMembers) {
    throw new ServiceError('LIMIT', `Este equipo ha alcanzado el máximo de ${limits.maxMembers} miembros de su plan. ${limits.personal ? 'Tu espacio personal no admite más personas; crea un equipo.' : HINT_TEAM}`)
  }
}

export async function assertCanCreateTeam(db: Db, userId: string) {
  const limits = await userLimits(db, userId)
  if (limits.maxOwnedTeams === null) return
  if ((await ownedTeamCount(db, userId)) >= limits.maxOwnedTeams) {
    throw new ServiceError('LIMIT', `Tu plan permite ${limits.maxOwnedTeams === 1 ? 'un equipo propio' : `hasta ${limits.maxOwnedTeams} equipos propios`}. ${HINT_USER}`)
  }
}

export async function assertStorageAvailable(db: Db, teamId: string, incomingBytes: number) {
  const limits = await teamLimits(db, teamId)
  const used = await teamStorageUsed(db, teamId)
  if (used + incomingBytes > limits.storageBytes) {
    throw new ServiceError('LIMIT', `No queda espacio para adjuntos: el plan incluye ${formatBytes(limits.storageBytes)} y se usan ${formatBytes(used)}. ${limits.personal ? HINT_USER : HINT_TEAM}`)
  }
}

export async function assertCanSetReminderOffsets(db: Db, userId: string, next: number, current: number) {
  const { maxReminderOffsets } = await userLimits(db, userId)
  // Reducir siempre se puede, aunque se haya bajado de plan y se conserve un número mayor.
  if (next > maxReminderOffsets && next > current) {
    throw new ServiceError('LIMIT', `Tu plan permite ${maxReminderOffsets} avisos por tarea. ${HINT_USER}`)
  }
}

export async function assertCanExport(db: Db, limits: Pick<TeamLimits, 'exportCsv' | 'exportFull'>, format: 'csv' | 'json', teamScope: boolean) {
  const ok = format === 'csv' ? limits.exportCsv : limits.exportFull
  if (!ok) {
    throw new ServiceError('LIMIT', `${format === 'csv' ? 'Exportar a CSV' : 'La copia completa en JSON'} no está incluido en el plan actual. ${teamScope ? HINT_TEAM : HINT_USER}`)
  }
}

/* ---------- Lo que ven los clientes ---------- */
export async function getTeamBilling(db: Db, userId: string, teamId: string): Promise<TeamBilling> {
  const role = await requireRole(db, userId, teamId)
  const limits = await teamLimits(db, teamId)
  const now = new Date()
  const row = limits.personal ? null : await findSubscription(db, { teamId })
  const state = limits.personal ? { status: 'free' as const, ends_at: null, trial_available: false } : stateOf(row, now)
  const { personal, ...teamLimitsOnly } = limits
  return {
    scope: 'team',
    plan: personal ? 'team_free' : await teamPlanOf(db, teamId, now),
    ...state,
    limits: teamLimitsOnly,
    usage: { members: await memberCount(db, teamId), storage_bytes: await teamStorageUsed(db, teamId) },
    is_admin: role === 'admin',
    can_export: can(userId, role, 'team:export'),
    personal,
  }
}

export async function getMyBilling(db: Db, userId: string): Promise<UserBilling> {
  const now = new Date()
  const row = await findSubscription(db, { userId })
  const ownPlan = await ownUserPlan(db, userId, now)
  const effective = await userPlanOf(db, userId, now)
  const personalId = await personalTeamId(db, userId)
  return {
    scope: 'user',
    plan: effective,
    source: effective === 'user_free' ? 'free' : effective === ownPlan ? 'own' : 'team',
    own: { plan: ownPlan, ...stateOf(row, now) },
    limits: USER_PLANS[effective].limits,
    usage: { owned_teams: await ownedTeamCount(db, userId), storage_bytes: personalId ? await teamStorageUsed(db, personalId) : 0 },
  }
}

/* ---------- Altas ---------- */
/**
 * Prueba gratuita de {@link TRIAL_DAYS} días, una sola vez por dueño. No hay que dar ningún dato de pago.
 * Al terminar, el dueño vuelve a los límites gratuitos sin perder nada.
 */
export async function startTrial(db: Db, userId: string, input: { teamId: string; plan: TeamPlanId } | { teamId?: undefined; plan: UserPlanId }) {
  if (input.teamId !== undefined) {
    if (!isTeamPlan(input.plan) || !isPaidPlan(input.plan)) throw new ServiceError('INVALID', 'Plan no válido para un equipo.')
    const role = await requireRole(db, userId, input.teamId)
    if (role !== 'admin') throw new ServiceError('FORBIDDEN', 'Solo un administrador puede probar un plan del equipo.')
    const [team] = await db.select({ is_personal: teams.is_personal }).from(teams).where(eq(teams.id, input.teamId))
    if (team?.is_personal) throw new ServiceError('INVALID', 'Tu espacio personal usa tu plan personal, no un plan de equipo.')
    const inserted = await db
      .insert(subscriptions)
      .values({ team_id: input.teamId, plan: input.plan, status: 'trialing', ends_at: addDays(TRIAL_DAYS), provider: 'trial' })
      .onConflictDoNothing()
      .returning({ id: subscriptions.id })
    if (inserted.length === 0) throw new ServiceError('CONFLICT', 'Este equipo ya ha usado su prueba gratuita o tiene un plan.')
    return
  }
  if (!isUserPlan(input.plan) || !isPaidPlan(input.plan)) throw new ServiceError('INVALID', 'Plan no válido para una persona.')
  const inserted = await db
    .insert(subscriptions)
    .values({ user_id: userId, plan: input.plan, status: 'trialing', ends_at: addDays(TRIAL_DAYS), provider: 'trial' })
    .onConflictDoNothing()
    .returning({ id: subscriptions.id })
  if (inserted.length === 0) throw new ServiceError('CONFLICT', 'Ya has usado tu prueba gratuita o tienes un plan.')
}

/**
 * Concede un plan de pago (lo usa el operador desde `scripts/plan.mjs` y, más adelante, el webhook del proveedor
 * de pagos). `days = null` deja el plan sin caducidad. Sustituye cualquier suscripción o prueba anterior.
 */
export async function grantPlan(db: Db, owner: Owner, plan: PlanId, opts: { days?: number | null; provider?: string; providerRef?: string } = {}) {
  if (!(plan in PLANS)) throw new ServiceError('INVALID', 'Plan desconocido.')
  if ('teamId' in owner && !isTeamPlan(plan)) throw new ServiceError('INVALID', 'Ese plan es personal, no de equipo.')
  if ('userId' in owner && !isUserPlan(plan)) throw new ServiceError('INVALID', 'Ese plan es de equipo, no personal.')
  const values = {
    plan,
    status: 'active',
    ends_at: opts.days == null ? null : addDays(opts.days),
    provider: opts.provider ?? 'manual',
    provider_ref: opts.providerRef ?? null,
    updated_at: new Date().toISOString(),
  }
  if ('userId' in owner) {
    await db.insert(subscriptions).values({ user_id: owner.userId, ...values }).onConflictDoUpdate({ target: subscriptions.user_id, targetWhere: sql`${subscriptions.user_id} is not null`, set: values })
  } else {
    await db.insert(subscriptions).values({ team_id: owner.teamId, ...values }).onConflictDoUpdate({ target: subscriptions.team_id, targetWhere: sql`${subscriptions.team_id} is not null`, set: values })
  }
}

