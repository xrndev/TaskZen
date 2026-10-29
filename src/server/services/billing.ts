import { and, count, eq, sql } from 'drizzle-orm'
import { attachments, comments, planAudit, planMetrics, subscriptions, tasks, teamMembers, teams, user } from '@/db/schema'
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

/* ---------- Métricas anónimas ---------- */
/**
 * Cuenta un suceso del día (sin identificar a nadie). Es de mejor esfuerzo: medir nunca debe romper la operación
 * del usuario, así que un fallo aquí se ignora.
 */
export async function recordMetric(db: Db, event: string, kind: string) {
  try {
    const day = new Date().toISOString().slice(0, 10)
    await db
      .insert(planMetrics)
      .values({ day, event, kind, n: 1 })
      .onConflictDoUpdate({ target: [planMetrics.day, planMetrics.event, planMetrics.kind], set: { n: sql`${planMetrics.n} + 1` } })
  } catch (e) {
    console.error('[metrics]', e)
  }
}

/** Error de límite: lo cuenta y lo devuelve listo para lanzar, con el plan (personal o de equipo) que habría que mejorar. */
async function limitError(db: Db, kind: string, message: string, scope: 'user' | 'team') {
  await recordMetric(db, 'limit_hit', kind)
  return new ServiceError('LIMIT', message, scope)
}

async function findSubscription(db: Db, owner: Owner) {
  const where = 'userId' in owner ? eq(subscriptions.user_id, owner.userId) : eq(subscriptions.team_id, owner.teamId)
  const [row] = await db.select().from(subscriptions).where(where).limit(1)
  return row ?? null
}

type SubRow = typeof subscriptions.$inferSelect

function stateOf(row: SubRow | null, now: Date): PlanState {
  if (!row) return { status: 'free', ends_at: null, trial_available: true, ended: null }
  const live = isActive(row as SubscriptionLike, now)
  return {
    status: live ? (row.status as PlanState['status']) : 'free',
    ends_at: live ? row.ends_at : null,
    trial_available: false,
    // Se conserva qué plan fue y cuándo acabó, para poder avisar una vez de que ya no lo tiene.
    ended: !live && row.ends_at ? { plan: row.plan as PlanId, ended_at: row.ends_at, trial: row.status === 'trialing' } : null,
  }
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
    return { maxMembers: 1, storageBytes: u.personalStorageBytes, maxFileBytes: u.maxFileBytes, exportCsv: u.exportCsv, exportFull: u.exportFull, personal: true }
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
    throw await limitError(
      db, 'members',
      `Este equipo ha alcanzado el máximo de ${limits.maxMembers} miembros de su plan. ${limits.personal ? 'Tu espacio personal no admite más personas; crea un equipo.' : HINT_TEAM}`,
      limits.personal ? 'user' : 'team',
    )
  }
}

export async function assertCanCreateTeam(db: Db, userId: string) {
  const limits = await userLimits(db, userId)
  if (limits.maxOwnedTeams === null) return
  if ((await ownedTeamCount(db, userId)) >= limits.maxOwnedTeams) {
    throw await limitError(db, 'teams', `Tu plan permite ${limits.maxOwnedTeams === 1 ? 'un equipo propio' : `hasta ${limits.maxOwnedTeams} equipos propios`}. ${HINT_USER}`, 'user')
  }
}

/** Tamaño máximo de un archivo según el plan (el del equipo, o el personal en el espacio personal). */
export async function assertFileSize(db: Db, teamId: string, bytes: number) {
  const limits = await teamLimits(db, teamId)
  if (bytes > limits.maxFileBytes) {
    throw await limitError(db, 'file_size', `El archivo pesa ${formatBytes(bytes)} y tu plan admite hasta ${formatBytes(limits.maxFileBytes)} por archivo. ${limits.personal ? HINT_USER : HINT_TEAM}`, limits.personal ? 'user' : 'team')
  }
}

export async function assertStorageAvailable(db: Db, teamId: string, incomingBytes: number) {
  const limits = await teamLimits(db, teamId)
  const used = await teamStorageUsed(db, teamId)
  if (used + incomingBytes > limits.storageBytes) {
    throw await limitError(
      db, 'storage',
      `No queda espacio para adjuntos: el plan incluye ${formatBytes(limits.storageBytes)} y se usan ${formatBytes(used)}. ${limits.personal ? HINT_USER : HINT_TEAM}`,
      limits.personal ? 'user' : 'team',
    )
  }
}

export async function assertCanSetReminderOffsets(db: Db, userId: string, next: number, current: number) {
  const { maxReminderOffsets } = await userLimits(db, userId)
  // Reducir siempre se puede, aunque se haya bajado de plan y se conserve un número mayor.
  if (next > maxReminderOffsets && next > current) {
    throw await limitError(db, 'reminders', `Tu plan permite ${maxReminderOffsets} recordatorios antes del vencimiento (por ejemplo, 1 día y 1 hora antes). ${HINT_USER}`, 'user')
  }
}

export async function assertCanExport(db: Db, limits: Pick<TeamLimits, 'exportCsv' | 'exportFull'> & { personal?: boolean }, format: 'csv' | 'json', teamScope: boolean) {
  const ok = format === 'csv' ? limits.exportCsv : limits.exportFull
  if (!ok) {
    throw await limitError(
      db, `export_${format}`,
      `${format === 'csv' ? 'Exportar a CSV' : 'La copia completa en JSON'} no está incluido en el plan actual. ${teamScope && !limits.personal ? HINT_TEAM : HINT_USER}`,
      teamScope && !limits.personal ? 'team' : 'user',
    )
  }
}

/**
 * Recordatorios que se envían de verdad. Si alguien bajó de plan y conserva más de los permitidos, se envían solo los
 * de mayor antelación hasta el máximo; no se borra nada y, al mejorar el plan, vuelven todos.
 */
export async function effectiveOffsets(db: Db, userId: string, offsets: number[]): Promise<number[]> {
  // Atajo: ningún plan permite menos que el gratuito, así que lo habitual no consulta nada.
  if (offsets.length <= USER_PLANS.user_free.limits.maxReminderOffsets) return offsets
  const { maxReminderOffsets } = await userLimits(db, userId)
  return [...offsets].sort((a, b) => b - a).slice(0, maxReminderOffsets)
}

/* ---------- Lo que ven los clientes ---------- */
export async function getTeamBilling(db: Db, userId: string, teamId: string): Promise<TeamBilling> {
  const role = await requireRole(db, userId, teamId)
  const limits = await teamLimits(db, teamId)
  const now = new Date()
  const row = limits.personal ? null : await findSubscription(db, { teamId })
  const state: PlanState = limits.personal ? { status: 'free', ends_at: null, trial_available: false, ended: null } : stateOf(row, now)
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
    await recordMetric(db, 'trial_started', input.plan)
    return
  }
  if (!isUserPlan(input.plan) || !isPaidPlan(input.plan)) throw new ServiceError('INVALID', 'Plan no válido para una persona.')
  const inserted = await db
    .insert(subscriptions)
    .values({ user_id: userId, plan: input.plan, status: 'trialing', ends_at: addDays(TRIAL_DAYS), provider: 'trial' })
    .onConflictDoNothing()
    .returning({ id: subscriptions.id })
  if (inserted.length === 0) throw new ServiceError('CONFLICT', 'Ya has usado tu prueba gratuita o tienes un plan.')
  await recordMetric(db, 'trial_started', input.plan)
}

/** Nombre legible del dueño para el registro de auditoría: el correo de la persona o `equipo:<id>`. */
async function ownerLabel(db: Db, owner: Owner): Promise<string> {
  if ('teamId' in owner) return `equipo:${owner.teamId}`
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, owner.userId))
  return u?.email ?? owner.userId
}

/**
 * Concede un plan de pago (lo usa el operador desde `scripts/plan.mjs` y, más adelante, el webhook del proveedor
 * de pagos). `days = null` deja el plan sin caducidad. Sustituye cualquier suscripción o prueba anterior.
 * Queda anotado quién lo concedió (`actor`).
 */
export async function grantPlan(db: Db, owner: Owner, plan: PlanId, opts: { days?: number | null; provider?: string; providerRef?: string; actor?: string } = {}) {
  if (!(plan in PLANS)) throw new ServiceError('INVALID', 'Plan desconocido.')
  if ('teamId' in owner && !isTeamPlan(plan)) throw new ServiceError('INVALID', 'Ese plan es personal, no de equipo.')
  if ('userId' in owner && !isUserPlan(plan)) throw new ServiceError('INVALID', 'Ese plan es de equipo, no personal.')
  const endsAt = opts.days == null ? null : addDays(opts.days)
  const values = {
    plan,
    status: 'active',
    ends_at: endsAt,
    provider: opts.provider ?? 'manual',
    provider_ref: opts.providerRef ?? null,
    updated_at: new Date().toISOString(),
  }
  if ('userId' in owner) {
    await db.insert(subscriptions).values({ user_id: owner.userId, ...values }).onConflictDoUpdate({ target: subscriptions.user_id, targetWhere: sql`${subscriptions.user_id} is not null`, set: values })
  } else {
    await db.insert(subscriptions).values({ team_id: owner.teamId, ...values }).onConflictDoUpdate({ target: subscriptions.team_id, targetWhere: sql`${subscriptions.team_id} is not null`, set: values })
  }
  await db.insert(planAudit).values({ actor: opts.actor ?? 'system', action: 'grant', owner: await ownerLabel(db, owner), plan, ends_at: endsAt })
  await recordMetric(db, 'plan_granted', plan)
}

/** Quita el plan (o la prueba) de un dueño. Vuelve a los límites gratuitos y, al desaparecer la fila, podría volver a probar. */
export async function revokePlan(db: Db, owner: Owner, opts: { actor?: string } = {}): Promise<boolean> {
  const label = await ownerLabel(db, owner)
  const where = 'userId' in owner ? eq(subscriptions.user_id, owner.userId) : eq(subscriptions.team_id, owner.teamId)
  const removed = await db.delete(subscriptions).where(where).returning({ plan: subscriptions.plan })
  if (removed.length === 0) return false
  await db.insert(planAudit).values({ actor: opts.actor ?? 'system', action: 'revoke', owner: label, plan: removed[0].plan })
  await recordMetric(db, 'plan_revoked', removed[0].plan)
  return true
}
